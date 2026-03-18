// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { createTracedDecorator, SpanNames } from '@microsoft/agents-telemetry'
import { AxiosResponse } from 'axios'
import type { TurnContext } from '../turnContext'
import { CloudAdapter } from '../cloudAdapter'
import { AgentApplication } from '../app/agentApplication'
import { ConnectorClient } from '../connector-client/connectorClient'
import type { AgentClient } from '../agent-client/agentClient'
import type { MsalTokenProvider } from '../auth/msalTokenProvider'
import type { AgenticAuthorization } from '../app/auth/handlers/agenticAuthorization'
import type { AzureBotAuthorization } from '../app/auth/handlers/azureBotAuthorization'
import type { UserTokenClient } from '../oauth'
import { HostingMetrics } from './metrics'

const fallback = <T>(value: T | undefined | null) => value ?? 'unknown'

/**
 * CloudAdapter method decorators
 */

interface ProcessDecoratorContext {
  args: Parameters<CloudAdapter['process']>
  data?: TurnContext
  result?: ReturnType<CloudAdapter['process']>
  duration: () => number
}

export const CloudAdapterProcess = createTracedDecorator<ProcessDecoratorContext>({
  spanName: SpanNames.ADAPTER_PROCESS,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, context) {
    const { data, duration } = context
    const type = fallback(data?.activity?.type)
    const channelId = fallback(data?.activity?.channelId)

    span.setAttribute('activity.type', type)
    span.setAttribute('activity.channel_id', channelId)
    span.setAttribute('activity.delivery_mode', fallback(data?.activity?.deliveryMode))
    span.setAttribute('activity.conversation_id', fallback(data?.activity?.conversation?.id))
    span.setAttribute('activity.is_agentic', data?.activity?.isAgenticRequest() ?? false)

    HostingMetrics.activitiesReceivedCounter.add(1, {
      'activity.type': type,
      'activity.channel_id': channelId
    })
    HostingMetrics.adapterProcessDuration.record(duration(), {
      'activity.type': type
    })
  }
})

interface SendActivitiesDecoratorContext {
  args: Parameters<CloudAdapter['sendActivities']>
  result?: ReturnType<CloudAdapter['sendActivities']>
}

export const CloudAdapterSendActivities = createTracedDecorator<SendActivitiesDecoratorContext>({
  spanName: SpanNames.ADAPTER_SEND_ACTIVITIES,
  onEnd (span, context) {
    const [, _activities] = context.args
    const activities = _activities ?? []

    span.setAttribute('activity.count', activities?.length ?? 0)
    span.setAttribute('activity.conversation_id', fallback(activities[0]?.conversation?.id))

    for (const activity of activities) {
      span.setAttribute('activity.type', fallback(activity.type))
      span.setAttribute('activity.id', fallback(activity.id))

      HostingMetrics.activitiesSentCounter.add(1, {
        'activity.type': fallback(activity?.type),
        'activity.channel_id': fallback(activity?.channelId)
      })
    }
  }
})

interface UpdateActivityDecoratorContext {
  args: Parameters<CloudAdapter['updateActivity']>
  result?: ReturnType<CloudAdapter['updateActivity']>
}

export const CloudAdapterUpdateActivity = createTracedDecorator<UpdateActivityDecoratorContext>({
  spanName: SpanNames.ADAPTER_UPDATE_ACTIVITY,
  onEnd (span, context) {
    const [, activity] = context.args

    span.setAttribute('activity.id', fallback(activity?.id))
    span.setAttribute('activity.conversation_id', fallback(activity?.conversation?.id))

    HostingMetrics.activitiesUpdatedCounter.add(1, {
      'activity.channel_id': fallback(activity?.channelId),
    })
  }
})

interface DeleteActivityDecoratorContext {
  args: Parameters<CloudAdapter['deleteActivity']>
  result?: ReturnType<CloudAdapter['deleteActivity']>
  durationMs?: { startTime: number }
}

