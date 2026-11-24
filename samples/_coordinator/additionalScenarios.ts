// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { oauthConnectionKey, readSetting } from '../_shared/config.js'
import { authorizationFlows } from '../authorization/flows.js'
import { CopilotStudioAgent, copilotStudioCardDetails } from '../copilot-studio/agent.js'
import type { Scenario } from './catalog.js'

export const additionalScenarios: Scenario[] = [
  {
    ...copilotStudioCardDetails,
    group: 'Authorization and integrations',
    modes: ['latest', 'legacy'],
    introduction: 'Sign in to chat with your configured Copilot Studio agent.',
    usesUserAuthorization: true,
    disabledReason: mode => {
      const key = oauthConnectionKey(mode, 'mcs')
      const connection = readSetting(key)
      if (!connection) {
        return `Configure ${key} in samples/${mode}.env, then restart.`
      }
      const sharesConnection = authorizationFlows.some(flow => readSetting(oauthConnectionKey(mode, flow.id)) === connection)
      if (sharesConnection) {
        return 'Use a separate OAuth connection for Copilot Studio.'
      }
    },
    create: (adapter, addResultNavigation, mode) => new CopilotStudioAgent(adapter, addResultNavigation, mode)
  }
]
