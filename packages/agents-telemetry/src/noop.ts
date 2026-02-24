// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import type { Span, SpanContext } from '@opentelemetry/api'

/*
 * A no-operation Span implementation that can be used when OpenTelemetry is not available.
 * All methods return the noopSpan itself for chaining, and isRecording() returns false.
 * This allows the recordSpan function to work seamlessly even if OpenTelemetry is not initialized.
 * The spanContext method returns a valid SpanContext structure with empty values, ensuring that any code expecting a SpanContext can still function without errors.
 */
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
