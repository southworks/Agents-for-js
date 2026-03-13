// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Span, SpanOptions, OTelAPI } from './types'

/*
 * Factory for creating method-specific traced decorators
 */
interface TracedMethodConfig<TArgs extends DecoratorContextShape> {
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
  // Optional callback to create child spans within the method execution
  onChildSpan?: (spanName: string, span: Span, context: TArgs) => void
}

type DecoratorContextShape = {
  args: unknown[]
  data?: unknown
  result?: unknown
}

type InternalContextShape<T extends DecoratorContextShape> = T & {
  onChildSpan?: (spanName: string, span: Span, context: T) => void
}

let otel: OTelAPI

export function createTracedDecorator<TContext extends DecoratorContextShape> (config: TracedMethodConfig<TContext> = {}) {
  const tracer = otel.trace.getTracer(`tracer[${config.spanName ?? 'agents.telemetry'}]`, '1.0.0')
  const invocationStacks = new WeakMap<object, Array<InternalContextShape<TContext>>>()

  const sharedContext = {
    args: [] as unknown[] as TContext['args'],
    data: undefined,
    result: undefined,
    onChildSpan: config.onChildSpan
  } as InternalContextShape<TContext>

  const decorator = function <T extends (...args: TContext['args']) => TContext['result']>(
    originalMethod: T,
    context: ClassMethodDecoratorContext
  ): T | void {
    const methodName = String(context.name)

    const wrappedMethod = function (this: any, ...args: TContext['args']): TContext['result'] {
      const spanName = config.spanName ?? `${this.constructor.name}.${methodName}`
      const thisArgObject = (typeof this === 'object' && this !== null) || typeof this === 'function'
        ? this as object
        : undefined

      const invocationContext = {
        args,
        data: undefined,
        result: undefined,
        onChildSpan: config.onChildSpan
      } as InternalContextShape<TContext>

      if (thisArgObject) {
        const stack = invocationStacks.get(thisArgObject) ?? []
        stack.push(invocationContext)
        invocationStacks.set(thisArgObject, stack)
      }

      const span = tracer.startSpan(spanName, config.spanOptions ?? {})
      const activeContext = otel.context.active()
      const spanContext = activeContext ? otel.trace.setSpan(activeContext, span) : undefined
      const runInSpanContext = <TResult>(fn: () => TResult): TResult => {
        return spanContext ? (otel.context.with(spanContext, fn) ?? fn()) : fn()
      }

      const cleanupInvocationContext = () => {
        if (!thisArgObject) {
          return
        }

        const stack = invocationStacks.get(thisArgObject)
        if (!stack) {
          return
        }

        stack.pop()
        if (stack.length === 0) {
          invocationStacks.delete(thisArgObject)
        }
      }

      return runInSpanContext(() => {
        config.onStart?.(span, invocationContext)

        const result = originalMethod.apply(this, args)

        try {
          if (isPromise(result)) {
            return result
              .then((res) => runInSpanContext(() => {
                invocationContext.result = res
                config.onSuccess?.(span, invocationContext)
                span.setStatus({ code: otel.SpanStatusCode.OK ?? 1 })
                return res
              }))
              .catch((error: unknown) => runInSpanContext(() => {
                config.onError?.(span, error, invocationContext)
                recordError(span, error)
                throw error
              }))
              .finally(() => runInSpanContext(() => {
                config.onEnd?.(span, invocationContext)
                span.end()
                cleanupInvocationContext()
              }))
          }

          invocationContext.result = result
          config.onSuccess?.(span, invocationContext)
          span.setStatus({ code: otel.SpanStatusCode.OK ?? 1 })
          config.onEnd?.(span, invocationContext)
          span.end()
          cleanupInvocationContext()
          return result
        } catch (error) {
          config.onError?.(span, error, invocationContext)
          recordError(span, error)
          config.onEnd?.(span, invocationContext)
          span.end()
          cleanupInvocationContext()
          throw error
        }
      })
    }

    return wrappedMethod as T
  }

  decorator.share = function (this: unknown, data: TContext['data']) {
    const thisArgObject = (typeof this === 'object' && this !== null) || typeof this === 'function'
      ? this as object
      : undefined
    const activeInvocationContext = thisArgObject ? invocationStacks.get(thisArgObject)?.at(-1) : undefined
    const targetContext = activeInvocationContext ?? sharedContext

    if (isPlainObject(targetContext.data) && isPlainObject(data)) {
      targetContext.data = { ...targetContext.data, ...data }
    } else {
      targetContext.data = data
    }
  }

  /**
   * Creates a child span within the current active span context.
   * If the parent decorator has an `onChildSpan` callback configured, it will be called
   * with the span name, span, and shared context.
   */
  decorator.withChildSpan = async function <T> (
    this: unknown,
    spanName: string,
    fn: (span: Span | undefined) => Promise<T>,
    options?: SpanOptions
  ): Promise<T | undefined> {
    const span = tracer?.startSpan(spanName, options ?? {})
    if (!span) {
      return fn(undefined)
    }

    const activeContext = otel.context.active()
    const spanContext = activeContext ? otel.trace.setSpan(activeContext, span) : undefined
    const runInSpanContext = <TResult>(callback: () => TResult): TResult => {
      return spanContext ? (otel.context.with(spanContext, callback) ?? callback()) : callback()
    }

    const thisArgObject = (typeof this === 'object' && this !== null) || typeof this === 'function'
      ? this as object
      : undefined
    const activeInvocationContext = thisArgObject ? invocationStacks.get(thisArgObject)?.at(-1) : undefined
    const targetContext = activeInvocationContext ?? sharedContext

    return runInSpanContext(async () => {
      try {
        // Call the onChildSpan callback if defined in the parent decorator
        targetContext?.onChildSpan?.(spanName, span, targetContext)

        const result = await fn(span)
        span.setStatus({ code: otel.SpanStatusCode.OK ?? 1 })
        return result
      } catch (error) {
        recordError(span, error)
        throw error
      } finally {
        span.end()
      }
    })
  }

  return decorator
}

function recordError (span: Span, error: unknown): void {
  if (error instanceof Error) {
    span.recordException(error)
    span.setStatus({ code: otel!.SpanStatusCode.ERROR, message: error.message })
  } else {
    span.setStatus({ code: otel!.SpanStatusCode.ERROR, message: String(error) })
  }
}

function isPromise<T> (value: T | Promise<T>): value is Promise<T> {
  return typeof value === 'object' && value !== null && 'then' in value
}

function isPlainObject (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && value.constructor === Object
}

export function TraceDecoratorFactory (_otel: OTelAPI) {
  otel = _otel
  return createTracedDecorator
}
