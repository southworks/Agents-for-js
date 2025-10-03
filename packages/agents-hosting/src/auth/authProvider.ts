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

  GetAgenticApplicationToken: (authConfig: AuthConfiguration, agentAppInstanceId: string) => Promise<string>

  GetAgenticInstanceToken: (authConfig: AuthConfiguration, agentAppInstanceId: string) => Promise<string>

  GetAgenticUserToken: (authConfig: AuthConfiguration, agentAppInstanceId: string, upn: string, scopes: string[]) => Promise<string>
}
