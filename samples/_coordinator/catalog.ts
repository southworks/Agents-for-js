// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { MemoryStorage } from '@microsoft/agents-hosting'
import { StateManagementHandler } from '../compat/stateManagementHandler.js'
import { rateLimitingScenario } from '../rate-limiting/agent.js'
import { createAttachmentAgent } from '../attachments/agent.js'
import { createStreamingAgent } from '../streaming/agent.js'
import { LongRunningSample } from '../long-running/agent.js'
import { createProactiveAgent } from '../proactive/agent.js'
import { createTelemetryAgent } from '../telemetry/agent.js'
import { isTelemetryEnabled } from '../telemetry/config.js'
import type { CloudAdapter, TurnContext } from '@microsoft/agents-hosting'
import type { Mode } from '../agent.js'
import { createEchoAgent } from '../echo/agent.js'
import { stateScenarios } from '../state/scenarios.js'
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
  ...stateScenarios,
  authorizationScenario,
  rateLimitingScenario,
  {
    id: 'compat-state',
    group: 'Compatibility',
    menuLabel: 'State',
    name: 'Compatibility state',
    modes: ['compat'],
    introduction: 'Start the name prompt, then type your name. Send another message to try the stored profile.',
    quickActions: [
      { label: 'Start name prompt', command: '/start' },
      { label: 'Reset state', command: '/reset' }
    ],
    create: () => new StateManagementHandler(new MemoryStorage())
  },
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
  {
    id: 'long-running',
    group: 'Messaging',
    name: 'Long-running turns',
    modes: ['latest'],
    introduction: 'Start a 5-second task, then send messages while it works. You’ll receive a progress update and the result.',
    quickActions: [
      { label: 'Start work', command: 'work' },
      { label: 'Send a message', command: 'ping' },
      { label: 'Test failure', command: 'work-error' }
    ],
    blockedExitMessage: 'Long-running work is still in progress. Wait for its result, then select All scenarios. Use samples/SCENARIOS.md for guidance.',
    create: (adapter, addResultNavigation) => new LongRunningSample(adapter, addResultNavigation)
  },
  {
    id: 'proactive',
    group: 'Messaging',
    name: 'Proactive messaging',
    modes: ['latest'],
    introduction: 'Send a separate proactive message from chat or trigger it from your browser.',
    quickActions: [
      { label: 'Send proactive message', command: 'send-proactive' },
      { label: 'Create browser link', command: 'proactive-link' },
      { label: 'Remind me in 5 seconds', command: 'remind' },
      { label: 'Cancel reminder', command: 'cancel-reminder' }
    ],
    blockedExitMessage: 'A reminder is pending. Select Cancel reminder or wait for delivery, then select All scenarios.',
    create: createProactiveAgent
  },
  {
    id: 'telemetry',
    group: 'Diagnostics',
    name: 'Telemetry',
    disabledReason: mode => isTelemetryEnabled() ? undefined : `Enable SAMPLES_TELEMETRY=on in samples/${mode}.env and restart.`,
    modes: ['latest'],
    introduction: 'Run a successful turn, trigger a controlled error, or send a channel trace activity.',
    quickActions: [
      { label: 'Successful turn', command: 'telemetry-success' },
      { label: 'Controlled error', command: 'telemetry-error' },
      { label: 'Trace activity', command: 'trace-activity' }
    ],
    create: createTelemetryAgent
  },
  ...chatScenarios,
  ...httpScenarios,
  ...additionalScenarios
]
