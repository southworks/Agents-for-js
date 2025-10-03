/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { AuthConfiguration } from './authConfiguration'
import { MsalTokenProvider } from './msalTokenProvider'

interface MsalConnectionManagerOptions {
  CONNECTIONSMAP?: any;
  CONNECTIONS?: any;
  [key: string]: any; // Allow arbitrary properties
}

interface ConnectionMapItem {
  audience: string
  serviceUrl: string
  connection: string
}

export class MsalConnectionManager {
  private _connections: Map<string, MsalTokenProvider>
  private _connectionsMap: ConnectionMapItem[]
  private _serviceConnectionConfiguration: AuthConfiguration
  private static readonly DEFAULT_CONNECTION = 'SERVICE_CONNECTION'

  constructor (
    connectionsConfigurations: Map<string, AuthConfiguration> = new Map(),
    connectionsMap: ConnectionMapItem[] = [],
    options: MsalConnectionManagerOptions = {}) {
    this._connections = new Map()
    this._connectionsMap = connectionsMap || options.CONNECTIONSMAP || []
    this._serviceConnectionConfiguration = null as any

    if (connectionsConfigurations.size > 0) {
      for (const [name, config] of connectionsConfigurations) {
        // Instantiate MsalTokenProvider for each connection
        this._connections.set(name, new MsalTokenProvider())
      }
    } else {
      const rawConfigurations: Map<string, Map<string, string>> = options.CONNECTIONS || new Map()
      for (const [name, rawConfig] of rawConfigurations) {
        const parsedConfig: AuthConfiguration = {
          clientId: rawConfig.get('clientId') || '',
          authority: rawConfig.get('authority') || '',
          issuers: rawConfig.get('issuers') ? rawConfig.get('issuers')!.split(',').map(s => s.trim()) : [],
        }
        this._connections.set(name, new MsalTokenProvider())
        if (name === 'SERVICE_CONNECTION') {
          this._serviceConnectionConfiguration = parsedConfig
        }
      }
    }

    if (!this._connections.has(MsalConnectionManager.DEFAULT_CONNECTION)) {
      throw new Error(
                `Missing default connection: ${MsalConnectionManager.DEFAULT_CONNECTION}`
      )
    }
  }

  /**
   * Get the OAuth connection for the agent.
   * @param connectionName The name of the connection.
   * @returns The OAuth connection for the agent.
   */
  getConnection (connectionName: string): MsalTokenProvider {
    const conn = this._connections.get(connectionName)
    if (!conn) {
      throw new Error(`Connection not found: ${connectionName}`)
    }
    return conn
  }

  /**
   * Get the default OAuth connection for the agent.
   * @returns The default OAuth connection for the agent.
   */
  getDefaultConnection (): MsalTokenProvider {
    return this.getConnection(MsalConnectionManager.DEFAULT_CONNECTION)
  }

  /**
   * Finds a connection based on a map.
   *
   * @param audience.
   * @param serviceUrl
   * @returns
   *
   * @remarks
   * Example environment variables:
   * CONNECTIONSMAP__0__CONNECTION=SERVICE_CONNECTION
   * CONNECTIONSMAP__0__SERVICEURL=http://*..botframework.com/*.
   * CONNECTIONSMAP__1__CONNECTION=AGENTIC
   * CONNECTIONSMAP__1__SERVICEURL=agentic
   *
   * ServiceUrl is:  A regex to match with, or "*" for any serviceUrl value.
   * Connection is: A name in the 'Connections' list.
   */
  getTokenProvider (audience: any, serviceUrl: string): MsalTokenProvider {
    if (!audience || !serviceUrl) throw new Error('Audience and Service URL are required to get the token provider.')

    if (this._connectionsMap.length === 0) {
      return this.getDefaultConnection()
    }

    for (const item of this._connectionsMap) {
      if (item.audience === audience) {
        if (item.serviceUrl === '*' || !item.serviceUrl) {
          return this.getConnection(item.connection)
        }

        const regex = new RegExp(serviceUrl, 'i')
        if (regex.test(item.serviceUrl)) {
          return this.getConnection(item.connection)
        }
      }
    }
    return null as any
  }

  /**
   * Get the default connection configuration for the agent.
   * @returns The default connection configuration for the agent.
   */
  getDefaultConnectionConfiguration (): AuthConfiguration {
    return this._serviceConnectionConfiguration
  }
}
