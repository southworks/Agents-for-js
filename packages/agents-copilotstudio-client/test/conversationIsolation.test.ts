import { strict as assert } from 'node:assert'
import { describe, it } from 'node:test'
import { Activity } from '@microsoft/agents-activity'
import { firstValueFrom, filter } from 'rxjs'
import { CopilotStudioClient } from '../src/copilotStudioClient'
import { CopilotStudioWebChat } from '../src/copilotStudioWebChat'

function signal () {
  let complete!: () => void
  const promise = new Promise<void>((resolve) => { complete = resolve })
  return { promise, resolve: complete }
}

function startResponse (id?: string, activity?: object) {
  const reading = signal()
  const finish = signal()
  let sentActivity = false
  const body = new ReadableStream<Uint8Array>({
    async pull (controller) {
      reading.resolve()
      if (activity && !sentActivity) {
        sentActivity = true
        controller.enqueue(new TextEncoder().encode(`event: activity\ndata: ${JSON.stringify(activity)}\n\n`))
        return
      }
      await finish.promise
      controller.enqueue(new TextEncoder().encode('event: end\ndata: done\n\n'))
      controller.close()
    }
  })
  return {
    reading,
    finish,
    response: new Response(body, {
      headers: { 'Content-Type': 'text/event-stream', ...(id && { 'x-ms-conversationid': id }) }
    })
  }
}

function client () {
  return new CopilotStudioClient({ directConnectUrl: 'https://fixture.example/api' }, 'test-token')
}

