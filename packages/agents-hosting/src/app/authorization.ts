/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { TurnContext } from '../turnContext'
import { debug } from '@microsoft/agents-activity/logger'
import { TurnState } from './turnState'
import { MemoryStorage, Storage } from '../storage'
import { FlowState, OAuthFlow, TokenResponse, UserTokenClient } from '../oauth'
import { AuthConfiguration, loadAuthConfigFromEnv, MsalTokenProvider } from '../auth'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { Activity } from '@microsoft/agents-activity'

const logger = debug('agents:authorization')

/**
 * Represents the response from beginning or continuing an OAuth flow.
 * @interface BeginOrContinueFlowResponse
 */
export interface BeginOrContinueFlowResponse extends TokenResponse {
  handler?: SignInHandlerState
}

/**
 * Represents the state of a sign-in process.
 * @interface SignInHandlerState
 */
export interface SignInHandlerState {
  /** Identifier of the auth handler being used. */
  id: string,
  /**
   * Current status of the sign-in process.
   * @remarks
   * Order of execution: begin -> continue -> success
   *
   * - **begin**: [begin] Initial state, no flow started.
   * - **continue**: [continue] OAuth flow has started, waiting for user interaction.
   * - **success**: [auth success] OAuth flow success, token available.
   * - **failure**: [auth failure] OAuth flow failure, no token available. Removed from storage.
  */
  status: 'begin' | 'continue' | 'success' | 'failure'
  /** Optional state of the OAuth flow, if applicable. */
  state?: FlowState
  /** Optional activity to continue with after sign-in completion. */
  continuationActivity?: Activity
}

/**
 * Interface defining an authorization handler for OAuth flows.
 * @interface AuthHandler
 */
export interface AuthHandler {
  /** Connection name for the auth provider. */
  name?: string,
  /** The OAuth flow implementation. */
  flow?: OAuthFlow,
  /** Title to display on auth cards/UI. */
  title?: string,
  /** Text to display on auth cards/UI. */
  text?: string,

  cnxPrefix?: string
}

/**
 * Options for configuring user authorization.
 * Contains settings to configure OAuth connections.
 * @interface AuthorizationHandlers
 */
export interface AuthorizationHandlers extends Record<string, AuthHandler> {}

/**
 * Class responsible for managing authorization and OAuth flows.
 * Handles multiple OAuth providers and manages the complete authentication lifecycle.
 *
 * @remarks
 * The Authorization class provides a centralized way to handle OAuth authentication
 * flows within the agent application. It supports multiple authentication handlers,
 * token exchange, on-behalf-of flows, and provides event handlers for success/failure scenarios.
 *
 * Key features:
 * - Multiple OAuth provider support
 * - Token caching and exchange
 * - On-behalf-of (OBO) token flows
 * - Sign-in success/failure event handling
 * - Automatic configuration from environment variables
 *
 * @example
 * ```typescript
 * const auth = new Authorization(storage, {
 *   'microsoft': {
 *     name: 'Microsoft',
 *     title: 'Sign in with Microsoft',
 *     text: 'Please sign in'
 *   }
 * });
 *
 * auth.onSignInSuccess(async (context, state) => {
 *   await context.sendActivity('Welcome! You are now signed in.');
 * });
 * ```
 *
 */
export class Authorization {
  /**
   * Private handler for successful sign-in events.
   * @private
   */
  private _signInSuccessHandler: Parameters<Authorization['onSignInSuccess']>[0] | null = null

  /**
   * Private handler for failed sign-in events.
   * @private
   */
  private _signInFailureHandler: Parameters<Authorization['onSignInFailure']>[0] | null = null
  /**
   * Storage instance used for managing sign-in state.
   * @private
   */
  private _signInStorage: SignInStorage

  /**
   * Dictionary of configured authentication handlers.
   * @public
   */
  authHandlers: AuthorizationHandlers

