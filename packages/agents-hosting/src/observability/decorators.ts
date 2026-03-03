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
    span.addEvent('process.started')
    context.durationMs = { startTime: performance.now() }
  },
  onSuccess (span) {
    span.addEvent('process.completed')
  },
  onError (span, error) {
    span.addEvent('process.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    const { args: [req], data, durationMs } = context
    console.log('tracedProcess onEnd - adding attributes', { method: req.method, activityId: context?.activity?.id })
    span.setAttribute('process.http.method', fallback(req.method))
    span.setAttribute('activity.id', fallback(data?.activity?.id))
    HostingMetrics.activitiesProcessedCounter.add(1, {
      'activity.type': fallback(data?.activity?.type),
      'channel.id': fallback(data?.activity?.channelId)
    })
    const processDuration = durationMs?.startTime ? performance.now() - durationMs.startTime : 0
    HostingMetrics.messageProcessingDuration.record(processDuration!, {
      'activity.type': fallback(data?.activity?.type)
    })
  }
})
