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
import { TracedStorage } from '../storage'
import { RouteHandler } from '../app/routeHandler'

const fallback = <T>(value: T | undefined | null | void) => value ?? 'unknown'

interface SharedContext {
  duration(): number
}

/**
 * CloudAdapter method decorators
 */

/**
 * AgentApplication method decorators
 */
interface AppRunDecoratorScope {
  authorized?: boolean
  route?: { matched?: boolean, isInvokeRoute?: boolean, isAgenticRoute?: boolean }
  attachmentsCount?: number
}

export const AgentApplicationRun = createTracedDecorator<AgentApplication<any>['runInternal'], AppRunDecoratorScope>({
  spanName: SpanNames.AGENTS_APP_RUN,
  onStart (span, decorator, context: SharedContext) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  // onChildSpan (spanName, span, context) {
  //   switch (spanName) {
  //     case SpanNames.AGENTS_APP_ROUTE_HANDLER:
  //       span.setAttribute('agents.route.is_invoke', context.data?.route?.isInvokeRoute ?? false)
  //       span.setAttribute('agents.route.is_agentic', context.data?.route?.isAgenticRoute ?? false)
  //       break
  //     case SpanNames.AGENTS_APP_DOWNLOAD_FILES:
  //       span.setAttribute('agents.attachments.count', context.data?.attachmentsCount ?? 0)
  //       break
  //   }
  // },
  onError (span, error) {
    HostingMetrics.turnsErrorsCounter.add(1, {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, decorator, context: SharedContext) {
    const { args: [turnContext], scope } = decorator
    const activityType = fallback(turnContext.activity?.type)
    const activityId = fallback(turnContext.activity?.id)
    const channelId = fallback(turnContext.activity?.channelId)
    const conversationId = fallback(turnContext.activity?.conversation?.id)
    const authorized = scope.authorized ?? false
    const routeMatched = scope.route?.matched ?? false
    span.setAttribute('activity.type', activityType)
    span.setAttribute('activity.id', activityId)
    span.setAttribute('route.authorized', authorized)
    span.setAttribute('route.matched', routeMatched)

    HostingMetrics.turnsTotalCounter.add(1, {
      'activity.type': activityType,
      'activity.conversation_id': conversationId
    })
    HostingMetrics.turnDuration.record(context.duration(), {
      'activity.type': activityType,
      'activity.channel_id': channelId,
      'activity.conversation_id': conversationId
    })
  }
})

export const AgentApplicationRouteHandler = createTracedDecorator<RouteHandler<any>, AppRunDecoratorScope>({
  spanName: SpanNames.AGENTS_APP_ROUTE_HANDLER,
  onEnd (span, decorator) {
    span.setAttribute('route.is_invoke', decorator.scope.route?.isInvokeRoute ?? false)
    span.setAttribute('route.is_agentic', decorator.scope.route?.isAgenticRoute ?? false)
  }
})

/**
 * ConnectorClient method decorators
 */

function recordConnectorMetrics (_operation: string, scope: ConnectorReplyToActivityScope, context: SharedContext): void {
  const operation = fallback(_operation)
  const httpMethod = fallback(scope.response?.config?.method?.toUpperCase())
  const httpStatusCode = scope.response?.status ?? -1

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

interface ConnectorReplyToActivityScope {
  response?: AxiosResponse
}

export const ConnectorReplyToActivity = createTracedDecorator<ConnectorClient['replyToActivity'], ConnectorReplyToActivityScope>({
  spanName: SpanNames.CONNECTOR_REPLY_TO_ACTIVITY,
  onStart (span, decorator, context: SharedContext) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, decorator, context: SharedContext) {
    const [conversationId, activityId] = decorator.args
    span.setAttribute('activity.conversation_id', fallback(conversationId))
    span.setAttribute('activity.id', fallback(activityId))
    recordConnectorMetrics('reply.to.activity', decorator.scope, context)
  }
})

interface ConnectorSendToConversationScope {
  response?: AxiosResponse
}

export const ConnectorSendToConversation = createTracedDecorator<ConnectorClient['sendToConversation'], ConnectorSendToConversationScope>({
  spanName: SpanNames.CONNECTOR_SEND_TO_CONVERSATION,
  onStart (span, decorator, context: SharedContext) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, decorator, context: SharedContext) {
    const [conversationId] = decorator.args
    span.setAttribute('activity.conversation_id', fallback(conversationId))
    recordConnectorMetrics('send.to.conversation', decorator.scope, context)
  }
})

interface ConnectorUpdateActivityScope {
  response?: AxiosResponse
}

export const ConnectorUpdateActivity = createTracedDecorator<ConnectorClient['updateActivity'], ConnectorUpdateActivityScope>({
  spanName: SpanNames.CONNECTOR_UPDATE_ACTIVITY,
  onStart (span, decorator, context: SharedContext) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, decorator, context: SharedContext) {
    const [conversationId, activityId] = decorator.args
    span.setAttribute('activity.conversation_id', fallback(conversationId))
    span.setAttribute('activity.id', fallback(activityId))
    recordConnectorMetrics('update.activity', decorator.scope, context)
  }
})

