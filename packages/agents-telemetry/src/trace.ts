// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Span, SpanOptions, OTel, SpanStatusCode } from './types'
import pkg from '../package.json'
import { createDecorator, DecoratorContext, TMethodShape, TScopeShape } from './utils/decorator'
import { attempt } from './utils/attempt'

/*
 * Factory for creating method-specific traced decorators
 */
export interface TracedMethodConfig<TDecoratorContext> {
  // Span name (defaults to method name if not provided)
  spanName?: string
  // Base span options (kind, links, etc.)
  spanOptions?: SpanOptions
  // Called before the original method executes
  onStart?: (span: Span, decorator: TDecoratorContext, context: any) => void
  // Called after successful execution
  onSuccess?: (span: Span, decorator: TDecoratorContext, context: any) => void
  // Called on error
  onError?: (span: Span, error: unknown, decorator: TDecoratorContext, context: any) => void
  // Called in finally block
  onEnd?: (span: Span, decorator: TDecoratorContext, context: any) => void
}

export function traceFactory2 (otel: OTel) {
  return function trace<TReturn> (name: string, fn: (span: Span) => TReturn): TReturn {
    const tracer = otel.trace.getTracer(pkg.name, pkg.version)
    return tracer.startActiveSpan(name, (span) => {
      return attempt({
        try () {
          return fn(span)
        },
        then () {
          span.setStatus({ code: otel.SpanStatusCode.OK ?? 1 })
        },
        catch (error) {
          let type
          let message

          if (error instanceof Error) {
            type = error.name
            message = error.message
            span.recordException(error)
          } else {
            type = typeof error
            message = String(error)
          }

          span.setStatus({ code: otel.SpanStatusCode.ERROR, message })
          span.addEvent(`${name}_failed`, {
            'error.type': type,
            'error.message': message
          })
          throw error
        },
        finally () {
          span.end()
        }
      })
    })
  }
}

export function traceFactory (otel: OTel) {
  return function trace<TMethod extends TMethodShape, TScope extends TScopeShape = {}> (config: TracedMethodConfig<DecoratorContext<TMethod, TScope>> = {}) {
    const tracer = otel.trace.getTracer(pkg.name, pkg.version)
    return createDecorator<TMethod, TScope>((decorator) => {
      const result = tracer.startActiveSpan(config.spanName!, config.spanOptions ?? {}, (span) => {
        const sharedContext = {}
        config.onStart?.(span, decorator, sharedContext)
        return attempt({
          try () {
            return decorator.call()
          },
          then () {
            config.onSuccess?.(span, decorator, sharedContext)
            span.setStatus({ code: otel.SpanStatusCode.OK ?? 1 })
          },
          catch (error) {
            let type
            let message

            if (error instanceof Error) {
              type = error.name
              message = error.message
              span.recordException(error)
            } else {
              type = typeof error
              message = String(error)
            }

            config.onError?.(span, error, decorator, sharedContext)
            span.setStatus({ code: otel.SpanStatusCode.ERROR, message })
            span.addEvent(`${config.spanName}_failed`, {
              'error.type': type,
              'error.message': message
            })
            throw error
          },
          finally () {
            config.onEnd?.(span, decorator, sharedContext)
            span.end()
          }
        })
      })

      return result
    })
  }
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
  endWithError: (error: Error | string) => void
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
 *     managed.endWithError(error instanceof Error ? error : String(error));
 *     throw error;
 *   }
 * }
 * ```
 */
export function startManagedSpan (otel: OTel) {
  return function managedSpan (name: string, options?: ManagedSpanOptions): ManagedSpanResult {
    const tracer = otel.trace.getTracer(pkg.name, pkg.version)
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
        span.setStatus({ code: otel.SpanStatusCode.OK ?? 1 })
        options?.onEnd?.(span)
        span.end()
      },
      endWithError (error: Error | string) {
        if (ended) return
        ended = true
        if (error instanceof Error) {
          span.recordException(error)
          span.setStatus({ code: otel.SpanStatusCode.ERROR, message: error.message })
        } else {
          span.setStatus({ code: otel.SpanStatusCode.ERROR, message: error })
        }
        options?.onEnd?.(span)
        span.end()
      },
      addEvent (name: string, attributes?: Record<string, string | number | boolean>) {
        span.addEvent(name, attributes)
      }
    }
  }
}
