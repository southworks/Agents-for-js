/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { debug } from '@microsoft/agents-activity/logger'
import { Guard, GuardRegisterOptions } from './types'
import { MessageFactory } from '../../messageFactory'
import { CardFactory } from '../../cards'
import { TurnContext } from '../../turnContext'
import { TokenExchangeRequest, UserTokenClient } from '../../oauth'
import { loadAuthConfigFromEnv, MsalTokenProvider } from '../../auth'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { RouteSelector } from '../routing/routeSelector'
import { AgentApplication } from '../agentApplication'
import { GuardStorage } from './guardStorage'

const logger = debug('agents:guards:authorization')

/**
 * Context data for authorization guards.
 */
export interface AuthorizationGuardContext {
  token: string
}

/**
 * Interface for token verification state.
 */
export interface TokenVerifyState {
  state: string
}

/**
 * Interface defining an authorization guard configuration.
 */
export interface AuthorizationGuardSettings {
  /**
   * Connection name for the auth provider.
   */
  name?: string,
  /**
   * Title to display on auth cards/UI.
   */
  title?: string,
  /**
   * Text to display on auth cards/UI.
   */
  text?: string,
  /**
   * Prefix to load the authentication configuration from environment variables.
   * @see {@link loadAuthConfigFromEnv}
   */
  cnxPrefix?: string
  /**
   * List of OAuth scopes required by the auth provider.
   */
  scopes?: string[]
  /**
   * Keyword or phrase to trigger the cancellation of the ongoing auth flow.
   */
  cancelKeyword?: string | RegExp | RouteSelector
}

/**
 * Guard implementation for OAuth authorization flows.
 */
export class AuthorizationGuard implements Guard {
  private _userTokenClient: UserTokenClient
  private _onSuccess?: Parameters<AuthorizationGuard['onSuccess']>[0]
  private _onFailure?: Parameters<AuthorizationGuard['onFailure']>[0]
  private _onCancelled?: Parameters<AuthorizationGuard['onCancelled']>[0]

  /**
   * Creates an instance of the AuthorizationGuard.
   * @param id The unique identifier for the guard.
   * @param settings The settings for the guard.
   */
  constructor (public id: string, public settings: AuthorizationGuardSettings, private app : AgentApplication<any>) {
    if (!settings.name) {
      throw new Error(`The 'name' property is required to initialize the '${this.id}' authorization guard.`)
    }

    if (!app.adapter.userTokenClient) {
      throw new Error('The \'userTokenClient\' is not available in the adapter. Ensure that the adapter supports user token operations.')
    }

    this._userTokenClient = app.adapter.userTokenClient
  }

  private _key = `${AuthorizationGuard.name}/${this.id}`

  /**
   * Gets the authorization context from the turn state.
   * @param context The turn context.
   */
  context (context: TurnContext): AuthorizationGuardContext {
    const registered = context.turnState.get(this._key)
    if (!registered) {
      logger.warn(`Guard '${this.id}' is not registered in the current route handler.`, context.activity)
      return { token: '' }
    }
    return registered()
  }

  /**
   * Cancels the ongoing authorization flow.
   * @param context The turn context.
   * @returns True if the cancellation was successful, false otherwise.
   */
  async cancel (context:TurnContext): Promise<boolean> {
    if (!this.app.options.storage) {
      return false
    }

    const storage = new GuardStorage(this.app.options.storage, context)
    const active = await storage.read()

    if (active?.guard !== this.id) {
      return false
    }

    logger.debug(`Cancelling active guard ${this.id}`, context.activity)
    await storage.delete()
    await this._onCancelled?.(context)
    return true
  }

  /**
   * Logs out the user from the service.
   * @param context The turn context.
   * @returns True if the logout was successful, false otherwise.
   */
  async logout (context: TurnContext): Promise<boolean> {
    const user = context.activity.from?.id
    const channel = context.activity.channelId
    const connection = this.settings.name!

    if (!channel || !user) {
      throw new Error('Both \'activity.channelId\' and \'activity.from.id\' are required to perform logout.')
    }

    logger.debug(`Logging out User '${user}' from => Channel: '${channel}', Guard: '${this.id}', Connection: '${connection}'`, context.activity)
    await this._userTokenClient.signOut(user, connection, channel)
    return true
  }

  /**
   * Sets a handler to be called when a user successfully signs in.
   * @param callback The callback function to be invoked on successful sign-in.
   */
  onSuccess (callback: (context: TurnContext, data: AuthorizationGuardContext) => Promise<void> | void): void {
    this._onSuccess = callback
  }

  /**
   * Sets a handler to be called when a user fails to sign in.
   * @param callback The callback function to be invoked on sign-in failure.
   */
  onFailure (callback: (context: TurnContext, reason: string) => Promise<void> | void): void {
    this._onFailure = callback
  }

  /**
   * Sets a handler to be called when a user cancels the sign-in process.
   * @param callback The callback function to be invoked on sign-in cancellation.
   */
  onCancelled (callback: (context: TurnContext) => Promise<void> | void): void {
    this._onCancelled = callback
  }

