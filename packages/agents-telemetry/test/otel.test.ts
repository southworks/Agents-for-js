// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

/**
 * Unit tests for trace.ts OpenTelemetry tracing utilities.
 *
 * These tests verify behavior in two scenarios:
 *   1. API installed, no SDK configured (no-op spans)
 *   2. API installed AND SDK configured (real spans)
 *
 * The traceFactory function creates a trace wrapper that validates span names
 * against SpanNames constants and handles both sync and async functions.
 */
import { describe, it, beforeEach } from 'node:test'
import assert from 'assert'
import * as otelApi from '@opentelemetry/api'
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { traceFactory } from '../src/trace'
import { SpanNames } from '../src/constants'

const trace = traceFactory(otelApi)

describe('trace', () => {
  // ============================================================================
  // Scenario 1: API installed, no SDK configured (no-op spans)
  // ============================================================================
  describe('no SDK configured (no-op spans)', () => {
    it('should execute function and return result', () => {
      const result = trace(SpanNames.ADAPTER_PROCESS, () => 'test-result')
      assert.strictEqual(result, 'test-result')
    })

    it('should pass a span object to the function', () => {
      let receivedSpan: otelApi.Span | undefined
      trace(SpanNames.ADAPTER_PROCESS, (span) => {
        receivedSpan = span
      })
      assert.ok(receivedSpan !== undefined, 'Span should not be undefined')
      assert.ok(typeof receivedSpan?.setAttribute === 'function', 'Span should have setAttribute method')
      assert.ok(typeof receivedSpan?.end === 'function', 'Span should have end method')
    })

    it('should handle async functions correctly', async () => {
      const result = await trace(SpanNames.ADAPTER_PROCESS, async () => {
        await new Promise((resolve) => setTimeout(resolve, 10))
        return 'async-result'
      })
      assert.strictEqual(result, 'async-result')
    })

    it('should propagate errors thrown by the function', () => {
      const expectedError = new Error('Test error')
      expectedError.name = 'TestError'

      assert.throws(
        () => trace(SpanNames.ADAPTER_PROCESS, () => { throw expectedError }),
        (error) => {
          assert.strictEqual(error, expectedError)
          assert.strictEqual((error as Error).name, 'TestError')
          return true
        }
      )
    })

    it('should propagate errors from async functions', async () => {
      const expectedError = new Error('Async error')
      await assert.rejects(
        trace(SpanNames.ADAPTER_PROCESS, async () => { throw expectedError }),
        (error) => {
          assert.strictEqual(error, expectedError)
          return true
        }
      )
    })

    it('should handle non-Error exceptions', () => {
      assert.throws(
        () => trace(SpanNames.ADAPTER_PROCESS, () => {
          // eslint-disable-next-line no-throw-literal
          throw 'string error'
        }),
        (error) => {
          assert.strictEqual(error, 'string error')
          return true
        }
      )
    })

    it('should throw on unrecognized span names', () => {
      assert.throws(
        // @ts-expect-error testing invalid span name
        () => trace('invalid-span-name', () => {}),
        (error) => {
          assert.ok(error instanceof Error)
          assert.ok(error.message.includes('Unrecognized span name'))
          return true
        }
      )
    })

    it('should work with void-returning functions', () => {
      let sideEffect = false
      const result = trace(SpanNames.ADAPTER_PROCESS, () => {
        sideEffect = true
      })
      assert.strictEqual(sideEffect, true)
      assert.strictEqual(result, undefined)
    })

    it('should allow setting attributes on span', () => {
      trace(SpanNames.ADAPTER_PROCESS, (span) => {
        span.setAttribute('string-attr', 'value')
        span.setAttribute('number-attr', 42)
        span.setAttribute('boolean-attr', true)
      })
      assert.ok(true, 'Should complete without errors')
    })

    it('should allow adding events to span', () => {
      trace(SpanNames.ADAPTER_PROCESS, (span) => {
        span.addEvent('event-1', { key: 'value' })
        span.addEvent('event-2')
      })
      assert.ok(true, 'Should complete without errors')
    })

    it('should allow setting span status', () => {
      trace(SpanNames.ADAPTER_PROCESS, (span) => {
        span.setStatus({ code: otelApi.SpanStatusCode.OK, message: 'All good' })
      })
      assert.ok(true, 'Should complete without errors')
    })

    it('should support nested trace calls', () => {
      const callOrder: string[] = []

      trace(SpanNames.ADAPTER_PROCESS, () => {
        callOrder.push('outer-start')
        trace(SpanNames.ADAPTER_SEND_ACTIVITIES, () => {
          callOrder.push('inner')
        })
        callOrder.push('outer-end')
      })

      assert.deepStrictEqual(callOrder, ['outer-start', 'inner', 'outer-end'])
    })

    it('should handle errors in nested spans correctly', () => {
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

    it('should handle multiple concurrent trace calls', async () => {
      const results = await Promise.all([
        trace(SpanNames.ADAPTER_PROCESS, async () => {
          await new Promise((resolve) => setTimeout(resolve, 10))
          return 'result-1'
        }),
        trace(SpanNames.ADAPTER_SEND_ACTIVITIES, async () => {
          await new Promise((resolve) => setTimeout(resolve, 5))
          return 'result-2'
        }),
        trace(SpanNames.ADAPTER_UPDATE_ACTIVITY, async () => {
          return 'result-3'
        })
      ])

      assert.deepStrictEqual(results, ['result-1', 'result-2', 'result-3'])
    })
  })

  // ============================================================================
  // Scenario 2: API installed AND SDK configured (real spans)
  // ============================================================================
  describe('SDK configured (real spans)', () => {
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
    provider.register()

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
})
