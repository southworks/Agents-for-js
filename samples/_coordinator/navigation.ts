// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CardFactory, type TurnContext } from '@microsoft/agents-hosting'
import type { Mode } from '../agent.js'

const scenarioHeaderId = 'samples-scenario-header'

interface ScenarioNavigation {
  id: string
  name: string
  flow?: { id: string, label: string }
}

export function headerWithMode (title: object, mode: Mode) {
  return {
    type: 'ColumnSet',
    id: scenarioHeaderId,
    columns: [
      { type: 'Column', width: 'stretch', items: [title] },
      {
        type: 'Column',
        width: 'auto',
        verticalContentAlignment: 'Center',
        items: [{
          type: 'TextBlock',
          text: mode[0].toUpperCase() + mode.slice(1),
          weight: 'Bolder',
          size: 'Small',
          horizontalAlignment: 'Right'
        }]
      }
    ]
  }
}

export function scenarioHeader (mode: Mode, scenarioId: string, name: string, flow?: { id: string, label: string }) {
  return headerWithMode(breadcrumbs(scenarioId, name, flow, true), mode)
}

function breadcrumbs (scenarioId: string, name: string, flow?: { id: string, label: string }, current = false) {
  const link = (text: string, data: object) => ({ type: 'TextRun', text, color: 'Accent', selectAction: { type: 'Action.Submit', title: text, data } })
  const label = (text: string) => ({ type: 'TextRun', text, color: 'Accent', weight: 'Bolder' })
  const separator = { type: 'TextRun', text: ' / ' }
  const flows = { samplesCommand: 'authorization', scenarioId, operation: 'flows' }
  const open = { samplesCommand: 'open', scenarioId }
  const scenarioLink = current && !flow ? label(name) : link(name, flow ? flows : open)
  const inlines = [
    link('All scenarios', { samplesCommand: 'back', scenarioId }),
    separator,
    scenarioLink
  ]

  if (flow) {
    const flowLink = current ? label(flow.label) : link(flow.label, { ...flows, operation: 'select', flow: flow.id })
    inlines.push(separator, flowLink)
  }

  return { type: 'RichTextBlock', spacing: 'Small', inlines }
}

export function addBreadcrumbs (context: TurnContext, mode: Mode, selected: () => Promise<ScenarioNavigation | undefined>) {
  context.onSendActivities(async (_context, activities, next) => {
    const scenario = await selected()
    if (!scenario) {
      return next()
    }

    for (const activity of activities) {
      if (activity.type !== 'message') {
        continue
      }
      // The channel renders the OAuth card and its sign-in controls as a separate card.
      const attachments = activity.attachments ?? []
      if (!activity.text && attachments.length === 1 && attachments[0].contentType === 'application/vnd.microsoft.card.oauth') {
        continue
      }

      const adaptive = attachments.find(attachment => attachment.contentType === 'application/vnd.microsoft.card.adaptive')
      // Classic CardFactory previews use their native format. Navigation is on the selector card.
      if (scenario.id === 'compat-card-factory' && attachments.length > 0 && !adaptive) {
        continue
      }

      const header = headerWithMode(breadcrumbs(scenario.id, scenario.name, scenario.flow), mode)
      if (adaptive?.content && typeof adaptive.content === 'object') {
        const card = adaptive.content as { body?: Array<{ id?: string }> }
        if (card.body?.[0]?.id !== scenarioHeaderId) {
          adaptive.content = { ...card, body: [header, ...(card.body ?? [])] }
        }
      } else {
        const body: object[] = [header]
        if (activity.text) {
          body.push({ type: 'TextBlock', text: activity.text, wrap: true })
          activity.text = undefined
        }
        const responseCard = CardFactory.adaptiveCard({ type: 'AdaptiveCard', version: '1.3', body })
        activity.attachments = [responseCard, ...attachments]
      }
    }

    return next()
  })
}
