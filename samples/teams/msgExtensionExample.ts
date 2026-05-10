import { Activity } from '@microsoft/agents-activity'
import { AdaptiveCard, AgentApplication, MemoryStorage, TurnContext, TurnState } from '@microsoft/agents-hosting'
import { startServer } from '@microsoft/agents-hosting-express'
import { TeamsAgentExtension } from '@microsoft/agents-hosting-extensions-teams'
import { MessagingExtensionActionResponse, MessagingExtensionQuery, MessagingExtensionResponse, MessagingExtensionResult } from '@microsoft/teams.api'
import { wrap } from 'node:module'

const app = new AgentApplication<TurnState>({ storage: new MemoryStorage() })

const teamsExt = new TeamsAgentExtension(app)

app.registerExtension<TeamsAgentExtension>(teamsExt, tae => {
  console.log('Teams extension registered')

  tae.messageExtensions
    .onQueryLink(async (context: TurnContext, state: TurnState, link: string) : Promise<MessagingExtensionResult> => {
      await context.sendActivity(`Received a message with the link: ${link}`)
      return {
        attachmentLayout: 'list',
        type: 'result',
        attachments: [
          {
            contentType: 'application/vnd.microsoft.card.thumbnail',
            content: {
              title: 'Link Preview',
              text: `You clicked on a link: ${link}`,
              tap: {
                type: 'invoke',
                value: {
                  title: 'Link Clicked',
                  text: `You clicked on the link: ${link}`
                }
              }
            }
          }
        ]
      }
    })
    .onQuery('searchQuery', async (context: TurnContext, state: TurnState, query: MessagingExtensionQuery) : Promise<MessagingExtensionResult> => {
      console.log('Received message extension query:', query)

      const fakeResult = {
        title: 'Hello from the message extension!',
        text: 'This is a sample message extension response.' + query.commandId + ' ' + query.parameters![0].value
      }

      const msgExtResult: MessagingExtensionResult = {
        attachmentLayout: 'list',
        type: 'result',
        attachments: [
          {
            preview: {
              contentType: 'application/vnd.microsoft.card.thumbnail',
              content: {
                title: fakeResult.title,
                text: fakeResult.text,
                tap: {
                  type: 'invoke',
                  value: fakeResult
                }
              }
            },
            contentType: 'application/vnd.microsoft.card.hero',
            content: fakeResult
          }
        ]
      }

      return Promise.resolve(msgExtResult)
    })

    .onSelectItem(async (context: TurnContext, state: TurnState, item: any) : Promise<MessagingExtensionResult> => {
      console.log('Item selected:', JSON.stringify(item))

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
            text: `You selected item: ${item.index} for query: '${item.query}'`,
            wrap: true,
            separator: true,
            fontType: 'monospace'
          }
        ],
        $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
        version: '1.4'
      } as AdaptiveCard

      const msgExtResult: MessagingExtensionResult = {
        attachmentLayout: 'list',
        type: 'result',
        attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', content: card }]
      }

      return Promise.resolve(msgExtResult)
    })

    .onSubmitAction('createCard', async (context: TurnContext, state: TurnState, item: any) : Promise<MessagingExtensionActionResponse> => {
      const title = item.data.title || 'No Title'
      const description = item.data.description || 'No Description'
      console.log(`Creating card with Title: ${title} and Description: ${description}`)

      const card = {
        type: 'AdaptiveCard',
        body: [
          {
            type: 'TextBlock',
            size: 'Large',
            weight: 'Bolder',
            color: 'Accent',
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

      const msgExtActionResponse: MessagingExtensionActionResponse = {
        composeExtension: {
          type: 'result',
          attachmentLayout: 'list',
          attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', content: card }]
        }
      }
      return Promise.resolve(msgExtActionResponse)
    })

  tae.messageExtensions.onQueryUrlSetting(async (context: TurnContext, state: TurnState): Promise<MessagingExtensionResponse> => {
    console.log('Query settings URL requested')

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

app.onActivity('message', async (context: TurnContext, state: TurnState) => {
  const text = context.activity.text || ''
  console.log('Received message:', text)
  await context.sendActivity('This is a message extension bot. Use the message extension commands in Teams to test functionality.')
})

startServer(app)
