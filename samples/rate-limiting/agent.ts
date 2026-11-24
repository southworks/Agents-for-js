// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { randomUUID } from 'node:crypto'
import { Activity, ActivityTypes } from '@microsoft/agents-activity'
import { AgentApplication, MemoryStorage, RateLimitResult, TurnContext, type CloudAdapter } from '@microsoft/agents-hosting'
import type { Mode } from '../agent.js'
import { createEditableScenarioCard } from '../_coordinator/cards.js'
import { getSessionKey } from '../_shared/sessionKey.js'
import type { Scenario } from '../_coordinator/catalog.js'

type Scope = 'User' | 'Conversation'

interface TurnObservation {
  accepted?: boolean
  throttle?: { scope: Scope, retryAfterMs: number }
}

interface LimitResult {
  passed: number
  throttled: number
  skipped: number
  retryAfterMs: number
}

const limitLabels: Record<Scope, string> = {
  User: 'User (3 / 10s)',
  Conversation: 'Conversation (5 / 10s)'
}

function limitRow (scope: Scope, result?: LimitResult) {
  const label = limitLabels[scope]
  if (!result) {
    return { type: 'TextBlock', text: `${label} · No result yet`, size: 'Small', maxLines: 1 }
  }

  const parts = [label, `${result.passed} passed`, `${result.throttled} throttled`]
  if (result.skipped) {
    parts.push(`${result.skipped} skipped`)
  }
  if (result.retryAfterMs) {
    parts.push(`retry in ~${Math.ceil(result.retryAfterMs / 1000)}s`)
  }
  return { type: 'TextBlock', text: parts.join(' · '), size: 'Small', maxLines: 1 }
}

const windowMs = 10_000

function isScenario (options: string[]) {
  return async (context: TurnContext) => {
    const command = context.activity.text?.trim() ?? ''
    return options.includes(command)
  }
}

const scenario = {
  id: 'rate-limiting',
  group: 'Diagnostics',
  name: 'Rate limiting',
  modes: ['latest'],
  introduction: 'Choose a burst or send 1 for User, 2 for Conversation, or 3 for both. Each row shows the latest result for that limit.',
  quickActions: [
    { label: 'User burst · 4', command: 'burst 1' },
    { label: 'Conversation burst · 6', command: 'burst 2' },
    { label: 'Combined burst · 4', command: 'burst 3' }
  ],
} satisfies Omit<Scenario, 'create'>

export const rateLimitingScenario: Scenario = {
  ...scenario,
  create: (adapter, _addResultNavigation, mode) => createRateLimitAgent(adapter, mode)
}

function createRateLimitAgent (adapter: CloudAdapter, mode: Mode) {
  const storage = new MemoryStorage()
  const card = createEditableScenarioCard(mode, scenario)
  const observations = new WeakMap<TurnContext, TurnObservation>()
  const resultsBySession = new Map<string, Partial<Record<Scope, LimitResult>>>()

  function throttleMessage (context: TurnContext, scope: Scope, result: RateLimitResult): string {
    const observation = observations.get(context)
    if (!observation) {
      return `${scope} limit reached. Retry in about ${Math.ceil(result.retryAfterMs / 1000)}s.`
    }
    observation.throttle = { scope, retryAfterMs: result.retryAfterMs }
    return ''
  }

  const app = new AgentApplication({
    adapter,
    storage,
    rateLimit: [
      // Activity limit: 3 messages per 10 seconds per user
      {
        scope: context => context.activity.from?.id,
        appliesTo: isScenario(['1', '3']),
        activityTypes: [ActivityTypes.Message],
        limit: 3,
        windowMs,
        message: (context, result) => throttleMessage(context, 'User', result)
      },
      // Conversation limit: 5 messages per 10 seconds per conversation
      {
        scope: context => context.activity.conversation?.id,
        appliesTo: isScenario(['2', '3']),
        activityTypes: [ActivityTypes.Message],
        limit: 5,
        windowMs,
        message: (context, result) => throttleMessage(context, 'Conversation', result)
      }
    ]
  })

  app.onConversationUpdate('membersAdded', async (context: TurnContext) => {
    await context.sendActivity(
      'Welcome to the Rate Limit sample. Send one option several times quickly:\n1. Activity limit\n2. Conversation limit\n3. Activity and conversation limits'
    )
  })

  app.onMessage(['1', '2', '3'], async context => {
    const observation = observations.get(context)
    if (observation) {
      observation.accepted = true
    }
  })

  async function observeTurn (context: TurnContext): Promise<TurnObservation> {
    const observation: TurnObservation = {}
    observations.set(context, observation)
    try {
      await app.run(context)
      return observation
    } finally {
      observations.delete(context)
    }
  }

  async function runBurst (context: TurnContext, choice: string): Promise<TurnObservation[]> {
    const count = choice === '2' ? 6 : 4
    const burst: TurnObservation[] = []

    for (let index = 0; index < count; index++) {
      const activity = Activity.fromObject({
        ...context.activity,
        id: randomUUID(),
        text: choice,
        value: undefined,
        attachments: undefined
      })
      const simulated = new TurnContext(context.adapter, activity, context.identity)
      burst.push(await observeTurn(simulated))
    }

    return burst
  }

  function summarize (scope: Scope, observations: TurnObservation[]): LimitResult {
    const result: LimitResult = { passed: 0, throttled: 0, skipped: 0, retryAfterMs: 0 }
    for (const { accepted, throttle } of observations) {
      if (throttle?.scope === scope) {
        result.throttled++
        result.retryAfterMs = Math.max(result.retryAfterMs, throttle.retryAfterMs)
      } else if (accepted || (scope === 'User' && throttle?.scope === 'Conversation')) {
        result.passed++
      } else {
        // The SDK stops checking subsequent rules when a rule throttles the turn.
        result.skipped++
      }
    }
    return result
  }

  function rows (results: Partial<Record<Scope, LimitResult>>) {
    return [limitRow('User', results.User), limitRow('Conversation', results.Conversation)]
  }

  return {
    showIntroduction: (context: TurnContext) => card.open(context, rows(resultsBySession.get(getSessionKey(context) ?? '') ?? {})),
    async onExit (context: TurnContext): Promise<void> {
      const key = getSessionKey(context)
      if (key) {
        resultsBySession.delete(key)
      }
      await card.onExit(context)
    },
    async run (context: TurnContext): Promise<void> {
      if (context.activity.type !== ActivityTypes.Message) {
        await app.run(context)
        return
      }

      const match = context.activity.text?.trim().match(/^(burst )?([123])$/)
      const key = getSessionKey(context)
      if (!match) {
        await card.update(context, rows((key && resultsBySession.get(key)) || {}))
        return
      }

      const [, burst, choice] = match
      const turns = burst ? await runBurst(context, choice) : [await observeTurn(context)]
      const results = (key && resultsBySession.get(key)) || {}
      if (choice !== '2') {
        results.User = summarize('User', turns)
      }
      if (choice !== '1') {
        results.Conversation = summarize('Conversation', turns)
      }
      if (key) {
        resultsBySession.set(key, results)
      }

      await card.update(context, rows(results))
    }
  }
}
