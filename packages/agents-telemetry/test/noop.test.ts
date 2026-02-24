// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { describe, it } from 'node:test'
import assert from 'assert'
import { noopSpan } from '../dist/src/noop.js'

describe('noop', () => {
  describe('noopSpan', () => {
    describe('spanContext', () => {
      it('should return a valid SpanContext with empty values', () => {
        const context = noopSpan.spanContext()

        assert.strictEqual(context.traceId, '', 'traceId should be empty string')
        assert.strictEqual(context.spanId, '', 'spanId should be empty string')
        assert.strictEqual(context.traceFlags, 0, 'traceFlags should be 0')
      })

      it('should return the same context on multiple calls', () => {
        const context1 = noopSpan.spanContext()
        const context2 = noopSpan.spanContext()

        assert.strictEqual(context1, context2, 'Should return the same SpanContext instance')
      })
    })

    describe('isRecording', () => {
      it('should return false', () => {
        assert.strictEqual(noopSpan.isRecording(), false, 'isRecording should return false')
      })
    })

    describe('chaining methods', () => {
      it('setAttribute should return noopSpan for chaining', () => {
        const result = noopSpan.setAttribute('key', 'value')
        assert.strictEqual(result, noopSpan, 'setAttribute should return noopSpan')
      })

      it('setAttributes should return noopSpan for chaining', () => {
        const result = noopSpan.setAttributes({ key1: 'value1', key2: 42 })
        assert.strictEqual(result, noopSpan, 'setAttributes should return noopSpan')
      })

      it('addEvent should return noopSpan for chaining', () => {
        const result = noopSpan.addEvent('event-name')
        assert.strictEqual(result, noopSpan, 'addEvent should return noopSpan')
      })

      it('addEvent with attributes should return noopSpan for chaining', () => {
        const result = noopSpan.addEvent('event-name', { attr: 'value' })
        assert.strictEqual(result, noopSpan, 'addEvent with attributes should return noopSpan')
      })

      it('setStatus should return noopSpan for chaining', () => {
        const result = noopSpan.setStatus({ code: 0 })
        assert.strictEqual(result, noopSpan, 'setStatus should return noopSpan')
      })

      it('updateName should return noopSpan for chaining', () => {
        const result = noopSpan.updateName('new-name')
        assert.strictEqual(result, noopSpan, 'updateName should return noopSpan')
      })

      it('addLink should return noopSpan for chaining', () => {
        const result = noopSpan.addLink({ context: { traceId: '', spanId: '', traceFlags: 0 } })
        assert.strictEqual(result, noopSpan, 'addLink should return noopSpan')
      })

      it('addLinks should return noopSpan for chaining', () => {
        const result = noopSpan.addLinks([{ context: { traceId: '', spanId: '', traceFlags: 0 } }])
        assert.strictEqual(result, noopSpan, 'addLinks should return noopSpan')
      })

      it('should support method chaining', () => {
        const result = noopSpan
          .setAttribute('key', 'value')
          .setAttributes({ another: 'attr' })
          .addEvent('event')
          .setStatus({ code: 0 })
          .updateName('name')
          .addLink({ context: { traceId: '', spanId: '', traceFlags: 0 } })

        assert.strictEqual(result, noopSpan, 'Method chaining should work')
      })
    })

    describe('void methods', () => {
      it('end should not throw', () => {
        assert.doesNotThrow(() => {
          noopSpan.end()
        }, 'end should not throw')
      })

      it('end with time should not throw', () => {
        assert.doesNotThrow(() => {
          noopSpan.end(Date.now())
        }, 'end with time should not throw')
      })

      it('recordException should not throw', () => {
        assert.doesNotThrow(() => {
          noopSpan.recordException(new Error('test error'))
        }, 'recordException should not throw')
      })

      it('recordException with string should not throw', () => {
        assert.doesNotThrow(() => {
          noopSpan.recordException('string error')
        }, 'recordException with string should not throw')
      })
    })

    describe('Span interface compliance', () => {
      it('should have all required Span interface methods', () => {
        assert.ok(typeof noopSpan.spanContext === 'function', 'Should have spanContext method')
        assert.ok(typeof noopSpan.setAttribute === 'function', 'Should have setAttribute method')
        assert.ok(typeof noopSpan.setAttributes === 'function', 'Should have setAttributes method')
        assert.ok(typeof noopSpan.addEvent === 'function', 'Should have addEvent method')
        assert.ok(typeof noopSpan.setStatus === 'function', 'Should have setStatus method')
        assert.ok(typeof noopSpan.updateName === 'function', 'Should have updateName method')
        assert.ok(typeof noopSpan.end === 'function', 'Should have end method')
        assert.ok(typeof noopSpan.isRecording === 'function', 'Should have isRecording method')
        assert.ok(typeof noopSpan.recordException === 'function', 'Should have recordException method')
        assert.ok(typeof noopSpan.addLink === 'function', 'Should have addLink method')
        assert.ok(typeof noopSpan.addLinks === 'function', 'Should have addLinks method')
      })
    })
  })
})
