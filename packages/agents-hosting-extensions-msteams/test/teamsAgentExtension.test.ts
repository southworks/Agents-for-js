import assert from 'node:assert'
import { describe, it } from 'node:test'
import { Activity, ActivityTypes } from '@microsoft/agents-activity'
import { AgentApplication, HeaderPropagation, TurnContext } from '@microsoft/agents-hosting'
import { TeamsAgentExtension } from '../src/teamsAgentExtension'
import { TEAMS_USER_AGENT_PRODUCT } from '../src/teamsHeaderPropagation'
import { TeamsTurnContext } from '../src/teamsTurnContext'

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

  it('configures header propagation with the Teams user-agent product token', () => {
    const headers = new HeaderPropagation({})
    const app = new AgentApplication()
    let extensionRegistered = false

    const teamsExt = new TeamsAgentExtension(app)

    app.registerExtension<TeamsAgentExtension>(teamsExt, tae => {
      extensionRegistered = true
    })

    // Invoke callback. This is done inside adapter.process()
    app.options.headerPropagation?.(headers)

    assert.strictEqual(extensionRegistered, true)
    assert.strictEqual(headers.outgoing['User-Agent'], TEAMS_USER_AGENT_PRODUCT)
  })

  it('appends the Teams user-agent product token to an incoming user-agent', () => {
    const app = new AgentApplication()
    const teamsExt = new TeamsAgentExtension(app)
    let extensionRegistered = false

    const headers = new HeaderPropagation({ 'user-agent': 'incoming-agent/1.0' })

    app.registerExtension<TeamsAgentExtension>(teamsExt, tae => {
      extensionRegistered = true
    })

    // Invoke callback. This is done inside adapter.process()
    app.options.headerPropagation?.(headers)

    assert.strictEqual(extensionRegistered, true)
    assert.match(headers.outgoing['user-agent'], /incoming-agent\/1\.0/)
    assert.match(headers.outgoing['user-agent'], new RegExp(escapeRegExp(TEAMS_USER_AGENT_PRODUCT)))
  })

  it('composes with existing app header propagation before appending the Teams user-agent product token', () => {
    let extensionRegistered = false
    const app = new AgentApplication({
      headerPropagation: (headers) => {
        headers.add({ 'x-custom-header': 'custom-value' })
        headers.add({ 'User-Agent': 'custom-agent/1.0' })
      }
    })
    const teamsExt = new TeamsAgentExtension(app)

    const headers = new HeaderPropagation({})

    app.registerExtension<TeamsAgentExtension>(teamsExt, tae => {
      extensionRegistered = true
    })

    // Invoke callback. This is done inside adapter.process()
    app.options.headerPropagation?.(headers)

    assert.strictEqual(extensionRegistered, true)
    assert.strictEqual(headers.outgoing['x-custom-header'], 'custom-value')
    assert.match(headers.outgoing['User-Agent'], /custom-agent\/1\.0/)
    assert.match(headers.outgoing['User-Agent'], new RegExp(escapeRegExp(TEAMS_USER_AGENT_PRODUCT)))
  })

  it('copies the propagated Teams user-agent product token to the Teams API client', async () => {
    const app = new AgentApplication()
    const extension = new TeamsAgentExtension(app)

    app.registerExtension(extension, () => {})
    app.onActivity(ActivityTypes.Message, async () => {})

    const headers = new HeaderPropagation({})
    app.options.headerPropagation?.(headers)

    const context = createContext()
    const connectorClient = context.turnState.get<any>(context.adapter.ConnectorClientKey)
    connectorClient.httpClient.defaultHeaders = {
      ...connectorClient.httpClient.defaultHeaders,
      ...headers.outgoing
    }

    await app.runInternal(context)
    const teamsContext = new TeamsTurnContext(context)

    assert.strictEqual((teamsContext.client as any).http.options.headers['User-Agent'], TEAMS_USER_AGENT_PRODUCT)
  })
})

function escapeRegExp (value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