  /**
   * Creates a new instance of Authorization.
   *
   * @remarks
   * The constructor initializes all configured auth handlers and sets up OAuth flows.
   * It automatically configures handler properties from environment variables if not provided:
   * - Connection name: {handlerId}_connectionName
   * - Connection title: {handlerId}_connectionTitle
   * - Connection text: {handlerId}_connectionText
   *
   * @example
   * ```typescript
   * const auth = new Authorization(storage, {
   *   'microsoft': {
   *     name: 'Microsoft',
   *     title: 'Sign in with Microsoft'
   *   },
   *   'google': {
   *     // Will use GOOGLE_connectionName from env vars
   *   }
   * });
   * ```
   *
   * @param storage - The storage system to use for state management.
   * @param authHandlers - Configuration for OAuth providers.
   * @throws {Error} If storage is null/undefined or no auth handlers are provided.
   *
   */
  constructor (private storage: Storage, authHandlers: AuthorizationHandlers, userTokenClient: UserTokenClient) {
    if (storage === undefined || storage === null) {
      throw new Error('Storage is required for UserAuthorization')
    }
    if (authHandlers === undefined || Object.keys(authHandlers).length === 0) {
      throw new Error('The authorization does not have any auth handlers')
    }
    this.authHandlers = authHandlers
    for (const ah in this.authHandlers) {
      if (this.authHandlers![ah].name === undefined && process.env[ah + '_connectionName'] === undefined) {
        throw new Error(`AuthHandler name ${ah}_connectionName not set in autorization and not found in env vars.`)
      }
      const currentAuthHandler = this.authHandlers![ah]
      currentAuthHandler.name = currentAuthHandler.name ?? process.env[ah + '_connectionName'] as string
      currentAuthHandler.title = currentAuthHandler.title ?? process.env[ah + '_connectionTitle'] as string
      currentAuthHandler.text = currentAuthHandler.text ?? process.env[ah + '_connectionText'] as string
      currentAuthHandler.cnxPrefix = currentAuthHandler.cnxPrefix ?? process.env[ah + '_cnxPrefix'] as string
      // Intentionally use MemoryStorage for OAuthFlow: persistent storage for OAuth state is managed separately by the Authorization class.
      // This avoids mixing persistent and in-memory state; OAuthFlow only needs in-memory storage for its internal state.
      currentAuthHandler.flow = new OAuthFlow(new MemoryStorage(), currentAuthHandler.name, userTokenClient, currentAuthHandler.title, currentAuthHandler.text)
    }
    logger.info('Authorization handlers configured with', Object.keys(this.authHandlers).length, 'handlers')
    this._signInStorage = new SignInStorage(this.storage, this.authHandlers)
  }

  /**
   * Creates a sign-in context for managing OAuth flows.
   *
   * @param context - The context object for the current turn.
   * @param handlerId - Optional ID of the auth handler to use.
   * @param useStorageState - Whether to use storage state for the sign-in handler. Defaults to true.
   * @private
   */
  private createSignInContext (context: TurnContext, handlerId?: string, useStorageState: boolean = true): SignInContext {
    return new SignInContext(this._signInStorage, this.authHandlers, context, handlerId, useStorageState)
  }

  /**
   * Gets the token for a specific auth handler.
   *
   * @param context - The context object for the current turn.
   * @param authHandlerId - ID of the auth handler to use.
   * @returns A promise that resolves to the token response from the OAuth provider.
   *
   * @remarks
   * This method retrieves an existing token for the specified auth handler.
   * The token may be cached and will be retrieved from the OAuth provider if needed.
   *
   * @example
   * ```typescript
   * const tokenResponse = await auth.getToken(context, 'microsoft');
   * if (tokenResponse.token) {
   *   console.log('User is authenticated');
   * }
   * ```
   *
   * @public
   */
  public getToken (context: TurnContext, authHandlerId: string): Promise<TokenResponse> {
    const signInContext = this.createSignInContext(context, authHandlerId)
    return signInContext.getUserToken()
  }

  /**
   * Exchanges a token for a new token with different scopes.
   *
   * @param context - The context object for the current turn.
   * @param scopes - Array of scopes to request for the new token.
   * @param authHandlerId - ID of the auth handler to use.
   * @returns A promise that resolves to the exchanged token response.
   *
   * @remarks
   * This method handles token exchange scenarios, particularly for on-behalf-of (OBO) flows.
   * It checks if the current token is exchangeable (e.g., has audience starting with 'api://')
   * and performs the appropriate token exchange using MSAL.
   *
   * @example
   * ```typescript
   * const exchangedToken = await auth.exchangeToken(
   *   context,
   *   ['https://graph.microsoft.com/.default'],
   *   'microsoft'
   * );
   * ```
   *
   * @public
   */
  public exchangeToken (context: TurnContext, scopes: string[], authHandlerId: string): Promise<TokenResponse> {
    const signInContext = this.createSignInContext(context, authHandlerId)
    return signInContext.exchangeToken(scopes)
  }

