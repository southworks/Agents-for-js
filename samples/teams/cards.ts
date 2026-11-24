// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { AgentApplication, CardFactory, MemoryStorage, MessageFactory, type CloudAdapter, type TurnContext } from '@microsoft/agents-hosting'
import { interactionData, TeamsInteractions } from './interaction.js'

const searchDataset = 'samples.cities'
const cities = ['Delhi', 'Lyon', 'Mumbai', 'Nice', 'Paris', 'Pune']

export const citySearchInput = {
  type: 'Input.ChoiceSet',
  id: 'city',
  label: 'Search for a city',
  style: 'filtered',
  'choices.data': { type: 'Data.Query', dataset: searchDataset }
}

function ownsSearch (context: TurnContext): boolean {
  const { type, name, value } = context.activity
  return type === 'invoke' && name === 'application/search' &&
    value != null && typeof value === 'object' && 'dataset' in value && value.dataset === searchDataset
}

export function ownsTeamsCardAction (context: TurnContext): boolean {
  return context.activity.channelId === 'msteams' && (ownsSearch(context) || interactionData(context).sampleOwner === 'teams-cards')
}

function inputSummary (context: TurnContext): string {
  const { usertext } = interactionData(context)
  const text = typeof usertext === 'string' ? usertext.trim().slice(0, 100) : ''
  return text ? `Received ${text.length} characters.` : 'No text entered.'
}

export function createTeamsCardAgent (adapter: CloudAdapter) {
  const interactions = new TeamsInteractions()
  const app = new AgentApplication({ adapter, storage: new MemoryStorage() })

  app.adaptiveCards.search(async context => ownsSearch(context), async (_context, _state, query) => {
    const text = query.parameters?.queryText?.trim().toLowerCase() ?? ''
    return cities.filter(city => city.toLowerCase().includes(text))
      .slice(query.skip, query.skip + query.count)
      .map(city => ({ title: city, value: city }))
  })

  app.adaptiveCards.actionSubmit('sample-submit', async context => {
    await context.sendActivity(interactions.accepts(context)
      ? `Teams cards · Submit received. ${inputSummary(context)}`
      : 'This card has expired or belongs to another session. Select Show card again.')
  })
  app.adaptiveCards.actionExecute('sample-execute', async context => {
    if (!interactions.accepts(context)) {
      return 'This card has expired or belongs to another session. Select Show card again.'
    }
    return {
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        { type: 'TextBlock', text: 'Execute received', weight: 'Bolder' },
        { type: 'TextBlock', text: inputSummary(context), wrap: true }
      ]
    }
  })
  app.onMessage('show-card', async context => {
    const token = interactions.issue(context)
    if (!token) {
      await context.sendActivity('A user and conversation are required to show this card.')
      return
    }
    const data = { sampleOwner: 'teams-cards', token }
    await context.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard({
      type: 'AdaptiveCard',
      version: '1.4',
      body: [
        { type: 'TextBlock', text: 'Enter text and try Submit or Execute.', wrap: true },
        { type: 'Input.Text', id: 'usertext', label: 'Sample text', maxLength: 100 }
      ],
      actions: [
        { type: 'Action.Submit', title: 'Submit', data: { ...data, verb: 'sample-submit', type: 'Action.Submit', data: {} } },
        { type: 'Action.Execute', title: 'Execute', verb: 'sample-execute', data }
      ]
    })))
  })
  app.onActivity('message', async context => {
    await context.sendActivity('Select Show card to test Submit and Execute.')
  })

  return {
    async onExit (context: TurnContext): Promise<void> {
      interactions.clear(context)
    },
    async run (context: TurnContext): Promise<void> {
      if (context.activity.channelId !== 'msteams') {
        await context.sendActivity('Open this sample in Microsoft Teams to test card actions.')
        return
      }
      await app.run(context)
    }
  }
}