interface ConnectorDeleteActivityScope {
  response?: AxiosResponse
}

export const ConnectorDeleteActivity = createTracedDecorator<ConnectorClient['deleteActivity'], ConnectorDeleteActivityScope>({
  spanName: SpanNames.CONNECTOR_DELETE_ACTIVITY,
  onStart (span, decorator, context: SharedContext) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, decorator, context: SharedContext) {
    const [conversationId, activityId] = decorator.args
    span.setAttribute('activity.conversation_id', fallback(conversationId))
    span.setAttribute('activity.id', fallback(activityId))
    recordConnectorMetrics('delete.activity', decorator.scope, context)
  }
})

interface ConnectorCreateConversationScope {
  response?: AxiosResponse
}

export const ConnectorCreateConversation = createTracedDecorator<ConnectorClient['createConversation'], ConnectorCreateConversationScope>({
  spanName: SpanNames.CONNECTOR_CREATE_CONVERSATION,
  onStart (span, decorator, context: SharedContext) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, decorator, context: SharedContext) {
    recordConnectorMetrics('create.conversation', decorator.scope, context)
  }
})

interface ConnectorGetConversationsScope {
  response?: AxiosResponse
}

export const ConnectorGetConversations = createTracedDecorator<ConnectorClient['getConversations'], ConnectorGetConversationsScope>({
  spanName: SpanNames.CONNECTOR_GET_CONVERSATIONS,
  onStart (span, decorator, context: SharedContext) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, decorator, context: SharedContext) {
    recordConnectorMetrics('get.conversations', decorator.scope, context)
  }
})

interface ConnectorGetConversationMemberScope {
  response?: AxiosResponse
}

export const ConnectorGetConversationMember = createTracedDecorator<ConnectorClient['getConversationMember'], ConnectorGetConversationMemberScope>({
  spanName: SpanNames.CONNECTOR_GET_CONVERSATION_MEMBERS,
  onStart (span, decorator, context: SharedContext) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, decorator, context: SharedContext) {
    recordConnectorMetrics('get.conversation.member', decorator.scope, context)
  }
})

interface ConnectorUploadAttachmentScope {
  response?: AxiosResponse
}

export const ConnectorUploadAttachment = createTracedDecorator<ConnectorClient['uploadAttachment'], ConnectorUploadAttachmentScope>({
  spanName: SpanNames.CONNECTOR_UPLOAD_ATTACHMENT,
  onStart (span, decorator, context: SharedContext) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, decorator, context: SharedContext) {
    const [conversationId] = decorator.args
    span.setAttribute('activity.conversation_id', fallback(conversationId))
    recordConnectorMetrics('upload.attachment', decorator.scope, context)
  }
})

interface ConnectorGetAttachmentInfoScope {
  response?: AxiosResponse
}

export const ConnectorGetAttachmentInfo = createTracedDecorator<ConnectorClient['getAttachmentInfo'], ConnectorGetAttachmentInfoScope>({
  spanName: SpanNames.CONNECTOR_GET_ATTACHMENT,
  onStart (span, decorator, context: SharedContext) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, decorator, context: SharedContext) {
    const [attachmentId] = decorator.args
    span.setAttribute('attachment.id', fallback(attachmentId))
    recordConnectorMetrics('get.attachment.info', decorator.scope, context)
  }
})

interface ConnectorGetAttachmentScope {
  response?: AxiosResponse
}

export const ConnectorGetAttachment = createTracedDecorator<ConnectorClient['getAttachment'], ConnectorGetAttachmentScope>({
  spanName: SpanNames.CONNECTOR_GET_ATTACHMENT,
  onStart (span, decorator, context: SharedContext) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, decorator, context: SharedContext) {
    const [attachmentId] = decorator.args
    span.setAttribute('attachment.id', fallback(attachmentId))
    recordConnectorMetrics('get.attachment', decorator.scope, context)
  }
})

