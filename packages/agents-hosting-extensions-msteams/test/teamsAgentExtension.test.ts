import assert from 'node:assert'
import { describe, it } from 'node:test'
import { Activity, ActivityTypes } from '@microsoft/agents-activity'
import { AgentApplication, TurnContext } from '@microsoft/agents-hosting'
import { TeamsAgentExtension } from './teamsAgentExtension'
import { TeamsTurnContext } from './teamsTurnContext'

function createContext (channelId: string = 'msteams', type: string = ActivityTypes.Message): TurnContext {
  const adapter = {
    ConnectorClientKey: Symbol('ConnectorClient'),
    async sendActivities (_context: TurnContext, activities: Activity[]) {
      return activities.map((_activity, index) => ({ id: `activity-${index}` }))
    }
  } as any

  const context = new TurnContext(
    adapter,
    Activity.fromObject({
      type,
      channelId,
      serviceUrl: 'https://service.example.com',
      conversation: { id: 'conversation-id' },
      recipient: { id: 'bot' },
      from: { id: 'user' },
      channelData: { eventType: 'editMessage' },
      text: 'hello'
    })
  )

  context.turnState.set(adapter.ConnectorClientKey, {
    httpClient: {
      baseURL: 'https://service.example.com',
      defaultHeaders: {
        Authorization: 'Bearer token',
        'User-Agent': 'test-agent'
      }
    }
  })

  return context
}

describe('TeamsAgentExtension', () => {
  it('creates a Teams turn context during Teams turns', async () => {
    const app = new AgentApplication()
    const extension = new TeamsAgentExtension(app)

    app.registerExtension(extension, () => {})
    app.onActivity(ActivityTypes.Message, async () => {})

    const context = createContext()
    const handled = await app.runInternal(context)
    const teamsContext = new TeamsTurnContext(context)

    assert.strictEqual(handled, true)
    assert.strictEqual(teamsContext.client.serviceUrl, 'https://service.example.com')
  })

  it('does not create a Teams turn context for non-Teams activities', async () => {
    const app = new AgentApplication()
    const extension = new TeamsAgentExtension(app)

    app.registerExtension(extension, () => {})
    app.onActivity(ActivityTypes.Message, async () => {})

    const context = createContext('emulator')
    const handled = await app.runInternal(context)

    assert.strictEqual(handled, true)
    assert.throws(() => new TeamsTurnContext(context).client, /Teams API client is not available/)
  })

  it('passes TeamsTurnContext to Teams handlers', async () => {
    const app = new AgentApplication()
    const extension = new TeamsAgentExtension(app)
    let handlerContext: TeamsTurnContext | undefined

    app.registerExtension(extension, (teams) => {
      teams.messages.onMessageEdit(async (context) => {
        handlerContext = context
      })
    })

    const context = createContext('msteams', ActivityTypes.MessageUpdate)
    const handled = await app.runInternal(context)

    assert.strictEqual(handled, true)
    assert.ok(handlerContext)
    assert.strictEqual(handlerContext.client.serviceUrl, 'https://service.example.com')
    assert.strictEqual(typeof handlerContext.sendTargetedActivity, 'function')
    assert.strictEqual(typeof handlerContext.sendTargetedActivities, 'function')
  })
})
