// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

/**
 * Unit tests for trace.ts - Scenario 1: API installed, no SDK configured (no-op spans).
 *
 * These tests run in their own process to ensure no global OTel SDK is configured,
 * guaranteeing that all spans are no-ops (the default behaviour when only the API
 * package is present without an SDK provider).
 */
import { describe, it } from 'node:test'
import assert from 'assert'
import * as otelApi from '@opentelemetry/api'
import { traceFactory } from '../src/trace'
import { SpanNames } from '../src/constants'

const trace = traceFactory(otelApi)

describe('trace - no SDK configured (no-op spans)', () => {
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
