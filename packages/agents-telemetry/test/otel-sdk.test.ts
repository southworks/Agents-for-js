// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

/**
 * Unit tests for trace.ts - Scenario 2: API installed AND SDK configured (real spans).
 *
 * These tests run in their own process to isolate global OTel SDK state.
 * A NodeTracerProvider with an InMemorySpanExporter is registered once via a
 * `before` hook so that real spans are recorded and can be verified.
 */
import { describe, it, before, beforeEach } from 'node:test'
import assert from 'assert'
import * as otelApi from '@opentelemetry/api'
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { traceFactory } from '../src/trace'
import { SpanNames } from '../src/constants'

const trace = traceFactory(otelApi)

describe('trace - SDK configured (real spans)', () => {
  // When a real OpenTelemetry SDK is configured, spans are actually recorded
  // and can be verified via the InMemorySpanExporter.
  //
  // Note: We use NodeTracerProvider which sets up AsyncLocalStorage for proper
  // context propagation. We use a single provider for all tests because the
  // global tracer provider can only be set once per process.

  const exporter = new InMemorySpanExporter()
  const provider = new NodeTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)]
  })

  before(() => {
    provider.register()
  })

  beforeEach(() => {
    // Clear any spans from previous tests
    exporter.reset()
  })

  it('should create and record a real span', () => {
    trace(SpanNames.ADAPTER_PROCESS, (span) => {
      span.setAttribute('test.attribute', 'test-value')
    })

    const spans = exporter.getFinishedSpans()
    assert.strictEqual(spans.length, 1, 'Should have recorded one span')
    assert.strictEqual(spans[0].name, SpanNames.ADAPTER_PROCESS)
    assert.strictEqual(spans[0].attributes['test.attribute'], 'test-value')
    assert.strictEqual(spans[0].status.code, otelApi.SpanStatusCode.OK)
  })

  it('should create and record a real span with async function', async () => {
    await trace(SpanNames.ADAPTER_PROCESS, async (span) => {
      span.setAttribute('test.attribute', 'async-value')
      await new Promise((resolve) => setTimeout(resolve, 10))
    })

    const spans = exporter.getFinishedSpans()
    assert.strictEqual(spans.length, 1)
    assert.strictEqual(spans[0].name, SpanNames.ADAPTER_PROCESS)
    assert.strictEqual(spans[0].attributes['test.attribute'], 'async-value')
    assert.strictEqual(spans[0].status.code, otelApi.SpanStatusCode.OK)
  })

  it('should record error status on sync exception', () => {
    try {
      trace(SpanNames.ADAPTER_PROCESS, () => {
        throw new Error('Test error')
      })
    } catch {
      // Expected
    }

    const spans = exporter.getFinishedSpans()
    assert.strictEqual(spans.length, 1)
    assert.strictEqual(spans[0].name, SpanNames.ADAPTER_PROCESS)
    assert.strictEqual(spans[0].status.code, otelApi.SpanStatusCode.ERROR)
    assert.strictEqual(spans[0].status.message, 'Test error')
    assert.ok(spans[0].events.length > 0, 'Should have recorded exception/failure events')
  })

  it('should record error status on async exception', async () => {
    try {
      await trace(SpanNames.ADAPTER_PROCESS, async () => {
        throw new Error('Async error')
      })
    } catch {
      // Expected
    }

    const spans = exporter.getFinishedSpans()
    assert.strictEqual(spans.length, 1)
    assert.strictEqual(spans[0].status.code, otelApi.SpanStatusCode.ERROR)
    assert.strictEqual(spans[0].status.message, 'Async error')
  })

  it('should handle non-Error exceptions in recorded spans', () => {
    try {
      trace(SpanNames.ADAPTER_PROCESS, () => {
        // eslint-disable-next-line no-throw-literal
        throw 'string error'
      })
    } catch {
      // Expected
    }

    const spans = exporter.getFinishedSpans()
    assert.strictEqual(spans.length, 1)
    assert.strictEqual(spans[0].status.code, otelApi.SpanStatusCode.ERROR)
    assert.strictEqual(spans[0].status.message, 'string error')
  })

  it('should record span events', () => {
    trace(SpanNames.ADAPTER_PROCESS, (span) => {
      span.addEvent('processing-started', { step: 1 })
      span.addEvent('processing-completed', { step: 2 })
    })

    const spans = exporter.getFinishedSpans()
    assert.strictEqual(spans.length, 1)
    assert.strictEqual(spans[0].events.length, 2)
    assert.strictEqual(spans[0].events[0].name, 'processing-started')
    assert.strictEqual(spans[0].events[1].name, 'processing-completed')
  })

  it('should create parent-child relationship for nested spans', () => {
    trace(SpanNames.ADAPTER_PROCESS, () => {
      trace(SpanNames.ADAPTER_SEND_ACTIVITIES, () => {
        // child span
      })
    })

    const spans = exporter.getFinishedSpans()
    assert.strictEqual(spans.length, 2, 'Should have recorded two spans')

    const childSpan = spans.find(s => s.name === SpanNames.ADAPTER_SEND_ACTIVITIES)
    const parentSpan = spans.find(s => s.name === SpanNames.ADAPTER_PROCESS)

    assert.ok(childSpan, 'Should have child span')
    assert.ok(parentSpan, 'Should have parent span')

    assert.strictEqual(
      childSpan?.spanContext().traceId,
      parentSpan?.spanContext().traceId,
      'Child and parent should share the same trace ID'
    )
    assert.strictEqual(
      childSpan?.parentSpanContext?.spanId,
      parentSpan?.spanContext().spanId,
      'Child parent span ID should match parent span ID'
    )
  })

  it('should handle concurrent trace calls', async () => {
    const results = await Promise.all([
      trace(SpanNames.ADAPTER_PROCESS, async () => 'result-1'),
      trace(SpanNames.ADAPTER_SEND_ACTIVITIES, async () => 'result-2'),
      trace(SpanNames.ADAPTER_UPDATE_ACTIVITY, async () => 'result-3')
    ])

    assert.deepStrictEqual(results, ['result-1', 'result-2', 'result-3'])
  })

  it('should propagate errors from nested spans', () => {
    const outerCompleted = { value: false }

    assert.throws(() => {
      trace(SpanNames.ADAPTER_PROCESS, () => {
        trace(SpanNames.ADAPTER_SEND_ACTIVITIES, () => {
          throw new Error('Inner error')
        })
        outerCompleted.value = true
      })
    })

    assert.strictEqual(outerCompleted.value, false, 'Outer span should not complete after inner error')
  })
})