/**
 * AgentClient method decorators
 */

interface AgentClientPostActivityScope {
  response: Response
  targetEndpoint: string
  targetClientId: string
}

export const AgentClientPostActivity = createTracedDecorator<AgentClient['postActivity'], AgentClientPostActivityScope>({
  spanName: SpanNames.AGENT_CLIENT_POST_ACTIVITY,
  onStart (span, decorator, context: SharedContext) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, decorator, context: SharedContext) {
    const { scope } = decorator
    const targetEndpoint = fallback(scope.targetEndpoint)
    const targetClientId = fallback(scope.targetClientId)
    const httpStatusCode = scope.response?.status ?? -1

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

function recordAuthMetrics (scope: AuthGetAccessTokenScope, context: SharedContext): void {
  const authMethod = fallback(scope.method)
  const authSuccess = scope.success ?? false

  HostingMetrics.authTokenRequestsCounter.add(1, {
    'auth.method': authMethod,
    'auth.success': authSuccess
  })

  HostingMetrics.authTokenDuration.record(context.duration(), {
    'auth.method': authMethod
  })
}

interface AuthGetAccessTokenScope {
  method: string
  success: boolean
  scopes?: string | string[]
}

export const AuthGetAccessToken = createTracedDecorator<MsalTokenProvider['getAccessToken'], AuthGetAccessTokenScope>({
  spanName: SpanNames.AUTHENTICATION_GET_ACCESS_TOKEN,
  onStart (span, decorator, context: SharedContext) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, decorator, context: SharedContext) {
    const [, scope] = decorator.args
    span.setAttribute('auth.scope', fallback(scope))
    span.setAttribute('auth.method', fallback(decorator.scope.method))
    recordAuthMetrics(decorator.scope, context)
  }
})

interface AuthAcquireTokenOnBehalfOfScope extends AuthGetAccessTokenScope {
  scopes?: string[]
}

export const AuthAcquireTokenOnBehalfOf = createTracedDecorator<MsalTokenProvider['acquireTokenOnBehalfOf'], AuthAcquireTokenOnBehalfOfScope>({
  spanName: SpanNames.AUTHENTICATION_ACQUIRE_TOKEN_ON_BEHALF_OF,
  onStart (span, decorator, context: SharedContext) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, decorator, context: SharedContext) {
    span.setAttribute('auth.scopes', decorator.scope.scopes ?? [])
    recordAuthMetrics(decorator.scope, context)
  }
})

export const AuthGetAgenticInstanceToken = createTracedDecorator<MsalTokenProvider['getAgenticInstanceToken'], AuthGetAccessTokenScope>({
  spanName: SpanNames.AUTHENTICATION_GET_AGENTIC_INSTANCE_TOKEN,
  onStart (span, decorator, context: SharedContext) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, decorator, context: SharedContext) {
    const [, agentAppInstanceId] = decorator.args
    span.setAttribute('agentic.instance_id', fallback(agentAppInstanceId))
    recordAuthMetrics(decorator.scope, context)
  }
})

export const AuthGetAgenticUserToken = createTracedDecorator<MsalTokenProvider['getAgenticUserToken'], AuthGetAccessTokenScope>({
  spanName: SpanNames.AUTHENTICATION_GET_AGENTIC_USER_TOKEN,
  onStart (span, decorator, context: SharedContext) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, decorator, context: SharedContext) {
    const [, agentAppInstanceId, agentUserId, scopes] = decorator.args
    span.setAttribute('agentic.instance_id', fallback(agentAppInstanceId))
    span.setAttribute('agentic.user_id', fallback(agentUserId))
    span.setAttribute('auth.scopes', scopes ?? [])
    recordAuthMetrics(decorator.scope, context)
  }
})

/**
 * Authorization method decorators
 */

interface AuthorizationAgenticTokenScope {
  handlerId: string
  connection?: string
  scopes?: string[]
}

export const AuthorizationAgenticToken = createTracedDecorator<AgenticAuthorization['token'], AuthorizationAgenticTokenScope>({
  spanName: SpanNames.AUTHORIZATION_AGENTIC_TOKEN,
  onStart (span, decorator, context: SharedContext) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, decorator, context: SharedContext) {
    span.setAttribute('auth.handler.id', fallback(decorator.scope.handlerId))
    span.setAttribute('auth.connection.name', fallback(decorator.scope.connection))
    span.setAttribute('auth.scopes', decorator.scope.scopes ?? [])
  }
})

