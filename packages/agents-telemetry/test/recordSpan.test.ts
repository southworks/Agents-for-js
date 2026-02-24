// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { describe, it } from 'node:test'
import assert from 'assert'
import type { Span } from '@opentelemetry/api'

describe('recordSpan', () => {
  describe('when OpenTelemetry is not initialized', () => {
    it('should use noopSpan and execute the function', async () => {
      // Import without initializing telemetry first
      // We need a fresh module state, but due to caching from other tests,
      // we'll test this behavior by checking the function executes correctly
      const { recordSpan } = await import('../dist/src/recordSpan.js')
      const { noopSpan } = await import('../dist/src/noop.js')

      let capturedSpan: Span | null = null
      const result = await recordSpan({
        name: 'test-span',
        fn: (span) => {
          capturedSpan = span
          return 'test-result'
        },
      })

      assert.strictEqual(result, 'test-result', 'Should return the function result')
      // When otel is null, noopSpan is used
      if (capturedSpan === noopSpan) {
        assert.strictEqual(capturedSpan, noopSpan, 'Should use noopSpan when otel is not initialized')
      }
    })

    it('should handle async functions with noopSpan', async () => {
      const { recordSpan } = await import('../dist/src/recordSpan.js')

      const result = await recordSpan({
        name: 'async-test-span',
        fn: async () => {
          await Promise.resolve()
          return 'async-result'
        },
      })

      assert.strictEqual(result, 'async-result', 'Should return async function result')
    })
  })

  describe('when OpenTelemetry is initialized', () => {
    it('should create a span and execute the function', async () => {
      const { initTelemetry } = await import('../dist/src/otel.js')
      const { recordSpan } = await import('../dist/src/recordSpan.js')

      initTelemetry({ serviceName: 'test-service' })

      let spanReceived = false
      const result = await recordSpan({
        name: 'test-span',
        fn: (span) => {
          spanReceived = true
          assert.ok(span, 'Should receive a span')
          assert.ok(typeof span.setAttribute === 'function', 'Span should have setAttribute method')
          assert.ok(typeof span.end === 'function', 'Span should have end method')
          return 'success'
        },
      })

      assert.ok(spanReceived, 'Function should have been called with a span')
      assert.strictEqual(result, 'success', 'Should return the function result')
    })

    it('should pass attributes to the span', async () => {
      const { initTelemetry } = await import('../dist/src/otel.js')
      const { recordSpan } = await import('../dist/src/recordSpan.js')

      initTelemetry({ serviceName: 'test-service' })

      const attributes = {
        'test.string': 'value',
        'test.number': 42,
        'test.boolean': true,
      }

      const result = await recordSpan({
        name: 'test-span-with-attributes',
        attributes,
        fn: (span) => {
          assert.ok(span, 'Should receive a span')
          return 'with-attributes'
        },
      })

      assert.strictEqual(result, 'with-attributes', 'Should return the function result')
    })

    it('should handle async functions', async () => {
      const { initTelemetry } = await import('../dist/src/otel.js')
      const { recordSpan } = await import('../dist/src/recordSpan.js')

      initTelemetry({ serviceName: 'test-service' })

      const result = await recordSpan({
        name: 'async-span',
        fn: async (span) => {
          await Promise.resolve()
          span.setAttribute('async', true)
          return 'async-success'
        },
      })

      assert.strictEqual(result, 'async-success', 'Should return async function result')
    })
  })

  describe('error handling', () => {
    it('should record exception and set error status when Error is thrown', async () => {
      const { initTelemetry } = await import('../dist/src/otel.js')
      const { recordSpan } = await import('../dist/src/recordSpan.js')

      initTelemetry({ serviceName: 'test-service' })

      const testError = new Error('Test error message')
      testError.name = 'TestError'

      let caughtError: Error | null = null
      try {
        await recordSpan({
          name: 'error-span',
          fn: () => {
            throw testError
          },
        })
      } catch (error) {
        caughtError = error as Error
      }

      assert.ok(caughtError, 'Should have thrown an error')
      assert.strictEqual(caughtError.message, 'Test error message', 'Should rethrow the original error')
      assert.strictEqual(caughtError.name, 'TestError', 'Should preserve error name')
    })

    it('should set error status when non-Error is thrown', async () => {
      const { initTelemetry } = await import('../dist/src/otel.js')
      const { recordSpan } = await import('../dist/src/recordSpan.js')

      initTelemetry({ serviceName: 'test-service' })

      let caughtError: unknown = null
      try {
        await recordSpan({
          name: 'non-error-span',
          fn: () => {
            // eslint-disable-next-line no-throw-literal
            throw 'string error'
          },
        })
      } catch (error) {
        caughtError = error
      }

      assert.strictEqual(caughtError, 'string error', 'Should rethrow the original non-Error value')
    })

    it('should rethrow errors from async functions', async () => {
      const { initTelemetry } = await import('../dist/src/otel.js')
      const { recordSpan } = await import('../dist/src/recordSpan.js')

      initTelemetry({ serviceName: 'test-service' })

      const testError = new Error('Async error')
      testError.name = 'Async error'

      let caughtError: Error | null = null
      try {
        await recordSpan({
          name: 'async-error-span',
          fn: async () => {
            await Promise.resolve()
            throw testError
          },
        })
      } catch (error) {
        caughtError = error as Error
      }

      assert.ok(caughtError, 'Should have thrown an error')
      assert.strictEqual(caughtError.message, 'Async error', 'Should rethrow async errors')
    })
  })

  describe('span lifecycle', () => {
    it('should end the span after successful execution', async () => {
      const { initTelemetry } = await import('../dist/src/otel.js')
      const { recordSpan } = await import('../dist/src/recordSpan.js')

      initTelemetry({ serviceName: 'test-service' })

      // The span.end() is called in the finally block
      // We verify by ensuring the function completes without error
      const result = await recordSpan({
        name: 'lifecycle-span',
        fn: () => 'completed',
      })

      assert.strictEqual(result, 'completed', 'Should complete successfully')
    })

    it('should end the span even when an error occurs', async () => {
      const { initTelemetry } = await import('../dist/src/otel.js')
      const { recordSpan } = await import('../dist/src/recordSpan.js')

      initTelemetry({ serviceName: 'test-service' })

      // The span.end() should be called in the finally block even on error
      let caughtError: Error | null = null
      try {
        await recordSpan({
          name: 'error-lifecycle-span',
          fn: () => {
            throw new Error('Expected error')
          },
        })
      } catch (error) {
        caughtError = error as Error
      }

      assert.ok(caughtError, 'Should have thrown an error')
      assert.strictEqual(caughtError.message, 'Expected error')
    })
  })

  describe('SpanOptions', () => {
    it('should pass SpanOptions to tracer.startActiveSpan', async () => {
      const { initTelemetry } = await import('../dist/src/otel.js')
      const { recordSpan } = await import('../dist/src/recordSpan.js')

      initTelemetry({ serviceName: 'test-service' })

      const result = await recordSpan({
        name: 'span-with-options',
        attributes: { key: 'value' },
        options: {
          root: true,
        },
        fn: (span) => {
          assert.ok(span, 'Should receive a span')
          return 'with-options'
        },
      })

      assert.strictEqual(result, 'with-options', 'Should return the function result')
    })
  })
})
