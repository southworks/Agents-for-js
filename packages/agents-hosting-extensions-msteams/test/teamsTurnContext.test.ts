import assert from 'node:assert'
import { describe, it } from 'node:test'
import { Activity } from '@microsoft/agents-activity'
import { TurnContext } from '@microsoft/agents-hosting'
import { setTeamsApiClient } from './teamsApiClientExtensions'
import { TeamsTurnContext } from './teamsTurnContext'

function createContext (channelId: string = 'msteams', withConnectorClient: boolean = true, serviceUrl: string | undefined = 'https://service.example.com'): TurnContext {
  const context = new TurnContext(
    {
      ConnectorClientKey: Symbol('ConnectorClient'),
      async sendActivities (_context: TurnContext, activities: Activity[]) {
        return activities.map((_activity, index) => ({ id: `activity-${index}` }))
      }
    } as any,
    Activity.fromObject({
      type: 'message',
      channelId,
      serviceUrl,
      conversation: { id: 'conversation-id', isGroup: true }
    })
  )

  if (withConnectorClient) {
    context.turnState.set(context.adapter.ConnectorClientKey, {
      httpClient: {
        baseURL: 'https://connector.example.com',
        defaultHeaders: {
          Authorization: 'Bearer token',
          'User-Agent': 'test-agent'
        }
      }
    })
  }

  return context
}

describe('TeamsTurnContext', () => {
  it('exposes the Teams client from the current turn', () => {
    const context = createContext()

    setTeamsApiClient(context)
    const teamsContext = new TeamsTurnContext(context)

    assert.strictEqual(teamsContext.client.serviceUrl, 'https://service.example.com')
  })

  it('falls back to ConnectorClient baseURL when activity serviceUrl is missing', () => {
    const context = createContext('msteams', true, undefined)

    setTeamsApiClient(context)
    const teamsContext = new TeamsTurnContext(context)

    assert.strictEqual(teamsContext.client.serviceUrl, 'https://connector.example.com')
  })

  it('does not create a client for non-Teams activities', () => {
    const context = createContext('emulator')

    setTeamsApiClient(context)

    assert.throws(() => new TeamsTurnContext(context).client, /Teams API client is not available/)
  })

  it('throws a setup error when running on Teams channel without ConnectorClient', () => {
    const context = createContext('msteams', false)

    assert.throws(() => {
      setTeamsApiClient(context)
    }, /Teams API client setup failed: missing ConnectorClient in turnState/)
  })

  it('throws a setup error when serviceUrl and connector baseURL are both missing', () => {
    const context = createContext('msteams', true, undefined)
    const connectorClient = context.turnState.get<any>(context.adapter.ConnectorClientKey)
    connectorClient.httpClient.baseURL = ''

    assert.throws(() => {
      setTeamsApiClient(context)
    }, /Teams API client setup failed: missing activity.serviceUrl and ConnectorClient baseURL/)
  })

  it('creates Teams turn contexts over the same turn state', () => {
    const context = createContext()

    setTeamsApiClient(context)

    assert.strictEqual(new TeamsTurnContext(context).client, new TeamsTurnContext(context).client)
  })

  it('sends a cloned targeted activity without mutating the caller activity', async () => {
    const sentActivities: Activity[] = []
    const context = createContext()
    context.adapter.sendActivities = async (_context: TurnContext, activities: Activity[]) => {
      sentActivities.push(...activities)
      return [{ id: 'sent-id' }]
    }

    setTeamsApiClient(context)
    const teamsContext = new TeamsTurnContext(context)
    const activity = Activity.fromObject({ type: 'message', channelId: 'msteams', conversation: { id: 'conversation-id', isGroup: true }, text: 'hello' })

    const response = await teamsContext.sendTargetedActivity(activity)

    assert.strictEqual(response?.id, 'sent-id')
    assert.strictEqual(activity.isTargetedActivity(), false)
    assert.strictEqual(sentActivities[0].isTargetedActivity(), true)
  })

  it('sends cloned targeted activities without mutating caller activities', async () => {
    const sentActivities: Activity[] = []
    const context = createContext()
    context.adapter.sendActivities = async (_context: TurnContext, activities: Activity[]) => {
      sentActivities.push(...activities)
      return activities.map((_activity, index) => ({ id: `sent-${index}` }))
    }

    setTeamsApiClient(context)
    const teamsContext = new TeamsTurnContext(context)
    const activities = [
      Activity.fromObject({ type: 'message', channelId: 'msteams', conversation: { id: 'conversation-id', isGroup: true }, text: 'one' }),
      Activity.fromObject({ type: 'message', channelId: 'msteams', conversation: { id: 'conversation-id', isGroup: true }, text: 'two' })
    ]

    const responses = await teamsContext.sendTargetedActivities(activities)

    assert.deepStrictEqual(responses.map((response) => response.id), ['sent-0', 'sent-1'])
    assert.deepStrictEqual(activities.map((activity) => activity.isTargetedActivity()), [false, false])
    assert.deepStrictEqual(sentActivities.map((activity) => activity.isTargetedActivity()), [true, true])
  })

  it('preserves targeted activity group-only validation', async () => {
    const context = createContext()
    setTeamsApiClient(context)
    const teamsContext = new TeamsTurnContext(context)
    const activity = Activity.fromObject({ type: 'message', channelId: 'msteams', conversation: { id: 'conversation-id', isGroup: false } })

    await assert.rejects(
      () => teamsContext.sendTargetedActivity(activity),
      /Targeted Activity is only supported for Group chat/
    )
  })

  it('is assignable to the public TeamsTurnContext type', () => {
    const context = createContext()
    setTeamsApiClient(context)

    const teamsContext: TeamsTurnContext = new TeamsTurnContext(context)

    assert.strictEqual(typeof teamsContext.sendTargetedActivity, 'function')
  })
})
