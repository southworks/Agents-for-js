import type { Span, SpanOptions } from '@opentelemetry/api'
import { noopSpan } from './noop'
import { getOtel } from './otel'

export interface RecordSpanOptions {
  name: string
  attributes?: Record<string, string | number | boolean>
  options?: SpanOptions
  fn: (span: Span) => Promise<unknown> | unknown
}

export async function recordSpan<T> ({ name, attributes, options, fn }: RecordSpanOptions & { fn: (span: Span) => Promise<T> | T }): Promise<T> {
  const otel = getOtel()
  if (otel === null) {
    return fn(noopSpan) as T
  }

  const { SpanStatusCode, tracer } = await otel

  return tracer.startActiveSpan(name, { attributes, ...options }, async (span) => {
    try {
      return await fn(span)
    } catch (error) {
      if (error instanceof Error) {
        span.recordException({
          name: error.name,
          message: error.message,
          stack: error.stack,
        })
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        })
      } else {
        span.setStatus({ code: SpanStatusCode.ERROR })
      }
      throw error
    } finally {
      span.end()
    }
  })
}