export const CloudAdapterDeleteActivity = createTracedDecorator<DeleteActivityDecoratorContext>({
  spanName: SpanNames.ADAPTER_DELETE_ACTIVITY,
  onEnd (span, context) {
    const [, reference] = context.args

    span.setAttribute('activity.id', fallback(reference?.activityId))
    span.setAttribute('activity.conversation_id', fallback(reference?.conversation?.id))

    HostingMetrics.activitiesDeletedCounter.add(1, {
      'activity.channel_id': fallback(reference?.channelId)
    })
  }
})

interface ContinueConversationDecoratorContext {
  args: Parameters<CloudAdapter['continueConversation']>
  data?: TurnContext
  result?: ReturnType<CloudAdapter['continueConversation']>
}

export const CloudAdapterContinueConversation = createTracedDecorator<ContinueConversationDecoratorContext>({
  spanName: SpanNames.ADAPTER_CONTINUE_CONVERSATION,
  onEnd (span, context) {
    const [, reference] = context.args
    const botAppId = fallback(context.data?.identity?.aud)
    const isAgenticRequest = context.data?.activity?.isAgenticRequest() ?? false
    const conversationId = fallback(reference?.conversation?.id)

    span.setAttribute('bot.app_id', botAppId)
    span.setAttribute('activity.conversation_id', conversationId)
    span.setAttribute('activity.is_agentic', isAgenticRequest)
  }
})

interface CreateConnectorClientDecoratorContext {
  args: Parameters<CloudAdapter['createConnectorClient']>
  result?: ReturnType<CloudAdapter['createConnectorClient']>
}

export const CloudAdapterCreateConnectorClient = createTracedDecorator<CreateConnectorClientDecoratorContext>({
  spanName: SpanNames.ADAPTER_CREATE_CONNECTOR_CLIENT,
  onEnd (span, context) {
    const [_serviceUrl, _scope] = context.args
    const serviceUrl = fallback(_serviceUrl)
    const scope = fallback(_scope)

    span.setAttribute('service_url', serviceUrl)
    span.setAttribute('auth.scope', scope)
  }
})

interface CreateConnectorClientWithIdentityDecoratorContext {
  args: Parameters<CloudAdapter['createConnectorClientWithIdentity']>
  data?: { scope?: string }
  result?: ReturnType<CloudAdapter['createConnectorClientWithIdentity']>
}

export const CloudAdapterCreateConnectorClientWithIdentity = createTracedDecorator<CreateConnectorClientWithIdentityDecoratorContext>({
  spanName: SpanNames.ADAPTER_CREATE_CONNECTOR_CLIENT,
  onEnd (span, context) {
    const [, activity] = context.args
    const isAgenticRequest = activity?.isAgenticRequest() ?? false
    const scope = fallback(context.data?.scope)
    const serviceUrl = fallback(activity?.serviceUrl)

    span.setAttribute('service_url', serviceUrl)
    span.setAttribute('auth.scope', scope)
    span.setAttribute('activity.is_agentic', isAgenticRequest)
  }
})

interface CreateUserTokenClientDecoratorContext {
  args: Parameters<CloudAdapter['createUserTokenClient']>
  result?: ReturnType<CloudAdapter['createUserTokenClient']>
}

export const CloudAdapterCreateUserTokenClient = createTracedDecorator<CreateUserTokenClientDecoratorContext>({
  spanName: SpanNames.ADAPTER_CREATE_USER_TOKEN_CLIENT,
  onEnd (span, context) {
    const [, _tokenserviceEndpoint, _scope] = context.args
    const serviceEndpoint = fallback(_tokenserviceEndpoint)
    const scope = fallback(_scope)

    span.setAttribute('token.service.endpoint', serviceEndpoint)
    span.setAttribute('auth.scope', scope)
  }
})

/**
 * AgentApplication method decorators
 */
interface AppRunDecoratorContext {
  args: Parameters<AgentApplication<any>['runInternal']>
  data: {
    authorized?: boolean
    route?: { matched?: boolean, isInvokeRoute?: boolean, isAgenticRoute?: boolean }
    attachmentsCount?: number
  }
  result?: ReturnType<AgentApplication<any>['runInternal']>
  duration: () => number
}

