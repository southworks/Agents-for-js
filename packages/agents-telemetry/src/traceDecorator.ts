// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Span, SpanOptions, OTelAPI } from './types'
import pkg from '../package.json'

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

type TMethodShape = (...args: any[]) => any
type TScopeShape = Record<string, any>

export interface DecoratorContext<TMethod extends TMethodShape, TScope extends TScopeShape> {
  class: ClassDecoratorContext['name'],
  name: ClassMethodDecoratorContext['name'],
  args: Parameters<TMethod>
  scope: TScope
  result: AttemptValue<ReturnType<TMethod>>
  call(): ReturnType<TMethod>
}

function createDecorator<TMethod extends TMethodShape, TScope extends TScopeShape> (fn: (decorator: DecoratorContext<TMethod, TScope>) => ReturnType<TMethod>) {
  const store = new WeakMap<object, TScope>()

  function decorator (originalMethod: TMethod, context: ClassMethodDecoratorContext) {
    if (context.kind !== 'method') {
      throw new Error('TraceDecorator can only be applied to methods')
    }

    return function decoratorWrapperMethod (this: any, ...args: Parameters<TMethod>) {
      const thisWrapper = this
      store.set(thisWrapper, {} as TScope)

      const value: DecoratorContext<TMethod, TScope> = {
        class: thisWrapper.constructor.name,
        name: context.name,
        args,
        scope: {} as TScope,
        result: undefined as any,
        call: () => attempt({
          try: () => originalMethod.apply(thisWrapper, args),
          then (result) {
            value.scope = store.get(thisWrapper)!
            value.result = result
          }
        })
      }

      return attempt({
        try: () => fn(value),
        finally () {
          store.delete(thisWrapper)
        }
      })
    }
  }

  decorator.share = function share (_this: any, scope: TScope) {
    const context = _this ? store.get(_this) : undefined
    if (!context) {
      throw new Error('No active context scope found. Ensure that "share" is called within a decorated method.')
    }

    Object.assign(context, scope)
  }

  decorator.process = function process (_this: any, fn: TMethod) {
    const context = _this ? store.get(_this) : undefined
    if (!context) {
      throw new Error('No active context scope found. Ensure that "process" is called within a decorated method.')
    }

    const decoratorInstance = decorator(fn, { kind: 'method', name: this.name } as ClassMethodDecoratorContext)
    return decoratorInstance.apply(_this)
  }

  return decorator
}

export function DecoratorFactory (otel: OTelAPI) {
  return {
    trace<TMethod extends TMethodShape, TScope extends TScopeShape = {}>(config: TracedMethodConfig<DecoratorContext<TMethod, TScope>> = {}) {
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
              config.onError?.(span, error, decorator, sharedContext)
              if (error instanceof Error) {
                span.recordException(error)
                span.setStatus({ code: otel.SpanStatusCode.ERROR, message: error.message })
              } else {
                span.setStatus({ code: otel.SpanStatusCode.ERROR, message: String(error) })
              }
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
}

function isPromise<T> (value: T | Promise<T>): value is Promise<T> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    'then' in value &&
    typeof value.then === 'function'
  )
}

type AttemptValue<TResult> =
  TResult extends Promise<infer U> ? U : TResult

function attempt<TResult> (options: {
  try: () => TResult,
  then?: (result: TResult) => TResult | void,
  catch?: (error: unknown) => void,
  finally?: () => void
}): TResult {
  let _isPromise = false
  try {
    const result = options.try()
    if (isPromise(result)) {
      _isPromise = true
      return result
        .then((res) => options.then?.(res) ?? res)
        .catch((error) => {
          options.catch?.(error)
          throw error
        })
        .finally(options.finally) as any
    }

    return options.then?.(result) ?? result
  } catch (error) {
    if (!_isPromise) {
      options.catch?.(error)
    }
    throw error
  } finally {
    if (!_isPromise) {
      options.finally?.()
    }
  }
}
