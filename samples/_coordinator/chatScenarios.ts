// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { AgentApplication, MemoryStorage, RouteRank } from '@microsoft/agents-hosting'
import type { Scenario } from './catalog.js'

export const chatScenarios: Scenario[] = [
  {
    id: 'route-matching',
    group: 'Basics',
    name: 'Route matching',
    modes: ['latest'],
    introduction: 'A route chooses the handler for an incoming message. Try an exact match, competing handlers with different priorities, or an unmatched message.',
    quickActions: [
      { label: 'Exact match · foo', command: 'foo' },
      { label: 'Exact match · fooBar', command: 'fooBar' },
      { label: 'Two matches · highest priority wins', command: 'dupText' },
      { label: 'No match · fallback handler', command: 'hello' }
    ],
    create: adapter => {
      const app = new AgentApplication({ adapter, storage: new MemoryStorage() })
      app.onMessage('foo', async context => {
        await context.sendActivity('Matched foo')
      })
      app.onMessage('fooBar', async context => {
        await context.sendActivity('Matched fooBar')
      })
      app.onMessage('dupText', async context => {
        await context.sendActivity('Matched last-ranked dupText')
      }, undefined, RouteRank.Last)
      app.onMessage('dupText', async context => {
        await context.sendActivity('Matched first-ranked dupText')
      }, undefined, RouteRank.First)
      app.onActivity('message', async context => {
        await context.sendActivity('Matched the fallback message route')
      })
      return app
    }
  }
]
