// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { createTracedDecorator, SpanNames } from '@microsoft/agents-telemetry'
import { AxiosResponse } from 'axios'
import { Activity } from '@microsoft/agents-activity'
import type { TurnContext } from '../turnContext'
import { CloudAdapter } from '../cloudAdapter'
import { AgentApplication } from '../app/agentApplication'
import { ConnectorClient } from '../connector-client/connectorClient'
import type { AgentClient } from '../agent-client/agentClient'
import { HostingMetrics } from './metrics'
import { BaseAdapter } from '../baseAdapter'

const fallback = <T>(value: T | undefined | null) => value ?? 'unknown'

/**
 * BaseAdapter method decorators
 */

interface BaseAdapterTurnDecoratorContext {
  args: Parameters<BaseAdapter['runMiddleware']>
  data?: Error
  result?: ReturnType<BaseAdapter['runMiddleware']>
  duration: () => number
}

export const BaseAdapterTurn = createTracedDecorator<BaseAdapterTurnDecoratorContext>({
  spanName: SpanNames.ADAPTER_TURN,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onError (span, error) {
    const type = fallback(error?.constructor?.name)
    span.addEvent('turn.failed', {
      'error.type': type
    })
    HostingMetrics.turnsErrorsCounter.add(1, {
      'error.type': type
    })
  },
  onEnd (span, context) {
    const { args: [turnContext], data, duration } = context
    const type = fallback(turnContext?.activity?.type)
    const channelId = fallback(turnContext?.activity?.channelId)

    if (data instanceof Error) {
      HostingMetrics.turnsErrorsCounter.add(1, {
        'error.type': type
      })
    }

    HostingMetrics.turnsTotalCounter.add(1, {
      'activity.type': type,
      'conversation.id': fallback(turnContext?.activity?.conversation?.id)
    })
    HostingMetrics.turnDuration.record(duration(), {
      'activity.type': type,
      'channel.id': channelId,
      'conversation.id': fallback(turnContext?.activity?.conversation?.id)
    })
  }
})

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
  onError (span, error) {
    span.addEvent('process.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    const { data, duration } = context
    const type = fallback(data?.activity?.type)
    const channelId = fallback(data?.activity?.channelId)

    span.setAttribute('agents.activity.type', type)
    span.setAttribute('agents.activity.channel_id', channelId)
    span.setAttribute('agents.activity.delivery_mode', fallback(data?.activity?.deliveryMode))
    span.setAttribute('agents.activity.conversation_id', fallback(data?.activity?.conversation?.id))
    span.setAttribute('agents.activity.is_agentic', data?.activity?.isAgenticRequest() ?? false)

    HostingMetrics.activitiesReceivedCounter.add(1, {
      'agents.activity.type': type,
      'agents.activity.channel_id': channelId
    })
    HostingMetrics.adapterProcessDuration.record(duration(), {
      'agents.activity.type': type
    })
  }
})

interface SendActivitiesDecoratorContext {
  args: Parameters<CloudAdapter['sendActivities']>
  result?: ReturnType<CloudAdapter['sendActivities']>
}

