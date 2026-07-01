import assert from 'node:assert'
import { describe, it } from 'node:test'
import { Activity, ActivityTypes } from '@microsoft/agents-activity'
import { AgentApplication, CloudAdapter, INVOKE_RESPONSE_KEY, TurnContext } from '@microsoft/agents-hosting'
import {
  onTeamsActivity,
  onTeamsConversationUpdate,
  onTeamsEvent,
  onTeamsFeedbackLoop,
  onTeamsHandoff,
  onTeamsMessage,
  onTeamsMessageReactionsAdded,
  onTeamsMessageReactionsRemoved
} from '../src/app/teamsAppExtensions'
import { TeamsAgentExtension } from '../src/teamsAgentExtension'
import { TeamsTurnContext } from '../src/teamsTurnContext'

function createContext (activity: Partial<Activity>): TurnContext {
  const adapter = new CloudAdapter()
  const context = new TurnContext(adapter, Activity.fromObject({
    channelId: 'msteams',
    from: { id: 'user' },
    conversation: { id: 'conv' },
    recipient: { id: 'bot' },
    ...activity
  }))
  context.turnState.set(adapter.ConnectorClientKey, {
    httpClient: {
      baseURL: 'https://service.example.com',
      defaultHeaders: {
        Authorization: 'Bearer token'
      }
    }
  })
  return context
}

function createApp<TState = any> (): AgentApplication<TState> {
  const app = new AgentApplication<TState>()
  app.registerExtension(new TeamsAgentExtension(app), () => {})
  return app
}

describe('TeamsAppExtensions', () => {
  it('onTeamsActivity handles matching Teams activity types with TeamsTurnContext', async () => {
    const app = createApp()
    let handled = false

    onTeamsActivity(app, ActivityTypes.Typing, async (context) => {
      handled = true
      assert.ok(context instanceof TeamsTurnContext)
    })

    await app.run(createContext({ type: ActivityTypes.Typing }))

    assert.strictEqual(handled, true)
  })

  it('onTeamsActivity ignores non-Teams activities', async () => {
    const app = createApp()
    let handled = false

    onTeamsActivity(app, ActivityTypes.Message, async () => {
      handled = true
    })

    await app.run(createContext({
      type: ActivityTypes.Message,
      channelId: 'emulator',
      text: 'hello'
    }))

    assert.strictEqual(handled, false)
  })

  it('onTeamsMessage matches exact text case-insensitively and regex text', async () => {
    const app = createApp()
    const handled: string[] = []

    onTeamsMessage(app, 'hello', async () => {
      handled.push('exact')
    })
    onTeamsMessage(app, /help/i, async () => {
      handled.push('regex')
    })

    await app.run(createContext({
      type: ActivityTypes.Message,
      text: 'HELLO'
    }))
    await app.run(createContext({
      type: ActivityTypes.Message,
      text: 'need help'
    }))

    assert.deepStrictEqual(handled, ['exact', 'regex'])
  })

  it('onTeamsConversationUpdate matches Teams member update events', async () => {
    const app = createApp()
    let handled = false

    onTeamsConversationUpdate(app, 'membersAdded', async (context) => {
      handled = true
      assert.ok(context instanceof TeamsTurnContext)
    })

    await app.run(createContext({
      type: ActivityTypes.ConversationUpdate,
      membersAdded: [{ id: 'user' }]
    }))

    assert.strictEqual(handled, true)
  })

  it('onTeamsConversationUpdate treats unknown events as any Teams conversation update', async () => {
    const app = createApp()
    let handled = false

    onTeamsConversationUpdate(app, 'teamRenamed', async () => {
      handled = true
    })

    await app.run(createContext({
      type: ActivityTypes.ConversationUpdate
    }))

    assert.strictEqual(handled, true)
  })

  it('onTeamsEvent matches event names and custom selectors only for Teams event activities', async () => {
    const app = createApp()
    const handled: string[] = []

    onTeamsEvent(app, 'application/vnd.microsoft.readReceipt', async () => {
      handled.push('name')
    })
    onTeamsEvent(app, async (context) => context.activity.value?.kind === 'custom', async () => {
      handled.push('selector')
    })

    await app.run(createContext({
      type: ActivityTypes.Event,
      name: 'APPLICATION/VND.MICROSOFT.READRECEIPT'
    }))
    await app.run(createContext({
      type: ActivityTypes.Event,
      value: { kind: 'custom' }
    }))
    await app.run(createContext({
      type: ActivityTypes.Message,
      value: { kind: 'custom' },
      text: 'not an event'
    }))

    assert.deepStrictEqual(handled, ['name', 'selector'])
  })

  it('onTeamsMessageReactionsAdded and onTeamsMessageReactionsRemoved match Teams message reactions', async () => {
    const app = createApp()
    const handled: string[] = []

    onTeamsMessageReactionsAdded(app, async (context) => {
      handled.push(`added:${context.activity.reactionsAdded?.[0].type}`)
      assert.ok(context instanceof TeamsTurnContext)
    })
    onTeamsMessageReactionsRemoved(app, async (context) => {
      handled.push(`removed:${context.activity.reactionsRemoved?.[0].type}`)
      assert.ok(context instanceof TeamsTurnContext)
    })

    await app.run(createContext({
      type: ActivityTypes.MessageReaction,
      reactionsAdded: [{ type: 'like' }]
    }))
    await app.run(createContext({
      type: ActivityTypes.MessageReaction,
      reactionsRemoved: [{ type: 'like' }]
    }))

    assert.deepStrictEqual(handled, ['added:like', 'removed:like'])
  })

  it('onTeamsHandoff passes the continuation and sends an InvokeResponse', async () => {
    const app = createApp()
    let continuation = ''
    let handlerContext: TeamsTurnContext | undefined

    onTeamsHandoff(app, async (context, _state, token) => {
      handlerContext = context
      continuation = token
    })

    const context = createContext({
      type: ActivityTypes.Invoke,
      name: 'handoff/action',
      value: { continuation: 'handoff-token' }
    })
    await app.run(context)

    const invokeResp = context.turnState.get(INVOKE_RESPONSE_KEY) as Activity | undefined
    assert.ok(handlerContext instanceof TeamsTurnContext)
    assert.strictEqual(continuation, 'handoff-token')
    assert.strictEqual(invokeResp?.type, ActivityTypes.InvokeResponse)
    assert.deepStrictEqual(invokeResp?.value, { status: 200 })
  })

  it('onTeamsFeedbackLoop passes feedback data with replyToId and sends an InvokeResponse', async () => {
    const app = createApp()
    let feedbackReaction: string | undefined
    let feedbackReplyToId: string | undefined

    onTeamsFeedbackLoop(app, async (context, _state, feedbackData) => {
      assert.ok(context instanceof TeamsTurnContext)
      feedbackReaction = feedbackData.actionValue?.reaction
      feedbackReplyToId = feedbackData.replyToId
    })

    const context = createContext({
      type: ActivityTypes.Invoke,
      name: 'message/submitAction',
      replyToId: 'reply-1',
      value: {
        actionName: 'feedback',
        actionValue: {
          reaction: 'like',
          feedback: 'helpful'
        }
      }
    })
    await app.run(context)

    const invokeResp = context.turnState.get(INVOKE_RESPONSE_KEY) as Activity | undefined
    assert.strictEqual(feedbackReaction, 'like')
    assert.strictEqual(feedbackReplyToId, 'reply-1')
    assert.strictEqual(invokeResp?.type, ActivityTypes.InvokeResponse)
    assert.deepStrictEqual(invokeResp?.value, { status: 200 })
  })
})
