import { strict as assert } from 'assert'
import sinon from 'sinon'
import { describe, it, beforeEach } from 'node:test'

import { AgentApplication } from './../../../src/app'
import { TestAdapter } from '../testStubs'
import { Activity, ActivityTypes } from '@microsoft/agents-activity'
import { MessageFactory } from '../../../src/messageFactory'
import { TurnContext } from '../../../src/turnContext'

const testActivity = Activity.fromObject({
  type: 'message',
  from: {
    id: 'test',
    name: 'test'
  },
  conversation: {
    id: 'test'
  },
  channelId: 'test',
  recipient: {
    id: 'test'
  },
  serviceUrl: 'test',
  text: '/yo'
})

describe('Application', () => {
  let sandbox: sinon.SinonSandbox
  let app = new AgentApplication()
  const testAdapter = new TestAdapter()

  beforeEach(() => {
    app = new AgentApplication()
    sandbox = sinon.createSandbox()
    sandbox.stub(app, 'adapter').get(() => testAdapter)
  })
  it('should create an Application with default options', () => {
    const app = new AgentApplication()
    assert.notEqual(app.options, undefined)
    assert.equal(app.options.adapter, undefined)
    assert.equal(app.options.storage, undefined)
    assert.equal(app.options.authorization, undefined)
    assert.equal(app.options.startTypingTimer, false)
  })

  it('should route to an activity handler', async () => {
    let called = false

    app.onActivity(ActivityTypes.Message, async (context, state) => {
      assert.notEqual(context, undefined)
      assert.notEqual(state, undefined)
      called = true
    })
    const context = new TurnContext(testAdapter, testActivity)
    const handled = await app.runInternal(context)
    await context.sendActivity('test')
    assert.equal(called, true)
    assert.equal(handled, true)
  })

  it('should route to a message handler with string', async () => {
    let called = false

    app.onMessage('/yo', async (context, state) => {
      assert.notEqual(context, undefined)
      assert.notEqual(state, undefined)
      called = true
    })
    const context = new TurnContext(testAdapter, testActivity)
    const handled = await app.runInternal(context)
    await context.sendActivity(MessageFactory.text('/yo'))
    assert.equal(called, true)
    assert.equal(handled, true)
  })

  it('should route to a act handler with regex', async () => {
    let called = false

    app.onActivity(/^message/, async (context, state) => {
      assert.notEqual(context, undefined)
      assert.notEqual(state, undefined)
      called = true
    })
    const context = new TurnContext(testAdapter, testActivity)
    const handled = await app.runInternal(context)
    await context.sendActivity(MessageFactory.text('/yo'))
    assert.equal(called, true)
    assert.equal(handled, true)
  })

  it('should route to a msg handler with regex', async () => {
    let called = false

    app.onMessage(/^\/yo/, async (context, state) => {
      assert.notEqual(context, undefined)
      assert.notEqual(state, undefined)
      called = true
    })
    const context = new TurnContext(testAdapter, testActivity)
    const handled = await app.runInternal(context)
    await context.sendActivity(MessageFactory.text('/yo'))
    assert.equal(called, true)
    assert.equal(handled, true)
  })

  it('should ignore sencond message', async () => {
    let timesCalled = 0

    app.onMessage('/yo', async (context, state) => {
      assert.notEqual(context, undefined)
      assert.notEqual(state, undefined)
      timesCalled++
    })
    app.onMessage('/yo', async (context2, state2) => {
      assert.notEqual(context2, undefined)
      assert.notEqual(state2, undefined)
      timesCalled++
    })
    const context = new TurnContext(testAdapter, testActivity)
    const handled = await app.runInternal(context)
    await context.sendActivity('/yo')
    assert.equal(timesCalled, 1)
    assert.equal(handled, true)
  })

  it('should ignore sencond message with act', async () => {
    let timesCalled = 0

    app.onMessage('/yo', async (context, state) => {
      assert.notEqual(context, undefined)
      assert.notEqual(state, undefined)
      timesCalled++
    })
    app.onActivity(ActivityTypes.Message, async (context2, state2) => {
      assert.notEqual(context2, undefined)
      assert.notEqual(state2, undefined)
      timesCalled++
    })
    const context = new TurnContext(testAdapter, testActivity)
    const handled = await app.runInternal(context)
    await context.sendActivity('/yo')
    assert.equal(timesCalled, 1)
    assert.equal(handled, true)
  })
})
