// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import type { Span, SpanOptions } from '@opentelemetry/api'
import { loadOtelApi } from './initOtel'

const LIBRARY_NAME = 'Agents SDK'
const LIBRARY_VERSION = '1.0.0'

let otelApi: typeof import('@opentelemetry/api') | undefined

/**
 * Returns a tracer scoped to this library, or `undefined` if the
 * OpenTelemetry API is not available.
 *
 * - If the user's application has registered an OTel SDK, this returns
 *   a fully functional tracer whose spans flow into the configured exporter.
 * - If no SDK is registered, the returned tracer is a no-op: every method
 *   is safe to call but produces zero overhead.
 * - If the OTel API cannot be loaded at all, this returns `undefined` and
 *   all telemetry functions become no-ops.
 */
async function getTracer () {
  otelApi = await loadOtelApi()
  if (!otelApi) console.log(`[${LIBRARY_NAME}] OpenTelemetry API not available, returning undefined tracer`)
  return otelApi?.trace.getTracer(LIBRARY_NAME, LIBRARY_VERSION)
}

/**
 * Wraps a synchronous or asynchronous operation in an OpenTelemetry span.
 *
 * - If `@opentelemetry/api` is installed and an SDK is registered,
 *   the span is recorded and exported normally.
 * - If `@opentelemetry/api` is installed but no SDK is registered,
 *   the span is a no-op (zero overhead).
 * - If `@opentelemetry/api` is **not** installed, the function is
 *   executed directly with no wrapping.
 *
 * @param spanName  - A descriptive name for the operation (e.g. "db.query", "http.request").
 * @param fn        - The function to execute within the span context.
 * @param options   - Optional span options (attributes, links, kind, etc.).
 *
 * @example
 * ```ts
 * const result = await withSpan('myLib.fetchUser', async () => {
 *   return await userService.getById(id);
 * });
 * ```
 */
export async function withSpan<T> (spanName: string, fn: (span: Span | undefined) => Promise<T>, options?: SpanOptions) {
  const tracer = await getTracer()

  if (!tracer) {
    return fn(undefined)
  }

  const api = otelApi!
  return tracer.startActiveSpan(spanName, options ?? {}, async (span) => {
    try {
      const result = await fn(span)
      span.setStatus({ code: api.SpanStatusCode.OK })
      return result
    } catch (error) {
      span.recordException(error as Error)
      span.setStatus({
        code: api.SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      })
      throw error
    } finally {
      span.end()
    }
  })
}

/**
 * Starts a span without automatically ending it.
 * Returns `undefined` if `@opentelemetry/api` is not available.
 * Useful when the span lifetime does not map to a single function scope
 * (e.g. streaming responses, event-driven workflows).
 */
export async function startSpan (spanName: string, options?: SpanOptions) {
  const tracer = await getTracer()
  return tracer?.startSpan(spanName, options)
}

/**
 * Returns the currently active span, or `undefined` if the
 * OpenTelemetry API is not available or no span is active.
 */
export async function getActiveSpan () {
  const api = await loadOtelApi()
  return api?.trace.getActiveSpan()
}

/**
 * Injects the current W3C trace-context headers into a carrier object.
 * Returns the carrier unchanged if `@opentelemetry/api` is not available.
 */
export async function injectTraceContext (carrier: Record<string, string> = {}) {
  const api = await loadOtelApi()
  if (api) {
    api.propagation.inject(api.context.active(), carrier)
  }
  return carrier
}
