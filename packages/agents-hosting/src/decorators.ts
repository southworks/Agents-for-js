// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { createTracedDecorator, SpanNames } from '@microsoft/agents-telemetry'
import { TurnContext } from './turnContext'
import { CloudAdapter } from './cloudAdapter'

const fallback = <T>(value: T | undefined | null) => value ?? 'unknown'

interface ProcessDecoratorSignature {
  args: Parameters<CloudAdapter['process']>
  data?: TurnContext
  result?: ReturnType<CloudAdapter['process']>
}

export const CloudAdapterProcess = createTracedDecorator<ProcessDecoratorSignature>({
  spanName: SpanNames.ADAPTER_PROCESS,
  // spanOptions: { kind: SpanKind.SERVER },
  onStart (span) {
    span.addEvent('process.started')
  },
  onSuccess (span) {
    span.addEvent('process.completed')
  },
  onError (span, error) {
    span.addEvent('process.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, { args: [req], data: context }) {
    console.log('tracedProcess onEnd - adding attributes', { method: req.method, activityId: context?.activity?.id })
    span.setAttribute('process.http.method', fallback(req.method))
    span.setAttribute('activity.id', fallback(context?.activity?.id))
  }
})
