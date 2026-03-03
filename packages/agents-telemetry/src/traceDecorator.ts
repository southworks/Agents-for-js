// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { trace, SpanStatusCode, type Span, type SpanOptions, context as otelContext, createContextKey } from '@opentelemetry/api'
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks'

// TODO: test if this can be overriden from sample
otelContext.setGlobalContextManager(new AsyncLocalStorageContextManager().enable())

const tracer = trace.getTracer('my-app')

/*
 * Factory for creating method-specific traced decorators
 */
interface TracedMethodConfig<TArgs extends DecoratorShape> {
  // Span name (defaults to method name if not provided)
  spanName?: string
  // Base span options (kind, links, etc.)
  spanOptions?: SpanOptions
  // Extract attributes from method arguments
  // extractAttributes?: (...args: TArgs) => Attributes
  // onShare?: (span: Span, data: Record<string, unknown>) => void
  // Called before the original method executes
  onStart?: (span: Span, context: TArgs) => void
  // Called after successful execution
  onSuccess?: (span: Span, context: TArgs) => void
  // Called on error
  onError?: (span: Span, error: unknown, context: TArgs) => void
  // Called in finally block
  onEnd?: (span: Span, context: TArgs) => void
}

const CONTEXT_KEY = createContextKey('agents-telemetry:createTracedDecorator-context')

// export interface DecoratorData {
//   args: []
//   data: Record<string, unknown>
//   result?: unknown
// }

type DecoratorShape = {
  args: unknown[]
  data?: unknown
  result?: unknown
}

type TracedDecorator<TArgs extends DecoratorShape> = {
  <T extends (...args: TArgs['args']) => TArgs['result']>(
    originalMethod: T,
    context: ClassMethodDecoratorContext
  ): T | void
  share: (data: TArgs['data']) => void
}

export function createTracedDecorator<TArgs extends DecoratorShape> (config: TracedMethodConfig<TArgs> = {}) {
  const decorator = function <T extends (...args: TArgs['args']) => TArgs['result']>(
    originalMethod: T,
    context: ClassMethodDecoratorContext
  ): T | void {
    const methodName = String(context.name)

    const wrappedMethod = function (this: any, ...args: TArgs['args']): TArgs['result'] {
      const spanName = config.spanName ?? `${this.constructor.name}.${methodName}`
      // const attributes = config.extractAttributes?.(...args) ?? {}

      // TODO: see if we can use tracer.startSpan(name) and context.with() instead of startActiveSpan, to have more control over the context and span lifecycle.
      return tracer.startActiveSpan(spanName, {
        ...config.spanOptions,
        // attributes: { ...config.spanOptions?.attributes, ...attributes }
      }, (span) => {
        const sharedContext = { args, data: undefined, result: undefined } as TArgs
        const ctx = otelContext.active().setValue(CONTEXT_KEY, sharedContext)

        config.onStart?.(span, sharedContext)

        const result = otelContext.with(ctx, () => originalMethod.apply(this, args))

        try {
          if (isPromise(result)) {
            return result
              .then((res) => {
                sharedContext.result = res
                config.onSuccess?.(span, sharedContext)
                span.setStatus({ code: SpanStatusCode.OK })
                return res
              })
              .catch((error: unknown) => {
                config.onError?.(span, error, sharedContext)
                recordError(span, error)
                throw error
              })
              .finally(() => {
                config.onEnd?.(span, sharedContext)
                span.end()
              })
          }

          sharedContext.result = result
          config.onSuccess?.(span, sharedContext)
          span.setStatus({ code: SpanStatusCode.OK })
          config.onEnd?.(span, sharedContext)
          span.end()
          return result
        } catch (error) {
          config.onError?.(span, error, sharedContext)
          recordError(span, error)
          config.onEnd?.(span, sharedContext)
          span.end()
          throw error
        }
      })
    }

    return wrappedMethod as T
  } as TracedDecorator<TArgs>

  decorator.share = (data: TArgs['data']) => {
    const sharedState = otelContext.active().getValue(CONTEXT_KEY) as DecoratorShape
    sharedState.data = data
  }

  return decorator
}

export function share<T> (data: T): void {
  const sharedState = otelContext.active().getValue(CONTEXT_KEY) as DecoratorShape
  sharedState.data = data
}

function recordError (span: Span, error: unknown): void {
  if (error instanceof Error) {
    span.recordException(error)
    span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
  } else {
    span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) })
  }
}

function isPromise<T> (value: T | Promise<T>): value is Promise<T> {
  return typeof value === 'object' && value !== null && 'then' in value
}
