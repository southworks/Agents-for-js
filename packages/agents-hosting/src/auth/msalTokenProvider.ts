/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { ConfidentialClientApplication, LogLevel, ManagedIdentityApplication, NodeSystemOptions } from '@azure/msal-node'
import axios from 'axios'
import { AuthConfiguration } from './authConfiguration'
import { AuthProvider } from './authProvider'
import { debug } from '@microsoft/agents-activity/logger'
import { v4 } from 'uuid'
import { MemoryCache } from './MemoryCache'

import fs from 'fs'
import crypto from 'crypto'

const audience = 'api://AzureADTokenExchange'
const logger = debug('agents:msal')

/**
 * Provides tokens using MSAL.
 */
export class MsalTokenProvider implements AuthProvider {
  private _agenticTokenCache: MemoryCache<string>

  constructor () {
    this._agenticTokenCache = new MemoryCache<string>()
  }

  /**
   * Gets an access token.
   * @param authConfig The authentication configuration.
   * @param scope The scope for the token.
   * @returns A promise that resolves to the access token.
   */
  public async getAccessToken (authConfig: AuthConfiguration, scope: string): Promise<string> {
    if (!authConfig.clientId && process.env.NODE_ENV !== 'production') {
      return ''
    }
    let token
    if (authConfig.FICClientId !== undefined) {
      token = await this.acquireAccessTokenViaFIC(authConfig, scope)
    } else if (authConfig.clientSecret !== undefined) {
      token = await this.acquireAccessTokenViaSecret(authConfig, scope)
    } else if (authConfig.certPemFile !== undefined &&
      authConfig.certKeyFile !== undefined) {
      token = await this.acquireTokenWithCertificate(authConfig, scope)
    } else if (authConfig.clientSecret === undefined &&
      authConfig.certPemFile === undefined &&
      authConfig.certKeyFile === undefined) {
      token = await this.acquireTokenWithUserAssignedIdentity(authConfig, scope)
    } else {
      throw new Error('Invalid authConfig. ')
    }
    if (token === undefined) {
      throw new Error('Failed to acquire token')
    }

    return token
  }

  public async acquireTokenOnBehalfOf (authConfig: AuthConfiguration, scopes: string[], oboAssertion: string): Promise<string> {
    const cca = new ConfidentialClientApplication({
      auth: {
        clientId: authConfig.clientId as string,
        authority: `${authConfig.authority}/${authConfig.tenantId || 'botframework.com'}`,
        clientSecret: authConfig.clientSecret
      },
      system: this.sysOptions
    })
    const token = await cca.acquireTokenOnBehalfOf({
      oboAssertion,
      scopes
    })
    return token?.accessToken as string
  }

  public async getAgenticInstanceToken (authConfig: AuthConfiguration, agentAppInstanceId: string): Promise<string> {
    const appToken = await this.getAgenticApplicationToken(authConfig, agentAppInstanceId)

    logger.debug('Getting agentic instance token')
    const cca = new ConfidentialClientApplication({
      auth: {
        clientId: agentAppInstanceId,
        clientAssertion: appToken,
        authority: `${authConfig.authority}/${authConfig.tenantId || 'botframework.com'}`,
      },
      system: this.sysOptions
    })

    const token = await cca.acquireTokenByClientCredential({
      scopes: ['api://AzureAdTokenExchange/.default'],
      correlationId: v4()
    })

    if (!token?.accessToken) {
      throw new Error(`Failed to acquire instance token for agent instance: ${agentAppInstanceId}`)
    }

    return token.accessToken
  }

  /**
   * Does a direct HTTP call to acquire a token for agentic scenarios - do not use this directly!
   * This method will be removed once MSAL is updated with the necessary features.
   * (This is required in order to pass additional parameters into the auth call)
   * @param authConfig 
   * @param clientId 
   * @param clientAssertion 
   * @param scopes 
   * @param tokenBodyParameters 
   * @returns 
   */
  private async acquireTokenByForAgenticScenarios (authConfig: AuthConfiguration, clientId: string, clientAssertion: string | undefined, scopes: string[], tokenBodyParameters: { [key: string]: any }): Promise<string | null> {
    // Check cache first
    const cacheKey = `${clientId}/${Object.keys(tokenBodyParameters).map(key => key !== 'user_federated_identity_credential' ? `${key}=${tokenBodyParameters[key]}` : '').join('&')}/${scopes.join(';')}`
    if (this._agenticTokenCache.get(cacheKey)) {
      return this._agenticTokenCache.get(cacheKey) as string
    }

    const url = `${authConfig.authority}/${authConfig.tenantId || 'botframework.com'}/oauth2/v2.0/token`

    const data: { [key: string]: any } = {
      client_id: clientId,
      scope: scopes.join(' '),
      ...tokenBodyParameters
    }

    if (clientAssertion) {
      data.client_assertion_type = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'
      data.client_assertion = clientAssertion
    } else {
      data.client_secret = authConfig.clientSecret
    }

    try {
      const token = await axios.post(
        url,
        data,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
          }
        }
      )

      // capture token, expire local cache 5 minutes early
      this._agenticTokenCache.set(cacheKey, token.data.access_token, token.data.expires_in - 300)

