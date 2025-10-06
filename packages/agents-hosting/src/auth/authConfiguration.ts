/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { debug } from '@microsoft/agents-activity/logger'
import { ConnectionMapItem } from './msalConnectionManager'

const logger = debug('agents:authConfiguration')

/**
 * Represents the authentication configuration.
 */
export interface AuthConfiguration {
  /**
   * The tenant ID for the authentication configuration.
   */
  tenantId?: string

  /**
   * The client ID for the authentication configuration. Required in production.
   */
  clientId?: string

  /**
   * The client secret for the authentication configuration.
   */
  clientSecret?: string

  /**
   * The path to the certificate PEM file.
   */
  certPemFile?: string

  /**
   * The path to the certificate key file.
   */
  certKeyFile?: string

  /**
   * A list of valid issuers for the authentication configuration.
   */
  issuers?: string[]

  /**
   * The connection name for the authentication configuration.
   */
  connectionName?: string

  /**
   * The FIC (First-Party Integration Channel) client ID.
   */
  FICClientId?: string,

  /**
   * Entra Authentication Endpoint to use.
   *
   * @remarks
   * If not populated the Entra Public Cloud endpoint is assumed.
   * This example of Public Cloud Endpoint is https://login.microsoftonline.com
   * see also https://learn.microsoft.com/entra/identity-platform/authentication-national-cloud
   */
  authority?: string

  /**
   * A map of connection names to their respective authentication configurations.
   */
  connections?: Map<string, AuthConfiguration>

  /**
   * A list of connection map items to map service URLs to connection names.
   */
  connectionsMap?: ConnectionMapItem[]
}
/**
 * Loads the authentication configuration from environment variables.
 *
 * @returns The authentication configuration.
 * @throws Will throw an error if clientId is not provided in production.
 *
 * @remarks
 * - `clientId` is required
 *
 * @example
 * ```
 * tenantId=your-tenant-id
 * clientId=your-client-id
 * clientSecret=your-client-secret
 *
 * certPemFile=your-cert-pem-file
 * certKeyFile=your-cert-key-file
 *
 * FICClientId=your-FIC-client-id
 *
 * connectionName=your-connection-name
 * authority=your-authority-endpoint
 * ```
 *
 */
export const loadAuthConfigFromEnv: (cnxName?: string) => AuthConfiguration = (cnxName?: string) => {
  if (cnxName === undefined) {
    const envConnections = loadConnectionsMapFromEnv()
    let authConfig: AuthConfiguration = {}

    if (envConnections.connectionsMap.length === 0) {
      // No connections provided, we need to populate the connection map with the old config settings
      authConfig = buildLegacyAuthConfig()
      envConnections.connections.set('serviceConnection', authConfig)
      envConnections.connectionsMap.push({
        serviceUrl: '*',
        connection: 'serviceConnection',
      })
    } else {
      // There are connections provided, ensure there is a clientId at least
      const firstEntry = envConnections.connections.entries().next().value
      if (firstEntry) {
        const [, firstValue] = firstEntry
        authConfig = {
          clientId: firstValue.clientId
        }
      }
    }

    return { ...authConfig, ...envConnections }
  } else {
    const envConnections = loadConnectionsMapFromEnv()
    let authConfig: AuthConfiguration = {}

    if (envConnections.connectionsMap.length === 0) {
      // No connections provided, we need to populate the connection map with the old config settings
      authConfig = buildLegacyAuthConfig(cnxName)
      envConnections.connections.set('serviceConnection', authConfig)
      envConnections.connectionsMap.push({
        serviceUrl: '*',
        connection: 'serviceConnection',
      })
    } else {
      // There are connections provided, find the requested one
      const firstEntry = envConnections.connections.entries().next().value
      if (firstEntry) {
        const [, firstValue] = firstEntry
        authConfig = {
          clientId: firstValue.clientId
        }
      }
    }
    return { ...authConfig, ...envConnections }
  }
}

/**
 * Loads the agent authentication configuration from previous version environment variables.
 *
 * @returns The agent authentication configuration.
 * @throws Will throw an error if MicrosoftAppId is not provided in production.
 *
 * @example
 * ```
 * MicrosoftAppId=your-client-id
 * MicrosoftAppPassword=your-client-secret
 * MicrosoftAppTenantId=your-tenant-id
 * ```
 *
 */
