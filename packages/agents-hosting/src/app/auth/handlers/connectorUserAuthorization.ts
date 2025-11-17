/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { debug } from '@microsoft/agents-activity/logger'
import { AuthorizationHandlerStatus, AuthorizationHandler, AuthorizationHandlerSettings, AuthorizationHandlerTokenOptions } from '../types'
import { TurnContext } from '../../../turnContext'
import { TokenResponse } from '../../../oauth'
import jwt, { JwtPayload } from 'jsonwebtoken'
import { Activity, ActivityTypes, Channels } from '@microsoft/agents-activity'
import { InvokeResponse } from '../../../invoke'

const logger = debug('agents:authorization:connectorUser')

// enum Category {
//   SIGNIN = 'signin',
//   UNKNOWN = 'unknown',
// }

/**
 * Active handler manager information.
 */
// export interface AzureBotActiveHandler extends ActiveAuthorizationHandler {
//   /**
//    * The number of attempts left for the handler to process in case of failure.
//    */
//   attemptsLeft: number
//   /**
//    * The current category of the handler.
//    */
//   category?: Category
// }

/**
 * Settings for on-behalf-of token acquisition.
 */
export interface ConnectorUserAuthorizationOptionsOBO {
  /**
   * Connection name to use for on-behalf-of token acquisition.
   */
  connection?: string
  /**
   * Scopes to request for on-behalf-of token acquisition.
   */
  scopes?: string[]
}

/**
 * Interface defining an authorization handler configuration.
 */
export interface ConnectorUserAuthorizationOptions {
  /**
   * The type of authorization handler.
   */
  type?: undefined

  /**
   * Settings for on-behalf-of token acquisition.
   * @remarks
   * When using environment variables, these can be set using the following variables:
   * - `${authHandlerId}_obo_connection`
   * - `${authHandlerId}_obo_scopes` (comma-separated values, e.g. `scope1,scope2`)
   */
  obo?: ConnectorUserAuthorizationOptionsOBO

  /**
   * Option to enable SSO when authenticating using Azure Active Directory (AAD). Defaults to true.
   */
  enableSso?: boolean
}

/**
 * Settings for configuring the Connector User authorization handler.
 */
export interface ConnectorUserAuthorizationSettings extends AuthorizationHandlerSettings {}

/**
 * User Authorization handling for Copilot Studio Connector requests.
 */
export class ConnectorUserAuthorization implements AuthorizationHandler {
  private _options: ConnectorUserAuthorizationOptions
  private _onSuccess?: Parameters<AuthorizationHandler['onSuccess']>[0]
  private _onFailure?: Parameters<AuthorizationHandler['onFailure']>[0]

  /**
   * Creates an instance of the ConnectorUserAuthorization.
   * @param id The unique identifier for the handler.
   * @param options The settings for the handler.
   * @param setting The settings for the authorization handler.
   */
  constructor (public readonly id: string, options: ConnectorUserAuthorizationOptions, private settings: ConnectorUserAuthorizationSettings) {
    if (!this.settings.storage) {
      throw new Error(this.prefix('The \'storage\' option is not available in the app options. Ensure that the app is properly configured.'))
    }

    if (!this.settings.connections) {
      throw new Error(this.prefix('The \'connections\' option is not available in the app options. Ensure that the app is properly configured.'))
    }

    this._options = this.loadOptions(options)
  }

  /**
   * Loads and validates the authorization handler options.
   */
  private loadOptions (settings: ConnectorUserAuthorizationOptions) {
    const result: ConnectorUserAuthorizationOptions = {
      obo: {
        connection: settings.obo?.connection ?? process.env[`${this.id}_obo_connection`],
        scopes: settings.obo?.scopes ?? this.loadScopes(process.env[`${this.id}_obo_scopes`]),
      },
      enableSso: process.env[`${this.id}_enableSso`] !== 'false' // default value is true
    }

    return result
  }

  /**
   * Sets a handler to be called when a user successfully signs in.
   * @param callback The callback function to be invoked on successful sign-in.
   */
  onSuccess (callback: (context: TurnContext) => Promise<void> | void): void {
    this._onSuccess = callback
  }

  /**
   * Sets a handler to be called when a user fails to sign in.
   * @param callback The callback function to be invoked on sign-in failure.
   */
  onFailure (callback: (context: TurnContext, reason?: string) => Promise<void> | void): void {
    this._onFailure = callback
  }

  /**
   * Retrieves the token for the user, optionally using on-behalf-of flow for specified scopes.
   * @param context The turn context.
   * @param options Optional options for token acquisition, including connection and scopes for on-behalf-of flow.
   * @returns The token response containing the token or undefined if not available.
   */
  async token (context: TurnContext, options?: AuthorizationHandlerTokenOptions): Promise<TokenResponse> {
    // let { token } = this.getContext(context)

    // if (!token?.trim()) {
    //   const { activity } = context

    const tokenResponse = this.createTokenResponse(context)
    const token = tokenResponse?.token

    if (!token?.trim()) {
      return { token: undefined }
    }

    return await this.handleOBO(token, options)
  }

