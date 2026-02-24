import { strict as assert, strict } from 'assert'
import { afterEach, beforeEach, describe, it } from 'node:test'
import { AuthConfiguration, CloudAdapter, INVOKE_RESPONSE_KEY, MsalConnectionManager, Request, UserTokenClient, TurnContext } from '../../../src'
import sinon, { SinonSandbox } from 'sinon'
import { Activity, ActivityTypes, ConversationReference, DeliveryModes, Channels, RoleTypes } from '@microsoft/agents-activity'
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
    const agent1AppId = '11111111-1111-1111-1111-111111111111'
    const agent2AppId = '22222222-2222-2222-2222-222222222222'

    it('MSTeams channel should use Bot Framework scope', function () {
      const identity = {
        aud: agent1AppId,
        azp: agent2AppId, // v2.0 tokens use azp for client app id
      } as JwtPayload

      const activity = Activity.fromObject({
        type: ActivityTypes.Message,
        channelId: Channels.Msteams
      })

      const scope = (cloudAdapter as any).resolveConnectorScope(identity, activity)

      assert.equal(scope, 'https://api.botframework.com')
    })

    it('MSTeams channel with Skill role should use Agent2 appid as scope', function () {
      const identity = {
        aud: agent1AppId,
        azp: agent2AppId, // v2.0 tokens use azp for client app id
      } as JwtPayload

      const activity = Activity.fromObject({
        type: ActivityTypes.Message,
        channelId: Channels.Msteams,
        recipient: { role: RoleTypes.Skill }
      })

      const scope = (cloudAdapter as any).resolveConnectorScope(identity, activity)

      assert.equal(scope, agent2AppId)
    })

    it('WebChat channel should use Agent2 appid as scope', function () {
      const identity = {
        aud: agent1AppId,
        azp: agent2AppId, // v2.0 tokens use azp for client app id
      } as JwtPayload

      const activity = Activity.fromObject({
        type: ActivityTypes.Message,
        channelId: Channels.Webchat,
      })

      const scope = (cloudAdapter as any).resolveConnectorScope(identity, activity)

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
