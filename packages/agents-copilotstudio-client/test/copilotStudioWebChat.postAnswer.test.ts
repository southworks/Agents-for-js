import { strict as assert } from 'node:assert'
import { it, type TestContext } from 'node:test'
import { Activity } from '@microsoft/agents-activity'
import { CopilotStudioClient } from '../src/copilotStudioClient'
import { CopilotStudioWebChat } from '../src/copilotStudioWebChat'

function thought (id: string, sender = 'bot'): Activity {
  return Activity.fromObject({
    id,
    type: 'typing',
    text: '',
    from: { id: sender, role: 'bot' },
    channelData: { streamType: 'streaming', streamSequence: 1 },
    entities: [{ type: 'thought', status: 'incomplete' }]
  })
}

function answer (id: string): Activity {
  return Activity.fromObject({
    id,
    type: 'message',
    text: 'Total sales: 370 units.',
    from: { id: 'bot', role: 'bot' },
    channelData: { streamType: 'final', streamId: 'before-answer' }
  })
}

function connectionFor (t: TestContext, client: CopilotStudioClient) {
  const connection = CopilotStudioWebChat.createConnection(client, { startConversation: false, showTyping: true })
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

it('does not forward post-answer empty thoughts while the service response is still running', async (t) => {
  let release!: () => void
  let reachedThought!: () => void
  const waiting = new Promise<void>(resolve => { release = resolve })
  const ready = new Promise<void>(resolve => { reachedThought = resolve })
  const client = {
    async * sendActivityStreaming () {
      yield thought('before-answer')
      yield answer('answer')
      yield thought('after-answer')
      reachedThought()
      await waiting
    }
  } as unknown as CopilotStudioClient
  const connection = CopilotStudioWebChat.createConnection(client, { startConversation: false })
  t.after(() => connection.end())
  const received: Partial<Activity>[] = []
  connection.activity$.subscribe(activity => received.push(activity))
  const done = new Promise<void>((resolve, reject) => {
    connection.postActivity(Activity.fromObject({ type: 'message', text: 'reproduce 881' })).subscribe({
      complete: resolve,
      error: reject
    })
  })
  await ready
  // Assert before SSE ends: end-of-response cleanup cannot satisfy this check.
  const thoughtWasForwarded = received.some(activity => activity.id === 'after-answer')
  release()
  await done
  assert.ok(received.some(activity => activity.id === 'before-answer'))
  assert.ok(received.some(activity => activity.id === 'answer'))
  assert.equal(thoughtWasForwarded, false, 'Empty thoughts reopen WebChat busy after the answer')
})

it('preserves visible progress, partial follow-up answers, cards, and stream finals', async (t) => {
  const progress = Activity.fromObject({ ...thought('progress'), text: 'Searching another source' })
  const partial = Activity.fromObject({ ...thought('partial'), text: 'Another answer' })
  const erasePartial = Activity.fromObject({
    ...thought('erase-partial'),
    channelData: { streamType: 'streaming', streamId: 'partial', streamSequence: 2 }
  })
  const card = Activity.fromObject({
    ...thought('card'),
    attachments: [{ contentType: 'application/vnd.microsoft.card.adaptive', content: { type: 'AdaptiveCard' } }]
  })
  const schema = Activity.fromObject({
    ...thought('schema'),
    entities: [{ type: 'thought' }, { type: 'https://schema.org/Message', '@id': '', abstract: 'Working' }]
  })
  const final = Activity.fromObject({
    ...thought('final'),
    channelData: { streamType: 'final', streamId: 'partial' }
  })
  const entityFinal = Activity.fromObject({
    ...thought('entity-final'),
    channelData: undefined,
    entities: [{ type: 'thought' }, { type: 'streaminfo', streamType: 'final', streamId: 'card' }]
  })
  const client = {
    async * sendActivityStreaming () {
      for (const activity of [answer('answer'), thought('hidden'), progress, partial, erasePartial, card, schema, final, entityFinal, answer('second-answer')]) {
        yield activity
      }
    }
  } as unknown as CopilotStudioClient
  const { received, post } = connectionFor(t, client)
  await post()
  const ids = received.filter(activity => activity.from?.id === 'bot').map(activity => activity.id)
  assert.deepEqual(ids, ['answer', 'progress', 'partial', 'erase-partial', 'card', 'schema', 'final', 'entity-final', 'second-answer'])
})

it('keeps senders and subsequent response requests independent', async (t) => {
  let request = 0
  const client = {
    async * sendActivityStreaming () {
      if (request++ === 0) {
        yield answer('answer')
        yield thought('hidden')
        yield thought('other-sender', 'other-bot')
      } else {
        yield thought('next-turn')
        yield answer('next-answer')
      }
    }
  } as unknown as CopilotStudioClient
  const { received, post } = connectionFor(t, client)
  await post()
  await post()
  assert.ok(!received.some(activity => activity.id === 'hidden'))
  assert.ok(received.some(activity => activity.id === 'other-sender'))
  assert.ok(received.some(activity => activity.id === 'next-turn'))
})

it('does not treat empty message activities as delivered answers', async (t) => {
  const client = {
    async * sendActivityStreaming () {
      yield Activity.fromObject({ ...answer('empty'), text: '' })
      yield thought('still-working')
    }
  } as unknown as CopilotStudioClient
  const { received, post } = connectionFor(t, client)
  await post()
  assert.ok(received.some(activity => activity.id === 'still-working'))
})

it('keeps a hidden stream hidden until it produces visible content', async (t) => {
  const client = {
    async * sendActivityStreaming () {
      yield answer('answer')
      yield thought('hidden')
      yield Activity.fromObject({
        ...thought('hidden-update'),
        channelData: { streamType: 'streaming', streamId: 'hidden', streamSequence: 2 },
        entities: []
      })
      yield Activity.fromObject({
        ...thought('visible-update'),
        text: 'Follow-up answer',
        channelData: { streamType: 'streaming', streamId: 'hidden', streamSequence: 3 }
      })
      yield Activity.fromObject({
        ...thought('erase-update'),
        channelData: { streamType: 'streaming', streamId: 'hidden', streamSequence: 4 }
      })
    }
  } as unknown as CopilotStudioClient
  const { received, post } = connectionFor(t, client)
  await post()
  assert.deepEqual(received.filter(activity => activity.from?.id === 'bot').map(activity => activity.id),
    ['answer', 'visible-update', 'erase-update'])
})

it('filters trailing greeting thoughts without closing the connection', async (t) => {
  let started!: () => void
  const ready = new Promise<void>(resolve => { started = resolve })
  const client = {
    async * startConversationStreaming () {
      yield answer('greeting')
      yield thought('trailing-greeting-thought')
      started()
    }
  } as unknown as CopilotStudioClient
  const connection = CopilotStudioWebChat.createConnection(client)
  t.after(() => connection.end())
  const received: Partial<Activity>[] = []
  let completed = false
  connection.activity$.subscribe({
    next: activity => received.push(activity),
    complete: () => { completed = true }
  })
  await ready
  assert.deepEqual(received.map(activity => activity.id), ['greeting'])
  assert.equal(completed, false)
})
