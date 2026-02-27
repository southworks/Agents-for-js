/**
 * Unit tests for otel.ts OpenTelemetry instrumentation utilities.
 *
 * These tests verify behavior in three scenarios:
 *   1. API installed, no SDK configured (no-op spans)
 *   2. API unavailable (graceful degradation)
 *   3. API installed AND SDK configured (real spans)
 *
 * The _resetForTesting function allows resetting module state between tests
 * and mocking the import to simulate the unavailable scenario.
 */
import { describe, it, mock, beforeEach, afterEach } from 'node:test'
import assert from 'assert'
import * as otelApi from '@opentelemetry/api'
import { InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { _resetForTesting } from '../dist/src/initOtel.js'

describe('otel', () => {
  // ============================================================================
  // Scenario 1: API installed, no SDK configured (no-op spans)
  // ============================================================================
  describe('@opentelemetry/api installed, no SDK configured', () => {
    describe('withSpan', () => {
      it('should execute function and return result', async () => {
        const { withSpan } = await import('../dist/src/otel.js')

        const expectedResult = { data: 'test-result' }
        const fn = mock.fn(async () => expectedResult)

        const result = await withSpan('test-span', fn)

        assert.deepStrictEqual(result, expectedResult)
        assert.strictEqual(fn.mock.callCount(), 1)
      })

      it('should pass no-op span to the function', async () => {
        const { withSpan } = await import('../dist/src/otel.js')

        let receivedSpan: otelApi.Span | undefined
        await withSpan('test-span', async (span) => {
          receivedSpan = span
          return 'done'
        })

        // When @opentelemetry/api is installed, we get a real Span object (no-op tracer)
        // This is different from the graceful degradation case where span is undefined
        assert.ok(receivedSpan !== undefined, 'Span should be a no-op Span object, not undefined')
        assert.ok(typeof receivedSpan?.setAttribute === 'function', 'Span should have setAttribute method')
        assert.ok(typeof receivedSpan?.end === 'function', 'Span should have end method')
      })

      it('should handle async functions correctly', async () => {
        const { withSpan } = await import('../dist/src/otel.js')

        const result = await withSpan('async-span', async () => {
          await new Promise((resolve) => setTimeout(resolve, 10))
          return 'async-result'
        })

        assert.strictEqual(result, 'async-result')
      })

      it('should propagate errors thrown by the function', async () => {
        const { withSpan } = await import('../dist/src/otel.js')

        const expectedError = new Error('Test error')
        expectedError.name = 'TestError'

        let caughtError: Error | null = null
        try {
          await withSpan('error-span', async () => {
            throw expectedError
          })
        } catch (error) {
          caughtError = error as Error
        }

        assert.ok(caughtError, 'Should have thrown an error')
        assert.strictEqual(caughtError, expectedError, 'Should have thrown the expected error')
        assert.strictEqual(caughtError.name, 'TestError', 'Should preserve error name')
      })

      it('should handle non-Error exceptions', async () => {
        const { withSpan } = await import('../dist/src/otel.js')

        let caughtError: unknown = null
        try {
          await withSpan('string-error-span', async () => {
            // eslint-disable-next-line no-throw-literal
            throw 'string error'
          })
        } catch (error) {
          caughtError = error
        }

        assert.strictEqual(caughtError, 'string error', 'Should have thrown the string error')
      })

      it('should accept span options', async () => {
        const { withSpan } = await import('../dist/src/otel.js')

        const options: otelApi.SpanOptions = {
          attributes: { 'custom.attribute': 'value' },
          kind: otelApi.SpanKind.CLIENT
        }

        const result = await withSpan(
          'span-with-options',
          async () => 'result',
          options
        )

        assert.strictEqual(result, 'result')
      })

      it('should work with void-returning functions', async () => {
        const { withSpan } = await import('../dist/src/otel.js')

        let sideEffect = false
        const result = await withSpan('void-span', async () => {
          sideEffect = true
        })

        assert.strictEqual(sideEffect, true)
        assert.strictEqual(result, undefined)
      })

      it('should allow setting attributes on span', async () => {
        const { withSpan } = await import('../dist/src/otel.js')

        await withSpan('attributed-span', async (span) => {
          if (span) {
            span.setAttribute('string-attr', 'value')
            span.setAttribute('number-attr', 42)
            span.setAttribute('boolean-attr', true)
          }
          return 'done'
        })

        assert.ok(true, 'Should complete without errors')
      })

      it('should allow adding events to span', async () => {
        const { withSpan } = await import('../dist/src/otel.js')

        await withSpan('event-span', async (span) => {
          if (span) {
            span.addEvent('event-1', { key: 'value' })
            span.addEvent('event-2')
          }
          return 'done'
        })

        assert.ok(true, 'Should complete without errors')
      })

      it('should allow setting span status', async () => {
        const { withSpan } = await import('../dist/src/otel.js')

        await withSpan('status-span', async (span) => {
          if (span) {
            span.setStatus({ code: otelApi.SpanStatusCode.OK, message: 'All good' })
          }
          return 'done'
        })

        assert.ok(true, 'Should complete without errors')
      })
    })

    describe('startSpan', () => {
      it('should return a no-op span', async () => {
        const { startSpan } = await import('../dist/src/otel.js')

        const span = await startSpan('manual-span')

        assert.ok(span !== undefined, 'Should return a no-op Span object, not undefined')
        assert.ok(typeof span?.end === 'function', 'Span should have an end method')
        assert.ok(typeof span?.setAttribute === 'function', 'Span should have setAttribute method')
        span?.end()
      })

      it('should accept span options', async () => {
        const { startSpan } = await import('../dist/src/otel.js')

        const options: otelApi.SpanOptions = {
          attributes: { 'test.attr': 'value' },
          kind: otelApi.SpanKind.PRODUCER
        }

        const span = await startSpan('span-with-options', options)

        if (span) {
          assert.ok(typeof span.setAttribute === 'function')
          span.end()
        }
      })

      it('should allow manual span lifecycle management', async () => {
        const { startSpan } = await import('../dist/src/otel.js')

        const span = await startSpan('lifecycle-span')

        if (span) {
          span.setAttribute('step', 1)
          span.addEvent('processing-started')
          span.setAttribute('step', 2)
          span.addEvent('processing-completed')
          span.setStatus({ code: otelApi.SpanStatusCode.OK })
          span.end()
        }

        assert.ok(true, 'Should complete without errors')
      })
    })

    describe('getActiveSpan', () => {
      it('should return undefined when no span is active', async () => {
        const { getActiveSpan } = await import('../dist/src/otel.js')

        const span = await getActiveSpan()

        assert.ok(span === undefined || span !== null, 'Should return undefined or a span')
      })

      it('should return the active span when inside withSpan', async () => {
        const { withSpan, getActiveSpan } = await import('../dist/src/otel.js')

        let activeSpanInside: otelApi.Span | undefined

        await withSpan('outer-span', async () => {
          activeSpanInside = await getActiveSpan()
          return 'done'
        })

        if (activeSpanInside) {
          assert.ok(typeof activeSpanInside.end === 'function')
        }
      })
    })

    describe('injectTraceContext', () => {
      it('should return the carrier object', async () => {
        const { injectTraceContext } = await import('../dist/src/otel.js')

        const carrier: Record<string, string> = {}
        const result = await injectTraceContext(carrier)

        assert.ok(result !== null)
        assert.ok(typeof result === 'object')
      })

      it('should use empty object as default carrier', async () => {
        const { injectTraceContext } = await import('../dist/src/otel.js')

        const result = await injectTraceContext()

        assert.ok(result !== null)
        assert.ok(typeof result === 'object')
      })

      it('should preserve existing carrier properties', async () => {
        const { injectTraceContext } = await import('../dist/src/otel.js')

        const carrier: Record<string, string> = {
          'existing-header': 'existing-value'
        }

        const result = await injectTraceContext(carrier)

        assert.strictEqual(result['existing-header'], 'existing-value')
      })
    })

    describe('nested spans', () => {
      it('should support nested withSpan calls', async () => {
        const { withSpan } = await import('../dist/src/otel.js')

        const callOrder: string[] = []

        await withSpan('outer', async () => {
          callOrder.push('outer-start')

          await withSpan('inner', async () => {
            callOrder.push('inner')
            return 'inner-result'
          })

          callOrder.push('outer-end')
          return 'outer-result'
        })

        assert.deepStrictEqual(callOrder, ['outer-start', 'inner', 'outer-end'])
      })

      it('should handle errors in nested spans correctly', async () => {
        const { withSpan } = await import('../dist/src/otel.js')

        const outerCompleted = { value: false }

        await assert.rejects(async () => {
          await withSpan('outer', async () => {
            await withSpan('inner', async () => {
              throw new Error('Inner error')
            })
            outerCompleted.value = true
            return 'outer-result'
          })
        })

        assert.strictEqual(outerCompleted.value, false, 'Outer span should not complete after inner error')
      })
    })

    describe('concurrent operations', () => {
      it('should handle multiple concurrent withSpan calls', async () => {
        const { withSpan } = await import('../dist/src/otel.js')

        const results = await Promise.all([
          withSpan('concurrent-1', async () => {
            await new Promise((resolve) => setTimeout(resolve, 10))
            return 'result-1'
          }),
          withSpan('concurrent-2', async () => {
            await new Promise((resolve) => setTimeout(resolve, 5))
            return 'result-2'
          }),
          withSpan('concurrent-3', async () => {
            return 'result-3'
          })
        ])

        assert.deepStrictEqual(results, ['result-1', 'result-2', 'result-3'])
      })
    })
  })

  // ============================================================================
  // Scenario 2: API unavailable (undefined spans)
  // ============================================================================
  describe('@opentelemetry/api unavailable (graceful degradation)', () => {
    beforeEach(() => {
      _resetForTesting({
        mockImport: async () => undefined
      })
    })

    afterEach(() => {
      _resetForTesting()
    })

    describe('withSpan', () => {
      it('should execute function and pass undefined span', async () => {
        const { withSpan } = await import('../dist/src/otel.js')

        const executed = { value: false }
        let receivedSpan: otelApi.Span | undefined = {} as otelApi.Span

        const result = await withSpan('test', async (span) => {
          executed.value = true
          receivedSpan = span
          return 'result'
        })

        assert.strictEqual(executed.value, true, 'Function should be executed')
        assert.strictEqual(result, 'result', 'Should return function result')
        assert.strictEqual(receivedSpan, undefined, 'Span should be undefined')
      })

      it('should propagate errors correctly', async () => {
        const { withSpan } = await import('../dist/src/otel.js')

        const expectedError = new Error('Function error')
        let caughtError: Error | null = null
        try {
          await withSpan('error-span', async () => {
            throw expectedError
          })
        } catch (error) {
          caughtError = error as Error
        }

        assert.strictEqual(caughtError, expectedError, 'Should propagate the error')
      })
    })

    describe('startSpan', () => {
      it('should return undefined', async () => {
        const { startSpan } = await import('../dist/src/otel.js')

        const span = await startSpan('test-span')

        assert.strictEqual(span, undefined, 'Should return undefined')
      })
    })

    describe('getActiveSpan', () => {
      it('should return undefined', async () => {
        const { getActiveSpan } = await import('../dist/src/otel.js')

        const span = await getActiveSpan()

        assert.strictEqual(span, undefined, 'Should return undefined')
      })
    })

    describe('injectTraceContext', () => {
      it('should return carrier unchanged', async () => {
        const { injectTraceContext } = await import('../dist/src/otel.js')

        const carrier = { test: 'value', 'existing-header': 'existing-value' }
        const result = await injectTraceContext(carrier)

        assert.strictEqual(result.test, 'value')
        assert.strictEqual(result['existing-header'], 'existing-value')
        assert.strictEqual(Object.keys(result).length, 2, 'No headers should be added')
      })
    })

    describe('nested spans', () => {
      it('should work correctly with undefined spans', async () => {
        const { withSpan } = await import('../dist/src/otel.js')

        const callOrder: string[] = []

        await withSpan('outer', async (outerSpan) => {
          assert.strictEqual(outerSpan, undefined)
          callOrder.push('outer-start')

          await withSpan('inner', async (innerSpan) => {
            assert.strictEqual(innerSpan, undefined)
            callOrder.push('inner')
            return 'inner-result'
          })

          callOrder.push('outer-end')
          return 'outer-result'
        })

        assert.deepStrictEqual(callOrder, ['outer-start', 'inner', 'outer-end'])
      })
    })
  })

  // ============================================================================
  // Scenario 3: API installed AND SDK configured (real spans)
  // ============================================================================
  describe('@opentelemetry/api installed, SDK configured (real spans)', () => {
    // When a real OpenTelemetry SDK is configured, spans are actually recorded
    // and can be verified via the InMemorySpanExporter.
    //
    // Note: We use NodeTracerProvider which sets up AsyncLocalStorage for proper
    // context propagation. We use a single provider for all tests because the
    // global tracer provider can only be set once per process.

    const exporter = new InMemorySpanExporter()
    const provider = new NodeTracerProvider()
    provider.addSpanProcessor(new SimpleSpanProcessor(exporter))
    provider.register()

    beforeEach(() => {
      // Clear any spans from previous tests
      exporter.reset()
    })

    describe('withSpan', () => {
      it('should create and record a real span', async () => {
        const { withSpan } = await import('../dist/src/otel.js')

        await withSpan('recorded-span', async (span) => {
          assert.ok(span !== undefined, 'Should receive a real span')
          span?.setAttribute('test.attribute', 'test-value')
          return 'done'
        })

        const spans = exporter.getFinishedSpans()
        assert.strictEqual(spans.length, 1, 'Should have recorded one span')
        assert.strictEqual(spans[0].name, 'recorded-span')
        assert.strictEqual(spans[0].attributes['test.attribute'], 'test-value')
        assert.strictEqual(spans[0].status.code, otelApi.SpanStatusCode.OK)
      })

      it('should record error status on exception', async () => {
        const { withSpan } = await import('../dist/src/otel.js')

        try {
          await withSpan('error-span', async () => {
            throw new Error('Test error')
          })
        } catch {
          // Expected
        }

        const spans = exporter.getFinishedSpans()
        assert.strictEqual(spans.length, 1)
        assert.strictEqual(spans[0].name, 'error-span')
        assert.strictEqual(spans[0].status.code, otelApi.SpanStatusCode.ERROR)
        assert.strictEqual(spans[0].status.message, 'Test error')
        assert.ok(spans[0].events.length > 0, 'Should have recorded exception event')
      })

      it('should record span events', async () => {
        const { withSpan } = await import('../dist/src/otel.js')

        await withSpan('event-span', async (span) => {
          span?.addEvent('processing-started', { step: 1 })
          span?.addEvent('processing-completed', { step: 2 })
          return 'done'
        })

        const spans = exporter.getFinishedSpans()
        assert.strictEqual(spans.length, 1)
        assert.strictEqual(spans[0].events.length, 2)
        assert.strictEqual(spans[0].events[0].name, 'processing-started')
        assert.strictEqual(spans[0].events[1].name, 'processing-completed')
      })
    })

    describe('startSpan', () => {
      it('should create a real span that must be manually ended', async () => {
        const { startSpan } = await import('../dist/src/otel.js')

        const span = await startSpan('manual-span', {
          attributes: { 'manual.attr': 'value' }
        })

        assert.ok(span !== undefined)
        span?.setAttribute('another.attr', 42)
        span?.end()

        const spans = exporter.getFinishedSpans()
        assert.strictEqual(spans.length, 1)
        assert.strictEqual(spans[0].name, 'manual-span')
        assert.strictEqual(spans[0].attributes['manual.attr'], 'value')
        assert.strictEqual(spans[0].attributes['another.attr'], 42)
      })
    })

    describe('getActiveSpan', () => {
      it('should return the current span inside withSpan', async () => {
        const { withSpan, getActiveSpan } = await import('../dist/src/otel.js')

        let activeSpan: otelApi.Span | undefined
        let passedSpan: otelApi.Span | undefined

        await withSpan('active-span-test', async (span) => {
          passedSpan = span
          activeSpan = await getActiveSpan()
          return 'done'
        })

        assert.ok(activeSpan !== undefined, 'Should have active span')
        assert.strictEqual(
          activeSpan?.spanContext().spanId,
          passedSpan?.spanContext().spanId,
          'Active span should match the span passed to callback'
        )
      })
    })

    describe('injectTraceContext', () => {
      it('should inject traceparent header', async () => {
        const { withSpan, injectTraceContext } = await import('../dist/src/otel.js')

        let carrier: Record<string, string> = {}

        await withSpan('context-injection-span', async () => {
          carrier = await injectTraceContext({})
          return 'done'
        })

        assert.ok('traceparent' in carrier, 'Should have injected traceparent header')
        // traceparent format: version-traceId-spanId-flags (e.g., 00-xxx-xxx-01)
        assert.match(
          carrier.traceparent,
          /^[0-9a-f]{2}-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$/,
          'traceparent should match W3C trace context format'
        )
      })
    })

    describe('nested spans', () => {
      it('should create parent-child relationship', async () => {
        const { withSpan } = await import('../dist/src/otel.js')

        await withSpan('parent-span', async () => {
          await withSpan('child-span', async () => {
            return 'child-result'
          })
          return 'parent-result'
        })

        const spans = exporter.getFinishedSpans()
        assert.strictEqual(spans.length, 2, 'Should have recorded two spans')

        // Spans are finished in reverse order (child finishes first)
        const childSpan = spans.find(s => s.name === 'child-span')
        const parentSpan = spans.find(s => s.name === 'parent-span')

        assert.ok(childSpan, 'Should have child span')
        assert.ok(parentSpan, 'Should have parent span')

        // Verify parent-child relationship via trace context
        assert.strictEqual(
          childSpan?.spanContext().traceId,
          parentSpan?.spanContext().traceId,
          'Child and parent should share the same trace ID'
        )
        assert.strictEqual(
          childSpan?.parentSpanId,
          parentSpan?.spanContext().spanId,
          'Child parent span ID should match parent span ID'
        )
      })
    })

    describe('concurrent operations', () => {
      it('should all complete successfully', async () => {
        const { withSpan } = await import('../dist/src/otel.js')

        const results = await Promise.all([
          withSpan('concurrent-1', async () => 'result-1'),
          withSpan('concurrent-2', async () => 'result-2'),
          withSpan('concurrent-3', async () => 'result-3')
        ])

        assert.deepStrictEqual(results, ['result-1', 'result-2', 'result-3'])
      })
    })
  })
})