  /**
   * Begins or continues an OAuth flow.
   *
   * @param context - The context object for the current turn.
   * @param state - The state object for the current turn.
   * @param authHandlerId - ID of the auth handler to use.
   * @param useStorageState - Whether to use storage state for the sign-in handler. Defaults to true.
   * @returns A promise that resolves to the token response from the OAuth provider.
   *
   * @remarks
   * This method manages the complete OAuth authentication flow:
   * - If no flow is active, it begins a new OAuth flow and shows the sign-in card
   * - If a flow is active, it continues the flow and processes the authentication response
   * - Handles success/failure callbacks and updates the sign-in state accordingly
   *
   * The method automatically manages the sign-in state and continuation activities,
   * allowing the conversation to resume after successful authentication.
   *
   * @example
   * ```typescript
   * const tokenResponse = await auth.beginOrContinueFlow(context, state, 'microsoft');
   * if (tokenResponse && tokenResponse.token) {
   *   // User is now authenticated
   *   await context.sendActivity('Authentication successful!');
   * }
   * ```
   *
   * @public
   */
  public async beginOrContinueFlow (context: TurnContext, state: TurnState, authHandlerId?: string, useStorageState: boolean = true) : Promise<BeginOrContinueFlowResponse> {
    const signInContext = this.createSignInContext(context, authHandlerId, useStorageState)
    signInContext.onSuccess(() => this._signInSuccessHandler?.(context, state, signInContext.handler.id))
    signInContext.onFailure((err) => this._signInFailureHandler?.(context, state, signInContext.handler.id, err))

    const tokenResponse = await signInContext.getToken()
    return { token: tokenResponse?.token, handler: signInContext.handler }
  }

  /**
   * Signs out the current user.
   *
   * @param context - The context object for the current turn.
   * @param state - The state object for the current turn.
   * @param authHandlerId - Optional ID of the auth handler to use for sign out. If not provided, signs out from all handlers.
   * @returns A promise that resolves when sign out is complete.
   *
   * @remarks
   * This method clears the user's token and resets the authentication state.
   * If no specific authHandlerId is provided, it signs out from all configured handlers.
   * This ensures complete cleanup of authentication state across all providers.
   *
   * @example
   * ```typescript
   * // Sign out from specific handler
   * await auth.signOut(context, state, 'microsoft');
   *
   * // Sign out from all handlers
   * await auth.signOut(context, state);
   * ```
   *
   * @public
   */
  async signOut (context: TurnContext, state: TurnState, authHandlerId?: string) : Promise<void> {
    if (authHandlerId?.trim()) {
      const signInContext = this.createSignInContext(context, authHandlerId)
      return signInContext?.signOut()
    }

    for (const id in this.authHandlers) {
      const signInContext = this.createSignInContext(context, id)
      await signInContext?.signOut()
    }
  }

  /**
   * Sets a handler to be called when sign-in is successfully completed.
   *
   * @param handler - The handler function to call on successful sign-in.
   *
   * @remarks
   * This method allows you to register a callback that will be invoked whenever
   * a user successfully completes the authentication process. The handler receives
   * the turn context, state, and the ID of the auth handler that was used.
   *
   * @example
   * ```typescript
   * auth.onSignInSuccess(async (context, state, authHandlerId) => {
   *   await context.sendActivity(`Welcome! You signed in using ${authHandlerId}.`);
   *   // Perform any post-authentication setup
   * });
   * ```
   *
   * @public
   */
  public onSignInSuccess (handler: (context: TurnContext, state: TurnState, authHandlerId?: string) => Promise<void> | void) {
    this._signInSuccessHandler = handler
  }

  /**
   * Sets a handler to be called when sign-in fails.
   *
   * @param handler - The handler function to call on sign-in failure.
   *
   * @remarks
   * This method allows you to register a callback that will be invoked whenever
   * a user's authentication attempt fails. The handler receives the turn context,
   * state, auth handler ID, and an optional error message describing the failure.
   *
   * Common failure scenarios include:
   * - User cancels the authentication process
   * - Invalid credentials or expired tokens
   * - Network connectivity issues
   * - OAuth provider errors
   *
   * @example
   * ```typescript
   * auth.onSignInFailure(async (context, state, authHandlerId, errorMessage) => {
   *   await context.sendActivity(`Sign-in failed: ${errorMessage || 'Unknown error'}`);
   *   await context.sendActivity('Please try signing in again.');
   * });
   * ```
   *
   * @public
   */
  public onSignInFailure (handler: (context: TurnContext, state: TurnState, authHandlerId?: string, errorMessage?: string) => Promise<void> | void) {
    this._signInFailureHandler = handler
  }
}

