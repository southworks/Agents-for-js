// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import type { Scenario } from '../_coordinator/catalog.js'
import { createAuthorizationAgent, isAuthorizationActivity } from './agent.js'
import { authorizationScenarioId } from './flows.js'

export const authorizationScenario: Scenario = {
  id: authorizationScenarioId,
  group: 'Authorization and integrations',
  name: 'Authorization',
  modes: ['latest', 'legacy'],
  introduction: 'Choose a flow to test sign-in, status, and sign-out.',
  usesUserAuthorization: true,
  handlesActivity: isAuthorizationActivity,
  create: createAuthorizationAgent
}
