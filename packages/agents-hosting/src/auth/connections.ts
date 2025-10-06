/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { AuthConfiguration } from './authConfiguration'
import { AuthProvider } from './authProvider'

export interface Connections {
  /**
 * Get the OAuth connection for the agent.
 * @param name - The connection name. Must match a configured OAuth connection.
 * @returns An AuthProvider instance.
 * @throws {Error} If the connection name is not found.
 */
  getConnection: (name: string) => AuthProvider

  /**
   * Get the default OAuth connection for the agent.
   * @returns An AuthProvider instance.
   */
  getDefaultConnection: () => AuthProvider

  /**
   * Get the OAuth token provider for the agent.
   * @param audience - The audience.
   * @param serviceUrl - The service url.
   * @returns An AuthProvider instance.
   */
  getTokenProvider: (audience: string, serviceUrl: string) => AuthProvider

  /**
   * Get the default connection configuration for the agent.
   * @returns An Auth Configuration.
   */
  getDefaultConnectionConfiguration: () => AuthConfiguration
}