/**
 * Context for managing sign-in operations.
 * Handles the OAuth flow, token retrieval, and sign-out operations.
 *
 * @remarks
 * The SignInContext class provides methods to manage the OAuth flow lifecycle,
 * including starting, continuing, and completing the sign-in process.
 * It also supports token exchange and sign-out operations.
 *
 * Key features:
 * - Handles OAuth flow state management
 * - Provides methods for token retrieval and exchange
 * - Supports sign-out operations
 * - Allows custom success/failure handlers
 */
class SignInContext {
  private _onSuccessHandler: Parameters<SignInContext['onSuccess']>[0] = undefined
  private _onFailureHandler: Parameters<SignInContext['onFailure']>[0] = undefined
  private _authHandler: AuthHandler = {}
  private _handler: SignInHandlerState | undefined = undefined

  /** Current sign-in handler state. */
  get handler (): SignInHandlerState {
    if (!this._handler) {
      throw new Error('SignInContext handler is not initialized. Call loadHandler() first.')
    }
    return this._handler
  }

  /** Logger for the sign-in context, prepends handler ID to log messages. */
  logger = {
    info: (msg: string, ...args: any[]) => logger.info(`[handler:${this.handler.id}] ${msg}`, ...args),
    warn: (msg: string, ...args: any[]) => logger.warn(`[handler:${this.handler.id}] ${msg}`, ...args),
    error: (msg: string, ...args: any[]) => logger.error(`[handler:${this.handler.id}] ${msg}`, ...args),
    debug: (msg: string, ...args: any[]) => logger.debug(`[handler:${this.handler.id}] ${msg}`, ...args)
  }

  /**
   * Creates a new instance of SignInContext.
   *
   * @param storage - The storage system to use for sign-in state management.
   * @param authHandler - Dictionary of configured authentication handlers.
   * @param context - The TurnContext for the current turn.
   * @param handlerId - ID of the auth handler to use.
   * @param useStorageState - Whether to use storage state for the sign-in handler. Defaults to true.
   */
  constructor (public storage: SignInStorage, private authHandlers: AuthorizationHandlers, private context: TurnContext, private handlerId?: string, private useStorageState: boolean = true) {
    if (!useStorageState && !handlerId) {
      throw new Error('Cannot begin or continue OAuth flow without handlerId when useStorageState is false.')
    }

    if (!context?.activity || typeof context.activity !== 'object') {
      throw new Error('TurnContext.Activity is required for SignInContext')
    }

    if (useStorageState) {
      storage.setKey(context)
    }
  }

  /**
   * Sets the handler to be called when sign-in is successful.
   * @param handler - The handler function to call on sign-in success.
   */
  onSuccess (handler: (() => Promise<void> | void) | undefined = undefined) {
    this._onSuccessHandler = handler
  }

  /**
   * Sets the handler to be called when sign-in fails.
   * @param handler - The handler function to call on sign-in failure.
   */
  onFailure (handler: ((err:string) => Promise<void> | void) | undefined = undefined) {
    this._onFailureHandler = handler
  }

  /**
   * Retrieves the user token from the current sign-in handler.
   * @returns A promise that resolves to the token response.
   * @remarks
   * This method loads the handler state and retrieves the user token from the OAuth flow.
   * It is used to get the current user's authentication token after a successful sign-in.
   */
  async getUserToken (): Promise<TokenResponse> {
    if (!(await this.loadHandler())) {
      return { token: undefined }
    }
    this.logger.info('Getting token from user token service.')
    return this._authHandler.flow!.getUserToken(this.context)
  }

  /**
   * Exchanges the current user token for a new token with specified scopes.
   * @param scopes - Array of scopes to request for the new token.
   * @returns A promise that resolves to the exchanged token response.
   * @remarks
   * This method checks if the current token is exchangeable (e.g., has audience starting with 'api://')
   * and performs the appropriate token exchange using MSAL.
   */
  async exchangeToken (scopes: string[]): Promise<TokenResponse> {
    if (!(await this.loadHandler())) {
      return { token: undefined }
    }
    this.logger.info('Exchanging token from user token service.')
    const tokenResponse = await this._authHandler.flow!.getUserToken(this.context)
    if (this.isExchangeable(tokenResponse.token)) {
      return await this.handleObo(tokenResponse.token!, scopes)
    }
    return tokenResponse
  }

