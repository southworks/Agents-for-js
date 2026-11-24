// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import type { CloudAdapter, TurnContext } from '@microsoft/agents-hosting'
import type { Mode } from '../agent.js'
import { createEchoAgent } from '../echo/agent.js'

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
]
