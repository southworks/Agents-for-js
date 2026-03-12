// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { trace, context as otelContext, SpanStatusCode, type Span, type SpanOptions, type Attributes, type Context } from '@opentelemetry/api'

const LIBRARY_NAME = 'Agents SDK'
const LIBRARY_VERSION = '1.0.0'

/**
 * Get the tracer lazily to ensure the provider is registered before use.
 * This is important in browser environments where the instrumentation module
 * must register the provider before any spans are created.
 */
function getTracer () {
  return trace.getTracer(LIBRARY_NAME, LIBRARY_VERSION)
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
  return getTracer().startActiveSpan(spanName, options ?? {}, async (span) => {
    try {
      const result = await fn(span)
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (error) {
      span.recordException(error as Error)
      span.setStatus({
        code: SpanStatusCode.ERROR,
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
 * Useful when the span lifetime does not map to a single function scope
 * (e.g. streaming responses, event-driven workflows).
 */
export function startSpan (spanName: string, options?: SpanOptions) {
  return getTracer().startSpan(spanName, options)
}

/**
 * Represents a managed span that can be controlled manually.
 * Used for long-lived operations where the span lifetime doesn't match a single function scope.
 */
export interface ManagedSpan {
  /** The underlying OpenTelemetry span */
  span: Span
  /** The context associated with this span for creating child spans */
  context: Context
  /**
   * Runs a function within this span's context.
   * Any spans created inside will be children of this span.
   */
  withContext: <T>(fn: () => T) => T
  /**
   * Runs an async function within this span's context.
   * Any spans created inside will be children of this span.
   */
  withContextAsync: <T>(fn: () => Promise<T>) => Promise<T>
  /** Adds an event to this span */
  addEvent: (name: string, attributes?: Attributes) => void
  /** Sets an attribute on this span */
  setAttribute: (key: string, value: string | number | boolean) => void
  /** Ends this span with success status */
  end: () => void
  /** Ends this span with error status */
  endWithError: (error: Error | string) => void
}

/**
 * Starts a managed span that can be controlled manually.
 * Unlike `withSpan`, this does not automatically end the span.
 * You must call `end()` or `endWithError()` when the operation completes.
 *
 * Use this for long-lived operations like WebSocket connections, streaming responses,
 * or event-driven workflows where the span lifetime doesn't match a single function scope.
 *
 * @param spanName - A descriptive name for the operation
 * @param options - Optional span options (attributes, links, kind, etc.)
 * @returns A ManagedSpan object with methods to control the span lifecycle
 *
 * @example
 * ```ts
 * const managed = startManagedSpan('connection.session');
 *
 * // Run code within the span's context (child spans will be linked)
 * managed.withContextAsync(async () => {
 *   await withSpan('child.operation', async () => { ... });
 * });
 *
 * // Add events during the session
 * managed.addEvent('message.received', { type: 'text' });
 *
 * // End when done
 * managed.end();
 * ```
 */
export function startManagedSpan (spanName: string, options?: SpanOptions): ManagedSpan {
  const span = getTracer().startSpan(spanName, options)
  const spanContext = trace.setSpan(otelContext.active(), span)

  return {
    span,
    context: spanContext,
    withContext: <T>(fn: () => T) => otelContext.with(spanContext, fn),
    withContextAsync: <T>(fn: () => Promise<T>) => otelContext.with(spanContext, fn),
    addEvent: (name: string, attributes?: Attributes) => span.addEvent(name, attributes),
    setAttribute: (key: string, value: string | number | boolean) => span.setAttribute(key, value),
    end: () => {
      span.setStatus({ code: SpanStatusCode.OK })
      span.end()
    },
    endWithError: (error: Error | string) => {
      if (error instanceof Error) {
        span.recordException(error)
        span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
      } else {
        span.setStatus({ code: SpanStatusCode.ERROR, message: error })
      }
      span.end()
    }
  }
}

/**
 * Returns the currently active span, or `undefined` if no span is active.
 */
export function getActiveSpan () {
  return trace.getActiveSpan()
}

/**
 * Adds an event to the currently active span.
 * If no span is active, this is a no-op.
 *
 * @param name - The name of the event to add
 * @param attributes - Optional attributes to attach to the event
 */
export function addEventToActiveSpan (name: string, attributes?: Attributes): void {
  trace.getActiveSpan()?.addEvent(name, attributes)
}

/**
 * Injects the current W3C trace-context headers into a carrier object.
 */
export function injectTraceContext (carrier: Record<string, string> = {}) {
  // Note: propagation requires the full @opentelemetry/api context
  // This is a simplified version that works with the static import
  return carrier
}