export const AgentApplicationRun = createTracedDecorator<AppRunDecoratorContext>({
  spanName: SpanNames.AGENTS_APP_RUN,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onChildSpan (spanName, span, context) {
    switch (spanName) {
      case SpanNames.AGENTS_APP_ROUTE_HANDLER:
        span.setAttribute('route.is_invoke', context.data?.route?.isInvokeRoute ?? false)
        span.setAttribute('route.is_agentic', context.data?.route?.isAgenticRoute ?? false)
        break
      case SpanNames.AGENTS_APP_DOWNLOAD_FILES:
        span.setAttribute('activity.attachments.count', context.data?.attachmentsCount ?? 0)
        break
    }
  },
  onError (span, error) {
    HostingMetrics.turnsErrorsCounter.add(1, {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    const { args: [turnContext], data, duration } = context
    const activityType = fallback(turnContext.activity?.type)
    const activityId = fallback(turnContext.activity?.id)
    const channelId = fallback(turnContext.activity?.channelId)
    const conversationId = fallback(turnContext.activity?.conversation?.id)
    const authorized = data?.authorized ?? false
    const routeMatched = context.data?.route?.matched ?? false
    span.setAttribute('activity.type', activityType)
    span.setAttribute('activity.id', activityId)
    span.setAttribute('route.authorized', authorized)
    span.setAttribute('route.matched', routeMatched)

    HostingMetrics.turnsTotalCounter.add(1, {
      'activity.type': activityType,
      'activity.conversation_id': conversationId
    })
    HostingMetrics.turnDuration.record(duration(), {
      'activity.type': activityType,
      'activity.channel_id': channelId,
      'activity.conversation_id': conversationId
    })
  }
})

/**
 * ConnectorClient method decorators
 */

function recordConnectorMetrics (_operation: string, context: Pick<ConnectorReplyToActivityDecoratorContext, 'data' | 'duration'>): void {
  const operation = fallback(_operation)
  const httpMethod = fallback(context.data?.config?.method?.toUpperCase())
  const httpStatusCode = context.data?.status ?? -1

  HostingMetrics.connectorRequestsCounter.add(1, {
    operation,
    'http.method': httpMethod,
    'http.status_code': httpStatusCode
  })

  HostingMetrics.connectorRequestDuration.record(context.duration(), {
    operation,
    'http.status_code': httpStatusCode
  })
}

interface ConnectorReplyToActivityDecoratorContext {
  args: Parameters<ConnectorClient['replyToActivity']>
  data?: AxiosResponse
  result?: ReturnType<ConnectorClient['replyToActivity']>
  duration: () => number
}

export const ConnectorReplyToActivity = createTracedDecorator<ConnectorReplyToActivityDecoratorContext>({
  spanName: SpanNames.CONNECTOR_REPLY_TO_ACTIVITY,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, context) {
    const [conversationId, activityId] = context.args
    span.setAttribute('activity.conversation_id', fallback(conversationId))
    span.setAttribute('activity.id', fallback(activityId))
    recordConnectorMetrics('reply.to.activity', context)
  }
})

interface ConnectorSendToConversationDecoratorContext {
  args: Parameters<ConnectorClient['sendToConversation']>
  data?: AxiosResponse
  result?: ReturnType<ConnectorClient['sendToConversation']>
  duration: () => number
}

export const ConnectorSendToConversation = createTracedDecorator<ConnectorSendToConversationDecoratorContext>({
  spanName: SpanNames.CONNECTOR_SEND_TO_CONVERSATION,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, context) {
    const [conversationId] = context.args
    span.setAttribute('activity.conversation_id', fallback(conversationId))
    recordConnectorMetrics('send.to.conversation', context)
  }
})

interface ConnectorUpdateActivityDecoratorContext {
  args: Parameters<ConnectorClient['updateActivity']>
  data?: AxiosResponse
  result?: ReturnType<ConnectorClient['updateActivity']>
  duration: () => number
}

export const ConnectorUpdateActivity = createTracedDecorator<ConnectorUpdateActivityDecoratorContext>({
  spanName: SpanNames.CONNECTOR_UPDATE_ACTIVITY,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, context) {
    const [conversationId, activityId] = context.args
    span.setAttribute('activity.conversation_id', fallback(conversationId))
    span.setAttribute('activity.id', fallback(activityId))
    recordConnectorMetrics('update.activity', context)
  }
})

