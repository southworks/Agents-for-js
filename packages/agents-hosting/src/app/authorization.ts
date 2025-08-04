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
 * Example usage:
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
 */
export class Authorization {
  /**
   * Private handler for successful sign-in events.
   * @private
   */
  private _signInSuccessHandler: ((context: TurnContext, state: TurnState, authHandlerId?: string) => Promise<void> | void) | null = null

  /**
   * Private handler for failed sign-in events.
   * @private
   */
  private _signInFailureHandler: ((context: TurnContext, state: TurnState, authHandlerId?: string, errorMessage?: string) => Promise<void> | void) | null = null
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
   * @param storage - The storage system to use for state management.
   * @param authHandlers - Configuration for OAuth providers.
   * @throws {Error} If storage is null/undefined or no auth handlers are provided.
   *
   * @remarks
   * The constructor initializes all configured auth handlers and sets up OAuth flows.
   * It automatically configures handler properties from environment variables if not provided:
   * - Connection name: {handlerId}_connectionName
   * - Connection title: {handlerId}_connectionTitle
   * - Connection text: {handlerId}_connectionText
   *
   * Example usage:
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
      // Add MemoryStorage to OAuthFlow since this class handles the storage state.
      currentAuthHandler.flow = new OAuthFlow(new MemoryStorage(), currentAuthHandler.name, userTokenClient, currentAuthHandler.title, currentAuthHandler.text)
    }
    logger.info('Authorization handlers configured with', Object.keys(this.authHandlers).length, 'handlers')
    this._signInStorage = new SignInStorage(this.storage, this.authHandlers)
  }

  private async createSignInContext (context: TurnContext, authHandlerId?: string, useStorageState: boolean = true): Promise<SignInContext | undefined> {
    if (!useStorageState && !authHandlerId) {
      throw new Error('Cannot begin or continue OAuth flow without authHandlerId when useStorageState is false.')
    }

    if (useStorageState) {
      this._signInStorage.setKey(context)
      const handler = authHandlerId ? await this._signInStorage.getOne(authHandlerId) : await this._signInStorage.getActive()
      authHandlerId = handler?.id ?? authHandlerId
    }

    if (!authHandlerId) {
      return undefined
    }

    return new SignInContext(this._signInStorage, context, authHandlerId, this.authHandlers[authHandlerId], useStorageState)
  }

  /**
   * Gets the token for a specific auth handler.
   *
   * @param context - The context object for the current turn.
   * @param authHandlerId - ID of the auth handler to use.
   * @returns A promise that resolves to the token response from the OAuth provider.
   * @throws {Error} If the auth handler is not configured.
   * @public
   *
   * @remarks
   * This method retrieves an existing token for the specified auth handler.
   * The token may be cached and will be retrieved from the OAuth provider if needed.
   *
   * Example usage:
   * ```typescript
   * const tokenResponse = await auth.getToken(context, 'microsoft');
   * if (tokenResponse.token) {
   *   console.log('User is authenticated');
   * }
   * ```
   */
  public async getToken (context: TurnContext, authHandlerId: string): Promise<TokenResponse> {
    const signInContext = await this.createSignInContext(context, authHandlerId)
    if (!signInContext) {
      throw new Error(`Auth handler '${authHandlerId}' not found or not configured`)
    }
    return signInContext.getUserToken(context)
  }

  /**
   * Exchanges a token for a new token with different scopes.
   *
   * @param context - The context object for the current turn.
   * @param scopes - Array of scopes to request for the new token.
   * @param authHandlerId - ID of the auth handler to use.
   * @returns A promise that resolves to the exchanged token response.
   * @throws {Error} If the auth handler is not configured.
   * @public
   *
   * @remarks
   * This method handles token exchange scenarios, particularly for on-behalf-of (OBO) flows.
   * It checks if the current token is exchangeable (e.g., has audience starting with 'api://')
   * and performs the appropriate token exchange using MSAL.
   *
   * Example usage:
   * ```typescript
   * const exchangedToken = await auth.exchangeToken(
   *   context,
   *   ['https://graph.microsoft.com/.default'],
   *   'microsoft'
   * );
   * ```
   */
  public async exchangeToken (context: TurnContext, scopes: string[], authHandlerId: string): Promise<TokenResponse> {
    const signInContext = await this.createSignInContext(context, authHandlerId)
    if (!signInContext) {
      throw new Error(`Auth handler '${authHandlerId}' not found or not configured`)
    }
    return signInContext.exchangeToken(context, scopes)
  }

  /**
   * Begins or continues an OAuth flow.
   *
   * @param context - The context object for the current turn.
   * @param state - The state object for the current turn.
   * @param authHandlerId - ID of the auth handler to use.
   * @returns A promise that resolves to the token response from the OAuth provider.
   * @throws {Error} If the auth handler is not configured.
   * @public
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
   * Example usage:
   * ```typescript
   * const tokenResponse = await auth.beginOrContinueFlow(context, state, 'microsoft');
   * if (tokenResponse && tokenResponse.token) {
   *   // User is now authenticated
   *   await context.sendActivity('Authentication successful!');
   * }
   * ```
   */
  public async beginOrContinueFlow (context: TurnContext, state: TurnState, authHandlerId?: string, useStorageState: boolean = true) : Promise<BeginOrContinueFlowResponse> {
    const signInContext = await this.createSignInContext(context, authHandlerId, useStorageState)
    if (!signInContext) {
      // No active handler.
      return { handler: undefined, token: undefined }
    }

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
   * @throws {Error} If the specified auth handler is not configured.
   * @public
   *
   * @remarks
   * This method clears the user's token and resets the authentication state.
   * If no specific authHandlerId is provided, it signs out from all configured handlers.
   * This ensures complete cleanup of authentication state across all providers.
   *
   * Example usage:
   * ```typescript
   * // Sign out from specific handler
   * await auth.signOut(context, state, 'microsoft');
   *
   * // Sign out from all handlers
   * await auth.signOut(context, state);
   * ```
   */
  async signOut (context: TurnContext, state: TurnState, authHandlerId?: string) : Promise<void> {
    if (authHandlerId?.trim()) {
      const signInContext = await this.createSignInContext(context, authHandlerId)
      return signInContext?.signOut(context)
    }

    for (const id in this.authHandlers) {
      const signInContext = await this.createSignInContext(context, id)
      await signInContext?.signOut(context)
    }
  }

  /**
   * Sets a handler to be called when sign-in is successfully completed.
   *
   * @param handler - The handler function to call on successful sign-in.
   * @public
   *
   * @remarks
   * This method allows you to register a callback that will be invoked whenever
   * a user successfully completes the authentication process. The handler receives
   * the turn context, state, and the ID of the auth handler that was used.
   *
   * Example usage:
   * ```typescript
   * auth.onSignInSuccess(async (context, state, authHandlerId) => {
   *   await context.sendActivity(`Welcome! You signed in using ${authHandlerId}.`);
   *   // Perform any post-authentication setup
   * });
   * ```
   */
  public onSignInSuccess (handler: (context: TurnContext, state: TurnState, authHandlerId?: string) => Promise<void> | void) {
    this._signInSuccessHandler = handler
  }

  /**
   * Sets a handler to be called when sign-in fails.
   *
   * @param handler - The handler function to call on sign-in failure.
   * @public
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
   * Example usage:
   * ```typescript
   * auth.onSignInFailure(async (context, state, authHandlerId, errorMessage) => {
   *   await context.sendActivity(`Sign-in failed: ${errorMessage || 'Unknown error'}`);
   *   await context.sendActivity('Please try signing in again.');
   * });
   * ```
   */
  public onSignInFailure (handler: (context: TurnContext, state: TurnState, authHandlerId?: string, errorMessage?: string) => Promise<void> | void) {
    this._signInFailureHandler = handler
  }
}

