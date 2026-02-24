// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import type { Span, SpanOptions } from '@opentelemetry/api'
import { noopSpan } from './noop'
import { getOtel } from './otel'

export interface RecordSpanOptions {
  name: string
  attributes?: Record<string, string | number | boolean>
  options?: SpanOptions
  fn: (span: Span) => Promise<unknown> | unknown
}

/*
 * A utility function to create and manage OpenTelemetry spans.
 * It attempts to get the OpenTelemetry tracer and, if available, starts a new span with the provided name and attributes.
 * If OpenTelemetry is not initialized, it uses a no-operation span to allow the function to execute without errors.
 * The function executes the provided callback with the span, and ensures that any exceptions are recorded on the span before rethrowing.
 * Finally, it ends the span after the callback execution is complete.
 */
export async function recordSpan<T> ({ name, attributes, options, fn }: RecordSpanOptions & { fn: (span: Span) => Promise<T> | T }): Promise<T> {
  const otel = getOtel()
  if (otel === null) {
    return fn(noopSpan) as T
  }

  const { SpanStatusCode, tracer } = await otel

  return tracer.startActiveSpan(name, { attributes, ...options }, async (span) => {
    try {
      return await fn(span)
    } catch (error) {
      if (error instanceof Error) {
        span.recordException({
          name: error.name,
          message: error.message,
          stack: error.stack,
        })
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        })
      } else {
        span.setStatus({ code: SpanStatusCode.ERROR })
      }
      throw error
    } finally {
      span.end()
    }
  }) as T
}
