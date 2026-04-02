/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import type { Span, OTel, SpanName } from '../types.js'
import { attempt } from '../utils/attempt.js'
import { isSpanDisabled } from './category.js'

const packageName = '@microsoft/agents-telemetry'

/**
 * Creates a span tracer that wraps the provided function with OpenTelemetry span creation and error handling.
 */
export function createSpanTracer<TReturn> (otel: OTel, name: SpanName, fn: (span: Span) => TReturn): TReturn {
  if (isSpanDisabled(name)) {
    const noopSpan = otel.trace.wrapSpanContext(otel.INVALID_SPAN_CONTEXT)
    return fn(noopSpan)
  }

  const tracer = otel.trace.getTracer(packageName)
  return tracer.startActiveSpan(name, (span) => {
    return attempt({
      try () {
        return fn(span)
      },
      then () {
        span.setStatus({ code: otel.SpanStatusCode.OK })
      },
      catch (error) {
        let message

        if (error instanceof Error) {
          message = error.message
          span.recordException(error)
        } else {
          message = String(error)
          span.recordException({ name: String(typeof error), message })
        }

        span.setStatus({ code: otel.SpanStatusCode.ERROR, message })
        throw error
      },
      finally () {
        span.end()
      }
    })
  })
}
