// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { createTracedDecorator, SpanNames } from '@microsoft/agents-telemetry'
import { AxiosResponse } from 'axios'
import { TurnContext } from '../turnContext'
import { CloudAdapter } from '../cloudAdapter'
import { ConnectorClient } from '../connector-client/connectorClient'
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
  onError (span, error) {
    span.addEvent('process.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    const { data, duration } = context
    const type = fallback(data?.activity?.type)
    const channelId = fallback(data?.activity?.channelId)

    span.setAttribute('activity.type', type)
    span.setAttribute('activity.channelId', channelId)
    span.setAttribute('activity.deliveryMode', fallback(data?.activity?.deliveryMode))
    span.setAttribute('activity.conversation.id', fallback(data?.activity?.conversation?.id))
    span.setAttribute('activity.isAgenticRequest', data?.activity?.isAgenticRequest() ?? false)

    HostingMetrics.activitiesReceivedCounter.add(1, {
      'activity.type': type,
      'activity.channelId': channelId
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
  onError (span, error) {
    span.addEvent('sendActivities.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    const [, _activities] = context.args
    const activities = _activities ?? []

    span.setAttribute('activity.count', activities?.length ?? 0)
    span.setAttribute('conversation.id', fallback(activities[0]?.conversation?.id))

    for (const activity of activities) {
      HostingMetrics.activitiesSentCounter.add(1, {
        'activity.type': fallback(activity?.type),
        'channel.id': fallback(activity?.channelId)
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

    span.setAttribute('activity.id', fallback(activity?.id))
    span.setAttribute('conversation.id', fallback(activity?.conversation?.id))

    HostingMetrics.activitiesUpdatedCounter.add(1, {
      'channel.id': fallback(activity?.channelId),
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

    span.setAttribute('activity.id', fallback(reference?.activityId))
    span.setAttribute('conversation.id', fallback(reference?.conversation?.id))

    HostingMetrics.activitiesDeletedCounter.add(1, {
      'channel.id': fallback(reference?.channelId)
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

    span.setAttribute('botAppId', botAppId)
    span.setAttribute('conversation.id', conversationId)
    span.setAttribute('isAgenticRequest', isAgenticRequest)
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

    span.setAttribute('serviceUrl', serviceUrl)
    span.setAttribute('scope', scope)
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

    span.setAttribute('serviceUrl', serviceUrl)
    span.setAttribute('scope', scope)
    span.setAttribute('isAgenticRequest', isAgenticRequest)
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

  HostingMetrics.connectorRequestDuration.record(context.duration(), { operation })
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
    span.setAttribute('conversation.id', fallback(conversationId))
    span.setAttribute('activity.id', fallback(activityId))
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
    span.setAttribute('conversation.id', fallback(conversationId))
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
    span.setAttribute('conversation.id', fallback(conversationId))
    span.setAttribute('activity.id', fallback(activityId))
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
    span.setAttribute('conversation.id', fallback(conversationId))
    span.setAttribute('activity.id', fallback(activityId))
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
    span.setAttribute('conversation.id', fallback(conversationId))
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
    span.setAttribute('attachment.id', fallback(attachmentId))
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
    span.setAttribute('attachment.id', fallback(attachmentId))
    recordConnectorMetrics('getAttachment', context)
  }
})
