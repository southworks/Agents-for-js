// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import {
  AgentApplication,
  TurnState,
  type CloudAdapter,
  type StorageProvider
} from '@microsoft/agents-hosting'
import type { Mode } from '../agent.js'
import { createEditableScenarioCard, type ScenarioCardDetails } from '../_coordinator/cards.js'
import type { ScenarioAgent } from '../_coordinator/catalog.js'

export function createStateAgent (
  adapter: CloudAdapter,
  storage: StorageProvider,
  mode: Mode,
  scenario: ScenarioCardDetails,
  includeUserCounter = false
): ScenarioAgent {
  const agent = new AgentApplication({ adapter, storage })
  const card = createEditableScenarioCard(mode, scenario)
  // Keep the keys already used by the File example and the other providers.
  const conversationKey = includeUserCounter ? 'conversation.counter' : 'conversation.sampleCounter'
  const userKey = 'user.counter'
  const counterKeys = includeUserCounter ? [conversationKey, userKey] : [conversationKey]

  function counterBody (state: TurnState) {
    const conversationCount = state.getValue<number>(conversationKey) ?? 0
    const counters = includeUserCounter
      ? `User counter: ${state.getValue<number>(userKey) ?? 0}. Conversation counter: ${conversationCount}`
      : `Conversation counter: ${conversationCount}`
    return [{ type: 'TextBlock', text: counters, weight: 'Bolder', wrap: true }]
  }

  agent.onMessage('increment', async (context, state) => {
    for (const key of counterKeys) {
      state.setValue(key, (state.getValue<number>(key) ?? 0) + 1)
    }
    await state.save(context, storage)
    await card.update(context, counterBody(state))
  })

  agent.onMessage('show', (context, state) => card.update(context, counterBody(state)))

  agent.onMessage('reset', async (context, state) => {
    for (const key of counterKeys) {
      state.deleteValue(key)
    }
    await state.save(context, storage)
    await card.update(context, counterBody(state))
  })

  if (includeUserCounter) {
    agent.onActivity('message', async context => {
      await context.sendActivity('Use Increment or Reset on the scenario card.')
    })
  }

  return {
    run: context => agent.run(context),
    async showIntroduction (context) {
      const state = new TurnState()
      await state.load(context, storage)
      await card.open(context, counterBody(state))
    },
    onExit: card.onExit
  }
}