  /**
   * Signs out the user from the current OAuth flow.
   * @returns {Promise<void>} A promise that resolves when sign out is complete.
   * @remarks
   * This method clears the user's token and resets the authentication state.
   * It also removes the handler state from storage if `useStorageState` is true.
   */
  async signOut (): Promise<void> {
    if (!(await this.loadHandler())) {
      return
    }

    this.logger.info('Signing out from the authorization flow.')
    if (this.useStorageState) {
      await this.storage.handler.delete(this.handler.id)
    }
    return this._authHandler.flow?.signOut(this.context)
  }

  /**
   * Retrieves the token for the current sign-in handler.
   * @returns {Promise<TokenResponse | undefined>} A promise that resolves to the token response if available, or undefined if not.
   * @remarks
   * This method processes the OAuth flow based on the current handler status:
   * - If the status is 'begin', it starts a new OAuth flow.
   * - If the status is 'continue', it continues the existing flow.
   * - If the status is 'success', it retrieves the user token.
   * - If the status is 'failure', it handles the failure case.
   */
  async getToken (): Promise<TokenResponse | undefined> {
    if (!(await this.loadHandler())) {
      return { token: undefined }
    }

    this.logger.debug('Processing authorization flow.')
    this.logger.debug(`Uses Storage state: ${this.useStorageState}`)
    this.logger.debug('Current sign-in state:', this.handler)

    const tokenResponse: TokenResponse | undefined = await {
      begin: this.begin,
      continue: this.continue,
      success: this.success,
      failure: this.failure
    }[this.handler.status].bind(this)()

    this.logger.debug('OAuth flow result:', { token: tokenResponse?.token, state: this.handler })
    return tokenResponse
  }

  /**
   * Sets the current status of the sign-in handler.
   * @param status - The new status to set.
   * @returns The updated SignInHandlerState.
   * @remarks
   * This method updates the handler's state information based on the provided status.
   * @private
   */
  private setStatus (status: SignInHandlerState['status']): SignInHandlerState {
    const states: Record<SignInHandlerState['status'], () => SignInHandlerState> = {
      begin: () => ({
        id: this.handlerId ?? '',
        status,
      }),
      continue: () => ({
        ...this.handler,
        status,
        state: this._authHandler.flow?.state,
        continuationActivity: this.context.activity
      }),
      success: () => ({
        ...this.handler,
        status,
        state: undefined
      }),
      failure: () => ({
        ...this.handler,
        status,
        state: this._authHandler.flow?.state
      })
    }
    this._handler = states[status]()
    return this.handler
  }

  /**
   * Loads the current handler state from storage or initializes it.
   * If the flow has already started and `useStorageState` is false, it uses the existing state.
   * If no active flow state is found, it starts a new OAuth flow.
   * @returns {Promise<boolean>} A promise that resolves to true if the handler was successfully loaded or initialized, false otherwise.
   * @private
   */
  private async loadHandler (): Promise<boolean> {
    if (this.useStorageState) {
      this._handler = this.handlerId ? await this.storage.handler.get(this.handlerId) : await this.storage.handler.active()
    }

    if (!this._handler) {
      this._handler = this.setStatus('begin')
    }

    // If no active handler ID is set, cannot proceed.
    if (!this.handler.id) {
      return false
    }

    this._authHandler = this.getAuthHandlerOrThrow(this.handler.id)

    if (!this.useStorageState && this._authHandler.flow?.state?.flowStarted === true) {
      this.setStatus('success')
      this.logger.debug('OAuth flow success, using existing state.')
      return true
    }

    if (this.handler.status === 'begin') {
      this.logger.debug('No active flow state, starting a new OAuth flow.')
      await this._authHandler.flow?.signOut(this.context)
    } else {
      // Sync auth and active handler flow state.
      // If there is not active handler state, reset.
      await this._authHandler.flow?.setFlowState(this.context, this.handler.state ?? {} as FlowState)
    }

    return true
  }

