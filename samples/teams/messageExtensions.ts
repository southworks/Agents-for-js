// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { AgentApplication, MemoryStorage, type AdaptiveCard, type CloudAdapter, type TurnContext, type TurnState } from '@microsoft/agents-hosting'
import { TeamsAgentExtension, TeamsTurnContext } from '@microsoft/agents-hosting-extensions-msteams'
import type {
  AppBasedLinkQuery,
  Attachment,
  MessagingExtensionAction,
  MessagingExtensionActionResponse,
  MessagingExtensionQuery,
  MessagingExtensionResponse,
  ThumbnailCard
} from '@microsoft/teams.api'

import { record } from './interaction.js'

function readText (value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

const ADAPTIVE_CARD_CONTENT_TYPE = 'application/vnd.microsoft.card.adaptive'
const THUMBNAIL_CARD_CONTENT_TYPE = 'application/vnd.microsoft.card.thumbnail'
const resultCount = 3

function createMessageResponse (text: string): MessagingExtensionResponse {
  return {
    composeExtension: {
      type: 'message',
      text
    }
  }
}

function createResultResponse (...attachments: Attachment[]): MessagingExtensionResponse {
  return {
    composeExtension: {
      type: 'result',
      attachmentLayout: 'list',
      attachments
    }
  }
}

function createAdaptiveCardAttachment (card: AdaptiveCard, preview?: ThumbnailCard): Attachment {
  const attachment: Attachment = {
    contentType: ADAPTIVE_CARD_CONTENT_TYPE,
    content: card
  }

  if (!preview) {
    return attachment
  }

  const previewAttachment: Attachment = {
    contentType: THUMBNAIL_CARD_CONTENT_TYPE,
    content: preview
  }

  return Object.assign(attachment, { preview: previewAttachment })
}

function registerMessageExtensionHandlers (app: AgentApplication<TurnState>): void {
  const teamsExt = new TeamsAgentExtension(app)
  app.registerExtension<TeamsAgentExtension>(teamsExt, tae => {
    tae.messageExtensions
      .onQueryLink(async (context: TeamsTurnContext, state: TurnState, query: AppBasedLinkQuery | undefined) : Promise<MessagingExtensionResponse> => {
        const url = query?.url
        if (!url) {
          return createMessageResponse('No URL provided')
        }

        const card = {
          type: 'AdaptiveCard',
          body: [
            {
              type: 'TextBlock',
              text: 'Link Preview',
              size: 'Large',
              weight: 'Bolder'
            },
            {
              type: 'TextBlock',
              text: url,
              wrap: true
            }
          ],
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          version: '1.4'
        } as AdaptiveCard

        const previewCard: ThumbnailCard = {
          title: 'Link Preview',
          text: url
        }

        return createResultResponse(createAdaptiveCardAttachment(card, previewCard))
      })
      .onQuery('searchQuery', async (context: TeamsTurnContext, state: TurnState, query: MessagingExtensionQuery) : Promise<MessagingExtensionResponse> => {
        const initialRun = query.parameters?.find(p => p.name === 'initialRun')?.value?.toString() === 'true'
        if (initialRun) {
          return createMessageResponse('Enter a search query to see sample results.')
        }

        const parameter = query.parameters?.find(p => p.name === 'query')?.value
        const searchQuery = typeof parameter === 'string' ? parameter.trim().slice(0, 100) : ''
        if (!searchQuery) {
          return createMessageResponse('Enter a search query to see sample results.')
        }

        const attachments: Attachment[] = []

        for (let i = 1; i <= resultCount; i++) {
          const card = {
            type: 'AdaptiveCard',
            body: [
              {
                type: 'TextBlock',
                text: `Search Result ${i}`,
                size: 'Large',
                weight: 'Bolder',
              },
              {
                type: 'TextBlock',
                text: `Query: ${searchQuery} - Result description for item ${i}`,
                size: 'Large',
                weight: 'Bolder',
              }
            ],
            $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
            version: '1.4'
          } as AdaptiveCard

          const previewCard: ThumbnailCard = {
            title: `Result ${i}`,
            text: `This is a preview of result ${i} for query '${searchQuery}'.`,
            tap: {
              type: 'invoke',
              title: `Result ${i}`,
              value: { index: i, query: searchQuery }
            }
          }

          attachments.push(createAdaptiveCardAttachment(card, previewCard))
        }

        return createResultResponse(...attachments)
      })

      .onSelectItem(async (context: TeamsTurnContext, state: TurnState, item: unknown) : Promise<MessagingExtensionResponse> => {
        const { index, query } = record(item)
        if (typeof index !== 'number' || !Number.isInteger(index) || index < 1 || index > resultCount) {
          return createMessageResponse('Choose a result from this search.')
        }
        const card = {
          type: 'AdaptiveCard',
          body: [
            {
              type: 'TextBlock',
              size: 'Large',
              weight: 'Bolder',
              text: 'Item Selected',
              color: 'good'
            },
            {
              type: 'TextBlock',
              text: `You selected item: ${index} for query: '${readText(query, 100)}'`,
              wrap: true,
              separator: true,
              fontType: 'monospace'
            }
          ],
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          version: '1.4'
        } as AdaptiveCard

        return createResultResponse(createAdaptiveCardAttachment(card))
      })

      .onFetchAction('createCard', async (context: TeamsTurnContext, state: TurnState, action: MessagingExtensionAction): Promise<MessagingExtensionActionResponse> => {
        const card = {
          type: 'AdaptiveCard',
          body: [
            {
              type: 'Input.Text',
              id: 'title',
              label: 'Title',
              placeholder: 'Enter a title',
              isRequired: true,
              errorMessage: 'A title is required.'
            },
            {
              type: 'Input.Text',
              id: 'description',
              label: 'Description',
              placeholder: 'Enter a description',
              isMultiline: true,
              isRequired: true,
              errorMessage: 'A description is required.'
            }
          ],
          actions: [
            {
              type: 'Action.Submit',
              title: 'Create Card',
              data: {
                submitLocation: 'messagingExtensionFetchTask'
              }
            }
          ],
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          version: '1.4'
        } as AdaptiveCard

        return {
          task: {
            type: 'continue',
            value: {
              title: 'Create Card',
              height: 'small',
              width: 'small',
              card: createAdaptiveCardAttachment(card)
            }
          }
        }
      })

      .onSubmitAction('createCard', async (context: TeamsTurnContext, state: TurnState, action: MessagingExtensionAction) : Promise<MessagingExtensionActionResponse> => {
        const title = readText(action.data?.title, 100)
        const description = readText(action.data?.description, 500)
        if (!title || !description) {
          return { task: { type: 'message', value: 'Enter a title and description, then try again.' } }
        }

        const card = {
          type: 'AdaptiveCard',
          body: [
            {
              type: 'TextBlock',
              size: 'Large',
              weight: 'Bolder',
              color: 'Good',
              text: 'Custom Card Created'
            },
            {
              type: 'TextBlock',
              size: 'Medium',
              weight: 'Bolder',
              text: title
            },
            {
              type: 'TextBlock',
              text: description,
              wrap: true,
              isSubtle: true
            }
          ],
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          version: '1.4'
        } as AdaptiveCard

        return createResultResponse(createAdaptiveCardAttachment(card))
      })

    tae.messageExtensions.onQuerySettingUrl(async (context: TeamsTurnContext, state: TurnState): Promise<MessagingExtensionResponse> => {
      const msgExtResponse: MessagingExtensionResponse = {
        composeExtension: {
          type: 'config',
          suggestedActions: {
            actions: [
              {
                type: 'openUrl',
                value: 'https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/overview',
                title: 'Configure'
              }
            ]
          }
        }
      }
      return Promise.resolve(msgExtResponse)
    })
  })
}

export function ownsMessageExtension (context: TurnContext): boolean {
  const { channelId, type, name, value } = context.activity
  if (channelId !== 'msteams' || type !== 'invoke') {
    return false
  }

  const { commandId } = record(value)
  switch (name) {
    case 'composeExtension/query':
      return commandId === 'searchQuery'
    case 'composeExtension/fetchTask':
    case 'composeExtension/submitAction':
      return commandId === 'createCard'
    case 'composeExtension/queryLink':
    case 'composeExtension/selectItem':
    case 'composeExtension/querySettingUrl':
      return true
    default:
      return false
  }
}

export function createTeamsMessageExtensionAgent (adapter: CloudAdapter) {
  const app = new AgentApplication({ adapter, storage: new MemoryStorage() })
  registerMessageExtensionHandlers(app)

  return {
    async run (context: TurnContext): Promise<void> {
      if (context.activity.type === 'message') {
        await context.sendActivity('Open this app from the Teams compose box Apps menu to try Search, Create Card, or Settings. Paste a link for a domain configured in the manifest to try link previews.')
        return
      }
      await app.run(context)
    }
  }
}
