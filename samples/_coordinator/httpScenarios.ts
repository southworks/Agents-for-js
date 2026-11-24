// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Activity, DeliveryModes } from '@microsoft/agents-activity'
import { CardFactory, ConnectorClient, HeaderPropagation, MessageFactory, TurnContext, UserTokenClient, type HeaderPropagationDefinition } from '@microsoft/agents-hosting'
import type { Scenario } from './catalog.js'

const probeHeader = 'x-samples-header'
const probeValue = 'demo'
const addedHeader = 'x-samples-added'
const overriddenHeader = 'x-samples-overridden'

export const configureSampleHeaders: HeaderPropagationDefinition = headers => {
  if (headers.incoming[probeHeader] !== probeValue) {
    return
  }
  headers.propagate([probeHeader])
  headers.add({ [addedHeader]: 'sample' })
  headers.concat({ [addedHeader]: 'appended' })
  headers.override({ [overriddenHeader]: 'sample-override' })
}

function headerChecks (headers: Record<string, string>) {
  const normalized = new Map(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]))
  return [
    { key: probeHeader, operation: 'Copied', expected: probeValue },
    { key: addedHeader, operation: 'Added and appended', expected: 'sample appended' },
    { key: overriddenHeader, operation: 'Set by override', expected: 'sample-override' }
  ].map(check => {
    const actual = normalized.get(check.key)
    if (actual === undefined) {
      return { ...check, status: 'Missing' }
    }
    const status = actual === check.expected ? 'Matched' : 'Different'
    return { ...check, status }
  })
}

function describeHeaders (name: string, headers?: Record<string, string>): string {
  if (!headers) {
    return `${name}: unavailable on this turn.`
  }
  return `${name}: ${headerChecks(headers).map(check => `${check.key}: ${check.status.toLowerCase()}`).join(', ')}.`
}

function simulationCard (body: object[]) {
  return MessageFactory.attachment(CardFactory.adaptiveCard({ type: 'AdaptiveCard', version: '1.3', body }))
}

function headerClientResult (name: string, headers: Record<string, string>) {
  return [
    { type: 'TextBlock', text: name, weight: 'Bolder', wrap: true },
    {
      type: 'FactSet',
      spacing: 'Small',
      facts: headerChecks(headers).map(check => ({
        title: check.key,
        value: check.status === 'Matched'
          ? `${check.operation} · ${check.expected}`
          : `${check.status} · expected ${check.expected}`
      }))
    }
  ]
}

export const httpScenarios: Scenario[] = [
  {
    id: 'expect-replies',
    group: 'Diagnostics',
    name: 'Expect replies',
    modes: ['latest'],
    preserveBufferedReplies: true,
    introduction: 'See how expectReplies collects several bot messages into a single HTTP response.',
    quickActions: [{ label: 'Emulate a buffered reply turn', command: 'emulate-replies' }],
    create: adapter => ({
      async run (context) {
        if (context.activity.type !== 'message') {
          return
        }
        if (context.activity.text === 'emulate-replies') {
          const simulated = new TurnContext(adapter, Activity.fromObject({
            type: 'message',
            deliveryMode: DeliveryModes.ExpectReplies,
            channelId: context.activity.channelId,
            conversation: context.activity.conversation,
            from: context.activity.from,
            recipient: context.activity.recipient
          }))
          await simulated.sendActivity('Reply 1 of 3')
          await simulated.sendActivity('Reply 2 of 3')
          await simulated.sendActivity('Reply 3 of 3')
          const replies = simulated.bufferedReplyActivities
          await context.sendActivity(simulationCard([
            { type: 'TextBlock', text: `${replies.length} replies buffered for one HTTP response`, weight: 'Bolder', wrap: true },
            { type: 'TextBlock', text: 'The simulated turn called sendActivity three times. With expectReplies, the SDK collected the messages in order instead of sending them to the channel. In a real HTTP turn, the caller gets them together in the response.', wrap: true },
            ...replies.map(reply => ({ type: 'TextBlock', text: reply.text, spacing: 'Small', wrap: true }))
          ]))
          return
        }
        if (context.activity.deliveryMode !== DeliveryModes.ExpectReplies) {
          await context.sendActivity('Send an HTTP message with deliveryMode set to expectReplies. See samples/README.md for an example.')
          return
        }
        await context.sendActivity('Reply 1 of 3')
        await context.sendActivity('Reply 2 of 3')
        await context.sendActivity('Reply 3 of 3')
      }
    })
  },
  {
    id: 'header-propagation',
    group: 'Diagnostics',
    name: 'Header propagation',
    modes: ['latest'],
    preserveBufferedReplies: true,
    introduction: 'Emulate the fixed test header passing through the propagation policy into both SDK clients.',
    quickActions: [{ label: 'Emulate header propagation', command: 'emulate-headers' }],
    create: () => ({
      async run (context) {
        if (context.activity.type !== 'message') {
          return
        }
        if (context.activity.text === 'emulate-headers') {
          const headers = new HeaderPropagation({ [probeHeader]: probeValue })
          configureSampleHeaders(headers)
          const connector = ConnectorClient.createClientWithToken('https://example.com', '', headers)
          const tokenClient = await UserTokenClient.createClientWithScope('https://example.com', null!, 'https://api.botframework.com', headers)
          await context.sendActivity(simulationCard([
            { type: 'TextBlock', text: 'Headers prepared for outgoing requests', weight: 'Bolder', wrap: true },
            { type: 'TextBlock', text: `Simulated incoming header: ${probeHeader} = ${probeValue}. No network request was sent.`, wrap: true },
            ...headerClientResult('Connector client', connector.httpClient.defaultHeaders),
            ...headerClientResult('User token client', tokenClient.client.defaultHeaders)
          ]))
          return
        }
        const connector = context.turnState.get<ConnectorClient>(context.adapter.ConnectorClientKey)
        const userToken = context.turnState.get<UserTokenClient>(context.adapter.UserTokenClientKey)
        await context.sendActivity([
          describeHeaders('Connector client', connector?.httpClient.defaultHeaders),
          describeHeaders('User token client', userToken?.client.defaultHeaders)
        ].join('\n\n'))
      }
    })
  }
]
