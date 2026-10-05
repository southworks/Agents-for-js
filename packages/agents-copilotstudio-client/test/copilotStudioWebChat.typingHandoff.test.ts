import { strict as assert } from 'node:assert'
import { it, type TestContext } from 'node:test'
import { Activity, ExceptionHelper } from '@microsoft/agents-activity'
import { CopilotStudioClient } from '../src/copilotStudioClient'
import { CopilotStudioWebChat } from '../src/copilotStudioWebChat'
import { Errors } from '../src/errorHelper'

function createTestConnection (t: TestContext, responses: () => AsyncGenerator<Activity>, showTyping = true) {
  const client = { sendActivityStreaming: responses } as unknown as CopilotStudioClient
  const connection = CopilotStudioWebChat.createConnection(client, { startConversation: false, showTyping })
  t.after(() => connection.end())
  const received: Partial<Activity>[] = []
  connection.activity$.subscribe(activity => received.push(activity))
  const post = () => new Promise<void>((resolve, reject) => {
    connection.postActivity(Activity.fromObject({ type: 'message', text: 'test' })).subscribe({
      complete: resolve,
      error: reject
    })
  })
  return { received, post }
}

function assertFallbackClosed (received: Partial<Activity>[]) {
  const initial = received.find(activity => activity.from?.id === 'agent' && activity.channelData?.streamType === 'streaming')
  assert.ok(initial)
  const finals = received.filter(activity => activity.from?.id === 'agent' && activity.channelData?.streamType === 'final')
  assert.equal(finals.length, 1)
  assert.equal(finals[0].channelData?.streamId, initial.id)
  assert.equal(finals[0].text, '')
  assert.equal(finals[0].type, 'typing')
}

it('hands SDK typing over to service progress before the response ends', async (t) => {
  let release!: () => void
  let progressReceived!: () => void
  const waiting = new Promise<void>(resolve => { release = resolve })
  const ready = new Promise<void>(resolve => { progressReceived = resolve })
  const client = {
    async * sendActivityStreaming () {
      yield Activity.fromObject({
        id: 'progress',
        type: 'typing',
        text: 'Processing',
        from: { id: 'service-bot', role: 'bot' },
        channelData: { streamType: 'informative', streamSequence: 1 }
      })
      progressReceived()
      await waiting
    }
  } as unknown as CopilotStudioClient
  const connection = CopilotStudioWebChat.createConnection(client, { startConversation: false, showTyping: true })
  t.after(() => connection.end())
  const received: Partial<Activity>[] = []
  connection.activity$.subscribe(activity => received.push(activity))
  const done = new Promise<void>((resolve, reject) => {
    connection.postActivity(Activity.fromObject({ type: 'message', text: 'test' })).subscribe({
      complete: resolve,
      error: reject
    })
  })
  await ready
  const beforeEnd = [...received]
  release()
  await done
  const initial = beforeEnd.find(activity => activity.type === 'typing' && activity.from?.id === 'agent')
  assert.ok(initial, 'Typing should be shown while waiting for the service')
  const finalIndex = beforeEnd.findIndex(activity => activity.from?.id === initial.from?.id &&
    activity.channelData?.streamType === 'final' && activity.channelData?.streamId === initial.id)
  const progressIndex = beforeEnd.findIndex(activity => activity.id === 'progress')
  assert.ok(finalIndex >= 0 && finalIndex < progressIndex, 'SDK typing must be cleared before displaying service progress')
  assert.equal(beforeEnd[progressIndex].text, 'Processing')
})

for (const responseType of ['message', 'typing'] as const) {
  it(`hands typing over to a service ${responseType} even without informative progress`, async (t) => {
    const { received, post } = createTestConnection(t, async function * () {
      yield Activity.fromObject({ id: 'service', type: responseType, from: { id: 'service-bot' }, text: responseType === 'message' ? 'Answer' : '' })
    })
    await post()
    assertFallbackClosed(received)
    const finalIndex = received.findIndex(activity => activity.channelData?.streamType === 'final')
    assert.ok(finalIndex < received.findIndex(activity => activity.id === 'service'))
  })
}

it('cleans up fallback typing on an empty response', async (t) => {
  const { received, post } = createTestConnection(t, async function * () {})
  await post()
  assertFallbackClosed(received)
  assert.equal(received.filter(activity => activity.type === 'message').length, 1)
})

it('cleans up fallback typing while preserving request errors', async (t) => {
  const error = ExceptionHelper.generateException(Error, Errors.ConnectionAlreadyEnded)
  const { received, post } = createTestConnection(t, async function * () {
    throw error
  })
  await assert.rejects(post(), error)
  assertFallbackClosed(received)
})

it('does not generate fallback activities when showTyping is disabled', async (t) => {
  const { received, post } = createTestConnection(t, async function * () {
    yield Activity.fromObject({ id: 'progress', type: 'typing', text: 'Processing', from: { id: 'service-bot' } })
  }, false)
  await post()
  assert.ok(!received.some(activity => activity.from?.id === 'agent'))
  assert.ok(received.some(activity => activity.id === 'progress'))
})

it('hands greeting typing over to service progress', async (t) => {
  let started!: () => void
  const ready = new Promise<void>(resolve => { started = resolve })
  const client = {
    async * startConversationStreaming () {
      yield Activity.fromObject({
        id: 'greeting-progress',
        type: 'typing',
        text: 'Processing',
        from: { id: 'service-bot' },
        channelData: { streamType: 'informative', streamSequence: 1 }
      })
      started()
    }
  } as unknown as CopilotStudioClient
  const connection = CopilotStudioWebChat.createConnection(client, { showTyping: true })
  t.after(() => connection.end())
  const received: Partial<Activity>[] = []
  connection.activity$.subscribe(activity => received.push(activity))
  await ready
  assertFallbackClosed(received)
  assert.equal(received.at(-1)?.id, 'greeting-progress')
})

it('keeps overlapping fallback streams independent', async (t) => {
  let release!: () => void
  let started!: () => void
  const waiting = new Promise<void>(resolve => { release = resolve })
  const ready = new Promise<void>(resolve => { started = resolve })
  let requests = 0
  const { received, post } = createTestConnection(t, async function * () {
    if (requests++ === 0) {
      started()
      await waiting
    } else {
      yield Activity.fromObject({ id: 'progress', type: 'typing', text: 'Processing', from: { id: 'service-bot' } })
    }
  })
  const first = post()
  await ready
  await post()
  const starts = received.filter(activity => activity.from?.id === 'agent' && activity.channelData?.streamType === 'streaming')
  const finalsBeforeRelease = received.filter(activity => activity.from?.id === 'agent' && activity.channelData?.streamType === 'final')
  release()
  await first
  assert.equal(starts.length, 2)
  assert.equal(finalsBeforeRelease.length, 1)
  assert.equal(finalsBeforeRelease[0].channelData?.streamId, starts[1].id)
  assert.equal(received.at(-1)?.channelData?.streamId, starts[0].id)
})
