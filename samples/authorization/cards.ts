// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { scenarioHeader } from '../_coordinator/navigation.js'
import type { Mode } from '../agent.js'
import { CardFactory, MessageFactory } from '@microsoft/agents-hosting'
import type { AuthorizationStatus } from './agent.js'
import { authorizationFlows, authorizationScenarioId, type AuthorizationFlow } from './flows.js'

function flowAction (title: string, operation: string, flow?: AuthorizationFlow) {
  return {
    type: 'Action.Submit',
    title,
    data: { samplesCommand: 'authorization', scenarioId: authorizationScenarioId, flow: flow?.id, operation }
  }
}

function paragraph (text: string) {
  return { type: 'TextBlock', text, wrap: true }
}

function card (body: object[]) {
  return MessageFactory.attachment(CardFactory.adaptiveCard({
    type: 'AdaptiveCard',
    version: '1.3',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    body
  }))
}

function authorizationActions (flow: AuthorizationFlow, signedIn?: boolean) {
  const actions = [flowAction('Check status', 'status', flow)]
  if (signedIn !== true) {
    actions.unshift(flowAction('Sign in', 'login', flow))
  }
  if (signedIn !== false) {
    actions.push(flowAction('Sign out', 'logout', flow))
  }
  return { type: 'ActionSet', spacing: 'Small', actions }
}

export function authorizationCard (flow: AuthorizationFlow | undefined, mode: Mode, signedIn?: boolean) {
  if (!flow) {
    return card([
      scenarioHeader(mode, authorizationScenarioId, 'Authorization'),
      paragraph('Select a flow to see its actions and validation instructions.'),
      { type: 'ActionSet', actions: authorizationFlows.map(entry => flowAction(entry.label, 'select', entry)) }
    ])
  }

  return card([
    scenarioHeader(mode, authorizationScenarioId, 'Authorization', flow),
    paragraph(flow.instruction),
    authorizationActions(flow, signedIn)
  ])
}

function tokenOutcome (status: AuthorizationStatus): string {
  if (status.displayName) {
    return `Signed in as ${status.displayName}`
  }

  if (status.signedIn === undefined) {
    return 'Sign-in status unknown'
  }

  return status.signedIn ? 'Token available' : 'Not signed in'
}

function resultSummary (status: AuthorizationStatus, showDiagnostics: boolean) {
  const outcome = tokenOutcome(status)

  if (!showDiagnostics) {
    return { outcome: status.userInfo }
  }

  if (status.exchange === 'Failed') {
    return {
      outcome: 'Token available · Token exchange failed',
      supporting: 'Check connection setup and consent with samples/SCENARIOS.md, then retry Check status.'
    }
  }

  if (status.graph === 'Failed') {
    return {
      outcome: 'Token available · Graph request failed',
      supporting: 'Check Graph permissions with samples/SCENARIOS.md, then retry Check status.'
    }
  }

  if (status.signedIn === undefined) {
    return {
      outcome,
      supporting: 'Token acquisition failed. Check connection setup with samples/SCENARIOS.md, then retry Check status.'
    }
  }

  if (status.graph === 'Succeeded' || status.graph === 'Succeeded; profile name unavailable') {
    const supporting = status.displayName
      ? 'Graph profile retrieved.'
      : 'Graph request succeeded; profile name unavailable.'

    return { outcome, supporting }
  }

  return { outcome }
}

function diagnosticFacts (status: AuthorizationStatus) {
  let token = 'Unknown'
  if (status.signedIn !== undefined) {
    token = status.signedIn ? 'Available' : 'Not available'
  }

  const facts = [{ title: 'Token', value: token }]

  if (status.callback) {
    const callback = status.callback === 'onSignInSuccess'
      ? 'Sign-in success observed'
      : status.callback
    facts.push({ title: 'Callback', value: callback })
  }

  if (status.exchange) {
    facts.push({ title: 'Exchange', value: status.exchange })
  }

  if (status.graph) {
    facts.push({ title: 'Graph', value: status.graph })
  }

  return facts
}

export function authorizationResultCard (operation: string, statuses: AuthorizationStatus[]) {
  const body: object[] = []

  if (statuses.length > 1) {
    body.push({ ...paragraph(`Authorization · ${operation}`), size: 'Small', isSubtle: true })
  }

  for (const [index, status] of statuses.entries()) {
    const flow = authorizationFlows.find(entry => entry.id === status.handlerId)
    const showDiagnostics = operation === 'Status' ||
      (operation === 'Sign in' && status.callback !== 'onSignInFailure')
    const summary = resultSummary(status, showDiagnostics)
    const items: object[] = [
      { ...paragraph(`${flow?.label ?? 'Authorization'} · ${operation}`), size: 'Small', isSubtle: true },
      { ...paragraph(summary.outcome), weight: 'Bolder', spacing: 'Small' }
    ]

    if (summary.supporting) {
      items.push(paragraph(summary.supporting))
    }

    if (showDiagnostics) {
      const detailsId = `authorization-details-${index}`
      const toggleDetails = {
        type: 'Action.ToggleVisibility',
        title: 'Details',
        targetElements: [detailsId]
      }
      items.push(
        { type: 'ActionSet', actions: [toggleDetails] },
        {
          type: 'Container',
          id: detailsId,
          isVisible: false,
          items: [{ type: 'FactSet', facts: diagnosticFacts(status) }]
        }
      )
    }

    body.push({ type: 'Container', separator: index > 0, items })
  }

  const resultCard = CardFactory.adaptiveCard({
    type: 'AdaptiveCard',
    version: '1.3',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    body
  })
  return MessageFactory.attachment(resultCard)
}
