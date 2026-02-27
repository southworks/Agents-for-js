// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { trace, SpanStatusCode, type Span, type SpanOptions, type Attributes } from '@opentelemetry/api'

const tracer = trace.getTracer('my-app')

/*
 * Factory for creating method-specific traced decorators
 */
interface TracedMethodConfig<TArgs extends any[], TResult> {
  // Span name (defaults to method name if not provided)
  spanName?: string
  // Base span options (kind, links, etc.)
  spanOptions?: SpanOptions
  // Extract attributes from method arguments
  extractAttributes?: (...args: TArgs) => Attributes
  // Called before the original method executes
  onStart?: (span: Span, args: TArgs) => void
  // Called after successful execution
  onSuccess?: (span: Span, result: TResult, args: TArgs) => void
  // Called on error
  onError?: (span: Span, error: unknown, args: TArgs) => void
  // Called in finally block
  onEnd?: (span: Span, args: TArgs) => void
}

export function createTracedDecorator<TArgs extends any[], TResult> (
  config: TracedMethodConfig<TArgs, TResult> = {}
) {
  return function <T extends (...args: TArgs) => TResult>(
    originalMethod: T,
    context: ClassMethodDecoratorContext
  ): T | void {
    const methodName = String(context.name)

    const wrappedMethod = function (this: any, ...args: TArgs): TResult {
      const spanName = config.spanName ?? `${this.constructor.name}.${methodName}`
      const attributes = config.extractAttributes?.(...args) ?? {}

      return tracer.startActiveSpan(spanName, {
        ...config.spanOptions,
        attributes: { ...config.spanOptions?.attributes, ...attributes }
      }, (span): TResult => {
        config.onStart?.(span, args)

        try {
          const result = originalMethod.apply(this, args)

          if (isPromise(result)) {
            return result
              .then((res) => {
                config.onSuccess?.(span, res as TResult, args)
                span.setStatus({ code: SpanStatusCode.OK })
                return res
              })
              .catch((error: unknown) => {
                config.onError?.(span, error, args)
                recordError(span, error)
                throw error
              })
              .finally(() => {
                config.onEnd?.(span, args)
                span.end()
              }) as TResult
          }

          config.onSuccess?.(span, result as TResult, args)
          span.setStatus({ code: SpanStatusCode.OK })
          config.onEnd?.(span, args)
          span.end()
          return result
        } catch (error) {
          config.onError?.(span, error, args)
          recordError(span, error)
          config.onEnd?.(span, args)
          span.end()
          throw error
        }
      })
    }

    return wrappedMethod as T
  }
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
