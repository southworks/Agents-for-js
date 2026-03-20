// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Span, SpanOptions, OTel } from './types'
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
