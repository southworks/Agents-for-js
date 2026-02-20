import type { Span, SpanContext } from '@opentelemetry/api'

const noopSpanContext: SpanContext = {
  traceId: '',
  spanId: '',
  traceFlags: 0,
}

export const noopSpan: Span = {
  spanContext: () => noopSpanContext,
  setAttribute: () => noopSpan,
  setAttributes: () => noopSpan,
  addEvent: () => noopSpan,
  setStatus: () => noopSpan,
  updateName: () => noopSpan,
  end: () => {},
  isRecording: () => false,
  recordException: () => {},
  addLink: () => noopSpan,
  addLinks: () => noopSpan,
}
