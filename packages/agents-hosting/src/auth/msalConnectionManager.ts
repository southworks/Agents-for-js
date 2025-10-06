/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { AuthConfiguration } from './authConfiguration'
import { Connections } from './connections'
import { MsalTokenProvider } from './msalTokenProvider'

export interface ConnectionMapItem {
  audience?: string
  serviceUrl: string
  connection: string
}

export class MsalConnectionManager implements Connections {
  private _connections: Map<string, MsalTokenProvider>
  private _connectionsMap: ConnectionMapItem[]
  private _serviceConnectionConfiguration: AuthConfiguration
  private static readonly DEFAULT_CONNECTION = 'serviceConnection'

  constructor (
    connectionsConfigurations: Map<string, AuthConfiguration> = new Map(),
    connectionsMap: ConnectionMapItem[] = [],
    configuration: AuthConfiguration = {}) {
    this._connections = new Map()
    this._connectionsMap = connectionsMap.length > 0 ? connectionsMap : (configuration.connectionsMap || [])
    this._serviceConnectionConfiguration = {}

    const providedConnections = connectionsConfigurations.size > 0 ? connectionsConfigurations : (configuration.connections || new Map())

    for (const [name, config] of providedConnections) {
      // Instantiate MsalTokenProvider for each connection
      this._connections.set(name, new MsalTokenProvider(config))
      if (name === MsalConnectionManager.DEFAULT_CONNECTION) {
        this._serviceConnectionConfiguration = config
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
   * connectionsMap__0__connection=seviceConnection
   * connectionsMap__0__serviceUrl=http://*..botframework.com/*
   * connectionsMap__0__audience=optional
   * connectionsMap__1__connection=agentic
   * connectionsMap__1__serviceUrl=agentic
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

        const regex = new RegExp(item.serviceUrl, 'i')
        if (regex.test(serviceUrl)) {
          return this.getConnection(item.connection)
        }
      }
    }
    throw new Error(`No connection found for audience: ${audience} and serviceUrl: ${serviceUrl}`)
  }

  /**
   * Get the default connection configuration for the agent.
   * @returns The default connection configuration for the agent.
   */
  getDefaultConnectionConfiguration (): AuthConfiguration {
    return this._serviceConnectionConfiguration
  }
}
