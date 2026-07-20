import assert from 'node:assert'
import { describe, it } from 'node:test'
import { AgentApplication, CloudAdapter, INVOKE_RESPONSE_KEY, TurnContext } from '@microsoft/agents-hosting'
import { Activity, ActivityTypes } from '@microsoft/agents-activity'
import { TeamsAgentExtension } from '../src/teamsAgentExtension'
import type { AppBasedLinkQuery, MessagingExtensionActionResponse, MessagingExtensionResponse, TaskModuleResponse } from '@microsoft/teams.api'

function addConnectorClientToTurnState (context: TurnContext): void {
  context.turnState.set(context.adapter.ConnectorClientKey, {
    httpClient: {
      baseURL: 'https://service.example.com',
      defaultHeaders: {
        Authorization: 'Bearer token'
      }
    }
  })
}

function createInvokeActivity (name: string, value?: unknown): Activity {
  return Activity.fromObject({
    type: ActivityTypes.Invoke,
    channelId: 'msteams',
    name,
    from: { id: 'user', name: 'User' },
    conversation: { id: 'conv' },
    recipient: { id: 'bot' },
    value: value ?? {}
  })
}

describe('MessageExtension - additional handlers', () => {
  const adapter = new CloudAdapter()

  it('onQuery fires for composeExtension/query with matching commandId string', async () => {
    let handled = false
    const app = new AgentApplication()
    const teamsExt = new TeamsAgentExtension(app)
    app.registerExtension(teamsExt, (tae) => {
      tae.messageExtensions.onQuery('searchCmd', async (_ctx, _state, query): Promise<MessagingExtensionResponse> => {
        handled = true
        assert.strictEqual(query.commandId, 'searchCmd')
        return { composeExtension: { type: 'result', attachmentLayout: 'list', attachments: [] } }
      })
    })

    const activity = createInvokeActivity('composeExtension/query', {
      commandId: 'searchCmd',
      parameters: [{ name: 'query', value: 'test' }]
    })
    const context = new TurnContext(adapter, activity)
    addConnectorClientToTurnState(context)
    await app.run(context)

    assert.strictEqual(handled, true)
    const invokeResp = context.turnState.get(INVOKE_RESPONSE_KEY) as Activity | undefined
    assert.ok(invokeResp)
    const invokeValue = invokeResp.value as any
    assert.strictEqual(invokeValue.status, 200)
    assert.strictEqual(invokeValue.body.composeExtension.type, 'result')
  })

  it('onQuery fires for composeExtension/query with matching commandId regex', async () => {
    let handled = false
    const app = new AgentApplication()
    const teamsExt = new TeamsAgentExtension(app)
    app.registerExtension(teamsExt, (tae) => {
      tae.messageExtensions.onQuery(/search.*/, async (): Promise<MessagingExtensionResponse> => {
        handled = true
        return { composeExtension: { type: 'result', attachmentLayout: 'list', attachments: [] } }
      })
    })

    const activity = createInvokeActivity('composeExtension/query', {
      commandId: 'searchUsers',
      parameters: []
    })
    const context = new TurnContext(adapter, activity)
    addConnectorClientToTurnState(context)
    await app.run(context)
    assert.strictEqual(handled, true)
  })

  it('onQuery does not fire for non-matching commandId', async () => {
    let handled = false
    const app = new AgentApplication()
    const teamsExt = new TeamsAgentExtension(app)
    app.registerExtension(teamsExt, (tae) => {
      tae.messageExtensions.onQuery('searchCmd', async (): Promise<MessagingExtensionResponse> => {
        handled = true
        return { composeExtension: { type: 'result', attachmentLayout: 'list', attachments: [] } }
      })
    })

    const activity = createInvokeActivity('composeExtension/query', {
      commandId: 'otherCmd',
      parameters: []
    })
    const context = new TurnContext(adapter, activity)
    addConnectorClientToTurnState(context)
    await app.run(context)
    assert.strictEqual(handled, false)
  })

  it('onSelectItem fires for composeExtension/selectItem', async () => {
    let handled = false
    let receivedItem: unknown
    const app = new AgentApplication()
    const teamsExt = new TeamsAgentExtension(app)
    app.registerExtension(teamsExt, (tae) => {
      tae.messageExtensions.onSelectItem(async (_ctx, _state, item): Promise<MessagingExtensionResponse> => {
        handled = true
        receivedItem = item
        return { composeExtension: { type: 'result', attachmentLayout: 'list', attachments: [] } }
      })
    })

    const itemValue = { id: 'item-1', title: 'Selected' }
    const activity = createInvokeActivity('composeExtension/selectItem', itemValue)
    const context = new TurnContext(adapter, activity)
    addConnectorClientToTurnState(context)
    await app.run(context)

    assert.strictEqual(handled, true)
    assert.deepStrictEqual(receivedItem, itemValue)
    const invokeResp = context.turnState.get(INVOKE_RESPONSE_KEY) as Activity | undefined
    assert.ok(invokeResp)
    const status = (invokeResp.value as any).status
    assert.strictEqual(status, 200)
  })

  it('onQueryLink fires for composeExtension/queryLink with valid URL', async () => {
    let handled = false
    let receivedQuery: AppBasedLinkQuery | undefined
    const app = new AgentApplication()
    const teamsExt = new TeamsAgentExtension(app)
    app.registerExtension(teamsExt, (tae) => {
      tae.messageExtensions.onQueryLink(async (_ctx, _state, query): Promise<MessagingExtensionResponse> => {
        handled = true
        receivedQuery = query
        return { composeExtension: { type: 'result', attachmentLayout: 'list', attachments: [] } }
      })
    })

    const activity = createInvokeActivity('composeExtension/queryLink', { url: 'https://example.com/page', state: 'magic-code' })
    const context = new TurnContext(adapter, activity)
    addConnectorClientToTurnState(context)
    await app.run(context)

    assert.strictEqual(handled, true)
    assert.deepStrictEqual(receivedQuery, { url: 'https://example.com/page', state: 'magic-code' })
    const invokeResp = context.turnState.get(INVOKE_RESPONSE_KEY) as Activity | undefined
    assert.ok(invokeResp)
    const status = (invokeResp.value as any).status
    assert.strictEqual(status, 200)
  })

  it('onAnonymousQueryLink fires for composeExtension/anonymousQueryLink', async () => {
    let handled = false
    let receivedQuery: AppBasedLinkQuery | undefined
    const app = new AgentApplication()
    const teamsExt = new TeamsAgentExtension(app)
    app.registerExtension(teamsExt, (tae) => {
      tae.messageExtensions.onAnonymousQueryLink(async (_ctx, _state, query): Promise<MessagingExtensionResponse> => {
        handled = true
        receivedQuery = query
        return { composeExtension: { type: 'result', attachmentLayout: 'list', attachments: [] } }
      })
    })

    const activity = createInvokeActivity('composeExtension/anonymousQueryLink', { url: 'https://example.com/anon' })
    const context = new TurnContext(adapter, activity)
    addConnectorClientToTurnState(context)
    await app.run(context)

    assert.strictEqual(handled, true)
    assert.deepStrictEqual(receivedQuery, { url: 'https://example.com/anon' })
  })

  it('onFetchAction fires for composeExtension/fetchTask with matching commandId', async () => {
    let handled = false
    const app = new AgentApplication()
    const teamsExt = new TeamsAgentExtension(app)
    app.registerExtension(teamsExt, (tae) => {
      tae.messageExtensions.onFetchAction('createCard', async (): Promise<TaskModuleResponse> => {
        handled = true
        return { task: { type: 'message', value: 'fetched' } }
      })
    })

    const activity = createInvokeActivity('composeExtension/fetchTask', { commandId: 'createCard' })
    const context = new TurnContext(adapter, activity)
    addConnectorClientToTurnState(context)
    await app.run(context)

    assert.strictEqual(handled, true)
    const invokeResp = context.turnState.get(INVOKE_RESPONSE_KEY) as Activity | undefined
    assert.ok(invokeResp)
    const status = (invokeResp.value as any).status
    assert.strictEqual(status, 200)
    const value = (invokeResp.value as any).body.task.value
    assert.strictEqual(value, 'fetched')
  })

  it('onSubmitAction fires for composeExtension/submitAction with matching commandId', async () => {
    let handled = false
    let receivedData: unknown
    const app = new AgentApplication()
    const teamsExt = new TeamsAgentExtension(app)
    app.registerExtension(teamsExt, (tae) => {
      tae.messageExtensions.onSubmitAction('createCard', async (_ctx, _state, data): Promise<MessagingExtensionActionResponse> => {
        handled = true
        receivedData = data
        return { composeExtension: { type: 'result', attachments: [] } }
      })
    })

    const activity = createInvokeActivity('composeExtension/submitAction', {
      commandId: 'createCard',
      data: { title: 'My Card' }
    })
    const context = new TurnContext(adapter, activity)
    addConnectorClientToTurnState(context)
    await app.run(context)

    assert.strictEqual(handled, true)
    assert.strictEqual((receivedData as any).commandId, 'createCard')
    const invokeResp = context.turnState.get(INVOKE_RESPONSE_KEY) as Activity | undefined
    assert.ok(invokeResp)
    const status = (invokeResp.value as any).status
    assert.strictEqual(status, 200)
  })

  it('onSubmitAction fires when botMessagePreviewAction is set', async () => {
    let handled = false
    let receivedPreviewAction: string | undefined
    const app = new AgentApplication()
    const teamsExt = new TeamsAgentExtension(app)
    app.registerExtension(teamsExt, (tae) => {
      tae.messageExtensions.onSubmitAction('createCard', async (_ctx, _state, action): Promise<MessagingExtensionActionResponse> => {
        handled = true
        receivedPreviewAction = action.botMessagePreviewAction
        return { composeExtension: { type: 'result', attachments: [] } }
      })
    })

    const activity = createInvokeActivity('composeExtension/submitAction', {
      commandId: 'createCard',
      botMessagePreviewAction: 'edit'
    })
    const context = new TurnContext(adapter, activity)
    addConnectorClientToTurnState(context)
    await app.run(context)
    assert.strictEqual(handled, true)
    assert.strictEqual(receivedPreviewAction, 'edit')
  })

  it('onMessagePreviewEdit fires for submitAction with botMessagePreviewAction=edit', async () => {
    let handled = false
    let receivedActivity: Activity | undefined
    const app = new AgentApplication()
    const teamsExt = new TeamsAgentExtension(app)
    app.registerExtension(teamsExt, (tae) => {
      tae.messageExtensions.onMessagePreviewEdit('createCard', async (_ctx, _state, previewActivity): Promise<MessagingExtensionActionResponse> => {
        handled = true
        receivedActivity = previewActivity
        return { composeExtension: { type: 'result', attachments: [] } }
      })
    })

    const activity = createInvokeActivity('composeExtension/submitAction', {
      commandId: 'createCard',
      botMessagePreviewAction: 'edit',
      botActivityPreview: [{ type: ActivityTypes.Message, text: 'Edit preview' }]
    })
    const context = new TurnContext(adapter, activity)
    addConnectorClientToTurnState(context)
    await app.run(context)

    assert.strictEqual(handled, true)
    assert.strictEqual(receivedActivity!.text, 'Edit preview')
    const invokeResp = context.turnState.get(INVOKE_RESPONSE_KEY) as Activity | undefined
    assert.ok(invokeResp)
    const status = (invokeResp.value as any).status
    assert.strictEqual(status, 200)
  })

  it('onMessagePreviewSend fires for submitAction with botMessagePreviewAction=send', async () => {
    let handled = false
    const app = new AgentApplication()
    const teamsExt = new TeamsAgentExtension(app)
    app.registerExtension(teamsExt, (tae) => {
      tae.messageExtensions.onMessagePreviewSend('createCard', async (_ctx, _state, previewActivity) => {
        handled = true
        assert.ok(previewActivity)
      })
    })

    const activity = createInvokeActivity('composeExtension/submitAction', {
      commandId: 'createCard',
      botMessagePreviewAction: 'send',
      botActivityPreview: [{ type: ActivityTypes.Message, text: 'Preview text' }]
    })
    const context = new TurnContext(adapter, activity)
    addConnectorClientToTurnState(context)
    await app.run(context)
    assert.strictEqual(handled, true)
    const invokeResp = context.turnState.get(INVOKE_RESPONSE_KEY) as Activity | undefined
    assert.ok(invokeResp)
    const status = (invokeResp.value as any).status
    assert.strictEqual(status, 200)
    const body = (invokeResp.value as any).body
    assert.deepStrictEqual(body, {})
  })

  it('onMessagePreviewSend passes undefined when botActivityPreview is empty', async () => {
    let handled = false
    let receivedActivity: Activity | undefined
    const app = new AgentApplication()
    const teamsExt = new TeamsAgentExtension(app)
    app.registerExtension(teamsExt, (tae) => {
      tae.messageExtensions.onMessagePreviewSend('createCard', async (_ctx, _state, previewActivity) => {
        handled = true
        receivedActivity = previewActivity
      })
    })

    const activity = createInvokeActivity('composeExtension/submitAction', {
      commandId: 'createCard',
      botMessagePreviewAction: 'send',
      botActivityPreview: []
    })
    const context = new TurnContext(adapter, activity)
    addConnectorClientToTurnState(context)
    await app.run(context)

    assert.strictEqual(handled, true)
    assert.strictEqual(receivedActivity, undefined)
  })

  it('onCardButtonClicked fires and sends InvokeResponse', async () => {
    let handled = false
    let receivedData: unknown
    const app = new AgentApplication()
    const teamsExt = new TeamsAgentExtension(app)
    app.registerExtension(teamsExt, (tae) => {
      tae.messageExtensions.onCardButtonClicked(async (_ctx, _state, cardData) => {
        handled = true
        receivedData = cardData
      })
    })

    const cardValue = { buttonId: 'btn-1', action: 'click' }
    const activity = createInvokeActivity('composeExtension/onCardButtonClicked', cardValue)
    const context = new TurnContext(adapter, activity)
    addConnectorClientToTurnState(context)
    await app.run(context)

    assert.strictEqual(handled, true)
    assert.deepStrictEqual(receivedData, cardValue)
    const invokeResp = context.turnState.get(INVOKE_RESPONSE_KEY) as Activity | undefined
    assert.ok(invokeResp)
    const status = (invokeResp.value as any).status
    assert.strictEqual(status, 200)
  })

  it('message extension handlers do not fire for non-msteams channel', async () => {
    let handled = false
    const app = new AgentApplication()
    const teamsExt = new TeamsAgentExtension(app)
    app.registerExtension(teamsExt, (tae) => {
      tae.messageExtensions.onSelectItem(async (): Promise<MessagingExtensionResponse> => {
        handled = true
        return { composeExtension: { type: 'result', attachmentLayout: 'list', attachments: [] } }
      })
    })

    const activity = createInvokeActivity('composeExtension/selectItem', {})
    activity.channelId = 'emulator'
    const context = new TurnContext(adapter, activity)
    addConnectorClientToTurnState(context)
    await app.run(context)
    assert.strictEqual(handled, false)
  })
})