  /**
   * Signs out the user from the service.
   * @returns True if the signout was successful, false otherwise.
   */
  async signout (): Promise<boolean> {
    // no-op for this handler.
    return true
  }

  /**
   * Initiates the sign-in process for the handler.
   * @param context The turn context.
   * @returns The status of the sign-in attempt.
   */
  async signin (context: TurnContext): Promise<AuthorizationHandlerStatus> {
    // There is no "sign in" or external token retrieval in this handler.  A single impl is sufficient.
    const token = await this.token(context)

    if (token) {
      return AuthorizationHandlerStatus.APPROVED
    } else {
      return AuthorizationHandlerStatus.REJECTED
    }
  }

  private createTokenResponse (context: TurnContext) {
    if (context.identity) {
      return context.identity
    }
    throw new Error('Unexpected Connector Request Token')
  }

  /**
   * Handles on-behalf-of token acquisition.
   */
  private async handleOBO (token:string, options?: AuthorizationHandlerTokenOptions): Promise<TokenResponse> {
    const oboConnection = options?.connection ?? this._options.obo?.connection
    const oboScopes = options?.scopes && options.scopes.length > 0 ? options.scopes : this._options.obo?.scopes

    if (!oboScopes || oboScopes.length === 0) {
      return { token }
    }

    if (!this.isExchangeable(token)) {
      throw new Error(this.prefix('The current token is not exchangeable for an on-behalf-of flow. Ensure the token audience starts with \'api://\'.'))
    }

    try {
      const provider = oboConnection ? this.settings.connections.getConnection(oboConnection) : this.settings.connections.getDefaultConnection()
      const newToken = await provider.acquireTokenOnBehalfOf(oboScopes, token)
      logger.debug(this.prefix('Successfully acquired on-behalf-of token'), { connection: oboConnection, scopes: oboScopes })
      return { token: newToken }
    } catch (error) {
      logger.error(this.prefix('Failed to exchange on-behalf-of token'), { connection: oboConnection, scopes: oboScopes }, error)
      return { token: undefined }
    }
  }

  /**
   * Checks if a token is exchangeable for an on-behalf-of flow.
   */
  private isExchangeable (token: string | undefined): boolean {
    if (!token || typeof token !== 'string') {
      return false
    }
    const payload = jwt.decode(token) as JwtPayload
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
    return audiences.some(aud => typeof aud === 'string' && aud.startsWith('api://'))
  }

  /**
   * Sets the token from the token response or initiates the sign-in flow.
   */
  //   private async setToken (storage: HandlerStorage<AzureBotActiveHandler>, context: TurnContext, active?: AzureBotActiveHandler, code?: string): Promise<AuthorizationHandlerStatus> {
  //     const { activity } = context

  //     const userTokenClient = await this.getUserTokenClient(context)
  //     const { tokenResponse, signInResource } = await userTokenClient.getTokenOrSignInResource(activity.from?.id!, this._options.name!, activity.channelId!, activity.getConversationReference(), activity.relatesTo!, code ?? '')

  //     if (!tokenResponse && active) {
  //       logger.warn(this.prefix('Invalid code entered. Restarting sign-in flow'), activity)
  //       await context.sendActivity(MessageFactory.text(this.messages.invalidCode(code ?? '')))
  //       return AuthorizationHandlerStatus.REJECTED
  //     }

  //     if (!tokenResponse) {
  //       logger.debug(this.prefix('Cannot find token. Sending sign-in card'), activity)

  //       const oCard = CardFactory.oauthCard(this._options.name!, this._options.title!, this._options.text!, signInResource, this._options.enableSso)
  //       await context.sendActivity(MessageFactory.attachment(oCard))
  //       await storage.write({ activity, id: this.id, ...(active ?? {}), attemptsLeft: this.maxAttempts })
  //       return AuthorizationHandlerStatus.PENDING
  //     }

  //     logger.debug(this.prefix('Successfully acquired token'), activity)
  //     this.setContext(context, { token: tokenResponse.token })
  //     return AuthorizationHandlerStatus.APPROVED
  //   }

  /**
   * Handles sign-in related activities.
   */
  //   private async handleSignInActivities (context: TurnContext): Promise<AuthorizationHandlerStatus> {
  //     const { activity } = context

  //     // Ignore signin/verifyState here (handled in codeVerification).
  //     if (activity.name === 'signin/verifyState') {
  //       return AuthorizationHandlerStatus.IGNORED
  //     }

  //     const userTokenClient = await this.getUserTokenClient(context)