  /**
   * Registers this guard for the current context.
   * @param options Registration options including context, and active guard state.
   */
  async register (options: GuardRegisterOptions): Promise<boolean> {
    if (!this.app.options.storage) {
      return false
    }

    const { context, active } = options
    const { activity } = context
    const storage = new GuardStorage(this.app.options.storage, context)

    if (!active) {
      return this.setToken(options, storage)
    }

    if (await this.isCancellable(context)) {
      logger.debug(`Guard ${this.id} was cancelled`)
      await storage.delete()
      await this._onCancelled?.(context)
      return false
    }

    if (active.activity.conversation?.id !== activity.conversation?.id) {
      logger.debug('Conversation changed. Starting new auth flow.', activity)
      await storage.delete()
      return this.setToken({ ...options, active: undefined }, storage)
    }

    if (activity.name === 'signin/tokenExchange') {
      const { token } = await this._userTokenClient.exchangeTokenAsync(activity.from?.id!, this.settings.name!, activity.channelId!, activity.value as TokenExchangeRequest)
      if (!token) {
        const reason = 'Token exchange failed.'
        logger.error(reason)
        await this._onFailure?.(context, reason)
        return false
      }

      logger.info('Token exchanged successfully.')
      this.setContext(context, { token: token! })
      return true
    }

    if (activity.name === 'signin/failure') {
      const reason = 'Login failed.'
      logger.error(reason, activity.value, activity)
      await context.sendActivity(MessageFactory.text(`${reason} Please try again.`))
      await storage.delete()
      await this._onFailure?.(context, reason)
      return false
    }

    const code = await this.codeVerification(options, storage)
    if (!code) {
      return false
    }

    const result = await this.setToken(options, storage, code)

    const data = this.context(context)
    if (this.isExchangeable(data.token)) {
      return this.handleObo(context, data.token)
    }

    return result
  }

  /**
   * Checks if the sign-in process can be cancelled.
   */
  private async isCancellable (context : TurnContext): Promise<boolean> {
    const keyword = this.settings.cancelKeyword
    if (!keyword) {
      return false
    }

    if (typeof keyword === 'function') {
      return keyword(context)
    }

    if (keyword instanceof RegExp) {
      return keyword.test(context.activity.text ?? '')
    }

    return context.activity.text?.toLocaleLowerCase() === keyword.toLocaleLowerCase()
  }

  /**
   * Checks if a token is exchangeable for an on-behalf-of flow.
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
   */
  private async handleObo (context: TurnContext, token: string): Promise<boolean> {
    const { cnxPrefix, scopes } = this.settings
    if (!scopes) {
      throw new Error(`Cannot perform on-behalf-of token exchange for guard '${this.id}' without defined scopes.`)
    }

    try {
      const msalTokenProvider = new MsalTokenProvider()
      const authConfig = cnxPrefix ? loadAuthConfigFromEnv(cnxPrefix) : context.adapter.authConfig
      const newToken = await msalTokenProvider.acquireTokenOnBehalfOf(authConfig, scopes, token)
      this.setContext(context, { token: newToken })
      await this._onSuccess?.(context, { token: newToken })
      return true
    } catch (error) {
      const reason = `On-behalf-of token exchange failed: ${(error as Error).message}`
      logger.error(reason, error)
      await this._onFailure?.(context, reason)
      return false
    }
  }

  /**
   * Sets the token from the token response or initiates the sign-in flow.
   */
  private async setToken ({ context, active }: GuardRegisterOptions, storage: GuardStorage, code?: string): Promise<boolean> {
    const { activity } = context

    const { tokenResponse, signInResource } = await this._userTokenClient.getTokenOrSignInResource(activity.from?.id!, this.settings.name!, activity.channelId!, activity.getConversationReference(), activity.relatesTo!, code ?? '')

    if (!tokenResponse && active) {
      logger.warn('Invalid code entered. Restarting sign-in flow.', activity)
      await context.sendActivity(MessageFactory.text('The code entered is invalid or has expired. Please sign-in again to continue.'))
    }

    if (!tokenResponse) {
      logger.debug('No token found. Sending sign-in card.', activity)
      const oCard = CardFactory.oauthCard(this.settings.name!, this.settings.title!, this.settings.text!, signInResource)
      await context.sendActivity(MessageFactory.attachment(oCard))
      await storage.write({ activity, guard: this.id, ...(active ?? {}), attempts: 3 })
      return false
    }

    logger.debug('Token acquired successfully.', activity)
    const guardContext: AuthorizationGuardContext = { token: tokenResponse.token! }
    this.setContext(context, guardContext)
    await storage.delete()
    await this._onSuccess?.(context, guardContext)
    return true
  }

  /**
   * Verifies the magic code provided by the user.
   */
  private async codeVerification ({ context, active }: GuardRegisterOptions, storage: GuardStorage): Promise<string | undefined> {
    if (!active) {
      return
    }

    const { activity } = context
    let state: string | undefined = activity.text

    if (active.attempts <= 0) {
      await context.sendActivity(MessageFactory.text('Too many invalid attempts. Please sign-in again to continue.'))
      await storage.delete()
      return
    }

    if (activity.name === 'signin/verifyState') {
      logger.debug('Getting code from activity.value', activity)
      const { state: teamsState } = activity.value as TokenVerifyState
      state = teamsState
    }

    if (state === 'CancelledByUser') {
      logger.warn('Sign-in process was cancelled by the user.', activity)
      await storage.delete()
      await this._onCancelled?.(context)
      return
    }

    if (!state?.match(/^\d{6}$/)) {
      logger.warn(`Invalid magic code entered. Attempts left: ${active.attempts}`, activity)
      await context.sendActivity(MessageFactory.text(`Please enter a valid **6-digit** code format (_e.g. 123456_).\r\n**${active.attempts} attempt(s) left...**`))
      await storage.write({ ...active, attempts: active.attempts - 1 })
      return
    }

    logger.debug('Code verification successful.', activity)
    return state
  }

  /**
   * Sets the authorization context in the turn state.
   */
  private setContext (context: TurnContext, data: AuthorizationGuardContext) {
    return context.turnState.set(this._key, () => data)
  }
}
