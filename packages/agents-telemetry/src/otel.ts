import type { Tracer, Span, SpanOptions } from '@opentelemetry/api'
import { getOtelApi } from './initOtel'

const LIBRARY_NAME = 'Agents SDK'
const LIBRARY_VERSION = '1.0.0'

let otelApi: typeof import('@opentelemetry/api') | undefined
let resolveAttempted = false
let importOverride: (() => Promise<typeof import('@opentelemetry/api') | undefined>) | undefined

/**
 * @internal
 * Resets the internal module state for testing purposes.
 * Allows tests to simulate scenarios where `@opentelemetry/api` is not installed.
 *
 * @param options.mockImport - Optional function to override the dynamic import behavior
 */
export function _resetForTesting (options?: {
  mockImport?: () => Promise<typeof import('@opentelemetry/api') | undefined>
}): void {
  otelApi = undefined
  resolveAttempted = false
  importOverride = options?.mockImport
}

/**
 * Attempts to load `@opentelemetry/api` once.
 * If the package is not installed, logs a warning and silently disables telemetry.
 */
async function loadOtelApi2 (): Promise<typeof import('@opentelemetry/api') | undefined> {
  if (resolveAttempted) return otelApi
  resolveAttempted = true

  try {
    otelApi = await import('@opentelemetry/api')
  } catch {
    console.warn(
      `[${LIBRARY_NAME}] @opentelemetry/api is not installed. ` +
      'Telemetry is disabled. To enable instrumentation, install it:\n\n' +
      '  npm install @opentelemetry/api\n'
    )
  }

  return otelApi
}

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
async function getTracer (): Promise<Tracer | undefined> {
  const api = getOtelApi() ?? await loadOtelApi2()
  if (!api) console.log(`[${LIBRARY_NAME}] OpenTelemetry API not available, returning undefined tracer`)
  return api?.trace.getTracer(LIBRARY_NAME, LIBRARY_VERSION)
}

type MaybePromise<T> = T | Promise<T>
type AnyMethod<This = unknown, Args extends unknown[] = unknown[], Return = unknown> = (this: This, ...args: Args) => Return

export interface OTelTraceExecutionContext<This = unknown, Args extends unknown[] = unknown[]> {
  thisArg: This
  className: string
  methodName: string
  args: Args
}

export interface OTelTraceOptions<This = unknown, Args extends unknown[] = unknown[]> {
  name?: string | ((context: OTelTraceExecutionContext<This, Args>) => string)
  options?: SpanOptions | ((context: OTelTraceExecutionContext<This, Args>) => SpanOptions | undefined)
  injectSpan?: boolean
}

function resolveClassName (thisArg: unknown): string {
  if (!thisArg || typeof thisArg !== 'object') return 'UnknownClass'
  return (thisArg as { constructor?: { name?: string } }).constructor?.name ?? 'UnknownClass'
}

function isMethodDecoratorContext (value: unknown): value is ClassMethodDecoratorContext {
  if (!value || typeof value !== 'object') return false
  return 'kind' in value && 'name' in value
}

