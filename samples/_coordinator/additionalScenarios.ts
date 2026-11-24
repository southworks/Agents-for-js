// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { AgentApplication, MemoryStorage, TranscriptLoggerMiddleware } from '@microsoft/agents-hosting'
import { BlobsTranscriptStore } from '@microsoft/agents-hosting-storage-blob'
import { oauthConnectionKey, readSetting } from '../_shared/config.js'
import { authorizationFlows } from '../authorization/flows.js'
import { AdaptiveCardHandler } from '../compat/adaptiveCardsHandler.js'
import { CardFactoryHandler, cardFactoryActions } from '../compat/cardFactoryHandler.js'
import { MultiFeatureHandler } from '../compat/multiFeatureHandler.js'
import { CopilotStudioAgent, copilotStudioCardDetails } from '../copilot-studio/agent.js'
import type { Scenario } from './catalog.js'

export const additionalScenarios: Scenario[] = [
  {
    id: 'transcripts',
    group: 'State and storage',
    name: 'Transcripts',
    modes: ['latest'],
    introduction: 'Send a message, then list or delete the transcript for this conversation.',
    quickActions: [{ label: 'List', command: 'list' }, { label: 'Delete', command: 'delete' }],
    create: adapter => {
      const logger = new BlobsTranscriptStore(readSetting('BLOB_STORAGE_CONNECTION_STRING')!, 'dev-samples-transcripts')
      const app = new AgentApplication({ adapter, storage: new MemoryStorage() })
      const transcript = new TranscriptLoggerMiddleware(logger)
      app.onMessage('list', async context => {
        const page = await logger.getTranscriptActivities(context.activity.channelId!, context.activity.conversation!.id)
        await context.sendActivity(page.items.map(activity => activity.text || activity.type).join('\n') || 'No stored activities.')
      })
      app.onMessage('delete', async context => {
        await logger.deleteTranscript(context.activity.channelId!, context.activity.conversation!.id)
        await context.sendActivity('Transcript deleted.')
      })
      app.onActivity('message', async context => {
        await context.sendActivity('Message received and recorded by transcript middleware.')
      })
      // Apply the SDK middleware to the selected scenario turn only.
      return { run: context => transcript.onTurn(context, () => app.run(context)) }
    }
  },
  {
    id: 'compat-adaptive-cards',
    group: 'Compatibility',
    menuLabel: 'Adaptive Cards',
    name: 'Compatibility Adaptive Cards',
    modes: ['compat'],
    introduction: 'Try Card Actions, Suggested Actions, or ToggleVisibility.',
    quickActions: [
      { label: 'Card actions', command: 'Card Actions' },
      { label: 'Suggested actions', command: 'Suggested Actions' },
      { label: 'Toggle visibility', command: 'ToggleVisibility' }
    ],
    create: () => new AdaptiveCardHandler()
  },
  {
    id: 'compat-card-factory',
    group: 'Compatibility',
    menuLabel: 'Card Factory',
    name: 'Compatibility CardFactory',
    modes: ['compat'],
    introduction: 'Choose a card type to preview. Support for classic cards varies by channel.',
    quickActions: cardFactoryActions,
    create: () => new CardFactoryHandler()
  },
  {
    id: 'compat-events',
    group: 'Compatibility',
    menuLabel: 'Events and attachments',
    name: 'Compatibility events and attachments',
    modes: ['compat'],
    introduction: 'Try an attachment or the typing demo, or upload a test file. Supported channels also report message edits, deletions, and reactions.',
    quickActions: [
      { label: 'Inline attachment', command: '1' },
      { label: 'Internet attachment', command: '2' },
      { label: 'Typing demonstration', command: 'wait' }
    ],
    create: () => new MultiFeatureHandler()
  },
  {
    ...copilotStudioCardDetails,
    group: 'Authorization and integrations',
    modes: ['latest', 'legacy'],
    introduction: 'Sign in to chat with your configured Copilot Studio agent.',
    usesUserAuthorization: true,
    disabledReason: mode => {
      const key = oauthConnectionKey(mode, 'mcs')
      const connection = readSetting(key)
      if (!connection) {
        return `Configure ${key} in samples/${mode}.env, then restart.`
      }
      const sharesConnection = authorizationFlows.some(flow => readSetting(oauthConnectionKey(mode, flow.id)) === connection)
      if (sharesConnection) {
        return 'Use a separate OAuth connection for Copilot Studio.'
      }
    },
    create: (adapter, addResultNavigation, mode) => new CopilotStudioAgent(adapter, addResultNavigation, mode)
  }
]