  /**
   * Begins the OAuth flow by starting the sign-in process.
   * @returns {Promise<undefined>} A promise that resolves when the flow has started.
   * @private
   */
  private async begin (): Promise<undefined> {
    this.logger.debug('Beginning OAuth flow.')
    await this._authHandler.flow?.beginFlow(this.context)
    this.logger.debug('OAuth flow started, waiting on continuation ...')
    this.setStatus('continue')
    if (this.useStorageState) {
      await this.storage.handler.set(this.handler)
    }
  }

  /**
   * Continues the OAuth flow after user interaction.
   * @returns {Promise<TokenResponse | undefined>} A promise that resolves to the token response if successful, or undefined if not.
   * @private
   */
  private async continue (): Promise<TokenResponse | undefined> {
    this.logger.debug('Continuing OAuth flow.')
    const tokenResponse = await this._authHandler.flow?.continueFlow(this.context)
    if (tokenResponse?.token?.trim()) {
      this.setStatus('success')
      this.logger.debug('OAuth flow success.')
      if (this.useStorageState) {
        await this.storage.handler.set(this.handler)
      }
      if (this._onSuccessHandler) {
        await this._onSuccessHandler()
      }
    } else {
      await this.failure()
    }

    return tokenResponse
  }

  /**
   * Retrieves the user token after a successful OAuth flow.
   * @returns {Promise<TokenResponse | undefined>} A promise that resolves to the token response if successful, or undefined if not.
   * @private
   */
  private async success (): Promise<TokenResponse | undefined> {
    const tokenResponse = await this._authHandler.flow?.getUserToken(this.context)
    if (this.useStorageState && tokenResponse?.token?.trim()) {
      this.logger.debug('OAuth flow success, retrieving token.')
      return tokenResponse
    } else {
      this.logger.debug('OAuth flow token not available, waiting on continuation ...')
      return this.continue()
    }
  }

  /**
   * Handles the failure case of the OAuth flow.
   * @returns {Promise<undefined>} A promise that resolves when the failure handling is complete.
   * @private
   */
  private async failure (): Promise<undefined> {
    this.setStatus('failure')

    let errors = { reason: 'token was not received', reset: false }
    if (!this.handler.continuationActivity) {
      errors = { reason: 'no continuation activity available', reset: true }
    } else if (!this.handler.continuationActivity.conversation || !this.context.activity.conversation) {
      errors = { reason: 'conversation missing during the continuation flow', reset: true }
    } else if (this.handler.continuationActivity.conversation.id !== this.context.activity.conversation.id) {
      errors = { reason: 'conversation changed during the continuation flow', reset: true }
    } else if (!this.handler.state?.flowStarted) {
      errors = { reason: 'flow was restarted', reset: true }
    }

    const message = `Failed to complete OAuth flow due to ${errors.reason}.`
    this.logger.warn(message)

    if (errors.reset) {
      await this._authHandler.flow?.signOut(this.context)
      if (this.useStorageState) {
        await this.storage.handler.delete(this.handler.id)
      }
    }

    if (this._onFailureHandler) {
      await this._onFailureHandler(message)
    }
  }

  /**
   * Checks if a token is exchangeable for an on-behalf-of flow.
   *
   * @param token - The token to check.
   * @returns True if the token is exchangeable, false otherwise.
   * @private
   */
  private isExchangeable (token: string | undefined): boolean {
    if (!token || typeof token !== 'string') {
      return false
    }
    const payload = jwt.decode(token) as JwtPayload
    return payload?.aud?.indexOf('api://') === 0
  }

  /**
   * Handles on-behalf-of token exchange using MSAL.
   *
   * @param token - The token to exchange.
   * @param scopes - Array of scopes to request for the new token.
   * @returns A promise that resolves to the exchanged token response.
   * @private
   */
  private async handleObo (token: string, scopes: string[]): Promise<TokenResponse> {
    const msalTokenProvider = new MsalTokenProvider()
    let authConfig: AuthConfiguration = this.context.adapter.authConfig
    if (this._authHandler.cnxPrefix) {
      authConfig = loadAuthConfigFromEnv(this._authHandler.cnxPrefix)
    }
    const newToken = await msalTokenProvider.acquireTokenOnBehalfOf(authConfig, scopes, token)
    return { token: newToken }
  }

