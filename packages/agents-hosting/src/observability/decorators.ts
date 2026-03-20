// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { createTracedDecorator, SpanNames } from '@microsoft/agents-telemetry'
import { AxiosResponse } from 'axios'
import type { TurnContext } from '../turnContext'
import { CloudAdapter } from '../cloudAdapter'
import { ConnectorClient } from '../connector-client/connectorClient'
import type { AgentClient } from '../agent-client/agentClient'
import type { UserTokenClient } from '../oauth'
import { HostingMetrics } from './metrics'
import { TracedStorage } from '../storage'

const fallback = <T>(value: T | undefined | null | void) => value ?? 'unknown'

interface SharedContext {
  duration(): number
}

/**
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

// function recordAuthMetrics (scope: AuthGetAccessTokenScope, context: SharedContext): void {
//   const authMethod = fallback(scope.method)
//   const authSuccess = scope.success ?? false

//   HostingMetrics.authTokenRequestsCounter.add(1, {
//     'auth.method': authMethod,
//     'auth.success': authSuccess
//   })

//   HostingMetrics.authTokenDuration.record(context.duration(), {
//     'auth.method': authMethod
//   })
// }

// interface AuthGetAccessTokenScope {
//   method: string
//   success: boolean
//   scopes?: string | string[]
// }

// export const AuthGetAccessToken = createTracedDecorator<MsalTokenProvider['getAccessToken'], AuthGetAccessTokenScope>({
//   spanName: SpanNames.AUTHENTICATION_GET_ACCESS_TOKEN,
//   onStart (span, decorator, context: SharedContext) {
//     const start = performance.now()
//     context.duration = () => performance.now() - start
//   },
//   onEnd (span, decorator, context: SharedContext) {
//     const [, scope] = decorator.args
//     span.setAttribute('auth.scope', fallback(scope))
//     span.setAttribute('auth.method', fallback(decorator.scope.method))
//     recordAuthMetrics(decorator.scope, context)
//   }
// })

// interface AuthAcquireTokenOnBehalfOfScope extends AuthGetAccessTokenScope {
//   scopes?: string[]
// }

// export const AuthAcquireTokenOnBehalfOf = createTracedDecorator<MsalTokenProvider['acquireTokenOnBehalfOf'], AuthAcquireTokenOnBehalfOfScope>({
//   spanName: SpanNames.AUTHENTICATION_ACQUIRE_TOKEN_ON_BEHALF_OF,
//   onStart (span, decorator, context: SharedContext) {
//     const start = performance.now()
//     context.duration = () => performance.now() - start
//   },
//   onEnd (span, decorator, context: SharedContext) {
//     span.setAttribute('auth.scopes', decorator.scope.scopes ?? [])
//     recordAuthMetrics(decorator.scope, context)
//   }
// })

// export const AuthGetAgenticInstanceToken = createTracedDecorator<MsalTokenProvider['getAgenticInstanceToken'], AuthGetAccessTokenScope>({
//   spanName: SpanNames.AUTHENTICATION_GET_AGENTIC_INSTANCE_TOKEN,
//   onStart (span, decorator, context: SharedContext) {
//     const start = performance.now()
//     context.duration = () => performance.now() - start
//   },
//   onEnd (span, decorator, context: SharedContext) {
//     const [, agentAppInstanceId] = decorator.args
//     span.setAttribute('agentic.instance_id', fallback(agentAppInstanceId))
//     recordAuthMetrics(decorator.scope, context)
//   }
// })

// export const AuthGetAgenticUserToken = createTracedDecorator<MsalTokenProvider['getAgenticUserToken'], AuthGetAccessTokenScope>({
//   spanName: SpanNames.AUTHENTICATION_GET_AGENTIC_USER_TOKEN,
//   onStart (span, decorator, context: SharedContext) {
//     const start = performance.now()
//     context.duration = () => performance.now() - start
//   },
//   onEnd (span, decorator, context: SharedContext) {
//     const [, agentAppInstanceId, agentUserId, scopes] = decorator.args
//     span.setAttribute('agentic.instance_id', fallback(agentAppInstanceId))
//     span.setAttribute('agentic.user_id', fallback(agentUserId))
//     span.setAttribute('auth.scopes', scopes ?? [])
//     recordAuthMetrics(decorator.scope, context)
//   }
// })

/**
 * Authorization method decorators
 */

// interface AuthorizationAgenticTokenScope {
//   handlerId: string
//   connection?: string
//   scopes?: string[]
// }

// export const AuthorizationAgenticToken = createTracedDecorator<AgenticAuthorization['token'], AuthorizationAgenticTokenScope>({
//   spanName: SpanNames.AUTHORIZATION_AGENTIC_TOKEN,
//   onStart (span, decorator, context: SharedContext) {
//     const start = performance.now()
//     context.duration = () => performance.now() - start
//   },
//   onEnd (span, decorator, context: SharedContext) {
//     span.setAttribute('auth.handler.id', fallback(decorator.scope.handlerId))
//     span.setAttribute('auth.connection.name', fallback(decorator.scope.connection))
//     span.setAttribute('auth.scopes', decorator.scope.scopes ?? [])
//   }
// })

// export const AuthorizationAzureBotToken = createTracedDecorator<AzureBotAuthorization['token'], AuthorizationAgenticTokenScope>({
//   spanName: SpanNames.AUTHORIZATION_AZURE_BOT_TOKEN,
//   onEnd (span, decorator) {
//     span.setAttribute('auth.handler.id', fallback(decorator.scope.handlerId))
//     span.setAttribute('auth.connection.name', fallback(decorator.scope.connection))
//     if (decorator.scope.scopes) {
//       span.setAttribute('auth.flow', 'obo')
//       span.setAttribute('auth.scopes', decorator.scope.scopes ?? [])
//     }
//   }
// })

// interface AuthorizationAzureBotSigninScope {
//   handlerId?: string
//   connection?: string
//   reason?: string
// }

// export const AuthorizationAzureBotSignin = createTracedDecorator<AzureBotAuthorization['signin'], AuthorizationAzureBotSigninScope>({
//   spanName: SpanNames.AUTHORIZATION_AZURE_BOT_SIGNIN,
//   onEnd (span, decorator) {
//     const status = decorator.result
//     span.setAttribute('auth.handler.id', fallback(decorator.scope.handlerId))
//     span.setAttribute('auth.handler.status', fallback(status))
//     span.setAttribute('auth.handler.status.reason', fallback(decorator.scope.reason))
//     span.setAttribute('auth.connection.name', fallback(decorator.scope.connection))
//   }
// })

// interface AuthorizationAzureBotSignoutScope {
//   handlerId: string
//   connection: string
//   channel: string
// }

// export const AuthorizationAzureBotSignout = createTracedDecorator<AzureBotAuthorization['signout'], AuthorizationAzureBotSignoutScope>({
//   spanName: SpanNames.AUTHORIZATION_AZURE_BOT_SIGNOUT,
//   onEnd (span, decorator) {
//     span.setAttribute('auth.handler.id', fallback(decorator.scope.handlerId))
//     span.setAttribute('auth.connection.name', fallback(decorator.scope.connection))
//     span.setAttribute('activity.channel_id', fallback(decorator.scope.channel))
//   }
// })

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
