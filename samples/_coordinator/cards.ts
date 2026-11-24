// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CardFactory, MessageFactory } from '@microsoft/agents-hosting'
import { scenarioGroups, type Scenario } from './catalog.js'
import type { Mode } from '../agent.js'
import { headerWithMode, scenarioHeader } from './navigation.js'

export function menuCard (mode: Mode, scenarios: Scenario[]) {
  return MessageFactory.attachment(CardFactory.adaptiveCard({
    type: 'AdaptiveCard',
    version: '1.5',
    body: [
      headerWithMode({ type: 'TextBlock', text: 'Choose a scenario', size: 'Medium', weight: 'Bolder', wrap: true }, mode),
      ...scenarioGroups.flatMap(title => {
        const entries = scenarios.filter(scenario => scenario.group === title)
        if (!entries.length) {
          return []
        }
        return [
          { type: 'TextBlock', text: title, weight: 'Bolder', separator: true, spacing: 'Medium' },
          {
            type: 'ActionSet',
            spacing: 'Small',
            actions: entries.map(scenario => {
              const reason = scenario.disabledReason?.(mode)
              return {
                type: 'Action.Submit',
                title: scenario.menuLabel ?? scenario.name,
                isEnabled: !reason,
                tooltip: reason || scenario.introduction,
                data: { samplesCommand: 'select', scenarioId: scenario.id }
              }
            })
          }
        ]
      })
    ]
  }))
}

function quickActionRows (scenario: Pick<Scenario, 'id' | 'quickActions'>) {
  const actions = scenario.quickActions ?? []
  return Array.from({ length: Math.ceil(actions.length / 3) }, (_, row) => ({
    type: 'ActionSet',
    spacing: 'Small',
    actions: actions.slice(row * 3, row * 3 + 3).map(action => ({
      type: 'Action.Submit',
      title: action.label,
      data: { samplesCommand: 'run', scenarioId: scenario.id, command: action.command }
    }))
  }))
}

type ScenarioCardDetails = Pick<Scenario, 'id' | 'name' | 'introduction' | 'cardBody' | 'quickActions'>

export function scenarioCard (mode: Mode, scenario: ScenarioCardDetails) {
  return MessageFactory.attachment(CardFactory.adaptiveCard({
    type: 'AdaptiveCard',
    version: '1.5',
    body: [
      scenarioHeader(mode, scenario.id, scenario.name),
      { type: 'TextBlock', text: scenario.introduction, spacing: 'Medium', wrap: true },
      ...(scenario.cardBody ?? []),
      ...quickActionRows(scenario)
    ]
  }))
}
