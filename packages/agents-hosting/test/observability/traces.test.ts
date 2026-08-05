// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { strict as assert } from 'assert'
import { afterEach, describe, it } from 'node:test'
import * as sinon from 'sinon'
import { Activity } from '@microsoft/agents-activity'
import {
  AdapterTraceDefinitions,
  AgentApplicationTraceDefinitions,
  AgentClientTraceDefinitions,
  AuthenticationTraceDefinitions,
  AuthorizationTraceDefinitions,
  ConnectorClientTraceDefinitions,
  ProactiveTraceDefinitions,
  StorageTraceDefinitions,
  TurnContextTraceDefinitions,
  UserTokenClientTraceDefinitions,
} from '../../src/observability/traces'
import { HostingMetrics } from '../../src/observability/metrics'

const duration = 123

function createSpan () {
  const attributes: Record<string, unknown> = {}
  const events: Array<{ name: string, attributes: Record<string, unknown> }> = []

  return {
    attributes,
    events,
    setAttribute (name: string, value: unknown) {
      attributes[name] = value
    },
    setAttributes (values: Record<string, unknown>) {
      Object.assign(attributes, values)
    },
    addEvent (name: string, values: Record<string, unknown>) {
      events.push({ name, attributes: values })
    },
  }
}

function endTrace (definition: any, record: Record<string, unknown>, error?: unknown) {
  const span = createSpan()
  definition.end({ span, record, duration, error })
  return span
}

function assertMetric (
  metric: sinon.SinonStub,
  value: number,
  attributes: Record<string, unknown>
) {
  sinon.assert.calledOnceWithExactly(metric, value, attributes)
}