interface ConnectorDeleteActivityDecoratorContext {
  args: Parameters<ConnectorClient['deleteActivity']>
  data?: AxiosResponse
  result?: ReturnType<ConnectorClient['deleteActivity']>
  duration: () => number
}

export const ConnectorDeleteActivity = createTracedDecorator<ConnectorDeleteActivityDecoratorContext>({
  spanName: SpanNames.CONNECTOR_DELETE_ACTIVITY,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, context) {
    const [conversationId, activityId] = context.args
    span.setAttribute('activity.conversation_id', fallback(conversationId))
    span.setAttribute('activity.id', fallback(activityId))
    recordConnectorMetrics('delete.activity', context)
  }
})

interface ConnectorCreateConversationDecoratorContext {
  args: Parameters<ConnectorClient['createConversation']>
  data?: AxiosResponse
  result?: ReturnType<ConnectorClient['createConversation']>
  duration: () => number
}

export const ConnectorCreateConversation = createTracedDecorator<ConnectorCreateConversationDecoratorContext>({
  spanName: SpanNames.CONNECTOR_CREATE_CONVERSATION,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, context) {
    recordConnectorMetrics('create.conversation', context)
  }
})

interface ConnectorGetConversationsDecoratorContext {
  args: Parameters<ConnectorClient['getConversations']>
  data?: AxiosResponse
  result?: ReturnType<ConnectorClient['getConversations']>
  duration: () => number
}

export const ConnectorGetConversations = createTracedDecorator<ConnectorGetConversationsDecoratorContext>({
  spanName: SpanNames.CONNECTOR_GET_CONVERSATIONS,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, context) {
    recordConnectorMetrics('get.conversations', context)
  }
})

interface ConnectorGetConversationMemberDecoratorContext {
  args: Parameters<ConnectorClient['getConversationMember']>
  data?: AxiosResponse
  result?: ReturnType<ConnectorClient['getConversationMember']>
  duration: () => number
}

export const ConnectorGetConversationMember = createTracedDecorator<ConnectorGetConversationMemberDecoratorContext>({
  spanName: SpanNames.CONNECTOR_GET_CONVERSATION_MEMBERS,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, context) {
    recordConnectorMetrics('get.conversation.member', context)
  }
})

interface ConnectorUploadAttachmentDecoratorContext {
  args: Parameters<ConnectorClient['uploadAttachment']>
  data?: AxiosResponse
  result?: ReturnType<ConnectorClient['uploadAttachment']>
  duration: () => number
}

export const ConnectorUploadAttachment = createTracedDecorator<ConnectorUploadAttachmentDecoratorContext>({
  spanName: SpanNames.CONNECTOR_UPLOAD_ATTACHMENT,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, context) {
    const [conversationId] = context.args
    span.setAttribute('activity.conversation_id', fallback(conversationId))
    recordConnectorMetrics('upload.attachment', context)
  }
})

interface ConnectorGetAttachmentInfoDecoratorContext {
  args: Parameters<ConnectorClient['getAttachmentInfo']>
  data?: AxiosResponse
  result?: ReturnType<ConnectorClient['getAttachmentInfo']>
  duration: () => number
}

export const ConnectorGetAttachmentInfo = createTracedDecorator<ConnectorGetAttachmentInfoDecoratorContext>({
  spanName: SpanNames.CONNECTOR_GET_ATTACHMENT,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, context) {
    const [attachmentId] = context.args
    span.setAttribute('attachment.id', fallback(attachmentId))
    recordConnectorMetrics('get.attachment.info', context)
  }
})

interface ConnectorGetAttachmentDecoratorContext {
  args: Parameters<ConnectorClient['getAttachment']>
  data?: AxiosResponse
  result?: ReturnType<ConnectorClient['getAttachment']>
  duration: () => number
}

export const ConnectorGetAttachment = createTracedDecorator<ConnectorGetAttachmentDecoratorContext>({
  spanName: SpanNames.CONNECTOR_GET_ATTACHMENT,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, context) {
    const [attachmentId] = context.args
    span.setAttribute('attachment.id', fallback(attachmentId))
    recordConnectorMetrics('get.attachment', context)
  }
})