class SignInStorage {
  private _baseKey: string = ''
  private _handlerKeys: string[] = []

  constructor (private storage: Storage, private handlers: Record<string, AuthHandler>) {}

  private createKey (id: string): string {
    if (!this._baseKey.trim()) {
      throw new Error('Base key is not set, make sure to call setKey() first.')
    }
    return `${this._baseKey}/${id}`
  }

  setKey (context: TurnContext) {
    const channelId = context.activity.channelId
    const userId = context.activity.from?.id
    if (!channelId || !userId) {
      throw new Error('Activity \'channelId\' and \'from.id\' properties must be set.')
    }
    this._baseKey = `auth/${channelId}/${userId}`
    this._handlerKeys = Object.keys(this.handlers).map(e => this.createKey(e))
  }

  async getActive (): Promise<SignInHandlerState | undefined> {
    const data = await this.storage.read(this._handlerKeys) as Record<string, SignInHandlerState>
    return Object.values(data).find(({ status }) => status !== 'success')
  }

  async getOne (id: string): Promise<SignInHandlerState | undefined> {
    const key = this.createKey(id)
    const data = await this.storage.read([key]) as Record<string, SignInHandlerState>
    return data[key]
  }

  async setOne (value: SignInHandlerState) {
    return this.storage.write({ [this.createKey(value.id)]: value })
  }

