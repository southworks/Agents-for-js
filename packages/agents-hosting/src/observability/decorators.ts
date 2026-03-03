// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { createTracedDecorator, SpanNames } from '@microsoft/agents-telemetry'
import { TurnContext } from '../turnContext'
import { CloudAdapter } from '../cloudAdapter'
import { HostingMetrics } from './metrics'

const fallback = <T>(value: T | undefined | null) => value ?? 'unknown'

interface ProcessDecoratorSignature {
  args: Parameters<CloudAdapter['process']>
  data?: TurnContext
  result?: ReturnType<CloudAdapter['process']>
  durationMs?: { startTime: number }
}

export const CloudAdapterProcess = createTracedDecorator<ProcessDecoratorSignature>({
  spanName: SpanNames.ADAPTER_PROCESS,
  // spanOptions: { kind: SpanKind.SERVER },
  onStart (span, context) {
    // span.addEvent('process.started')
    context.durationMs = { startTime: performance.now() }
  },
  onSuccess (span) {
    // span.addEvent('process.completed')
  },
  onError (span, error) {
    span.addEvent('process.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    const { data, durationMs } = context
    span.setAttribute('activity.type', fallback(data?.activity?.type))
    span.setAttribute('activity.channelId', fallback(data?.activity?.channelId))
    span.setAttribute('activity.deliveryMode', fallback(data?.activity?.deliveryMode))
    span.setAttribute('activity.conversationId', fallback(data?.activity?.conversation?.id))
    span.setAttribute('activity.isAgentic', fallback(data?.activity?.isAgenticRequest()))
    HostingMetrics.activitiesProcessedCounter.add(1, {
      'activity.type': fallback(data?.activity?.type),
      'activity.channelId': fallback(data?.activity?.channelId)
    })
    const processDuration = durationMs?.startTime ? performance.now() - durationMs.startTime : 0
    HostingMetrics.messageProcessingDuration.record(processDuration!, {
      'activity.type': fallback(data?.activity?.type)
    })
  }
})
