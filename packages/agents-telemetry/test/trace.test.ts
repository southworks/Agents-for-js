// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import assert from 'assert'
import sinon from 'sinon'
import { describe, it, beforeEach, afterEach } from 'node:test'
import { traceFactory } from '../src/trace'
import { SpanNames } from '../src/constants'

describe('traceFactory', () => {
  let otel: any
  let mockSpan: any
  let trace: ReturnType<typeof traceFactory>

  beforeEach(() => {
    mockSpan = {
      setStatus: sinon.stub(),
      recordException: sinon.stub(),
      end: sinon.stub(),
    }

    otel = {
      trace: {
        getTracer: sinon.stub().returns({
          startActiveSpan: sinon.stub().callsFake((_name: string, fn: Function) => fn(mockSpan)),
        }),
        wrapSpanContext: sinon.stub().returns({ noop: true }),
      },
      INVALID_SPAN_CONTEXT: { traceId: '', spanId: '', traceFlags: 0 },
      SpanStatusCode: {
        OK: 1,
        ERROR: 2,
      },
    }

    trace = traceFactory(otel)
  })

  afterEach(() => {
    sinon.restore()
  })

  it('throws for unrecognized span name', () => {
    assert.throws(
      () => trace('invalid.span.name' as any, () => {}),
      /Unrecognized span name "invalid\.span\.name"/
    )
  })

  it('calls fn with real span and sets OK status', () => {
    const result = trace(SpanNames.ADAPTER_PROCESS, (span) => {
      assert.strictEqual(span, mockSpan)
      return 42
    })

    assert.strictEqual(result, 42)
    assert.ok(mockSpan.setStatus.calledOnceWith({ code: otel.SpanStatusCode.OK }))
    assert.ok(mockSpan.end.calledOnce)
  })

  it('calls fn with noop span if span is disabled', () => {
    const originalEnv = process.env.AGENTS_TELEMETRY_DISABLED_SPAN_CATEGORIES
    process.env.AGENTS_TELEMETRY_DISABLED_SPAN_CATEGORIES = 'STORAGE'

    // Clear module caches so category re-evaluates disabled spans
    delete require.cache[require.resolve('../src/category')]
    delete require.cache[require.resolve('../src/trace')]

    const { traceFactory: factory } = require('../src/trace')
    const localTrace = factory(otel) as ReturnType<typeof traceFactory>

    const noopSpan = { noop: true }
    otel.trace.wrapSpanContext.returns(noopSpan)

    const result = localTrace(SpanNames.STORAGE_READ, (span) => {
      assert.strictEqual(span, noopSpan)
      return 'noop-result'
    })

    assert.strictEqual(result, 'noop-result')
    assert.ok(otel.trace.wrapSpanContext.calledOnceWith(otel.INVALID_SPAN_CONTEXT))
    assert.ok(otel.trace.getTracer.notCalled)

    // Restore env and module caches
    process.env.AGENTS_TELEMETRY_DISABLED_SPAN_CATEGORIES = originalEnv ?? ''
    delete require.cache[require.resolve('../src/category')]
    delete require.cache[require.resolve('../src/trace')]
  })

  it('records exception and sets ERROR status on throw', () => {
    const error = new Error('test error')

    assert.throws(
      () => trace(SpanNames.ADAPTER_PROCESS, () => { throw error }),
      (err) => err === error
    )

    assert.ok(mockSpan.recordException.calledOnceWith(error))
    assert.ok(mockSpan.setStatus.calledOnceWith({
      code: otel.SpanStatusCode.ERROR,
      message: 'test error',
    }))
    assert.ok(mockSpan.end.calledOnce)
  })

  it('records non-Error exception with string conversion', () => {
    assert.throws(
      () => trace(SpanNames.ADAPTER_PROCESS, () => { throw 'string error' }), // eslint-disable-line no-throw-literal
      (err) => err === 'string error'
    )

    assert.ok(mockSpan.recordException.calledOnceWith({ name: 'string', message: 'string error' }))
    assert.ok(mockSpan.setStatus.calledOnceWith({
      code: otel.SpanStatusCode.ERROR,
      message: 'string error',
    }))
    assert.ok(mockSpan.end.calledOnce)
  })

  it('handles async fn and sets OK status', async () => {
    const result = await trace(SpanNames.ADAPTER_PROCESS, async (span) => {
      assert.strictEqual(span, mockSpan)
      return 'async-result'
    })

    assert.strictEqual(result, 'async-result')
    assert.ok(mockSpan.setStatus.calledOnceWith({ code: otel.SpanStatusCode.OK }))
    assert.ok(mockSpan.end.calledOnce)
  })

  it('handles async fn rejection', async () => {
    const error = new Error('async error')

    await assert.rejects(
      () => trace(SpanNames.ADAPTER_PROCESS, async () => { throw error }),
      (err: unknown) => err === error
    )

    assert.ok(mockSpan.recordException.calledOnceWith(error))
    assert.ok(mockSpan.setStatus.calledOnceWith({
      code: otel.SpanStatusCode.ERROR,
      message: 'async error',
    }))
    assert.ok(mockSpan.end.calledOnce)
  })
})