describe('trace definitions', () => {
  afterEach(() => {
    sinon.restore()
  })

  describe('AgentApplicationTraceDefinitions', () => {
    it('should set route attributes and turn metrics when a turn ends', () => {
      const turnCounters = sinon.stub(HostingMetrics.turnsTotalCounter, 'add')
      const turnDuration = sinon.stub(HostingMetrics.turnDuration, 'record')
      const activity = Activity.fromObject({ type: 'message', channelId: 'msteams' })

      const span = endTrace(AgentApplicationTraceDefinitions.run, {
        authorized: true,
        activity,
        routeMatched: true,
      })
      const metricAttributes = {
        'activity.type': 'message',
        'activity.channel_id': 'msteams',
      }

      assert.deepEqual(span.attributes, {
        'route.authorized': true,
        'route.matched': true,
        ...metricAttributes,
      })
      assertMetric(turnCounters, 1, metricAttributes)
      assertMetric(turnDuration, duration, metricAttributes)
    })

    it('should set the error metric when a turn ends with an error', () => {
      const turnCounters = sinon.stub(HostingMetrics.turnsTotalCounter, 'add')
      sinon.stub(HostingMetrics.turnDuration, 'record')

      endTrace(AgentApplicationTraceDefinitions.run, {
        authorized: false,
        activity: Activity.fromObject({ type: 'message' }),
        routeMatched: false,
      }, new TypeError('invalid turn'))

      sinon.assert.callCount(turnCounters, 2)
      assert.deepEqual(turnCounters.secondCall.args, [1, { 'error.type': 'TypeError' }])
    })

    it('should set the attachment count when file downloads end', () => {
      const span = endTrace(AgentApplicationTraceDefinitions.downloadFiles, { attachmentsCount: 3 })

      assert.deepEqual(span.attributes, { 'agents.attachments.count': 3 })
    })

    it('should set route type attributes when a route handler ends', () => {
      const span = endTrace(AgentApplicationTraceDefinitions.routeHandler, {
        isInvoke: true,
        isAgentic: true,
      })

      assert.deepEqual(span.attributes, {
        'route.is_invoke': true,
        'route.is_agentic': true,
      })
    })
  })

  describe('TurnContextTraceDefinitions', () => {
    it('should add activity event attributes when an activity is recorded', () => {
      const span = createSpan()
      const actions = TurnContextTraceDefinitions.sendActivities.actions!({ span } as any)

      actions.recordActivity(Activity.fromObject({
        id: 'activity-id',
        type: 'message',
        deliveryMode: 'expectReplies',
      }))

      assert.deepEqual(span.events, [{
        name: 'activity.sent',
        attributes: {
          'activity.id': 'activity-id',
          'activity.type': 'message',
          'activity.delivery_mode': 'expectReplies',
        },
      }])
    })

    it('should set the activity count when sending activities ends', () => {
      const span = endTrace(TurnContextTraceDefinitions.sendActivities, { activityCount: 2 })

      assert.deepEqual(span.attributes, { 'activity.count': 2 })
    })
  })

  describe('AgentClientTraceDefinitions', () => {
    it('should set request attributes and metrics when posting an activity ends', () => {
      const requests = sinon.stub(HostingMetrics.agentClientRequestsCounter, 'add')
      const requestDuration = sinon.stub(HostingMetrics.agentClientRequestDuration, 'record')
      const attributes = {
        'target.endpoint': 'https://agent.example.com',
        'target.client_id': 'client-id',
        'http.status_code': 202,
      }

      const span = endTrace(AgentClientTraceDefinitions.postActivity, {
        endpoint: attributes['target.endpoint'],
        clientId: attributes['target.client_id'],
        httpStatusCode: attributes['http.status_code'],
      })

      assert.deepEqual(span.attributes, attributes)
      assertMetric(requests, 1, attributes)
      assertMetric(requestDuration, duration, attributes)
    })
  })

  describe('AdapterTraceDefinitions', () => {
    it('should set connector attributes when creating a connector client ends', () => {
      const span = endTrace(AdapterTraceDefinitions.createConnectorClient, {
        serviceUrl: 'https://service.example.com',
        scopes: ['scope-a'],
        activityIsAgentic: true,
      })

      assert.deepEqual(span.attributes, {
        service_url: 'https://service.example.com',
        'auth.scopes': ['scope-a'],
        'activity.is_agentic': true,
      })
    })

    it('should set token service attributes when creating a user token client ends', () => {
      const span = endTrace(AdapterTraceDefinitions.createUserTokenClient, {
        tokenServiceEndpoint: 'https://token.example.com',
        authScope: 'token-scope',
      })

      assert.deepEqual(span.attributes, {
        'token.service.endpoint': 'https://token.example.com',
        'auth.scope': 'token-scope',
      })
    })

    it('should add event attributes and sent metric when an outbound activity is recorded', () => {
      const activitiesSent = sinon.stub(HostingMetrics.activitiesSentCounter, 'add')
      const span = createSpan()
      const actions = AdapterTraceDefinitions.sendActivities.actions!({ span } as any)
      const activityAttributes = {
        'activity.type': 'message',
        'activity.channel_id': 'webchat',
        'activity.conversation_id': 'conversation-id',
      }

      actions.recordActivity(Activity.fromObject({
        id: 'activity-id',
        type: activityAttributes['activity.type'],
        channelId: activityAttributes['activity.channel_id'],
        conversation: { id: activityAttributes['activity.conversation_id'] },
      }))

      assert.deepEqual(span.events, [{
        name: 'activity.sent',
        attributes: {
          'activity.id': 'activity-id',
          ...activityAttributes,
        },
      }])
      assertMetric(activitiesSent, 1, activityAttributes)
    })

    it('should set the activity count when adapter sending ends', () => {
      const span = endTrace(AdapterTraceDefinitions.sendActivities, { activityCount: 4 })

      assert.deepEqual(span.attributes, { 'activity.count': 4 })
    })

    it('should set activity attributes and received metrics when adapter processing ends', () => {
      const processDuration = sinon.stub(HostingMetrics.adapterProcessDuration, 'record')
      const activitiesReceived = sinon.stub(HostingMetrics.activitiesReceivedCounter, 'add')
      const activity = Activity.fromObject({
        type: 'message',
        channelId: 'msteams',
        deliveryMode: 'normal',
        conversation: { id: 'conversation-id' },
      })

      const span = endTrace(AdapterTraceDefinitions.process, { activity })

      assert.deepEqual(span.attributes, {
        'activity.type': 'message',
        'activity.channel_id': 'msteams',
        'activity.delivery_mode': 'normal',
        'activity.conversation_id': 'conversation-id',
        'activity.is_agentic': false,
      })
      assertMetric(processDuration, duration, { 'activity.type': 'message' })
      assertMetric(activitiesReceived, 1, {
        'activity.type': 'message',
        'activity.channel_id': 'msteams',
      })
    })

    it('should set activity attributes and updated metric when updating an activity ends', () => {
      const activitiesUpdated = sinon.stub(HostingMetrics.activitiesUpdatedCounter, 'add')
      const activity = Activity.fromObject({
        id: 'activity-id',
        type: 'message',
        channelId: 'webchat',
        conversation: { id: 'conversation-id' },
      })

      const span = endTrace(AdapterTraceDefinitions.updateActivity, { activity })

      assert.deepEqual(span.attributes, {
        'activity.id': 'activity-id',
        'activity.conversation_id': 'conversation-id',
      })
      assertMetric(activitiesUpdated, 1, { 'activity.channel_id': 'webchat' })
    })

    it('should set activity attributes and deleted metric when deleting an activity ends', () => {
      const activitiesDeleted = sinon.stub(HostingMetrics.activitiesDeletedCounter, 'add')

      const span = endTrace(AdapterTraceDefinitions.deleteActivity, {
        reference: {
          activityId: 'activity-id',
          channelId: 'webchat',
          conversation: { id: 'conversation-id' },
        },
      })

      assert.deepEqual(span.attributes, {
        'activity.id': 'activity-id',
        'activity.conversation_id': 'conversation-id',
      })
      assertMetric(activitiesDeleted, 1, { 'activity.channel_id': 'webchat' })
    })

    it('should set conversation attributes when continuing a conversation ends', () => {
      const span = endTrace(AdapterTraceDefinitions.continueConversation, {
        botAppId: 'bot-app-id',
        conversationId: 'conversation-id',
        isAgentic: true,
      })

      assert.deepEqual(span.attributes, {
        'bot.app_id': 'bot-app-id',
        'activity.conversation_id': 'conversation-id',
        'activity.is_agentic': true,
      })
    })
  })

  describe('ProactiveTraceDefinitions', () => {
    function assertConversationAttribute (definition: any) {
      const span = endTrace(definition, { conversationId: 'conversation-id' })

      assert.deepEqual(span.attributes, { 'activity.conversation_id': 'conversation-id' })
    }

    it('should set the conversation attribute when storing a conversation ends', () => {
      assertConversationAttribute(ProactiveTraceDefinitions.storeConversation)
    })

    it('should set the conversation attribute when getting or throwing for a conversation ends', () => {
      assertConversationAttribute(ProactiveTraceDefinitions.getConversationOrThrow)
    })

    it('should set the conversation attribute when deleting a conversation ends', () => {
      assertConversationAttribute(ProactiveTraceDefinitions.deleteConversation)
    })

    it('should set conversation lookup attributes when getting a conversation ends', () => {
      const span = endTrace(ProactiveTraceDefinitions.getConversation, {
        conversationId: 'conversation-id',
        found: true,
      })

      assert.deepEqual(span.attributes, {
        'activity.conversation_id': 'conversation-id',
        'proactive.conversation_found': true,
      })
    })

    function assertOperation (
      definition: any,
      record: Record<string, unknown>,
      spanAttributes: Record<string, unknown>,
      metricAttributes: Record<string, unknown>
    ) {
      const operations = sinon.stub(HostingMetrics.proactiveOperationCounter, 'add')
      const operationDuration = sinon.stub(HostingMetrics.proactiveOperationDuration, 'record')

      const span = endTrace(definition, record)

      assert.deepEqual(span.attributes, spanAttributes)
      assertMetric(operations, 1, metricAttributes)
      assertMetric(operationDuration, duration, metricAttributes)
    }

    it('should set attributes and operation metrics when sending an activity ends', () => {
      assertOperation(
        ProactiveTraceDefinitions.sendActivity,
        { conversationId: 'conversation-id', channelId: 'webchat', activityType: 'message' },
        {
          'activity.channel_id': 'webchat',
          'activity.type': 'message',
          'activity.conversation_id': 'conversation-id',
        },
        {
          'activity.channel_id': 'webchat',
          'activity.type': 'message',
          operation: 'send.activity',
          'operation.success': true,
        }
      )
    })

    it('should set attributes and operation metrics when continuing a conversation ends', () => {
      assertOperation(
        ProactiveTraceDefinitions.continueConversation,
        { conversationId: 'conversation-id', channelId: 'msteams', hasAutoSignIn: true },
        {
          'activity.channel_id': 'msteams',
          'proactive.has_auto_sign_in': true,
          'activity.conversation_id': 'conversation-id',
        },
        {
          'activity.channel_id': 'msteams',
          'proactive.has_auto_sign_in': true,
          operation: 'continue.conversation',
          'operation.success': true,
        }
      )
    })

    it('should set attributes and operation metrics when creating a conversation ends', () => {
      assertOperation(
        ProactiveTraceDefinitions.createConversation,
        { channelId: 'msteams', membersCount: 2, storeConversation: true, hasHandler: true },
        {
          'activity.channel_id': 'msteams',
          'proactive.store_conversation': true,
          'proactive.has_handler': true,
          'proactive.members_count': 2,
        },
        {
          'activity.channel_id': 'msteams',
          'proactive.store_conversation': true,
          'proactive.has_handler': true,
          operation: 'create.conversation',
          'operation.success': true,
        }
      )
    })
  })

  describe('ConnectorClientTraceDefinitions', () => {
    function assertRequest (
      definition: any,
      operation: string,
      method: string,
      record: Record<string, unknown> = {},
      spanAttributes: Record<string, unknown> = {}
    ) {
      const requests = sinon.stub(HostingMetrics.connectorRequestsCounter, 'add')
      const requestDuration = sinon.stub(HostingMetrics.connectorRequestDuration, 'record')
      const metricAttributes = {
        operation,
        'http.method': method,
        'http.status_code': 200,
      }

      const span = endTrace(definition, { ...record, httpStatusCode: 200 })

      assert.deepEqual(span.attributes, spanAttributes)
      assertMetric(requests, 1, metricAttributes)
      assertMetric(requestDuration, duration, metricAttributes)
    }

    it('should set attributes and request metrics when getting conversations ends', () => {
      assertRequest(ConnectorClientTraceDefinitions.getConversations, 'get.conversations', 'GET')
    })

    it('should set attributes and request metrics when getting a conversation member ends', () => {
      assertRequest(ConnectorClientTraceDefinitions.getConversationMember, 'get.conversation.member', 'GET')
    })

    it('should set attributes and request metrics when creating a conversation ends', () => {
      assertRequest(ConnectorClientTraceDefinitions.createConversation, 'create.conversation', 'POST')
    })

    it('should set attributes and request metrics when replying to an activity ends', () => {
      assertRequest(
        ConnectorClientTraceDefinitions.replyToActivity,
        'reply.to.activity',
        'POST',
        { conversationId: 'conversation-id', activityId: 'activity-id' },
        { 'activity.conversation_id': 'conversation-id', 'activity.id': 'activity-id' }
      )
    })

    it('should set attributes and request metrics when sending to a conversation ends', () => {
      assertRequest(
        ConnectorClientTraceDefinitions.sendToConversation,
        'send.to.conversation',
        'POST',
        { conversationId: 'conversation-id' },
        { 'activity.conversation_id': 'conversation-id' }
      )
    })

    it('should set attributes and request metrics when updating an activity ends', () => {
      assertRequest(
        ConnectorClientTraceDefinitions.updateActivity,
        'update.activity',
        'PUT',
        { conversationId: 'conversation-id', activityId: 'activity-id' },
        { 'activity.conversation_id': 'conversation-id', 'activity.id': 'activity-id' }
      )
    })

    it('should set attributes and request metrics when deleting an activity ends', () => {
      assertRequest(
        ConnectorClientTraceDefinitions.deleteActivity,
        'delete.activity',
        'DELETE',
        { conversationId: 'conversation-id', activityId: 'activity-id' },
        { 'activity.conversation_id': 'conversation-id', 'activity.id': 'activity-id' }
      )
    })

    it('should set attributes and request metrics when uploading an attachment ends', () => {
      assertRequest(
        ConnectorClientTraceDefinitions.uploadAttachment,
        'upload.attachment',
        'POST',
        { conversationId: 'conversation-id' },
        { 'activity.conversation_id': 'conversation-id' }
      )
    })

    it('should set attributes and request metrics when getting attachment info ends', () => {
      assertRequest(
        ConnectorClientTraceDefinitions.getAttachmentInfo,
        'get.attachment.info',
        'GET',
        { attachmentId: 'attachment-id' },
        { 'attachment.id': 'attachment-id' }
      )
    })

    it('should set attributes and request metrics when getting an attachment ends', () => {
      assertRequest(
        ConnectorClientTraceDefinitions.getAttachment,
        'get.attachment',
        'GET',
        { attachmentId: 'attachment-id', viewId: 'view-id' },
        { 'attachment.id': 'attachment-id', 'view.id': 'view-id' }
      )
    })
  })

  describe('StorageTraceDefinitions', () => {
    function assertStorageOperation (operation: keyof typeof StorageTraceDefinitions) {
      const operationDuration = sinon.stub(HostingMetrics.storageOperationDuration, 'record')
      const attributes = {
        'storage.operation': operation,
        'storage.key.count': 3,
      }

      const span = endTrace(StorageTraceDefinitions[operation], { keyCount: 3 })

      assert.deepEqual(span.attributes, attributes)
      assertMetric(operationDuration, duration, attributes)
    }

    it('should set attributes and duration metric when storage read ends', () => {
      assertStorageOperation('read')
    })

    it('should set attributes and duration metric when storage write ends', () => {
      assertStorageOperation('write')
    })

    it('should set attributes and duration metric when storage delete ends', () => {
      assertStorageOperation('delete')
    })
  })

  describe('AuthenticationTraceDefinitions', () => {
    function assertTokenRequest (
      definition: any,
      record: Record<string, unknown>,
      spanAttributes: Record<string, unknown>,
      method: string,
      error?: unknown
    ) {
      const requests = sinon.stub(HostingMetrics.authTokenRequestsCounter, 'add')
      const tokenDuration = sinon.stub(HostingMetrics.authTokenDuration, 'record')

      const span = endTrace(definition, record, error)

      assert.deepEqual(span.attributes, spanAttributes)
      assertMetric(requests, 1, {
        'auth.method': method,
        'auth.success': error === undefined,
      })
      assertMetric(tokenDuration, duration, { 'auth.method': method })
    }

    it('should set attributes and token metrics when getting an access token ends', () => {
      assertTokenRequest(
        AuthenticationTraceDefinitions.getAccessToken,
        { scope: 'api.scope', method: 'client_secret' },
        { 'auth.scope': 'api.scope', 'auth.method': 'client_secret' },
        'client_secret'
      )
    })

    it('should set attributes and token metrics when acquiring an on-behalf-of token ends', () => {
      assertTokenRequest(
        AuthenticationTraceDefinitions.acquireTokenOnBehalfOf,
        { scopes: ['api.scope'] },
        { 'auth.scopes': ['api.scope'] },
        'obo',
        new Error('token failure')
      )
    })

    it('should set attributes and token metrics when getting an agentic instance token ends', () => {
      assertTokenRequest(
        AuthenticationTraceDefinitions.getAgenticInstanceToken,
        { agenticInstanceId: 'instance-id' },
        { 'agentic.instance_id': 'instance-id' },
        'agentic_instance'
      )
    })

    it('should set attributes and token metrics when getting an agentic user token ends', () => {
      assertTokenRequest(
        AuthenticationTraceDefinitions.getAgenticUserToken,
        { agenticInstanceId: 'instance-id', agenticUserId: 'user-id', scopes: ['api.scope'] },
        {
          'agentic.instance_id': 'instance-id',
          'agentic.user_id': 'user-id',
          'auth.scopes': ['api.scope'],
        },
        'agentic_user'
      )
    })
  })

  describe('AuthorizationTraceDefinitions', () => {
    function assertAuthorization (
      definition: any,
      record: Record<string, unknown>,
      attributes: Record<string, unknown>
    ) {
      const span = endTrace(definition, record)

      assert.deepEqual(span.attributes, attributes)
    }

    it('should set authorization attributes when getting an Azure Bot token ends', () => {
      assertAuthorization(
        AuthorizationTraceDefinitions.azureBotToken,
        { handlerId: 'handler-id', connectionName: 'connection-name' },
        { 'auth.handler.id': 'handler-id', 'auth.connection.name': 'connection-name' }
      )
    })

    it('should set authorization attributes when getting an Azure Bot OBO token ends', () => {
      assertAuthorization(
        AuthorizationTraceDefinitions.azureBotOBOToken,
        { handlerId: 'handler-id', connectionName: 'connection-name', authScopes: ['api.scope'] },
        {
          'auth.handler.id': 'handler-id',
          'auth.connection.name': 'connection-name',
          'auth.scopes': ['api.scope'],
        }
      )
    })

    it('should set authorization attributes when signing out an Azure Bot user ends', () => {
      assertAuthorization(
        AuthorizationTraceDefinitions.azureBotSignout,
        { handlerId: 'handler-id', connectionName: 'connection-name', channelId: 'msteams' },
        {
          'auth.handler.id': 'handler-id',
          'auth.connection.name': 'connection-name',
          'activity.channel_id': 'msteams',
        }
      )
    })

    it('should set authorization attributes when signing in an Azure Bot user ends', () => {
      assertAuthorization(
        AuthorizationTraceDefinitions.azureBotSignin,
        {
          handlerId: 'handler-id',
          connectionName: 'connection-name',
          status: 'approved',
          statusReason: 'valid token',
        },
        {
          'auth.handler.id': 'handler-id',
          'auth.handler.status': 'approved',
          'auth.handler.status.reason': 'valid token',
          'auth.connection.name': 'connection-name',
        }
      )
    })

    it('should set authorization attributes when getting an agentic token ends', () => {
      assertAuthorization(
        AuthorizationTraceDefinitions.agenticToken,
        { handlerId: 'handler-id', connectionName: 'connection-name', authScopes: ['api.scope'] },
        {
          'auth.handler.id': 'handler-id',
          'auth.connection.name': 'connection-name',
          'auth.scopes': ['api.scope'],
        }
      )
    })
  })

  describe('UserTokenClientTraceDefinitions', () => {
    function assertRequest (
      definition: any,
      operation: string,
      method: string,
      record: Record<string, unknown>,
      attributes: Record<string, unknown>
    ) {
      const requests = sinon.stub(HostingMetrics.userTokenClientRequestsCounter, 'add')
      const requestDuration = sinon.stub(HostingMetrics.userTokenClientRequestDuration, 'record')
      const metricAttributes = {
        operation,
        'http.method': method,
        'http.status_code': 200,
      }

      const span = endTrace(definition, { ...record, httpStatusCode: 200 })

      assert.deepEqual(span.attributes, attributes)
      assertMetric(requests, 1, metricAttributes)
      assertMetric(requestDuration, duration, metricAttributes)
    }

    it('should set attributes and request metrics when getting a user token ends', () => {
      assertRequest(
        UserTokenClientTraceDefinitions.getUserToken,
        'get.user.token',
        'GET',
        { userId: 'user-id', connectionName: 'connection-name', channelId: 'msteams' },
        {
          'user.id': 'user-id',
          'auth.connection.name': 'connection-name',
          'activity.channel_id': 'msteams',
        }
      )
    })

    it('should set attributes and request metrics when signing out ends', () => {
      assertRequest(
        UserTokenClientTraceDefinitions.signOut,
        'sign.out',
        'DELETE',
        { userId: 'user-id', connectionName: 'connection-name', channelId: 'msteams' },
        {
          'user.id': 'user-id',
          'auth.connection.name': 'connection-name',
          'activity.channel_id': 'msteams',
        }
      )
    })

    it('should set attributes and request metrics when getting a sign-in resource ends', () => {
      assertRequest(
        UserTokenClientTraceDefinitions.getSignInResource,
        'get.sign.in.resource',
        'GET',
        { connectionName: 'connection-name' },
        { 'auth.connection.name': 'connection-name' }
      )
    })

    it('should set attributes and request metrics when exchanging a token ends', () => {
      assertRequest(
        UserTokenClientTraceDefinitions.exchangeToken,
        'exchange.token',
        'POST',
        { userId: 'user-id', connectionName: 'connection-name', channelId: 'msteams' },
        {
          'user.id': 'user-id',
          'auth.connection.name': 'connection-name',
          'activity.channel_id': 'msteams',
        }
      )
    })

    it('should set attributes and request metrics when getting a token or sign-in resource ends', () => {
      assertRequest(
        UserTokenClientTraceDefinitions.getTokenOrSignInResource,
        'get.token.or.sign.in.resource',
        'GET',
        { userId: 'user-id', connectionName: 'connection-name', channelId: 'msteams' },
        {
          'user.id': 'user-id',
          'auth.connection.name': 'connection-name',
          'activity.channel_id': 'msteams',
        }
      )
    })

    it('should set attributes and request metrics when getting token status ends', () => {
      assertRequest(
        UserTokenClientTraceDefinitions.getTokenStatus,
        'get.token.status',
        'GET',
        { userId: 'user-id', channelId: 'msteams' },
        { 'user.id': 'user-id', 'activity.channel_id': 'msteams' }
      )
    })

    it('should set attributes and request metrics when getting AAD tokens ends', () => {
      assertRequest(
        UserTokenClientTraceDefinitions.getAadTokens,
        'get.aad.tokens',
        'POST',
        { userId: 'user-id', connectionName: 'connection-name', channelId: 'msteams' },
        {
          'user.id': 'user-id',
          'auth.connection.name': 'connection-name',
          'activity.channel_id': 'msteams',
        }
      )
    })
  })
})