  /**
   * Gets the auth handler by ID or throws an error if not found.
   *
   * @param handlerId - ID of the auth handler to retrieve.
   * @returns The auth handler instance.
   * @throws {Error} If the auth handler with the specified ID is not configured.
   * @private
   */
  private getAuthHandlerOrThrow (handlerId: string): AuthHandler {
    if (!Object.prototype.hasOwnProperty.call(this.authHandlers, handlerId)) {
      throw new Error(`AuthHandler with ID ${handlerId} not configured`)
    }
    return this.authHandlers[handlerId]
  }
}

class SignInStorage {
  private _baseKey: string = ''
  private _handlerKeys: string[] = []

  /**
   * Creates a new instance of SignInStorage.
   *
   * @param storage - The storage system to use for sign-in state management.
   * @param handlers - Dictionary of configured authentication handlers.
   * @throws {Error} If storage is null/undefined.
   */
  constructor (private storage: Storage, private handlers?: Record<string, AuthHandler>) {
    if (!storage) {
      throw new Error('Storage is required')
    }
  }

  /**
   * Creates a storage key for a specific sign-in handler.
   *
   * @param id - The ID of the sign-in handler.
   * @returns The storage key for the sign-in handler.
   * @throws {Error} If the base key is not set.
   * @remarks
   * This method generates a unique storage key for the specified sign-in handler by appending its ID to the base key.
   */
  private createKey (id: string): string {
    if (!this._baseKey?.trim()) {
      throw new Error('Base key is not set, make sure to call setKey() first.')
    }
    return `${this._baseKey}/${id}`
  }

  /**
   * Sets the base key for sign-in handler storage.
   *
   * @param context - The TurnContext for the current turn.
   * @throws {Error} If 'channelId' or 'from.id' properties are not set in the activity.
   * @remarks
   * This method sets the base key for all sign-in handler states based on the channel and user ID.
   * It is typically called at the beginning of a turn to ensure the correct context is used for storage.
   */
  setKey (context: TurnContext) {
    const channelId = context?.activity.channelId
    const userId = context?.activity.from?.id
    if (!channelId || !userId) {
      throw new Error('Activity \'channelId\' and \'from.id\' properties must be set.')
    }
    this._baseKey = `auth/${channelId}/${userId}`
    this._handlerKeys = Object.keys(this.handlers ?? {}).map(e => this.createKey(e))
  }

  /**
   * Gets the sign-in handler for the current context.
   *
   * @returns An object containing methods to manage sign-in handler states.
   * @remarks
   * This method provides access to the sign-in handler state management functions,
   * allowing retrieval, setting, and deletion of sign-in handler states in storage.
   */
  handler = {
    /**
     * Retrieves the active sign-in handler state.
     *
     * @returns A promise that resolves to the active sign-in handler state, or undefined if not found.
     * @remarks
     * This method reads all sign-in handler states from storage and returns the first one that is not in 'success' status.
     * It is typically used to check if there is an ongoing OAuth flow that needs to be continued.
     */
    active: async (): Promise<SignInHandlerState | undefined> => {
      const data = await this.storage.read(this._handlerKeys) as Record<string, SignInHandlerState>
      return Object.values(data).find(({ status }) => status !== 'success')
    },

    /**
     * Retrieves a sign-in handler state by its ID.
     *
     * @param id - The ID of the sign-in handler to retrieve.
     * @returns A promise that resolves to the sign-in handler state, or undefined if not found.
     * @remarks
     * This method reads the sign-in handler state from storage using the provided ID.
     * It is typically used to load the current state of an ongoing OAuth flow.
     */
    get: async (id: string): Promise<SignInHandlerState | undefined> => {
      const key = this.createKey(id)
      const data = await this.storage.read([key]) as Record<string, SignInHandlerState>
      return data[key]
    },

    /**
     * Sets a sign-in handler state in storage.
     *
     * @param value - The sign-in handler state to set.
     * @returns A promise that resolves when the state is set.
     * @remarks
     * This method writes the provided sign-in handler state to storage.
     * It is typically used to save the current state of an ongoing OAuth flow.
     */
    set: async (value: SignInHandlerState) => {
      return this.storage.write({ [this.createKey(value.id)]: value })
    },

    /**
     * Deletes a sign-in handler state by its ID.
     *
     * @param id - The ID of the sign-in handler to delete.
     * @returns A promise that resolves when the deletion is complete.
     * @remarks
     * This method removes the specified sign-in handler state from storage.
     * It is typically used to clear the state after a successful sign-out or when the flow is no longer needed.
     */
    delete: async (id: string) => {
      return this.storage.delete([this.createKey(id)])
    }
  }
}