export const AuthorizationAzureBotToken = createTracedDecorator<AzureBotAuthorization['token'], AuthorizationAgenticTokenScope>({
  spanName: SpanNames.AUTHORIZATION_AZURE_BOT_TOKEN,
  onEnd (span, decorator) {
    span.setAttribute('auth.handler.id', fallback(decorator.scope.handlerId))
    span.setAttribute('auth.connection.name', fallback(decorator.scope.connection))
    if (decorator.scope.scopes) {
      span.setAttribute('auth.flow', 'obo')
      span.setAttribute('auth.scopes', decorator.scope.scopes ?? [])
    }
  }
})

interface AuthorizationAzureBotSigninScope {
  handlerId?: string
  connection?: string
  reason?: string
}

export const AuthorizationAzureBotSignin = createTracedDecorator<AzureBotAuthorization['signin'], AuthorizationAzureBotSigninScope>({
  spanName: SpanNames.AUTHORIZATION_AZURE_BOT_SIGNIN,
  onEnd (span, decorator) {
    const status = decorator.result
    span.setAttribute('auth.handler.id', fallback(decorator.scope.handlerId))
    span.setAttribute('auth.handler.status', fallback(status))
    span.setAttribute('auth.handler.status.reason', fallback(decorator.scope.reason))
    span.setAttribute('auth.connection.name', fallback(decorator.scope.connection))
  }
})

interface AuthorizationAzureBotSignoutScope {
  handlerId: string
  connection: string
  channel: string
}

export const AuthorizationAzureBotSignout = createTracedDecorator<AzureBotAuthorization['signout'], AuthorizationAzureBotSignoutScope>({
  spanName: SpanNames.AUTHORIZATION_AZURE_BOT_SIGNOUT,
  onEnd (span, decorator) {
    span.setAttribute('auth.handler.id', fallback(decorator.scope.handlerId))
    span.setAttribute('auth.connection.name', fallback(decorator.scope.connection))
    span.setAttribute('activity.channel_id', fallback(decorator.scope.channel))
  }
})

function recordUserTokenClientMetrics (operation: string, scope: UserTokenClientGetUserTokenScope, context: SharedContext): void {
  const httpMethod = fallback(scope.response?.config?.method?.toUpperCase())
  const httpStatusCode = scope.response?.status ?? -1

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

interface UserTokenClientGetUserTokenScope {
  response?: AxiosResponse
}

export const UserTokenClientGetUserToken = createTracedDecorator<UserTokenClient['getUserToken'], UserTokenClientGetUserTokenScope>({
  spanName: SpanNames.USER_TOKEN_CLIENT_GET_USER_TOKEN,
  onStart (span, decorator, context: SharedContext) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, decorator, context: SharedContext) {
    const [connectionName, channelId, userId] = decorator.args
    span.setAttribute('auth.connection.name', fallback(connectionName))
    span.setAttribute('activity.channel_id', fallback(channelId))
    span.setAttribute('user.id', fallback(userId))
    recordUserTokenClientMetrics('get.user.token', decorator.scope, context)
  }
})

export const UserTokenClientSignOut = createTracedDecorator<UserTokenClient['signOut'], UserTokenClientGetUserTokenScope>({
  spanName: SpanNames.USER_TOKEN_CLIENT_SIGN_OUT,
  onStart (span, decorator, context: SharedContext) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, decorator, context: SharedContext) {
    const [userId, connectionName, channelId] = decorator.args
    span.setAttribute('user.id', fallback(userId))
    span.setAttribute('auth.connection.name', fallback(connectionName))
    span.setAttribute('activity.channel_id', fallback(channelId))
    recordUserTokenClientMetrics('sign.out', decorator.scope, context)
  }
})

export const UserTokenClientGetSignInResource = createTracedDecorator<UserTokenClient['getSignInResource'], UserTokenClientGetUserTokenScope>({
  spanName: SpanNames.USER_TOKEN_CLIENT_GET_SIGN_IN_RESOURCE,
  onStart (span, decorator, context: SharedContext) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, decorator, context: SharedContext) {
    const [, connectionName] = decorator.args
    span.setAttribute('auth.connection.name', fallback(connectionName))
    recordUserTokenClientMetrics('get.sign.in.resource', decorator.scope, context)
  }
})

