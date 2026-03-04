// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { createTracedDecorator, SpanNames } from '@microsoft/agents-telemetry'
import { TurnContext } from '../turnContext'
import { CloudAdapter } from '../cloudAdapter'
import { HostingMetrics } from './metrics'

const fallback = <T>(value: T | undefined | null) => value ?? 'unknown'

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
  spanName: 'agents.adapter.continueConversation',
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
  spanName: 'agents.adapter.createConnectorClient',
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
  spanName: 'agents.adapter.createConnectorClient',
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