  async deleteOne (id:string) {
    return this.storage.delete([this.createKey(id)])
  }
}

class SignInContext {
  private _onSuccessHandler: (() => Promise<void> | void) | undefined = undefined
  private _onFailureHandler: ((err:string) => Promise<void> | void) | undefined = undefined

  handler: SignInHandlerState
  logger = {
    info: (msg: string, ...args: any[]) => logger.info(`[handler:${this.handler.id}] ${msg}`, ...args),
    warn: (msg: string, ...args: any[]) => logger.warn(`[handler:${this.handler.id}] ${msg}`, ...args),
    error: (msg: string, ...args: any[]) => logger.error(`[handler:${this.handler.id}] ${msg}`, ...args),
    debug: (msg: string, ...args: any[]) => logger.debug(`[handler:${this.handler.id}] ${msg}`, ...args)
  }

  constructor (public storage: SignInStorage, private context: TurnContext, private handlerId: string, private authHandler: AuthHandler, private useStorageState: boolean = true) {
    this.handler = this.setStatus('begin')
  }

  onSuccess (handler: SignInContext['_onSuccessHandler']) {
    this._onSuccessHandler = handler
  }

  onFailure (handler: SignInContext['_onFailureHandler']) {
    this._onFailureHandler = handler
  }

  async getUserToken (context: TurnContext): Promise<TokenResponse> {
    this.logger.info('Getting token from user token service.')
    await this.loadHandler()
    return this.authHandler.flow!.getUserToken(context)
  }

  async exchangeToken (context: TurnContext, scopes: string[]): Promise<TokenResponse> {
    this.logger.info('Exchanging token from user token service.')
    const tokenResponse = await this.getUserToken(context)
    if (this.isExchangeable(tokenResponse.token)) {
      return await this.handleObo(context, tokenResponse.token!, scopes)
    }
    return tokenResponse
  }

  async signOut (context: TurnContext): Promise<void> {
    this.logger.info('Signing out from the authorization flow.')
    if (this.useStorageState) {
      await this.storage.deleteOne(this.handlerId)
    }
    return this.authHandler.flow?.signOut(context)
  }

  async getToken (): Promise<TokenResponse | undefined> {
    await this.loadHandler()

    this.logger.debug('Processing authorization flow.')
    this.logger.debug(`Uses Storage state: ${this.useStorageState}`)
    this.logger.debug('Current sign-in state:', this.handler)

    const tokenResponse: TokenResponse | undefined = await {
      begin: this.begin,
      continue: this.continue,
      success: this.success,
      failure: () => undefined
    }[this.handler.status].bind(this)()

    this.logger.debug('OAuth flow result:', { token: tokenResponse?.token, state: this.handler })
    return tokenResponse
  }

