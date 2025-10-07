/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { AuthConfiguration } from './authConfiguration'

/**
 * Represents an authentication provider.
 */
export interface AuthProvider {
  /**
   * Gets an access token for the specified authentication configuration and scope.
   * @param authConfig - The authentication configuration.
   * @param scope - The scope for which the access token is requested.
   * @returns A promise that resolves to the access token.
   */
  getAccessToken: (authConfig: AuthConfiguration, scope: string) => Promise<string>

  /**
   * Get an access token for the agentic application
   * @param authConfig
   * @param agentAppInstanceId
   * @returns a promise that resolves to the access token.
   */
  getAgenticApplicationToken: (authConfig: AuthConfiguration, agentAppInstanceId: string) => Promise<string>

  /**
   * Get an access token for the agentic instance
   * @param authConfig
   * @param agentAppInstanceId
   * @returns a promise that resolves to the access token.
   */
  getAgenticInstanceToken: (authConfig: AuthConfiguration, agentAppInstanceId: string) => Promise<string>

  /**
   * Get an access token for the agentic user
   * @param authConfig
   * @param agentAppInstanceId
   * @param upn
   * @param scopes
   * @returns a promise that resolves to the access token.
   */
  getAgenticUserToken: (authConfig: AuthConfiguration, agentAppInstanceId: string, upn: string, scopes: string[]) => Promise<string>
}