export const CloudAdapterSendActivities = createTracedDecorator<SendActivitiesDecoratorContext>({
  spanName: SpanNames.ADAPTER_SEND_ACTIVITIES,
  onError (span, error) {
    span.addEvent('sendActivities.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    const [, _activities] = context.args
    const activities = _activities ?? []

    span.setAttribute('agents.activity.count', activities?.length ?? 0)
    span.setAttribute('agents.activity.conversation_id', fallback(activities[0]?.conversation?.id))

    for (const activity of activities) {
      HostingMetrics.activitiesSentCounter.add(1, {
        'agents.activity.type': fallback(activity?.type),
        'agents.activity.channel_id': fallback(activity?.channelId)
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
  onError (span, error) {
    span.addEvent('updateActivity.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    const [, activity] = context.args

    span.setAttribute('agents.activity.id', fallback(activity?.id))
    span.setAttribute('agents.activity.conversation_id', fallback(activity?.conversation?.id))

    HostingMetrics.activitiesUpdatedCounter.add(1, {
      'agents.activity.channel_id': fallback(activity?.channelId),
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
  onError (span, error) {
    span.addEvent('deleteActivity.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    const [, reference] = context.args

    span.setAttribute('agents.activity.id', fallback(reference?.activityId))
    span.setAttribute('agents.activity.conversation_id', fallback(reference?.conversation?.id))

    HostingMetrics.activitiesDeletedCounter.add(1, {
      'agents.activity.channel_id': fallback(reference?.channelId)
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
  onError (span, error) {
    span.addEvent('continueConversation.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    const [, reference] = context.args
    const botAppId = fallback(context.data?.identity?.aud)
    const isAgenticRequest = context.data?.activity?.isAgenticRequest() ?? false
    const conversationId = fallback(reference?.conversation?.id)

    span.setAttribute('agents.bot.app_id', botAppId)
    span.setAttribute('agents.activity.conversation_id', conversationId)
    span.setAttribute('agents.is_agentic', isAgenticRequest)
  }
})

interface CreateConnectorClientDecoratorContext {
  args: Parameters<CloudAdapter['createConnectorClient']>
  result?: ReturnType<CloudAdapter['createConnectorClient']>
}

export const CloudAdapterCreateConnectorClient = createTracedDecorator<CreateConnectorClientDecoratorContext>({
  spanName: SpanNames.ADAPTER_CREATE_CONNECTOR_CLIENT,
  onError (span, error) {
    span.addEvent('createConnectorClient.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    const [_serviceUrl, _scope] = context.args
    const serviceUrl = fallback(_serviceUrl)
    const scope = fallback(_scope)

    span.setAttribute('agents.service_url', serviceUrl)
    span.setAttribute('agents.auth.scope', scope)
  }
})

interface CreateConnectorClientWithIdentityDecoratorContext {
  args: Parameters<CloudAdapter['createConnectorClientWithIdentity']>
  data: { scope: string }
  result?: ReturnType<CloudAdapter['createConnectorClientWithIdentity']>
}

export const CloudAdapterCreateConnectorClientWithIdentity = createTracedDecorator<CreateConnectorClientWithIdentityDecoratorContext>({
  spanName: SpanNames.ADAPTER_CREATE_CONNECTOR_CLIENT,
  onError (span, error) {
    span.addEvent('createConnectorClientWithIdentity.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    const [, activity] = context.args
    const isAgenticRequest = activity?.isAgenticRequest() ?? false
    const scope = fallback(context.data.scope)
    const serviceUrl = fallback(activity?.serviceUrl)

    span.setAttribute('agents.service_url', serviceUrl)
    span.setAttribute('agents.auth.scope', scope)
    span.setAttribute('agents.is_agentic', isAgenticRequest)
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
}

export const AgentApplicationRun = createTracedDecorator<AppRunDecoratorContext>({
  spanName: SpanNames.AGENTS_APP_RUN,
  onChildSpan (spanName, span, context) {
    switch (spanName) {
      case SpanNames.AGENTS_APP_ROUTE_HANDLER:
        span.setAttribute('agents.route.is_invoke', context.data?.route?.isInvokeRoute ?? false)
        span.setAttribute('agents.route.is_agentic', context.data?.route?.isAgenticRoute ?? false)
        break
      case SpanNames.AGENTS_APP_DOWNLOAD_FILES:
        span.setAttribute('agents.attachments.count', context.data?.attachmentsCount ?? 0)
        break
    }
  },
  onError (span, error) {
    span.addEvent('appRun.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    const [turnContext] = context.args
    const activityType = fallback(turnContext.activity?.type)
    const activityId = fallback(turnContext.activity?.id)
    const authorized = context.data?.authorized ?? false
    const routeMatched = context.data?.route?.matched ?? false
    span.setAttribute('agents.activity.type', activityType)
    span.setAttribute('agents.activity.id', activityId)
    span.setAttribute('agents.route.authorized', authorized)
    span.setAttribute('agents.route.matched', routeMatched)
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
  onError (span, error) {
    span.addEvent('replyToActivity.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    const [conversationId, activityId] = context.args
    span.setAttribute('agents.activity.conversation_id', fallback(conversationId))
    span.setAttribute('agents.activity.id', fallback(activityId))
    recordConnectorMetrics('replyToActivity', context)
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
  onError (span, error) {
    span.addEvent('sendToConversation.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    const [conversationId] = context.args
    span.setAttribute('agents.activity.conversation_id', fallback(conversationId))
    recordConnectorMetrics('sendToConversation', context)
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
  onError (span, error) {
    span.addEvent('updateActivity.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    const [conversationId, activityId] = context.args
    span.setAttribute('agents.activity.conversation_id', fallback(conversationId))
    span.setAttribute('agents.activity.id', fallback(activityId))
    recordConnectorMetrics('updateActivity', context)
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
  onError (span, error) {
    span.addEvent('deleteActivity.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    const [conversationId, activityId] = context.args
    span.setAttribute('agents.activity.conversation_id', fallback(conversationId))
    span.setAttribute('agents.activity.id', fallback(activityId))
    recordConnectorMetrics('deleteActivity', context)
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
  onError (span, error) {
    span.addEvent('createConversation.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    recordConnectorMetrics('createConversation', context)
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
  onError (span, error) {
    span.addEvent('getConversations.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    recordConnectorMetrics('getConversations', context)
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
  onError (span, error) {
    span.addEvent('getConversationMember.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    recordConnectorMetrics('getConversationMembers', context)
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
  onError (span, error) {
    span.addEvent('uploadAttachment.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    const [conversationId] = context.args
    span.setAttribute('agents.activity.conversation_id', fallback(conversationId))
    recordConnectorMetrics('uploadAttachment', context)
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
  onError (span, error) {
    span.addEvent('getAttachmentInfo.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    const [attachmentId] = context.args
    span.setAttribute('agents.attachment.id', fallback(attachmentId))
    recordConnectorMetrics('getAttachmentInfo', context)
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
  onError (span, error) {
    span.addEvent('getAttachment.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    const [attachmentId] = context.args
    span.setAttribute('agents.attachment.id', fallback(attachmentId))
    recordConnectorMetrics('getAttachment', context)
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
  onError (span, error) {
    span.addEvent('postActivity.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    const targetEndpoint = fallback(context.data?.targetEndpoint)
    const targetClientId = fallback(context.data?.targetClientId)
    const httpStatusCode = context.data?.response?.status ?? -1

    span.setAttribute('agents.target.endpoint', targetEndpoint)
    span.setAttribute('agents.target.client_id', targetClientId)
    span.setAttribute('http.status_code', httpStatusCode)

    HostingMetrics.agentClientRequestsCounter.add(1, {
      'agents.target.endpoint': targetEndpoint,
      'http.status_code': httpStatusCode
    })
    HostingMetrics.agentClientRequestDuration.record(context.duration(), {
      'agents.target.endpoint': targetEndpoint
    })
  }
})

/**
 * TurnContext method decorators
 */

interface TurnContextSendActivityDecoratorContext {
  args: Parameters<TurnContext['sendActivity']>
  result?: ReturnType<TurnContext['sendActivity']>
}

export const TurnContextSendActivity = createTracedDecorator<TurnContextSendActivityDecoratorContext>({
  spanName: SpanNames.TURN_SEND_ACTIVITY,
  onError (span, error) {
    span.addEvent('sendActivity.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    const [activityOrText] = context.args
    const activity = typeof activityOrText === 'string'
      ? Activity.fromObject({ type: 'message', text: activityOrText })
      : activityOrText

    span.setAttribute('activity.type', fallback(activity.type))
    span.setAttribute('activity.id', fallback(activity.id))
    span.setAttribute('activity.count', 1)
  }
})

interface TurnContextSendActivitiesDecoratorContext {
  args: Parameters<TurnContext['sendActivities']>
  result?: ReturnType<TurnContext['sendActivities']>
}

export const TurnContextSendActivities = createTracedDecorator<TurnContextSendActivitiesDecoratorContext>({
  spanName: SpanNames.TURN_SEND_ACTIVITIES,
  onError (span, error) {
    span.addEvent('sendActivities.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    const [activities] = context.args

    span.setAttribute('activity.count', activities.length ?? 0)

    for (const activity of activities) {
      span.setAttribute('activity.type', fallback(activity.type))
      span.setAttribute('activity.id', fallback(activity.id))
    }
  }
})

interface TurnContextUpdateActivityDecoratorContext {
  args: Parameters<TurnContext['updateActivity']>
  result?: ReturnType<TurnContext['updateActivity']>
}

export const TurnContextUpdateActivity = createTracedDecorator<TurnContextUpdateActivityDecoratorContext>({
  spanName: SpanNames.TURN_UPDATE_ACTIVITY,
  onError (span, error) {
    span.addEvent('updateActivity.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    const [activity] = context.args
    span.setAttribute('activity.id', fallback(activity?.id))
  }
})

interface TurnContextDeleteActivityDecoratorContext {
  args: Parameters<TurnContext['deleteActivity']>
  result?: ReturnType<TurnContext['deleteActivity']>
}

export const TurnContextDeleteActivity = createTracedDecorator<TurnContextDeleteActivityDecoratorContext>({
  spanName: SpanNames.TURN_DELETE_ACTIVITY,
  onError (span, error) {
    span.addEvent('deleteActivity.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    const [idOrReference] = context.args
    const activityId = typeof idOrReference === 'string'
      ? idOrReference
      : idOrReference.activityId

    span.setAttribute('activity.id', fallback(activityId))
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
  onError (span, error) {
    span.addEvent('storage.read.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    const [keys] = context.args
    span.setAttribute('storage.keys.count', keys?.length ?? 0)
    HostingMetrics.storageOperationDuration.record(context.duration(), {
      'agents.storage.operation': 'read'
    })
  }
})

export const StorageWrite = createTracedDecorator<StorageDecoratorContext>({
  spanName: SpanNames.STORAGE_WRITE,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onError (span, error) {
    span.addEvent('storage.write.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    const [changes] = context.args
    span.setAttribute('storage.keys.count', changes ? Object.keys(changes).length : 0)
    HostingMetrics.storageOperationDuration.record(context.duration(), {
      'agents.storage.operation': 'write'
    })
  }
})

export const StorageDelete = createTracedDecorator<StorageDecoratorContext>({
  spanName: SpanNames.STORAGE_DELETE,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onError (span, error) {
    span.addEvent('storage.delete.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    const [keys] = context.args
    span.setAttribute('storage.keys.count', keys?.length ?? 0)
    HostingMetrics.storageOperationDuration.record(context.duration(), {
      'agents.storage.operation': 'delete'
    })
  }
})