/**
 * AgentClient method decorators
 */

interface AgentClientPostActivityData {
  response: Response
  targetEndpoint: string
  targetClientId: string
}

interface AgentClientPostActivityDecoratorContext {
  args: Parameters<AgentClient['postActivity']>
  data?: AgentClientPostActivityData
  result?: ReturnType<AgentClient['postActivity']>
  duration: () => number
}

export const AgentClientPostActivity = createTracedDecorator<AgentClientPostActivityDecoratorContext>({
  spanName: SpanNames.AGENT_CLIENT_POST_ACTIVITY,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, context) {
    const targetEndpoint = fallback(context.data?.targetEndpoint)
    const targetClientId = fallback(context.data?.targetClientId)
    const httpStatusCode = context.data?.response?.status ?? -1

    span.setAttribute('target.endpoint', targetEndpoint)
    span.setAttribute('target.client_id', targetClientId)
    span.setAttribute('http.status_code', httpStatusCode)

    HostingMetrics.agentClientRequestsCounter.add(1, {
      'target.endpoint': targetEndpoint,
      'http.status_code': httpStatusCode
    })
    HostingMetrics.agentClientRequestDuration.record(context.duration(), {
      'target.endpoint': targetEndpoint
    })
  }
})

/**
 * Authentication method decorators
 */

interface AuthTokenBase {
  method: string
  success: boolean
  scopes?: string | string[]
}

function recordAuthMetrics (context: Pick<AuthGetAccessTokenDecoratorContext, 'data' | 'duration'>): void {
  const authMethod = fallback(context.data?.method)
  const authSuccess = context.data?.success ?? false

  HostingMetrics.authTokenRequestsCounter.add(1, {
    'auth.method': authMethod,
    'auth.success': authSuccess
  })

  HostingMetrics.authTokenDuration.record(context.duration(), {
    'auth.method': authMethod
  })
}

interface AuthGetAccessTokenDecoratorContext {
  args: Parameters<MsalTokenProvider['getAccessToken']>
  data?: AuthTokenBase
  result?: ReturnType<MsalTokenProvider['getAccessToken']>
  duration: () => number
}

export const AuthGetAccessToken = createTracedDecorator<AuthGetAccessTokenDecoratorContext>({
  spanName: SpanNames.AUTHENTICATION_GET_ACCESS_TOKEN,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, context) {
    span.setAttribute('auth.scope', fallback(context.data?.scopes))
    span.setAttribute('auth.method', fallback(context.data?.method))
    recordAuthMetrics(context)
  }
})

interface AuthAcquireTokenOnBehalfOfDecoratorData extends AuthTokenBase {
  scopes?: string[]
}

interface AuthAcquireTokenOnBehalfOfDecoratorContext {
  args: Parameters<MsalTokenProvider['acquireTokenOnBehalfOf']>
  data?: AuthAcquireTokenOnBehalfOfDecoratorData
  result?: ReturnType<MsalTokenProvider['acquireTokenOnBehalfOf']>
  duration: () => number
}

export const AuthAcquireTokenOnBehalfOf = createTracedDecorator<AuthAcquireTokenOnBehalfOfDecoratorContext>({
  spanName: SpanNames.AUTHENTICATION_ACQUIRE_TOKEN_ON_BEHALF_OF,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, context) {
    span.setAttribute('auth.scopes', context.data?.scopes ?? [])
    recordAuthMetrics(context)
  }
})

interface AuthGetAgenticInstanceTokenDecoratorContext {
  args: Parameters<MsalTokenProvider['getAgenticInstanceToken']>
  data?: AuthTokenBase
  result?: ReturnType<MsalTokenProvider['getAgenticInstanceToken']>
  duration: () => number
}

export const AuthGetAgenticInstanceToken = createTracedDecorator<AuthGetAgenticInstanceTokenDecoratorContext>({
  spanName: SpanNames.AUTHENTICATION_GET_AGENTIC_INSTANCE_TOKEN,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, context) {
    const [, agentAppInstanceId] = context.args
    span.setAttribute('agentic.instance_id', fallback(agentAppInstanceId))
    recordAuthMetrics(context)
  }
})

