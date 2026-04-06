/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import type { Span, OTel, SpanName } from '../types.js'
import { attempt } from '../utils/attempt.js'
import { isSpanDisabled } from './category.js'
import { SpanNames } from './constants.js'

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

/**
 * Options for creating a managed span.
 */
export interface ManagedSpanOptions {
  /** Initial attributes to set on the span. */
  attributes?: Record<string, string | number | boolean>
  /** Callback invoked when the span ends (on both success and error), before `span.end()`. Use this to record metrics. */
  onEnd?: (span: Span) => void
}

/**
 * A manually controlled span for long-lived operations.
 */
export interface ManagedSpanResult {
  /** The underlying OpenTelemetry span. */
  span: Span
  /** Set additional attributes on the span after creation. */
  setAttributes: (attrs: Record<string, string | number | boolean>) => void
  /** End the span with OK status. Safe to call multiple times (subsequent calls are no-ops). */
  end: () => void
  /** End the span with ERROR status. Safe to call multiple times (subsequent calls are no-ops). */
  endWithError: (error: unknown) => void
  /** Add an event to the span. Can be called multiple times. */
  addEvent: (name: string, attributes?: Record<string, string | number | boolean>) => void
}

/**
 * Starts a managed span that can be controlled manually.
 * Unlike `trace`, this does not automatically end the span.
 * You must call `end()` or `endWithError()` when the operation completes.
 *
 * Use this for long-lived operations like WebSocket connections, streaming responses,
 * or async generators where `yield` cannot appear inside a callback.
 *
 * @example
 * ```ts
 * async function* streamData(): AsyncGenerator<Item> {
 *   const managed = managedSpan('stream.session', {
 *     attributes: { 'stream.url': url },
 *     onEnd: () => {
 *       durationHistogram.record(performance.now() - start)
 *     }
 *   });
 *   try {
 *     yield* innerStream();
 *     managed.end();
 *   } catch (error) {
 *     managed.endWithError(error);
 *     throw error;
 *   }
 * }
 * ```
 */
export function startManagedSpan (otel: OTel) {
  const validSpanNames = new Set(Object.values(SpanNames))
  return function managedSpan (name: SpanName, options?: ManagedSpanOptions): ManagedSpanResult {
    if (!validSpanNames.has(name)) {
      throw new Error(`Unrecognized span name "${name}". See SpanNames constants.`)
    }

    if (isSpanDisabled(name)) {
      const noopSpan = otel.trace.wrapSpanContext(otel.INVALID_SPAN_CONTEXT)
      return {
        span: noopSpan,
        setAttributes: () => {},
        end: () => {},
        endWithError: () => {},
        addEvent: () => {}
      }
    }

    const tracer = otel.trace.getTracer(packageName)
    const span = tracer.startSpan(name, options?.attributes ? { attributes: options.attributes } : undefined)
    let ended = false

    return {
      span,
      setAttributes (attrs: Record<string, string | number | boolean>) {
        for (const [key, value] of Object.entries(attrs)) {
          span.setAttribute(key, value)
        }
      },
      end () {
        if (ended) return
        ended = true
        span.setStatus({ code: otel.SpanStatusCode.OK })
        try {
          options?.onEnd?.(span)
        } finally {
          span.end()
        }
      },
      endWithError (error) {
        if (ended) return
        ended = true
        let message
        if (error instanceof Error) {
          message = error.message
          span.recordException(error)
        } else {
          message = String(error)
          span.recordException({ name: String(typeof error), message })
        }
        span.setStatus({ code: otel.SpanStatusCode.ERROR, message })

        try {
          options?.onEnd?.(span)
        } finally {
          span.end()
        }
      },
      addEvent (name: string, attributes?: Record<string, string | number | boolean>) {
        span.addEvent(name, attributes)
      }
    }
  }
}
