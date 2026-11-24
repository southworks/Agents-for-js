// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Activity } from '@microsoft/agents-activity'
import { AgentApplication, MemoryStorage, type CloudAdapter, type TurnState } from '@microsoft/agents-hosting'

export function createEchoAgent (adapter: CloudAdapter): AgentApplication<TurnState> {
  // Mode-wide authorization settings require a store even without protected routes.
  const agent = new AgentApplication({ adapter, storage: new MemoryStorage() })

  agent.onActivity('message', async context => {
    await context.sendActivity(`You said: ${context.activity.text ?? ''}`)
  })

  // Echo has no invoke operations. Acknowledge unsupported requests explicitly.
  agent.onActivity('invoke', async context => {
    await context.sendActivity(Activity.fromObject({ type: 'invokeResponse', value: { status: 501 } }))
  })

  return agent
}