export const loadPrevAuthConfigFromEnv: () => AuthConfiguration = () => {
  if (process.env.MicrosoftAppId === undefined && process.env.NODE_ENV === 'production') {
    throw new Error('ClientId required in production')
  }
  const authority = process.env.authorityEndpoint ?? 'https://login.microsoftonline.com'
  return {
    tenantId: process.env.MicrosoftAppTenantId,
    clientId: process.env.MicrosoftAppId!,
    clientSecret: process.env.MicrosoftAppPassword,
    certPemFile: process.env.certPemFile,
    certKeyFile: process.env.certKeyFile,
    connectionName: process.env.connectionName,
    FICClientId: process.env.MicrosoftAppClientId,
    authority,
    issuers: getDefaultIssuers(process.env.MicrosoftAppTenantId ?? '', authority)
  }
}

function loadConnectionsMapFromEnv () {
  const envVars = process.env
  const connections = new Map<string, AuthConfiguration>()
  const connectionsMap: ConnectionMapItem[] = []

  for (const [key, value] of Object.entries(envVars)) {
    if (key.startsWith('connections__')) {
      const parts = key.split('__')
      if (parts.length >= 4 && parts[2] === 'settings') {
        const connectionName = parts[1]
        const propertyPath = parts.slice(3) // e.g., ['issuers', '0'] or ['clientId']

        let config = connections.get(connectionName)
        if (!config) {
          config = {}
          connections.set(connectionName, config)
        }

        let currentLevel: any = config
        for (let i = 0; i < propertyPath.length - 1; i++) {
          const level = propertyPath[i]

          // Detect array index
          const nextLevel = propertyPath[i + 1]
          const isArrayIndex = /^\d+$/.test(nextLevel)

          if (!(level in currentLevel)) {
            currentLevel[level] = isArrayIndex ? [] : {}
          }

          currentLevel = currentLevel[level]
        }

        const finalKey = propertyPath[propertyPath.length - 1]

        if (Array.isArray(currentLevel)) {
          currentLevel[parseInt(finalKey, 10)] = value
        } else {
          currentLevel[finalKey] = value
        }
      }
    } else if (key.startsWith('connectionsMap__')) {
      const parts = key.split('__')
      if (parts.length === 3) {
        const index = parseInt(parts[1], 10)
        const property = parts[2]

        if (!connectionsMap[index]) {
          connectionsMap[index] = { serviceUrl: '', connection: '' }
        }

        (connectionsMap[index] as any)[property] = value
      }
    }
  }

  if (connections.size === 0) {
    logger.warn('No connections found in configuration.')
  }

  if (connectionsMap.length === 0) {
    logger.warn('No connections map found in configuration.')
    if (connections.size > 0) {
      const firstEntry = connections.entries().next().value

      if (firstEntry) {
        const [firstKey] = firstEntry
        // Provide a default connection map if none is specified
        connectionsMap.push({
          serviceUrl: '*',
          connection: firstKey,
        })
      }
    }
  }

  return {
    connections: connections || new Map<string, AuthConfiguration>(),
    connectionsMap: connectionsMap || [],
  }
}

function buildLegacyAuthConfig (envPrefix: string = ''): AuthConfiguration {
  const prefix = envPrefix ? `${envPrefix}_` : ''
  const authority = process.env[`${prefix}authorityEndpoint`] ?? 'https://login.microsoftonline.com'
  const clientId = process.env[`${prefix}clientId`]

  if (!clientId && !envPrefix && process.env.NODE_ENV === 'production') {
    throw new Error('ClientId required in production')
  }
  if (!clientId && envPrefix) {
    throw new Error(`ClientId not found for connection: ${envPrefix}`)
  }

  return {
    tenantId: process.env[`${prefix}tenantId`],
    clientId: clientId!,
    clientSecret: process.env[`${prefix}clientSecret`],
    certPemFile: process.env[`${prefix}certPemFile`],
    certKeyFile: process.env[`${prefix}certKeyFile`],
    connectionName: process.env[`${prefix}connectionName`],
    FICClientId: process.env[`${prefix}FICClientId`],
    authority,
    issuers: getDefaultIssuers(process.env[`${prefix}tenantId`] ?? '', authority)
  }
}

function getDefaultIssuers (tenantId: string, authority: string) : string[] {
  return [
    'https://api.botframework.com',
    `https://sts.windows.net/${tenantId}/`,
    `${authority}/${tenantId}/v2.0`
  ]
}