interface AuthGetAgenticUserTokenDecoratorContext {
  args: Parameters<MsalTokenProvider['getAgenticUserToken']>
  data?: AuthTokenBase
  result?: ReturnType<MsalTokenProvider['getAgenticUserToken']>
  duration: () => number
}

export const AuthGetAgenticUserToken = createTracedDecorator<AuthGetAgenticUserTokenDecoratorContext>({
  spanName: SpanNames.AUTHENTICATION_GET_AGENTIC_USER_TOKEN,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, context) {
    const [, agentAppInstanceId, agentUserId, scopes] = context.args
    span.setAttribute('agentic.instance_id', fallback(agentAppInstanceId))
    span.setAttribute('agentic.user_id', fallback(agentUserId))
    span.setAttribute('auth.scopes', scopes ?? [])
    recordAuthMetrics(context)
  }
})

/**
 * Authorization method decorators
 */

interface AuthorizationAgenticTokenDecoratorContext {
  args: Parameters<AgenticAuthorization['token']>
  data?: Partial<{ handlerId: string, connection: string, scopes: string[] }>
  result?: ReturnType<AgenticAuthorization['token']>
  duration: () => number
}

export const AuthorizationAgenticToken = createTracedDecorator<AuthorizationAgenticTokenDecoratorContext>({
  spanName: SpanNames.AUTHORIZATION_AGENTIC_TOKEN,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, context) {
    span.setAttribute('auth.handler.id', fallback(context.data?.handlerId))
    span.setAttribute('auth.connection.name', fallback(context.data?.connection))
    span.setAttribute('auth.scopes', context.data?.scopes ?? [])
  }
})

interface AuthorizationAzureBotTokenDecoratorData {
  handlerId: string
  connection?: string
  scopes?: string[]
}

interface AuthorizationAzureBotTokenDecoratorContext {
  args: Parameters<AzureBotAuthorization['token']>
  result?: ReturnType<AzureBotAuthorization['token']>
  data: AuthorizationAzureBotTokenDecoratorData
  duration: () => number
}

export const AuthorizationAzureBotToken = createTracedDecorator<AuthorizationAzureBotTokenDecoratorContext>({
  spanName: SpanNames.AUTHORIZATION_AZURE_BOT_TOKEN,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, context) {
    span.setAttribute('auth.handler.id', fallback(context.data?.handlerId))
    span.setAttribute('auth.connection.name', fallback(context.data?.connection))
    if (context.data?.scopes) {
      span.setAttribute('auth.flow', 'obo')
      span.setAttribute('auth.scopes', context.data.scopes ?? [])
    }
  }
})

interface AuthorizationAzureBotSigninDecoratorContext {
  args: Parameters<AzureBotAuthorization['signin']>
  data?: Partial<{ handlerId: string, connection: string, reason: string }>
  result?: ReturnType<AzureBotAuthorization['signin']>
  duration: () => number
}

export const AuthorizationAzureBotSignin = createTracedDecorator<AuthorizationAzureBotSigninDecoratorContext>({
  spanName: SpanNames.AUTHORIZATION_AZURE_BOT_SIGNIN,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, context) {
    const status = context.result as Awaited<typeof context.result>
    span.setAttribute('auth.handler.id', fallback(context.data?.handlerId))
    span.setAttribute('auth.handler.status', fallback(status))
    span.setAttribute('auth.handler.status.reason', fallback(context.data?.reason))
    span.setAttribute('auth.connection.name', fallback(context.data?.connection))
  }
})

interface AuthorizationAzureBotSignoutDecoratorContext {
  args: Parameters<AzureBotAuthorization['signout']>
  data?: Partial<{ handlerId: string, connection: string, channel: string }>
  result?: ReturnType<AzureBotAuthorization['signout']>
  duration: () => number
}

export const AuthorizationAzureBotSignout = createTracedDecorator<AuthorizationAzureBotSignoutDecoratorContext>({
  spanName: SpanNames.AUTHORIZATION_AZURE_BOT_SIGNOUT,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, context) {
    span.setAttribute('auth.handler.id', fallback(context.data?.handlerId))
    span.setAttribute('auth.connection.name', fallback(context.data?.connection))
    span.setAttribute('activity.channel_id', fallback(context.data?.channel))
  }
})