  //     if (activity.name === 'signin/tokenExchange') {
  //       const tokenExchangeInvokeRequest = activity.value as TokenExchangeInvokeRequest
  //       const tokenExchangeRequest: TokenExchangeRequest = { token: tokenExchangeInvokeRequest.token }

  //       if (!tokenExchangeRequest?.token) {
  //         const reason = 'The Agent received an InvokeActivity that is missing a TokenExchangeInvokeRequest value. This is required to be sent with the InvokeActivity.'
  //         await this.sendInvokeResponse<TokenExchangeInvokeResponse>(context, {
  //           status: 400,
  //           body: { connectionName: this._options.name!, failureDetail: reason }
  //         })
  //         logger.error(this.prefix(reason))
  //         await this._onFailure?.(context, reason)
  //         return AuthorizationHandlerStatus.REJECTED
  //       }

  //       if (tokenExchangeInvokeRequest.connectionName !== this._options.name) {
  //         const reason = `The Agent received an InvokeActivity with a TokenExchangeInvokeRequest for a different connection name ('${tokenExchangeInvokeRequest.connectionName}') than expected ('${this._options.name}').`
  //         await this.sendInvokeResponse<TokenExchangeInvokeResponse>(context, {
  //           status: 400,
  //           body: { id: tokenExchangeInvokeRequest.id, connectionName: this._options.name!, failureDetail: reason }
  //         })
  //         logger.error(this.prefix(reason))
  //         await this._onFailure?.(context, reason)
  //         return AuthorizationHandlerStatus.REJECTED
  //       }

  //       const { token } = await userTokenClient.exchangeTokenAsync(activity.from?.id!, this._options.name!, activity.channelId!, tokenExchangeRequest)
  //       if (!token) {
  //         const reason = 'The MS Teams token service didn\'t send back the exchanged token. Waiting for MS Teams to send another signin/tokenExchange request. After multiple failed attempts, the user will be asked to enter the magic code.'
  //         await this.sendInvokeResponse<TokenExchangeInvokeResponse>(context, {
  //           status: 412,
  //           body: { id: tokenExchangeInvokeRequest.id, connectionName: this._options.name!, failureDetail: reason }
  //         })
  //         logger.debug(this.prefix(reason))
  //         return AuthorizationHandlerStatus.PENDING
  //       }

  //       await this.sendInvokeResponse<TokenExchangeInvokeResponse>(context, {
  //         status: 200,
  //         body: { id: tokenExchangeInvokeRequest.id, connectionName: this._options.name! }
  //       })
  //       logger.debug(this.prefix('Successfully exchanged token'))
  //       this.setContext(context, { token })
  //       await this._onSuccess?.(context)
  //       return AuthorizationHandlerStatus.APPROVED
  //     }

  //     if (activity.name === 'signin/failure') {
  //       await this.sendInvokeResponse(context, { status: 200 })
  //       const reason = 'Failed to sign-in'
  //       const value = activity.value as SignInFailureValue
  //       logger.error(this.prefix(reason), value, activity)
  //       if (this._onFailure) {
  //         await this._onFailure(context, value.message || reason)
  //       } else {
  //         await context.sendActivity(MessageFactory.text(`${reason}. Please try again.`))
  //       }
  //       return AuthorizationHandlerStatus.REJECTED
  //     }

  //     logger.error(this.prefix(`Unknown sign-in activity name: ${activity.name}`), activity)
  //     return AuthorizationHandlerStatus.REJECTED
  //   }

  // private _key = `${AzureBotAuthorization.name}/${this.id}`

  /**
   * Sets the authorization context in the turn state.
   */
  //   private setContext (context: TurnContext, data: TokenResponse) {
  //     return context.turnState.set(this._key, () => data)
  //   }

  /**
   * Gets the authorization context from the turn state.
   */
  //   private getContext (context: TurnContext): TokenResponse {
  //     const result = context.turnState.get(this._key)
  //     return result?.() ?? { token: undefined }
  //   }

  /**
   * Sends an InvokeResponse activity if the channel is Microsoft Teams.
   */
  private sendInvokeResponse <T>(context: TurnContext, response: InvokeResponse<T>) {
    if (context.activity.channelId !== Channels.Msteams) {
      return Promise.resolve()
    }

    return context.sendActivity(Activity.fromObject({
      type: ActivityTypes.InvokeResponse,
      value: response
    }))
  }

  /**
   * Prefixes a message with the handler ID.
   */
  private prefix (message: string) {
    return `[handler:${this.id}] ${message}`
  }

  /**
   * Loads the OAuth scopes from the environment variables.
   */
  private loadScopes (value:string | undefined): string[] {
    return value?.split(',').reduce<string[]>((acc, scope) => {
      const trimmed = scope.trim()
      if (trimmed) {
        acc.push(trimmed)
      }
      return acc
    }, []) ?? []
  }
}