  private setStatus (status: SignInHandlerState['status']): SignInHandlerState {
    const states: Record<SignInHandlerState['status'], () => SignInHandlerState> = {
      begin: () => ({
        id: this.handlerId,
        status,
      }),
      continue: () => ({
        id: this.handlerId,
        status,
        state: this.authHandler.flow?.state,
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
        state: this.authHandler.flow?.state
      })
    }
    this.handler = states[status]()
    return this.handler
  }

  private async loadHandler (): Promise<void> {
    this.handler = await this.storage.getOne(this.handler.id) ?? this.handler

    if (!this.useStorageState && this.authHandler.flow?.state?.flowStarted === true) {
      this.setStatus('success')
      this.logger.debug('OAuth flow success, using existing state.')
      return
    }

    if (this.handler.status === 'begin') {
      this.logger.debug('No active flow state, starting a new OAuth flow.')
      await this.authHandler.flow?.signOut(this.context)
    } else {
      // Sync auth and active handler flow state.
      // If there is not active handler state, reset.
      await this.authHandler.flow?.setFlowState(this.context, this.handler.state ?? {} as FlowState)
    }
  }

  private async begin (): Promise<undefined> {
    this.logger.debug('Beginning OAuth flow.')
    await this.authHandler.flow?.beginFlow(this.context)
    this.logger.debug('OAuth flow started, waiting on continuation ...')
    this.setStatus('continue')
    if (this.useStorageState) {
      await this.storage.setOne(this.handler)
    }
  }

  private async continue (): Promise<TokenResponse | undefined> {
    this.logger.debug('Continuing OAuth flow.')
    const tokenResponse = await this.authHandler.flow?.continueFlow(this.context)
    if (tokenResponse?.token?.trim()) {
      this.setStatus('success')
      this.logger.debug('OAuth flow success.')
      if (this.useStorageState) {
        await this.storage.setOne(this.handler)
      }
      if (this._onSuccessHandler) {
        await this._onSuccessHandler()
      }
    } else {
      await this.failure()
    }

    return tokenResponse
  }

  private async success () {
    const tokenResponse = await this.authHandler.flow?.getUserToken(this.context)
    if (this.useStorageState && tokenResponse?.token?.trim()) {
      this.logger.debug('OAuth flow success, retrieving token.')
      return tokenResponse
    } else {
      this.logger.debug('OAuth flow token not available, waiting on continuation ...')
      return this.continue()
    }
  }

  private async failure (): Promise<undefined> {
    this.setStatus('failure')

    let errors = { reason: 'token was not received', reset: false }
    if (!this.handler.continuationActivity) {
      errors = { reason: 'no continuation activity available', reset: true }
    } else if (this.handler.continuationActivity?.conversation?.id !== this.context.activity.conversation?.id) {
      errors = { reason: 'conversation changed during the continuation flow', reset: true }
    } else if (!this.handler.state?.flowStarted) {
      errors = { reason: 'flow was restarted', reset: true }
    }

    const message = `Failed to complete OAuth flow due to ${errors.reason}.`
    this.logger.warn(message)

    if (errors.reset) {
      await this.authHandler.flow?.signOut(this.context)
      if (this.useStorageState) {
        await this.storage.deleteOne(this.handler.id)
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
   * @param context - The context object for the current turn.
   * @param token - The token to exchange.
   * @param scopes - Array of scopes to request for the new token.
   * @returns A promise that resolves to the exchanged token response.
   * @private
   */
  private async handleObo (context: TurnContext, token: string, scopes: string[]): Promise<TokenResponse> {
    const msalTokenProvider = new MsalTokenProvider()
    let authConfig: AuthConfiguration = context.adapter.authConfig
    if (this.authHandler.cnxPrefix) {
      authConfig = loadAuthConfigFromEnv(this.authHandler.cnxPrefix)
    }
    const newToken = await msalTokenProvider.acquireTokenOnBehalfOf(authConfig, scopes, token)
    return { token: newToken }
  }
}