describe('shared client conversation isolation', () => {
  it('preserves WebChat activity-ID precedence when the header disagrees', async (t) => {
    const responses = [
      startResponse('header-A', { type: 'message', text: 'Hello', conversation: { id: 'activity-A' } }),
      startResponse('activity-A')
    ]
    responses.forEach(response => response.finish.resolve())
    let index = 0
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => responses[index++].response)
    const connection = CopilotStudioWebChat.createConnection(client())
    const subscription = connection.activity$.subscribe()
    try {
      await firstValueFrom(connection.postActivity(Activity.fromObject({ type: 'message', text: 'Follow-up' })))
      assert.match(String(fetchMock.mock.calls[1].arguments[0]), /\/conversations\/activity-A\?/)
    } finally {
      connection.end()
      subscription.unsubscribe()
    }
  })

  it('streams startup activities before returning header metadata', async (t) => {
    const response = startResponse('header-A', { type: 'message', text: 'Hello', conversation: { id: 'activity-A' } })
    t.mock.method(globalThis, 'fetch', async () => response.response)
    const stream = client().startConversationStreaming({ locale: 'fr-FR' })
    try {
      const first = await stream.next()
      assert.equal(first.done, false)
      assert.equal(first.value.text, 'Hello')
      response.finish.resolve()
      const final = await stream.next()
      assert.equal(final.done, true)
      assert.equal(final.value, 'header-A')
    } finally {
      response.finish.resolve()
      await stream.return(undefined)
    }
  })

  it('uses a non-message activity ID when the header is absent', async (t) => {
    const response = startResponse(undefined, { type: 'event', name: 'ready', conversation: { id: 'event-A' } })
    response.finish.resolve()
    t.mock.method(globalThis, 'fetch', async () => response.response)
    const result = await client().startConversationWithResponse(false)
    assert.equal(result.conversationId, 'event-A')
  })

  it('closes the request when startup streaming is stopped early', async (t) => {
    const response = startResponse('A', { type: 'message', text: 'Hello', conversation: { id: 'A' } })
    let requestSignal: AbortSignal | null | undefined
    t.mock.method(globalThis, 'fetch', async (_url: string | URL | Request, init?: RequestInit) => {
      requestSignal = init?.signal
      return response.response
    })
    const stream = client().startConversationStreaming()
    try {
      const first = await stream.next()
      assert.equal(first.done, false)
      assert.equal(requestSignal?.aborted, false)
      await stream.return(undefined)
      assert.equal(requestSignal?.aborted, true)
    } finally {
      response.finish.resolve()
      await stream.return(undefined)
    }
  })

  it('uses the supplied start ID when the response has no ID', async (t) => {
    const response = startResponse()
    response.finish.resolve()
    t.mock.method(globalThis, 'fetch', async () => response.response)
    const result = await client().startConversationWithResponse({ conversationId: 'supplied-A', emitStartConversationEvent: false })
    assert.equal(result.conversationId, 'supplied-A')
  })

  it('prefers a response activity ID over a supplied start ID', async (t) => {
    const response = startResponse(undefined, { type: 'message', text: 'Hello', conversation: { id: 'server-A' } })
    response.finish.resolve()
    t.mock.method(globalThis, 'fetch', async () => response.response)
    const result = await client().startConversationWithResponse({ conversationId: 'requested-A' })
    assert.equal(result.conversationId, 'server-A')
  })

  it('preserves implicit default updates for startup streaming', async (t) => {
    const responses = [startResponse('legacy-A'), startResponse('stream-B'), startResponse('stream-B')]
    responses.forEach(response => response.finish.resolve())
    let index = 0
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => responses[index++].response)
    const shared = client()
    await shared.startConversationWithResponse(false)
    const streamed = await shared.startConversationStreaming(false).next()
    assert.equal(streamed.done, true)
    assert.equal(streamed.value, 'stream-B')
    await shared.sendActivity(Activity.fromObject({ type: 'message', text: 'Legacy follow-up' }))
    assert.match(String(fetchMock.mock.calls[2].arguments[0]), /\/conversations\/stream-B\?/)
  })

  it('preserves empty-ID start results without borrowing a prior conversation', async (t) => {
    const responses = [startResponse('prior-A'), startResponse()]
    responses.forEach(response => response.finish.resolve())
    let index = 0
    t.mock.method(globalThis, 'fetch', async () => responses[index++].response)
    const shared = client()
    await shared.startConversationAsync(false)
    const result = await shared.startConversationWithResponse(false)
    assert.equal(result.conversationId, '')
    assert.deepEqual(result.activities, [])
  })

  it('preserves activity-ID precedence and the header-based implicit default', async (t) => {
    const responses = [
      startResponse('header-A', { type: 'message', text: 'Hello', conversation: { id: 'activity-A' } }),
      startResponse('header-A')
    ]
    responses.forEach(response => response.finish.resolve())
    let index = 0
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => responses[index++].response)
    const shared = client()
    const result = await shared.startConversationWithResponse()
    assert.equal(result.conversationId, 'activity-A')
    await shared.sendActivity(Activity.fromObject({ type: 'message', text: 'Follow-up' }))
    assert.match(String(fetchMock.mock.calls[1].arguments[0]), /\/conversations\/header-A\?/)
  })

  for (const finishFirst of [0, 1]) {
    it(`returns request-local header IDs when start ${finishFirst + 1} finishes first`, async (t) => {
      const responses = [startResponse('A'), startResponse('B')]
      let index = 0
      t.mock.method(globalThis, 'fetch', async () => responses[index++].response)
      const shared = client()
      const starts = [shared.startConversationWithResponse(false), shared.startConversationWithResponse(false)]
      try {
        await Promise.all(responses.map(response => response.reading.promise))
        responses[finishFirst].finish.resolve()
        await starts[finishFirst]
        responses[1 - finishFirst].finish.resolve()
        const [a, b] = await Promise.all(starts)
        assert.equal(a.conversationId, 'A')
        assert.equal(b.conversationId, 'B')
        assert.deepEqual(a.activities, [])
        assert.deepEqual(b.activities, [])
      } finally {
        responses.forEach(response => response.finish.resolve())
        await Promise.allSettled(starts)
      }
    })
  }

  it('keeps a pending start ID isolated from an explicit continuation response', async (t) => {
    const a = startResponse('A')
    const b = startResponse('B')
    b.finish.resolve()
    let index = 0
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => [a, b][index++].response)
    const shared = client()
    const pending = shared.startConversationWithResponse(false)
    try {
      await a.reading.promise
      await shared.executeWithResponse(Activity.fromObject({ type: 'message', text: 'B' }), 'B')
      a.finish.resolve()
      assert.equal((await pending).conversationId, 'A')
      assert.match(String(fetchMock.mock.calls[1].arguments[0]), /\/conversations\/B\?/)
    } finally {
      a.finish.resolve()
      await Promise.allSettled([pending])
    }
  })

  it('routes concurrent explicit sends independently in the URL and request body', async (t) => {
    const responses = [startResponse('A'), startResponse('B')]
    let index = 0
    const requests: { url: string, id: string }[] = []
    t.mock.method(globalThis, 'fetch', async (url: string | URL | Request, init?: RequestInit) => {
      requests.push({ url: String(url), id: JSON.parse(String(init?.body)).conversationId })
      return responses[index++].response
    })
    const shared = client()
    const turns = ['A', 'B'].map(id => shared.executeWithResponse(Activity.fromObject({ type: 'message', text: id }), id))
    try {
      await Promise.all(responses.map(response => response.reading.promise))
      responses[1].finish.resolve()
      await turns[1]
      responses[0].finish.resolve()
      assert.deepEqual((await Promise.all(turns)).map(result => result.conversationId), ['A', 'B'])
      assert.deepEqual(requests.map(request => request.id), ['A', 'B'])
      assert.match(requests[0].url, /\/conversations\/A\?/)
      assert.match(requests[1].url, /\/conversations\/B\?/)
    } finally {
      responses.forEach(response => response.finish.resolve())
      await Promise.allSettled(turns)
    }
  })

  it('waits for startup completion before posting while greeting activities still stream', async (t) => {
    const startup = startResponse('A', { type: 'message', text: 'Greeting', conversation: { id: 'A' } })
    const turn = startResponse('A')
    turn.finish.resolve()
    const greeting = signal()
    let requests = 0
    t.mock.method(globalThis, 'fetch', async () => ++requests === 1 ? startup.response : turn.response)
    const connection = CopilotStudioWebChat.createConnection(client())
    const subscription = connection.activity$.subscribe(activity => {
      if (activity.text === 'Greeting') {
        greeting.resolve()
      }
    })
    let posted: Promise<void> | undefined
    try {
      await greeting.promise
      posted = new Promise<void>((resolve, reject) => {
        connection.postActivity(Activity.fromObject({ type: 'message', text: 'A' })).subscribe({ complete: resolve, error: reject })
      })
      await new Promise<void>((resolve) => setImmediate(resolve))
      assert.equal(requests, 1, 'A send must wait for its own startup to finish')
      startup.finish.resolve()
      await posted
      assert.equal(requests, 2)
    } finally {
      startup.finish.resolve()
      await Promise.allSettled(posted ? [posted] : [])
      connection.end()
      subscription.unsubscribe()
    }
  })

  it('preserves implicit WebChat sends when startup is disabled', async (t) => {
    const responses = [startResponse('prior-A'), startResponse('prior-A')]
    responses.forEach(response => response.finish.resolve())
    let index = 0
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => responses[index++].response)
    const shared = client()
    await shared.startConversationAsync(false)
    const connection = CopilotStudioWebChat.createConnection(shared, { startConversation: false })
    const subscription = connection.activity$.subscribe()
    try {
      await new Promise<void>((resolve, reject) => {
        connection.postActivity(Activity.fromObject({ type: 'message', text: 'A' })).subscribe({ complete: resolve, error: reject })
      })
      assert.match(String(fetchMock.mock.calls[1].arguments[0]), /\/conversations\/prior-A\?/)
    } finally {
      connection.end()
      subscription.unsubscribe()
    }
  })

  it('preserves WebChat startup and first sends when no start ID is returned', async (t) => {
    const responses = [startResponse(), startResponse('first-reply-A', { type: 'message', text: 'Hello', conversation: { id: 'first-reply-A' } })]
    responses.forEach(response => response.finish.resolve())
    let index = 0
    t.mock.method(globalThis, 'fetch', async () => responses[index++].response)
    const connection = CopilotStudioWebChat.createConnection(client())
    const subscription = connection.activity$.subscribe()
    try {
      await firstValueFrom(connection.connectionStatus$.pipe(filter(status => status === 2)))
      assert.equal(connection.conversationId, undefined)
      await new Promise<void>((resolve, reject) => {
        connection.postActivity(Activity.fromObject({ type: 'message', text: 'A' })).subscribe({ complete: resolve, error: reject })
      })
      assert.equal(connection.conversationId, 'first-reply-A')
    } finally {
      connection.end()
      subscription.unsubscribe()
    }
  })

  it('preserves direct implicit client continuation after WebChat startup', async (t) => {
    const responses = [startResponse('prior-B'), startResponse('webchat-A'), startResponse('webchat-A')]
    responses.forEach(response => response.finish.resolve())
    let index = 0
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => responses[index++].response)
    const shared = client()
    await shared.startConversationAsync(false)
    const connection = CopilotStudioWebChat.createConnection(shared)
    const subscription = connection.activity$.subscribe()
    try {
      await firstValueFrom(connection.connectionStatus$.pipe(filter(status => status === 2)))
      await shared.sendActivity(Activity.fromObject({ type: 'message', text: 'Direct follow-up' }))
      assert.equal(connection.conversationId, 'webchat-A')
      assert.match(String(fetchMock.mock.calls[2].arguments[0]), /\/conversations\/webchat-A\?/)
    } finally {
      connection.end()
      subscription.unsubscribe()
    }
  })

  it('preserves start overrides when returning conversation metadata', async (t) => {
    const shared = client()
    t.mock.method(shared, 'startConversationStreaming', async function * () {
      yield Activity.fromObject({ type: 'message', text: 'Custom start', conversation: { id: 'custom-A' } })
    })
    const result = await shared.startConversationWithResponse()
    assert.equal(result.conversationId, 'custom-A')
    assert.equal(result.activities[0].text, 'Custom start')
  })

  it('preserves header metadata when a start override discards the generator return value', async (t) => {
    const response = startResponse('custom-header-A')
    response.finish.resolve()
    t.mock.method(globalThis, 'fetch', async () => response.response)
    const shared = client()
    const originalStart = shared.startConversationStreaming.bind(shared)
    t.mock.method(shared, 'startConversationStreaming', async function * () {
      yield * originalStart()
    })

    const result = await shared.startConversationWithResponse()

    assert.equal(result.conversationId, 'custom-header-A')
    assert.equal(result.activities.length, 0)
  })

  it('queues a send triggered synchronously by the first typing notification', async (t) => {
    const startup = startResponse('A')
    const turn = startResponse('A')
    turn.finish.resolve()
    let requests = 0
    t.mock.method(globalThis, 'fetch', async () => ++requests === 1 ? startup.response : turn.response)
    const connection = CopilotStudioWebChat.createConnection(client(), { showTyping: true })
    let posted: Promise<void> | undefined
    let postError: unknown
    const subscription = connection.activity$.subscribe(activity => {
      if (activity.type === 'typing' && !posted) {
        posted = new Promise<void>((resolve) => {
          connection.postActivity(Activity.fromObject({ type: 'message', text: 'A' })).subscribe({
            complete: resolve,
            error: error => {
              postError = error
              resolve()
            }
          })
        })
      }
    })
    try {
      await new Promise<void>((resolve) => setImmediate(resolve))
      assert.ok(posted)
      assert.equal(postError, undefined)
      assert.equal(requests, 1)
      startup.finish.resolve()
      await posted
      assert.equal(postError, undefined)
      assert.equal(requests, 2)
    } finally {
      startup.finish.resolve()
      await Promise.allSettled(posted ? [posted] : [])
      connection.end()
      subscription.unsubscribe()
    }
  })

  it('routes an activity with a whitespace ID using the configured resume ID', async (t) => {
    const response = startResponse('A')
    response.finish.resolve()
    const fetchMock = t.mock.method(globalThis, 'fetch', async () => response.response)
    const connection = CopilotStudioWebChat.createConnection(client(), { conversationId: 'A' })
    const subscription = connection.activity$.subscribe()
    try {
      await new Promise<void>((resolve, reject) => {
        connection.postActivity(Activity.fromObject({ type: 'message', text: 'A', conversation: { id: ' ' } })).subscribe({ complete: resolve, error: reject })
      })
      assert.match(String(fetchMock.mock.calls[0].arguments[0]), /\/conversations\/A\?/)
      const payload = JSON.parse(String(fetchMock.mock.calls[0].arguments[1]?.body))
      assert.equal(payload.activity.conversation.id, 'A')
    } finally {
      connection.end()
      subscription.unsubscribe()
    }
  })

  it('isolates two WebChat connections with header-only starts', async (t) => {
    const destinations: string[] = []
    let starts = 0
    t.mock.method(globalThis, 'fetch', async (url: string | URL | Request, init?: RequestInit) => {
      const request = JSON.parse(String(init?.body))
      const id = request.activity ? new URL(String(url)).pathname.split('/').at(-1)! : `conversation-${++starts}`
      const response = startResponse(id, request.activity && { type: 'message', text: 'echo', conversation: { id } })
      response.finish.resolve()
      if (request.activity) {
        destinations.push(id)
      }
      return response.response
    })
    const shared = client()
    const a = CopilotStudioWebChat.createConnection(shared)
    const b = CopilotStudioWebChat.createConnection(shared)
    const subscriptions = [a.activity$.subscribe(), b.activity$.subscribe()]
    try {
      await Promise.all([a, b].map(connection => firstValueFrom(connection.connectionStatus$.pipe(filter(status => status === 2)))))
      await new Promise<void>((resolve, reject) => {
        a.postActivity(Activity.fromObject({ type: 'message', text: 'A' })).subscribe({ complete: resolve, error: reject })
      })
      await new Promise<void>((resolve, reject) => {
        b.postActivity(Activity.fromObject({ type: 'message', text: 'B' })).subscribe({ complete: resolve, error: reject })
      })
      assert.equal(a.conversationId, 'conversation-1')
      assert.equal(b.conversationId, 'conversation-2')
      assert.deepEqual(destinations, ['conversation-1', 'conversation-2'])
    } finally {
      a.end()
      b.end()
      subscriptions.forEach(subscription => subscription.unsubscribe())
    }
  })
})
