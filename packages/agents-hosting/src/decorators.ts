// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { createTracedDecorator, SpanKind, SpanNames } from '@microsoft/agents-telemetry'
import { TurnContext } from './turnContext'
import { Request } from './auth/request'
import { Response } from 'express'
import { HeaderPropagationDefinition } from './headerPropagation'

// Decorator for `process` method
export const tracedProcess = createTracedDecorator<
  [req: Request, res: Response, logic: (context: TurnContext) => Promise<void>, headerPropagation?: HeaderPropagationDefinition],
    void
    >({
      spanName: SpanNames.ADAPTER_PROCESS,
      spanOptions: { kind: SpanKind.SERVER },
      extractAttributes: (req) => ({
        'process.http.method': req.method ?? 'unknown',
      }),
      onStart: (span) => {
        span.addEvent('process.started')
      },
      onSuccess: (span, result) => {
        span.addEvent('process.completed')
      },
      onError: (span, error) => {
        span.addEvent('process.failed', {
          'error.type': error?.constructor?.name ?? 'Unknown'
        })
      }
    })
