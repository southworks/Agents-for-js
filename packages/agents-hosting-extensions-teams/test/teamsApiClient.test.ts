import assert from 'node:assert'
import { describe, it } from 'node:test'
import { TurnContext } from '@microsoft/agents-hosting'
import { Activity } from '@microsoft/agents-activity'
import { getTeamsClient, setTeamsApiClient, TeamsApiClientKey } from '../src/teamsApiClient'
import { SetTeamsApiClientMiddleware } from '../src/compat/setTeamsApiClientMiddleware'

function createContext (channelId: string = 'msteams'): TurnContext {
  const context = new TurnContext(
    {
      ConnectorClientKey: Symbol('ConnectorClient')
    } as any,
    Activity.fromObject({
      type: 'message',
      channelId,
      serviceUrl: 'https://service.example.com'
    })
  )

  context.turnState.set(context.adapter.ConnectorClientKey, {
    axiosInstance: {
      defaults: {
        baseURL: 'https://service.example.com',
        headers: {
          common: {
            Authorization: 'Bearer token',
            'User-Agent': 'test-agent',
            'X-Trace': 123
          }
        }
      }
    }
  })

  return context
}

describe('teamsApiClient', () => {
  it('sets teams client in turn state for Teams activities', () => {
    const context = createContext()

    setTeamsApiClient(context)

    assert.ok(context.turnState.has(TeamsApiClientKey))
    assert.strictEqual(getTeamsClient(context).serviceUrl, 'https://service.example.com')
  })

  it('does not set teams client for non-Teams activities', () => {
    const context = createContext('emulator')

    setTeamsApiClient(context)

    assert.strictEqual(context.turnState.has(TeamsApiClientKey), false)
  })

  it('middleware populates the teams client before continuing', async () => {
    const context = createContext()
    const middleware = new SetTeamsApiClientMiddleware()
    let nextCalled = false

    await middleware.onTurn(context, async () => {
      nextCalled = true
      assert.ok(context.turnState.has(TeamsApiClientKey))
    })

    assert.strictEqual(nextCalled, true)
  })
})
