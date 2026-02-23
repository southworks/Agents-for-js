import { strict as assert, strict } from 'assert'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { AuthConfiguration, CloudAdapter, INVOKE_RESPONSE_KEY, MsalConnectionManager, Request, UserTokenClient, TurnContext } from '../../../src'
import sinon, { SinonSandbox } from 'sinon'
import { Activity, ActivityTypes, ConversationReference, DeliveryModes } from '@microsoft/agents-activity'
import { ConnectorClient } from '../../../src/connector-client/connectorClient'
import { Response } from 'express'
import { JwtPayload } from 'jsonwebtoken'

describe('CloudAdapter', function () {
  let sandbox: SinonSandbox
  let mockConnectorClient: sinon.SinonStubbedInstance<ConnectorClient>
  let mockConnectionManager: sinon.SinonStubbedInstance<MsalConnectionManager>
  let mockUserTokenClient: sinon.SinonStubbedInstance<UserTokenClient>
  let cloudAdapter: CloudAdapter
  let req: Request
  let res: Partial<Response>
  let createConnectorClientWithIdentitySpy: sinon.SinonStub

  const authentication: AuthConfiguration = {
    tenantId: 'tenantId',
    clientId: 'clientId',
    clientSecret: 'clientSecret',
    issuers: ['issuers']
  }

  beforeEach(function () {
    sandbox = sinon.createSandbox({ useFakeTimers: true })
    mockConnectorClient = sinon.createStubInstance(ConnectorClient)
    mockConnectionManager = sinon.createStubInstance(MsalConnectionManager)
    mockUserTokenClient = sinon.createStubInstance(UserTokenClient)
    cloudAdapter = new CloudAdapter(authentication);
    (cloudAdapter as any).connectionManager = mockConnectionManager

    sinon.stub(cloudAdapter as any, 'createConnectorClient').returns(mockConnectorClient)
    sinon.stub(cloudAdapter as any, 'createUserTokenClient').returns(mockUserTokenClient)
    createConnectorClientWithIdentitySpy = sinon.stub(cloudAdapter as any, 'createConnectorClientWithIdentity').returns(mockConnectorClient)

    req = {
      headers: {},
      body: {}
    }
    res = {
      status: sinon.stub().returnsThis(),
      send: sinon.stub().returnsThis(),
      end: sinon.stub().returnsThis(),
      setHeader: sinon.stub().returnsThis()
    }
  })

  afterEach(function () {
    if (sandbox) {
      sandbox.restore()
    }
  })

  describe('constructor', function () {
    it('succeeds', function () {
      const ca = new CloudAdapter(authentication)
      strict.notEqual(ca, undefined)
    })
  })

  describe('process', function () {
    it('Should call end with status 200 and a body on invoke activity', async function () {
      const stubfromObject = sinon.stub(Activity, 'fromObject').returns(createActivity(ActivityTypes.Invoke))

      const logic = async (context: TurnContext) => {
        context.turnState.set(INVOKE_RESPONSE_KEY, {
          type: ActivityTypes.InvokeResponse,
          value: {
            status: 200,
            body: 'invokeResponse',
          },
        })
      }

      await cloudAdapter.process(req as Request, res as Response, logic)

      sinon.assert.calledOnceWithExactly((res as any).status, 200)
      sinon.assert.calledOnceWithExactly((res as any).setHeader, 'content-type', 'application/json')
      sinon.assert.calledOnce((res as any).send)
      sinon.assert.calledOnce((res as any).end)
      sinon.assert.calledOnce(createConnectorClientWithIdentitySpy)

      stubfromObject.restore()
    })

    it('Should call end with status 200 and no body on invokeResponse activity', async function () {
      const stubfromObject = sinon.stub(Activity, 'fromObject').returns(createActivity(ActivityTypes.InvokeResponse))

      const logic = async (context: TurnContext) => {
        context.turnState.set(INVOKE_RESPONSE_KEY, {
          type: ActivityTypes.InvokeResponse,
          value: {
            status: 200,
            body: 'invokeResponse',
          },
        })
      }

      await cloudAdapter.process(req as Request, res as Response, logic)

      sinon.assert.calledOnceWithExactly((res as any).status, 200)
      sinon.assert.calledOnceWithExactly((res as any).setHeader, 'content-type', 'application/json')
      sinon.assert.notCalled((res as any).send)
      sinon.assert.calledOnce(createConnectorClientWithIdentitySpy)

      stubfromObject.restore()
    })

    it('Should call end with status 501 on invoke activity with no invokeResponse', async function () {
      const stubfromObject = sinon.stub(Activity, 'fromObject').returns(createActivity(ActivityTypes.Invoke))

      const logic = async (context: TurnContext) => {
        // No invokeResponse set in turnState
      }

      await cloudAdapter.process(req as Request, res as Response, logic)

      sinon.assert.calledOnceWithExactly((res as any).status, 501)
      sinon.assert.calledOnceWithExactly((res as any).setHeader, 'content-type', 'application/json')
      sinon.assert.notCalled((res as any).send)
      sinon.assert.calledOnce(createConnectorClientWithIdentitySpy)

      stubfromObject.restore()
    })

    it('Should call end with status 200 on expectReplies without connectorClient', async function () {
      const activity = createActivity(ActivityTypes.Message)
      activity.deliveryMode = DeliveryModes.ExpectReplies
      activity.text = 'test-message'
      activity.serviceUrl = undefined // Simulate no serviceUrl

      const stubfromObject = sinon.stub(Activity, 'fromObject').returns(activity)

      const logic = async (context: TurnContext) => {
        await context.sendActivity(activity)
      }

      await cloudAdapter.process(req as Request, res as Response, logic)

      sinon.assert.calledOnceWithExactly((res as any).status, 200)
      sinon.assert.calledOnceWithExactly((res as any).setHeader, 'content-type', 'application/json')
      sinon.assert.calledOnceWithExactly((res as any).send, { activities: [activity] })
      sinon.assert.notCalled(createConnectorClientWithIdentitySpy) // No connector client created for ExpectReplies without serviceUrl

      stubfromObject.restore()
    })

    it('Should call end with status 200 on normal delivery mode', async function () {
      const activity = createActivity(ActivityTypes.Message)
      activity.deliveryMode = DeliveryModes.Normal
      activity.text = 'test-message'

      const stubfromObject = sinon.stub(Activity, 'fromObject').returns(activity)

      const logic = async (context: TurnContext) => {
        await context.sendActivity(activity)
      }

      await cloudAdapter.process(req as Request, res as Response, logic)

      sinon.assert.calledOnceWithExactly((res as any).status, 200)
      sinon.assert.notCalled((res as any).setHeader)
      sinon.assert.notCalled((res as any).send)
      sinon.assert.calledOnce(createConnectorClientWithIdentitySpy)

      stubfromObject.restore()
    })
  })

  describe('sendActivities', function () {
    it('throws for bad args', async function () {
      // @ts-expect-error
      await assert.rejects(cloudAdapter.sendActivities(undefined, []), {
        name: 'TypeError',
        message: '[-120090] - context parameter required - https://aka.ms/M365AgentsErrorCodesJS/#-120090'
      })

      // @ts-expect-error
      await assert.rejects(cloudAdapter.sendActivities(new TurnContext(cloudAdapter), undefined), {
        name: 'TypeError',
        message: '[-120070] - activities parameter required - https://aka.ms/M365AgentsErrorCodesJS/#-120070'
      })

      // @ts-expect-error
      await assert.rejects(cloudAdapter.sendActivities(new TurnContext(cloudAdapter), []), {
        name: 'Error',
        message: '[-120060] - Expecting one or more activities, but the array was empty. - https://aka.ms/M365AgentsErrorCodesJS/#-120060'
      })
    })

    it('replies to an activity', async function () {
      // @ts-expect-error
      const context = new TurnContext(cloudAdapter)

      const activity: Activity = Activity.fromObject(
        {
          type: ActivityTypes.Message,
          conversation: {
            id: 'conversationId'
          },
          replyToId: 'replyToId',
          serviceUrl: 'serviceUrl'
        }
      )

      context.turnState.set(cloudAdapter.ConnectorClientKey, mockConnectorClient)
      mockConnectorClient.replyToActivity.resolves({ id: 'id' })

      assert.deepStrictEqual(await cloudAdapter.sendActivities(context, [activity]), [{ id: 'id' }])

      sandbox.verify()
    })

    it('sends an activity to a conversation', async function () {
      // @ts-expect-error
      const context = new TurnContext(cloudAdapter)

      const activity: Activity = Activity.fromObject(
        {
          type: ActivityTypes.Message,
          conversation: {
            id: 'conversationId'
          },
          serviceUrl: 'serviceUrl'
        }
      )
      mockConnectorClient.sendToConversation.resolves({ id: 'id' })

      context.turnState.set(cloudAdapter.ConnectorClientKey, mockConnectorClient)

      assert.deepStrictEqual(await cloudAdapter.sendActivities(context, [activity]), [{ id: 'id' }])

      sandbox.verify()
    })
  })

  describe('continueConversation', function () {
    const bootstrap = () => {
      const logic = sinon.fake((context) => {
        sinon.assert.match(
          context,
          sinon.match({
            activity: {
              name: 'ContinueConversation',
            },
          })
        )
      })

      return {
        logic,
        verify: () => {
          sandbox.verify()
          sinon.assert.called(logic)
        },
      }
    }

    it('works with a botId', async function () {
      const conversationReference: ConversationReference = {
        activityId: '1234',
        user: { id: 'user1', name: 'User' },
        agent: { id: 'bot1', name: 'Bot' },
        conversation: { id: 'conversation1' },
        channelId: 'channel123',
        locale: 'en-US',
        serviceUrl: 'http://example.com'
      }

      const { logic, verify } = bootstrap()

      // @ts-expect-error
      await cloudAdapter.continueConversation(authentication.clientId, conversationReference, logic)

      verify()
    })

    it('throws error', async function () {
      const conversationReference: ConversationReference = {
        activityId: '1234',
        user: { id: 'user1', name: 'User' },
        bot: { id: 'bot1', name: 'Bot' },
        // @ts-expect-error
        conversation: null,
        channelId: 'channel123',
        locale: 'en-US',
        serviceUrl: 'http://example.com'
      }

      const { logic } = bootstrap()

      const error = new Error('[-120130] - continueConversation: Invalid conversation reference object - https://aka.ms/M365AgentsErrorCodesJS/#-120130')

      await assert.rejects(
        cloudAdapter.continueConversation(authentication.clientId as string, conversationReference, (context) => {
          logic(context)

          throw error
        }),
        error
      )
    })
  })

  describe('resolveConnectorScope', function () {
    const agentSingleTenantId = 'SingleTenant-1111-1111-1111-111111111111'
    const agentMultiTenantId = 'botframework.com'
    const agent1AppId = '11111111-1111-1111-1111-111111111111'
    const agent2AppId = '22222222-2222-2222-2222-222222222222'

    it('Agent2(SingleTenant) to Agent1(MultiTenant) should use Bot Framework scope', function () {
      const identity = {
        aud: agent1AppId,
        azp: agent2AppId, // v2.0 tokens use azp for client app id
        iss: `https://sts.windows.net/${agentSingleTenantId}/v2.0`
      } as JwtPayload

      const scope = (cloudAdapter as any).resolveConnectorScope(identity, agentMultiTenantId)

      // Using this scope for SingleTenant to MultiTenant scenario for ConnectorClient calls will fail.
      assert.equal(scope, 'https://api.botframework.com')
    })

    it('Agent2(MultiTenant) to Agent1(SingleTenant) should use Bot Framework scope', function () {
      const identity = {
        aud: agent1AppId,
        azp: agent2AppId, // v2.0 tokens use azp for client app id
        iss: 'https://sts.windows.net/f8cdef31-a31e-4b4a-93e4-5f571e91255a/v2.0'
      } as JwtPayload

      const scope = (cloudAdapter as any).resolveConnectorScope(identity, agentSingleTenantId)

      // Using this scope for MultiTenant to SingleTenant scenario for ConnectorClient calls will fail.
      assert.equal(scope, 'https://api.botframework.com')
    })

    it('[SingleTenant] Agent2 to Agent1 with same tenant should use Agent2 appid as scope', function () {
      const identity = {
        aud: agent1AppId,
        appid: agent2AppId,
        iss: `https://sts.windows.net/${agentSingleTenantId}/v2.0`
      } as JwtPayload

      const scope = (cloudAdapter as any).resolveConnectorScope(identity, agentSingleTenantId)

      assert.equal(scope, agent2AppId)
    })

    it('[SingleTenant] Agent2 to Agent1 with different tenant should use Bot Framework scope', function () {
      const identity = {
        aud: agent1AppId,
        appid: agent2AppId,
        iss: 'https://sts.windows.net/different-tenant/v2.0'
      } as JwtPayload

      const scope = (cloudAdapter as any).resolveConnectorScope(identity, agentSingleTenantId)

      assert.equal(scope, 'https://api.botframework.com')
    })

    it('[SingleTenant] ABS to Agent1 with no azp/appid should use Bot Framework scope', function () {
      const identity = {
        aud: agent1AppId,
        iss: `https://login.microsoftonline.com/${agentSingleTenantId}/v2.0`
      } as JwtPayload

      const scope = (cloudAdapter as any).resolveConnectorScope(identity, agentSingleTenantId)

      assert.equal(scope, 'https://api.botframework.com')
    })

    it('[SingleTenant] same appId and aud should use Bot Framework scope', function () {
      const identity = {
        aud: agent1AppId,
        appid: agent1AppId,
        iss: `https://login.microsoftonline.com/${agentSingleTenantId}/v2.0`
      } as JwtPayload

      const scope = (cloudAdapter as any).resolveConnectorScope(identity, agentSingleTenantId)

      assert.equal(scope, 'https://api.botframework.com')
    })

    it('[SingleTenant] missing issuer should use Bot Framework scope', function () {
      const identity = {
        aud: agent1AppId,
        appid: agent2AppId
      } as JwtPayload

      const scope = (cloudAdapter as any).resolveConnectorScope(identity, agentMultiTenantId)

      assert.equal(scope, 'https://api.botframework.com')
    })

    it('[SingleTenant] Agent2 to Agent1 with same appId should use Bot Framework scope', function () {
      const identity = {
        aud: agent1AppId,
        appid: agent1AppId,
        iss: `https://sts.windows.net/${agentSingleTenantId}/v2.0`
      } as JwtPayload

      const scope = (cloudAdapter as any).resolveConnectorScope(identity, agentSingleTenantId)

      assert.equal(scope, 'https://api.botframework.com')
    })

    it('[MultiTenant] Agent2 to Agent1 should use Agent2 appid as scope', function () {
      const identity = {
        aud: agent1AppId,
        azp: agent2AppId, // v2.0 tokens use azp for client app id
        iss: 'https://sts.windows.net/f8cdef31-a31e-4b4a-93e4-5f571e91255a/v2.0'
      } as JwtPayload

      const scope = (cloudAdapter as any).resolveConnectorScope(identity, agentMultiTenantId)

      assert.equal(scope, agent2AppId)
    })

    it('[MultiTenant] Agent2 to Agent1 with unknown issuer should use Bot Framework scope', function () {
      const identity = {
        aud: agent1AppId,
        appid: agent2AppId,
        iss: 'https://sts.windows.net/unknown-issuer/v2.0'
      } as JwtPayload

      const scope = (cloudAdapter as any).resolveConnectorScope(identity, agentMultiTenantId)

      assert.equal(scope, 'https://api.botframework.com')
    })

    it('[MultiTenant] Agent2 to Agent1 with same appId should use Bot Framework scope', function () {
      const identity = {
        aud: agent1AppId,
        appid: agent1AppId,
        iss: 'https://sts.windows.net/d6d49420-f39b-4df7-a1dc-d59a935871db/v2.0'
      } as JwtPayload

      const scope = (cloudAdapter as any).resolveConnectorScope(identity, agentMultiTenantId)

      assert.equal(scope, 'https://api.botframework.com')
    })

    it('[MultiTenant] ABS to Agent1 with no azp/appid should use Bot Framework scope', function () {
      const identity = {
        aud: agent1AppId,
        iss: 'https://login.microsoftonline.com/d6d49420-f39b-4df7-a1dc-d59a935871db/v2.0'
      } as JwtPayload

      const scope = (cloudAdapter as any).resolveConnectorScope(identity, agentMultiTenantId)

      assert.equal(scope, 'https://api.botframework.com')
    })

    it('[MultiTenant] undefined tenant should default to MultiTenant and use Agent2 appid as scope', function () {
      const identity = {
        aud: agent1AppId,
        appid: agent2AppId,
        iss: 'https://login.microsoftonline.com/f8cdef31-a31e-4b4a-93e4-5f571e91255a/v2.0'
      } as JwtPayload

      const scope = (cloudAdapter as any).resolveConnectorScope(identity, undefined)

      assert.equal(scope, agent2AppId)
    })

    it('[MultiTenant] undefined tenant with unknown issuer should use Bot Framework scope', function () {
      const identity = {
        aud: agent1AppId,
        appid: agent2AppId,
        iss: 'https://login.microsoftonline.com/unknown-issuer/v2.0'
      } as JwtPayload

      const scope = (cloudAdapter as any).resolveConnectorScope(identity, undefined)

      assert.equal(scope, 'https://api.botframework.com')
    })

    it('[MultiTenant] when both azp and appid are present it should prefer azp', function () {
      // Not a real scenario since azp should only be present in v2.0 tokens and appid in v1.0 tokens,
      // but adding this test for completeness since the code checks for both.
      const identity = {
        aud: agent1AppId,
        azp: agent2AppId,
        appid: '33333333-3333-3333-3333-333333333333',
        iss: 'https://login.microsoftonline.com/d6d49420-f39b-4df7-a1dc-d59a935871db/v2.0'
      } as JwtPayload

      const scope = (cloudAdapter as any).resolveConnectorScope(identity, agentMultiTenantId)

      assert.equal(scope, agent2AppId)
    })
  })
})

function createActivity (type: ActivityTypes) {
  const activity: Activity = new Activity(type)
  activity.conversation = { id: 'test-conversation-id' }
  activity.serviceUrl = 'http://test-service-url'
  activity.channelId = 'test-channel'
  activity.from = { id: 'test-user-id', name: 'test-user-name' }
  activity.recipient = { id: 'test-bot-id', name: 'test-bot-name' }
  return activity
}