      return token.data.access_token

    } catch (error) {
      logger.error(`Error acquiring token: ${error}`)
      return null
    }

  }

  public async getAgenticUserToken (authConfig: AuthConfiguration, agentAppInstanceId: string, upn: string, scopes: string[]): Promise<string> {
    const agentToken = await this.getAgenticApplicationToken(authConfig, agentAppInstanceId)
    const instanceToken = await this.getAgenticInstanceToken(authConfig, agentAppInstanceId)

    const token = await this.acquireTokenByForAgenticScenarios(authConfig, agentAppInstanceId, agentToken, scopes, {
      username: upn,
      user_federated_identity_credential: instanceToken,
      grant_type: 'user_fic',
    })

    if (!token) {
      throw new Error(`Failed to acquire instance token for user token: ${agentAppInstanceId}`)
    }

    return token
  }

  public async getAgenticApplicationToken (authConfig: AuthConfiguration, agentAppInstanceId: string): Promise<string> {
    const token = await this.acquireTokenByForAgenticScenarios(authConfig, authConfig.clientId, undefined, ['api://AzureAdTokenExchange/.default'], {
      grant_type: 'client_credentials',
      fmi_path: agentAppInstanceId,
    })

    if (!token) {
      throw new Error(`Failed to acquire token for agent instance: ${agentAppInstanceId}`)
    }

    return token
  }

  private readonly sysOptions: NodeSystemOptions = {
    loggerOptions: {
      logLevel: LogLevel.Trace,
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) {
          return
        }
        switch (level) {
          case LogLevel.Error:
            logger.error(message)
            return
          case LogLevel.Info:
            logger.debug(message)
            return
          case LogLevel.Warning:
            if (!message.includes('Warning - No client info in response')) {
              logger.warn(message)
            }
            return
          case LogLevel.Verbose:
            logger.debug(message)
        }
      },
      piiLoggingEnabled: false
    }
  }

  /**
   * Acquires a token using a user-assigned identity.
   * @param authConfig The authentication configuration.
   * @param scope The scope for the token.
   * @returns A promise that resolves to the access token.
   */
  private async acquireTokenWithUserAssignedIdentity (authConfig: AuthConfiguration, scope: string) {
    const mia = new ManagedIdentityApplication({
      managedIdentityIdParams: {
        userAssignedClientId: authConfig.clientId || ''
      },
      system: this.sysOptions
    })
    const token = await mia.acquireToken({
      resource: scope
    })
    return token?.accessToken
  }

  /**
   * Acquires a token using a certificate.
   * @param authConfig The authentication configuration.
   * @param scope The scope for the token.
   * @returns A promise that resolves to the access token.
   */
  private async acquireTokenWithCertificate (authConfig: AuthConfiguration, scope: string) {
    const privateKeySource = fs.readFileSync(authConfig.certKeyFile as string)

    const privateKeyObject = crypto.createPrivateKey({
      key: privateKeySource,
      format: 'pem'
    })

    const privateKey = privateKeyObject.export({
      format: 'pem',
      type: 'pkcs8'
    })

    const pubKeyObject = new crypto.X509Certificate(fs.readFileSync(authConfig.certPemFile as string))

    const cca = new ConfidentialClientApplication({
      auth: {
        clientId: authConfig.clientId || '',
        authority: `${authConfig.authority}/${authConfig.tenantId || 'botframework.com'}`,
        clientCertificate: {
          privateKey: privateKey as string,
          thumbprint: pubKeyObject.fingerprint.replaceAll(':', ''),
          x5c: Buffer.from(authConfig.certPemFile as string, 'base64').toString()
        }
      },
      system: this.sysOptions
    })
    const token = await cca.acquireTokenByClientCredential({
      scopes: [`${scope}/.default`],
      correlationId: v4()
    })
    return token?.accessToken as string
  }

  /**
   * Acquires a token using a client secret.
   * @param authConfig The authentication configuration.
   * @param scope The scope for the token.
   * @returns A promise that resolves to the access token.
   */
  private async acquireAccessTokenViaSecret (authConfig: AuthConfiguration, scope: string) {
    const cca = new ConfidentialClientApplication({
      auth: {
        clientId: authConfig.clientId as string,
        authority: `${authConfig.authority}/${authConfig.tenantId || 'botframework.com'}`,
        clientSecret: authConfig.clientSecret
      },
      system: this.sysOptions
    })
    const token = await cca.acquireTokenByClientCredential({
      scopes: [`${scope}/.default`],
      correlationId: v4()
    })
    return token?.accessToken as string
  }

  /**
   * Acquires a token using a FIC client assertion.
   * @param authConfig The authentication configuration.
   * @param scope The scope for the token.
   * @returns A promise that resolves to the access token.
   */
  private async acquireAccessTokenViaFIC (authConfig: AuthConfiguration, scope: string) : Promise<string> {
    const scopes = [`${scope}/.default`]
    const clientAssertion = await this.fetchExternalToken(authConfig.FICClientId as string)
    const cca = new ConfidentialClientApplication({
      auth: {
        clientId: authConfig.clientId as string,
        authority: `${authConfig.authority}/${authConfig.tenantId}`,
        clientAssertion
      },
      system: this.sysOptions
    })
    const token = await cca.acquireTokenByClientCredential({ scopes })
    logger.debug('got token using FIC client assertion')
    return token?.accessToken as string
  }

  /**
   * Fetches an external token.
   * @param FICClientId The FIC client ID.
   * @returns A promise that resolves to the external token.
   */
  private async fetchExternalToken (FICClientId: string) : Promise<string> {
    const managedIdentityClientAssertion = new ManagedIdentityApplication({
      managedIdentityIdParams: {
        userAssignedClientId: FICClientId
      },
      system: this.sysOptions
    }
    )
    const response = await managedIdentityClientAssertion.acquireToken({
      resource: audience,
      forceRefresh: true
    })
    logger.debug('got token for FIC')
    return response.accessToken
  }
}
