// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export const authorizationScenarioId = 'authorization'

export const authorizationFlows = [
  { id: 'auth', label: 'OAuth', instruction: 'Sign in and check access to your Microsoft Graph profile.' },
  { id: 'sso', label: 'SSO', instruction: 'Validate channel single sign-on and downstream token exchange.' },
  { id: 'obo_auto', label: 'OBO Auto', instruction: 'Validate automatic on-behalf-of token acquisition for Graph.' },
  { id: 'obo_manual', label: 'OBO Manual', instruction: 'Validate sign-in followed by explicit on-behalf-of token exchange.' }
] as const

export type AuthorizationFlow = typeof authorizationFlows[number]