function recordUserTokenClientMetrics (operation: string, context: Pick<UserTokenClientGetUserTokenDecoratorContext, 'data' | 'duration'>): void {
  const httpMethod = fallback(context.data?.config?.method?.toUpperCase())
  const httpStatusCode = context.data?.status ?? -1

  HostingMetrics.userTokenClientRequestsCounter.add(1, {
    operation: fallback(operation),
    'http.method': httpMethod,
    'http.status_code': httpStatusCode
  })

  HostingMetrics.userTokenClientRequestDuration.record(context.duration(), {
    operation: fallback(operation),
    'http.status_code': httpStatusCode
  })
}

interface UserTokenClientGetUserTokenDecoratorContext {
  args: Parameters<UserTokenClient['getUserToken']>
  data?: AxiosResponse
  result?: ReturnType<UserTokenClient['getUserToken']>
  duration: () => number
}

export const UserTokenClientGetUserToken = createTracedDecorator<UserTokenClientGetUserTokenDecoratorContext>({
  spanName: SpanNames.USER_TOKEN_CLIENT_GET_USER_TOKEN,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, context) {
    const [connectionName, channelId, userId] = context.args
    span.setAttribute('auth.connection.name', fallback(connectionName))
    span.setAttribute('activity.channel_id', fallback(channelId))
    span.setAttribute('user.id', fallback(userId))
    recordUserTokenClientMetrics('get.user.token', context)
  }
})

interface UserTokenClientSignOutDecoratorContext {
  args: Parameters<UserTokenClient['signOut']>
  data?: AxiosResponse
  result?: ReturnType<UserTokenClient['signOut']>
  duration: () => number
}

export const UserTokenClientSignOut = createTracedDecorator<UserTokenClientSignOutDecoratorContext>({
  spanName: SpanNames.USER_TOKEN_CLIENT_SIGN_OUT,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, context) {
    const [userId, connectionName, channelId] = context.args
    span.setAttribute('user.id', fallback(userId))
    span.setAttribute('auth.connection.name', fallback(connectionName))
    span.setAttribute('activity.channel_id', fallback(channelId))
    recordUserTokenClientMetrics('sign.out', context)
  }
})

interface UserTokenClientGetSignInResourceDecoratorContext {
  args: Parameters<UserTokenClient['getSignInResource']>
  data?: AxiosResponse
  result?: ReturnType<UserTokenClient['getSignInResource']>
  duration: () => number
}

export const UserTokenClientGetSignInResource = createTracedDecorator<UserTokenClientGetSignInResourceDecoratorContext>({
  spanName: SpanNames.USER_TOKEN_CLIENT_GET_SIGN_IN_RESOURCE,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, context) {
    const [, connectionName] = context.args
    span.setAttribute('auth.connection.name', fallback(connectionName))
    recordUserTokenClientMetrics('get.sign.in.resource', context)
  }
})

interface UserTokenClientExchangeTokenDecoratorContext {
  args: Parameters<UserTokenClient['exchangeTokenAsync']>
  data?: AxiosResponse
  result?: ReturnType<UserTokenClient['exchangeTokenAsync']>
  duration: () => number
}

export const UserTokenClientExchangeToken = createTracedDecorator<UserTokenClientExchangeTokenDecoratorContext>({
  spanName: SpanNames.USER_TOKEN_CLIENT_EXCHANGE_TOKEN,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, context) {
    const [userId, connectionName, channelId] = context.args
    span.setAttribute('user.id', fallback(userId))
    span.setAttribute('auth.connection.name', fallback(connectionName))
    span.setAttribute('activity.channel_id', fallback(channelId))
    recordUserTokenClientMetrics('exchange.token', context)
  }
})

interface UserTokenClientGetTokenOrSignInResourceDecoratorContext {
  args: Parameters<UserTokenClient['getTokenOrSignInResource']>
  data?: AxiosResponse
  result?: ReturnType<UserTokenClient['getTokenOrSignInResource']>
  duration: () => number
}