export const UserTokenClientExchangeToken = createTracedDecorator<UserTokenClient['exchangeTokenAsync'], UserTokenClientGetUserTokenScope>({
  spanName: SpanNames.USER_TOKEN_CLIENT_EXCHANGE_TOKEN,
  onStart (span, decorator, context: SharedContext) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, decorator, context: SharedContext) {
    const [userId, connectionName, channelId] = decorator.args
    span.setAttribute('user.id', fallback(userId))
    span.setAttribute('auth.connection.name', fallback(connectionName))
    span.setAttribute('activity.channel_id', fallback(channelId))
    recordUserTokenClientMetrics('exchange.token', decorator.scope, context)
  }
})

export const UserTokenClientGetTokenOrSignInResource = createTracedDecorator<UserTokenClient['getTokenOrSignInResource'], UserTokenClientGetUserTokenScope>({
  spanName: SpanNames.USER_TOKEN_CLIENT_GET_TOKEN_OR_SIGNIN_RESOURCE,
  onStart (span, decorator, context: SharedContext) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, decorator, context: SharedContext) {
    const [userId, connectionName, channelId] = decorator.args
    span.setAttribute('user.id', fallback(userId))
    span.setAttribute('auth.connection.name', fallback(connectionName))
    span.setAttribute('activity.channel_id', fallback(channelId))
    recordUserTokenClientMetrics('get.token.or.sign.in.resource', decorator.scope, context)
  }
})

export const UserTokenClientGetTokenStatus = createTracedDecorator<UserTokenClient['getTokenStatus'], UserTokenClientGetUserTokenScope>({
  spanName: SpanNames.USER_TOKEN_CLIENT_GET_TOKEN_STATUS,
  onStart (span, decorator, context: SharedContext) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, decorator, context: SharedContext) {
    const [userId, channelId] = decorator.args
    span.setAttribute('user.id', fallback(userId))
    span.setAttribute('activity.channel_id', fallback(channelId))
    recordUserTokenClientMetrics('get.token.status', decorator.scope, context)
  }
})

export const UserTokenClientGetAadTokens = createTracedDecorator<UserTokenClient['getAadTokens'], UserTokenClientGetUserTokenScope>({
  spanName: SpanNames.USER_TOKEN_CLIENT_GET_AAD_TOKENS,
  onStart (span, decorator, context: SharedContext) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, decorator, context: SharedContext) {
    const [userId, connectionName, channelId] = decorator.args
    span.setAttribute('user.id', fallback(userId))
    span.setAttribute('auth.connection.name', fallback(connectionName))
    span.setAttribute('activity.channel_id', fallback(channelId))
    recordUserTokenClientMetrics('get.aad.tokens', decorator.scope, context)
  }
})

/**
 * TurnContext method decorators
 */

export const TurnContextSendActivities = createTracedDecorator<TurnContext['sendActivities']>({
  spanName: SpanNames.TURN_SEND_ACTIVITIES,
  onEnd (span, decorator) {
    const [activities] = decorator.args

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

export const StorageRead = createTracedDecorator<TracedStorage['read']>({
  spanName: SpanNames.STORAGE_READ,
  onStart (span, decorator, context: SharedContext) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, decorator, context: SharedContext) {
    const [keys] = decorator.args
    span.setAttribute('storage.key.count', keys?.length ?? 0)
    HostingMetrics.storageOperationDuration.record(context.duration(), {
      'storage.operation': 'read'
    })
  }
})

export const StorageWrite = createTracedDecorator<TracedStorage['write']>({
  spanName: SpanNames.STORAGE_WRITE,
  onStart (span, decorator, context: SharedContext) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, decorator, context: SharedContext) {
    const [changes] = decorator.args
    span.setAttribute('storage.key.count', changes ? Object.keys(changes).length : 0)
    HostingMetrics.storageOperationDuration.record(context.duration(), {
      'storage.operation': 'write'
    })
  }
})

export const StorageDelete = createTracedDecorator<TracedStorage['delete']>({
  spanName: SpanNames.STORAGE_DELETE,
  onStart (span, decorator, context: SharedContext) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onEnd (span, decorator, context: SharedContext) {
    const [keys] = decorator.args
    span.setAttribute('storage.key.count', keys?.length ?? 0)
    HostingMetrics.storageOperationDuration.record(context.duration(), {
      'storage.operation': 'delete'
    })
  }
})
