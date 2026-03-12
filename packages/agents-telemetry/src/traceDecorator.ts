// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { trace, SpanStatusCode, type Span, type SpanOptions, type Attributes, context as otelContext, createContextKey } from '@opentelemetry/api'

// Initialize context manager asynchronously (no top-level await for CJS compatibility)
setupContextManager().catch(() => { /* silently ignore */ })

/**
 * Get the tracer lazily to ensure the provider is registered before use.
 * This is important in browser environments where the instrumentation module
 * must register the provider before any spans are created.
 */
function getTracer () {
  return trace.getTracer('my-app')
}

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
  // Called when addEvent is invoked from within the decorated method
  onEvent?: (span: Span, eventName: string, eventData: unknown, context: TArgs) => void
}

const CONTEXT_KEY = createContextKey('agents-telemetry:createTracedDecorator-context')

type DecoratorContextShape = {
  args: unknown[]
  data?: unknown
  result?: unknown
}

type InternalContextShape<T extends DecoratorContextShape> = T & {
  onChildSpan?: (spanName: string, span: Span, context: T) => void
  onEvent?: (span: Span, eventName: string, eventData: unknown, context: T) => void
}

/**
 * Sets up the OpenTelemetry context manager appropriate for the current runtime environment.
 *
 * - **Node.js**: Uses `AsyncLocalStorageContextManager` from `@opentelemetry/context-async-hooks`
 * - **Browser**: Uses the default `StackContextManager` (no additional setup needed)
 *
 * This function is opt-in and should be called once at application startup if you want
 * the library to handle context manager configuration. Alternatively, applications can
 * configure their own context manager directly.
 *
 * @returns Promise that resolves to `true` if a context manager was set up, `false` otherwise
 */
export async function setupContextManager (): Promise<void> {
  // Check if we're in a real Node.js runtime (avoid browser process polyfills)
  const isNodeRuntime =
    typeof process !== 'undefined' &&
    process.release?.name === 'node' &&
    !!process.versions?.node

  if (isNodeRuntime) {
    try {
      const { AsyncLocalStorageContextManager } = await import('@opentelemetry/context-async-hooks')
      otelContext.setGlobalContextManager(new AsyncLocalStorageContextManager().enable())
    } catch {
      // Fallback: use default StackContextManager (no-op)
    }
  }
  // Browser: default StackContextManager works automatically
}

export function createTracedDecorator<TContext extends DecoratorContextShape> (config: TracedMethodConfig<TContext> = {}) {
  const decorator = function <T extends (...args: TContext['args']) => TContext['result']>(
    originalMethod: T,
    context: ClassMethodDecoratorContext
  ): T | void {
    const methodName = String(context.name)

    const wrappedMethod = function (this: any, ...args: TContext['args']): TContext['result'] {
      const spanName = config.spanName ?? `${this.constructor.name}.${methodName}`
      // const attributes = config.extractAttributes?.(...args) ?? {}

      // TODO: see if we can use getTracer().startSpan(name) and context.with() instead of startActiveSpan, to have more control over the context and span lifecycle.
      return getTracer().startActiveSpan(spanName, config.spanOptions ?? {}, (span) => {
        const sharedContext = {
          args,
          data: undefined,
          result: undefined,
          onChildSpan: config.onChildSpan,
          onEvent: config.onEvent
        } as InternalContextShape<TContext>
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
  }

  decorator.share = (data: TContext['data']) => {
    const sharedState = otelContext.active().getValue(CONTEXT_KEY) as DecoratorContextShape
    if (isPlainObject(sharedState.data) && isPlainObject(data)) {
      sharedState.data = { ...sharedState.data, ...data }
    } else {
      sharedState.data = data
    }
  }

  /**
   * Creates a child span within the current active span context.
   * If the parent decorator has an `onChildSpan` callback configured, it will be called
   * with the span name, span, and shared context.
   */
  decorator.withChildSpan = async <T>(
    spanName: string,
    fn: (span: Span | undefined) => Promise<T>,
    options?: SpanOptions
  ): Promise<T> => {
    const sharedState = otelContext.active().getValue(CONTEXT_KEY) as InternalContextShape<TContext> | undefined

    return getTracer().startActiveSpan(spanName, options ?? {}, async (span) => {
      try {
        // Call the onChildSpan callback if defined in the parent decorator
        sharedState?.onChildSpan?.(spanName, span, sharedState)

        const result = await fn(span)
        span.setStatus({ code: SpanStatusCode.OK })
        return result
      } catch (error) {
        recordError(span, error)
        throw error
      } finally {
        span.end()
      }
    })
  }

  /**
   * Adds an event to the current active span. If no span is active, this is a no-op.
   * Events are used to represent discrete occurrences during the span's lifetime.
   *
   * @param name - The name of the event to add
   * @param attributes - Optional attributes to attach to the event
   */
  decorator.addEvent = (name: string, attributes?: Attributes): void => {
    const activeSpan = trace.getActiveSpan()
    activeSpan?.addEvent(name, attributes)
  }

  return decorator
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

function isPlainObject (value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && value.constructor === Object
}
