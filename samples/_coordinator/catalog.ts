// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { createAttachmentAgent } from '../attachments/agent.js'
import { createStreamingAgent } from '../streaming/agent.js'
import type { CloudAdapter, TurnContext } from '@microsoft/agents-hosting'
import type { Mode } from '../agent.js'
import { createEchoAgent } from '../echo/agent.js'
import { authorizationScenario } from '../authorization/scenario.js'
import { chatScenarios } from './chatScenarios.js'
import { additionalScenarios } from './additionalScenarios.js'
import { httpScenarios } from './httpScenarios.js'

export interface ScenarioAgent {
  selectedFlow?: (context: TurnContext) => { id: string, label: string } | undefined
  run: (context: TurnContext) => Promise<void>
  showIntroduction?: (context: TurnContext) => Promise<void>
  canExit?: (context: TurnContext) => Promise<boolean>
  onExit?: (context: TurnContext) => Promise<void>
}

export const scenarioGroups = ['Basics', 'State and storage', 'Authorization and integrations', 'Messaging', 'Diagnostics', 'Compatibility', 'Teams'] as const

export type ScenarioGroup = typeof scenarioGroups[number]

export interface Scenario {
  id: string
  name: string
  group: ScenarioGroup
  menuLabel?: string
  introduction: string
  cardBody?: object[]
  quickActions?: { label: string, command: string }[]
  modes: Mode[]
  usesUserAuthorization?: boolean
  preserveBufferedReplies?: boolean
  unavailableMessage?: string
  blockedExitMessage?: string
  handlesActivity?: (context: TurnContext) => boolean
  initializeOnActivity?: boolean
  disabledReason?: (mode: Mode) => string | undefined
  create: (adapter: CloudAdapter, addResultNavigation: (context: TurnContext) => void, mode: Mode) => ScenarioAgent | Promise<ScenarioAgent>
}

export const scenarios: Scenario[] = [
  {
    id: 'echo',
    group: 'Basics',
    name: 'Echo',
    introduction: 'Send hello to see it echoed back.',
    quickActions: [{ label: 'Send hello', command: 'hello' }],
    modes: ['latest'],
    create: createEchoAgent
  },
  authorizationScenario,
  {
    id: 'attachments',
    group: 'Messaging',
    name: 'Generic attachments',
    modes: ['latest'],
    introduction: 'Preview a sample image or upload a file in a channel that supports attachments.',
    quickActions: [{ label: 'Test sample attachment', command: 'test-sample-attachment' }],
    create: createAttachmentAgent
  },
  {
    id: 'streaming',
    group: 'Messaging',
    name: 'Streaming',
    modes: ['latest'],
    introduction: 'Try a regular or streamed reply with citations, or test a failure halfway through a stream.',
    quickActions: [
      { label: 'Start stream', command: 'stream' },
      { label: 'Test failure', command: 'stream-error' },
      { label: 'Send cited reply', command: 'cited-reply' },
      { label: 'Web Chat citations', command: 'webchat-citations' }
    ],
    blockedExitMessage: 'A response is still streaming. Wait for it to finish, then select All scenarios. Use samples/SCENARIOS.md for guidance.',
    create: createStreamingAgent
  },
  ...chatScenarios,
  ...httpScenarios,
  ...additionalScenarios
]
