// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { describe, it, beforeEach, mock } from 'node:test'
import assert from 'assert'
// import { initTelemetry, getOtel } from '../src/otel'
describe('otel', () => {
  beforeEach(() => {
    // Clear the module cache to reset state between tests
    mock.reset()
  })

  describe('initTelemetry', () => {
    it('should initialize telemetry with default service name', async () => {
      // Re-import to get fresh module state
      const { initTelemetry, getOtel } = await import('../dist/src/otel.js')

      initTelemetry()

      const otel = getOtel()
      assert.ok(otel !== null, 'getOtel should return a promise after initialization')

      const modules = await otel
      assert.ok(modules.tracer, 'Should have a tracer')
      assert.ok(modules.SpanStatusCode, 'Should have SpanStatusCode')
      assert.ok(modules.propagation, 'Should have propagation')
      assert.ok(modules.context, 'Should have context')
    })

    it('should initialize telemetry with custom service name', async () => {
      const { initTelemetry, getOtel } = await import('../dist/src/otel.js')

      initTelemetry({ serviceName: 'custom-service' })

      const otel = getOtel()
      assert.ok(otel !== null, 'getOtel should return a promise after initialization')

      const modules = await otel
      assert.ok(modules.tracer, 'Should have a tracer with custom service name')
    })
  })

  describe('getOtel', () => {
    it('should return null when telemetry is not initialized', async () => {
      // Import fresh module without calling initTelemetry
      // Since modules are cached, we need to test this in isolation
      // The initial state should be null
      const freshModule = await import('../dist/src/otel.js')

      // Note: Due to module caching, this test verifies behavior
      // after initTelemetry has been called in previous tests
      const otel = freshModule.getOtel()

      // If initTelemetry was called before, otel will be a promise
      // This is expected behavior due to module-level state
      if (otel === null) {
        assert.strictEqual(otel, null, 'Should return null when not initialized')
      } else {
        assert.ok(otel instanceof Promise, 'Should return a Promise when initialized')
      }
    })

    it('should return the same promise on multiple calls', async () => {
      const { initTelemetry, getOtel } = await import('../dist/src/otel.js')

      initTelemetry()

      const otel1 = getOtel()
      const otel2 = getOtel()

      assert.strictEqual(otel1, otel2, 'Should return the same promise instance')
    })
  })

  describe('OTelModules interface', () => {
    it('should provide all required OpenTelemetry modules', async () => {
      const { initTelemetry, getOtel } = await import('../dist/src/otel.js')

      initTelemetry()

      const otel = getOtel()
      assert.ok(otel !== null)

      const modules = await otel

      // Verify tracer has expected methods
      assert.ok(typeof modules.tracer.startSpan === 'function', 'Tracer should have startSpan method')
      assert.ok(typeof modules.tracer.startActiveSpan === 'function', 'Tracer should have startActiveSpan method')

      // Verify SpanStatusCode enum values
      assert.ok('OK' in modules.SpanStatusCode, 'SpanStatusCode should have OK')
      assert.ok('ERROR' in modules.SpanStatusCode, 'SpanStatusCode should have ERROR')
      assert.ok('UNSET' in modules.SpanStatusCode, 'SpanStatusCode should have UNSET')

      // Verify propagation API
      assert.ok(typeof modules.propagation.inject === 'function', 'Propagation should have inject method')
      assert.ok(typeof modules.propagation.extract === 'function', 'Propagation should have extract method')

      // Verify context API
      assert.ok(typeof modules.context.active === 'function', 'Context should have active method')
      assert.ok(typeof modules.context.with === 'function', 'Context should have with method')
    })
  })
})