function buildDecoratorWrapper<This, Args extends unknown[], Return> (
  originalMethod: AnyMethod<This, Args, Return>,
  methodName: string,
  options?: OTelTraceOptions<This, Args>
): AnyMethod<This, Args, Promise<Awaited<Return>>> {
  return async function tracedMethod (this: This, ...args: Args): Promise<Awaited<Return>> {
    const className = resolveClassName(this)
    const executionContext: OTelTraceExecutionContext<This, Args> = {
      thisArg: this,
      className,
      methodName,
      args,
    }

    const resolvedName = typeof options?.name === 'function'
      ? options.name(executionContext)
      : options?.name
    const spanName = resolvedName ?? `${className}.${methodName}`
    const spanOptions = typeof options?.options === 'function'
      ? options.options(executionContext)
      : options?.options

    return withSpan(
      spanName,
      (span) => {
        const callArgs = options?.injectSpan ? [...args, span] as unknown as Args : args
        return originalMethod.apply(this, callArgs)
      },
      spanOptions
    )
  }
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
export async function withSpan<T> (
  spanName: string,
  fn: (span: Span | undefined) => MaybePromise<T>,
  options?: SpanOptions
): Promise<Awaited<T>> {
  const tracer = await getTracer()
  const api = getOtelApi()

  if (!tracer) {
    return await fn(undefined)
  }

  return tracer.startActiveSpan(spanName, options ?? {}, async (span) => {
    try {
      const result = await fn(span)
      if (api) {
        span.setStatus({ code: api.SpanStatusCode.OK })
      }
      return result
    } catch (error) {
      span.recordException(error as Error)
      if (api) {
        span.setStatus({
          code: api.SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        })
      }
      throw error
    } finally {
      span.end()
    }
  }) as Promise<Awaited<T>>
}

/**
 * Starts a span without automatically ending it.
 * Returns `undefined` if `@opentelemetry/api` is not available.
 * Useful when the span lifetime does not map to a single function scope
 * (e.g. streaming responses, event-driven workflows).
 */
export async function startSpan (spanName: string, options?: SpanOptions): Promise<Span | undefined> {
  const tracer = await getTracer()
  return tracer?.startSpan(spanName, options)
}

/**
 * Returns the currently active span, or `undefined` if the
 * OpenTelemetry API is not available or no span is active.
 */
export async function getActiveSpan (): Promise<Span | undefined> {
  const api = getOtelApi() // await loadOtelApi()
  return api?.trace.getActiveSpan()
}

/**
 * Returns the currently active context object from OpenTelemetry.
 * Useful when the caller needs to manually propagate context.
 */
export function getActiveContext (): ReturnType<(typeof import('@opentelemetry/api'))['context']['active']> | undefined {
  const api = getOtelApi()
  return api?.context.active()
}

/**
 * Returns the currently active span synchronously, or `undefined` when
 * OpenTelemetry is unavailable or no span is active.
 */
export function getActiveSpanSync (): Span | undefined {
  const api = getOtelApi()
  return api?.trace.getActiveSpan()
}

/**
 * Method decorator for tracing class methods with OpenTelemetry.
 *
 * Supports both forms:
 * - `@otelTrace`                          — span name defaults to `ClassName.methodName`
 * - `@otelTrace({ name: 'custom.name' })` — pre-configured span name / options
 *
 * The returned decorator adapts to any method signature, so pre-configured
 * instances (e.g. `traceAdapterProcess`) can be applied to any class method.
 */
export function otelTrace<This, Args extends unknown[], Return> (
  target: AnyMethod<This, Args, Return>,
  context: ClassMethodDecoratorContext<This, AnyMethod<This, Args, Return>>
): AnyMethod<This, Args, Promise<Awaited<Return>>>
export function otelTrace (
  options?: OTelTraceOptions
): <This, Args extends unknown[], Return>(
  target: AnyMethod<This, Args, Return>,
  context: ClassMethodDecoratorContext<This, AnyMethod<This, Args, Return>>
) => AnyMethod<This, Args, Promise<Awaited<Return>>>
export function otelTrace<This, Args extends unknown[], Return> (
  targetOrOptions?: AnyMethod<This, Args, Return> | OTelTraceOptions,
  context?: ClassMethodDecoratorContext<This, AnyMethod<This, Args, Return>>
) {
  if (context && isMethodDecoratorContext(context) && typeof targetOrOptions === 'function') {
    return buildDecoratorWrapper(targetOrOptions, String(context.name))
  }

  const options = targetOrOptions as OTelTraceOptions | undefined

  return <T, A extends unknown[], R>(
    target: AnyMethod<T, A, R>,
    methodContext: ClassMethodDecoratorContext<T, AnyMethod<T, A, R>>
  ) => buildDecoratorWrapper(target, String(methodContext.name), options as OTelTraceOptions<T, A>)
}

/**
 * Injects the current W3C trace-context headers into a carrier object.
 * Returns the carrier unchanged if `@opentelemetry/api` is not available.
 */
export async function injectTraceContext (
  carrier: Record<string, string> = {}
): Promise<Record<string, string>> {
  const api = getOtelApi() // await loadOtelApi()
  if (api) {
    api.propagation.inject(api.context.active(), carrier)
  }
  return carrier
}