export const UserTokenClientGetTokenOrSignInResource = createTracedDecorator<UserTokenClientGetTokenOrSignInResourceDecoratorContext>({
  spanName: SpanNames.USER_TOKEN_CLIENT_GET_TOKEN_OR_SIGNIN_RESOURCE,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, context) {
    const [userId, connectionName, channelId] = context.args
    span.setAttribute('user.id', fallback(userId))
    span.setAttribute('auth.connection.name', fallback(connectionName))
    span.setAttribute('activity.channel_id', fallback(channelId))
    recordUserTokenClientMetrics('get.token.or.sign.in.resource', context)
  }
})

interface UserTokenClientGetTokenStatusDecoratorContext {
  args: Parameters<UserTokenClient['getTokenStatus']>
  data?: AxiosResponse
  result?: ReturnType<UserTokenClient['getTokenStatus']>
  duration: () => number
}

export const UserTokenClientGetTokenStatus = createTracedDecorator<UserTokenClientGetTokenStatusDecoratorContext>({
  spanName: SpanNames.USER_TOKEN_CLIENT_GET_TOKEN_STATUS,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, context) {
    const [userId, channelId] = context.args
    span.setAttribute('user.id', fallback(userId))
    span.setAttribute('activity.channel_id', fallback(channelId))
    recordUserTokenClientMetrics('get.token.status', context)
  }
})

interface UserTokenClientGetAadTokensDecoratorContext {
  args: Parameters<UserTokenClient['getAadTokens']>
  data?: AxiosResponse
  result?: ReturnType<UserTokenClient['getAadTokens']>
  duration: () => number
}

export const UserTokenClientGetAadTokens = createTracedDecorator<UserTokenClientGetAadTokensDecoratorContext>({
  spanName: SpanNames.USER_TOKEN_CLIENT_GET_AAD_TOKENS,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, context) {
    const [userId, connectionName, channelId] = context.args
    span.setAttribute('user.id', fallback(userId))
    span.setAttribute('auth.connection.name', fallback(connectionName))
    span.setAttribute('activity.channel_id', fallback(channelId))
    recordUserTokenClientMetrics('get.aad.tokens', context)
  }
})

/**
 * TurnContext method decorators
 */

interface TurnContextSendActivitiesDecoratorContext {
  args: Parameters<TurnContext['sendActivities']>
  result?: ReturnType<TurnContext['sendActivities']>
}

export const TurnContextSendActivities = createTracedDecorator<TurnContextSendActivitiesDecoratorContext>({
  spanName: SpanNames.TURN_SEND_ACTIVITIES,
  onEnd (span, context) {
    const [activities] = context.args

    span.setAttribute('activity.count', activities.length ?? 0)

    for (const activity of activities) {
      span.setAttribute('activity.type', fallback(activity.type))
      span.setAttribute('activity.delivery_mode', fallback(activity.deliveryMode))
      span.setAttribute('activity.id', fallback(activity.id))
    }
  }
})

/**
 * Storage method decorators
 */

interface StorageDecoratorContext {
  args: [keys: string[]]
  result?: Promise<any>
  duration: () => number
}

export const StorageRead = createTracedDecorator<StorageDecoratorContext>({
  spanName: SpanNames.STORAGE_READ,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, context) {
    const [keys] = context.args
    span.setAttribute('storage.key.count', keys?.length ?? 0)
    HostingMetrics.storageOperationDuration.record(context.duration(), {
      'storage.operation': 'read'
    })
  }
})

export const StorageWrite = createTracedDecorator<StorageDecoratorContext>({
  spanName: SpanNames.STORAGE_WRITE,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, context) {
    const [changes] = context.args
    span.setAttribute('storage.key.count', changes ? Object.keys(changes).length : 0)
    HostingMetrics.storageOperationDuration.record(context.duration(), {
      'storage.operation': 'write'
    })
  }
})

export const StorageDelete = createTracedDecorator<StorageDecoratorContext>({
  spanName: SpanNames.STORAGE_DELETE,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, context) {
    const [keys] = context.args
    span.setAttribute('storage.key.count', keys?.length ?? 0)
    HostingMetrics.storageOperationDuration.record(context.duration(), {
      'storage.operation': 'delete'
    })
  }
})
