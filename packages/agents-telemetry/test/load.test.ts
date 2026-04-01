// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import assert from 'assert'
import sinon from 'sinon'
import { describe, it, beforeEach } from 'node:test'
import { loadTelemetryDependencies } from '../src/utils/load'

const logger = require('../src/utils/logger').logger
const warnStub = sinon.spy(logger, 'warn')
const errorStub = sinon.spy(logger, 'error')
const primaryOtel = { api: 'otel' }
const primaryLogs = { api: 'logs' }
const fallbackOtel = { api: 'otel-fallback' }
const fallbackLogs = { api: 'logs-fallback' }

describe('loadTelemetryDependencies', () => {
  beforeEach(() => {
    warnStub.resetHistory()
    errorStub.resetHistory()
  })

  it('returns primary otel and logs if both succeed', () => {
    const [otel, logs] = loadTelemetryDependencies([
      () => primaryOtel,
      () => fallbackOtel
    ], [
      () => primaryLogs,
      () => fallbackLogs
    ])
    assert.strictEqual(otel, primaryOtel)
    assert.strictEqual(logs, primaryLogs)
    assert.ok(warnStub.notCalled)
    assert.ok(errorStub.notCalled)
  })

  it('uses fallback if primary otel fails', () => {
    const [otel, logs] = loadTelemetryDependencies([
      () => { throw new Error('fail otel') },
      () => fallbackOtel
    ], [
      () => primaryLogs,
      () => fallbackLogs
    ])
    assert.strictEqual(otel, fallbackOtel)
    assert.strictEqual(logs, primaryLogs)
    assert.ok(warnStub.calledWithMatch('Missing OpenTelemetry API'))
    assert.ok(errorStub.notCalled)
  })

  it('uses fallback if primary logs fails', () => {
    const [otel, logs] = loadTelemetryDependencies([
      () => primaryOtel,
      () => { throw new Error('should not be called') }
    ], [
      () => { throw new Error('fail logs') },
      () => fallbackLogs
    ])
    assert.strictEqual(otel, primaryOtel)
    assert.strictEqual(logs, fallbackLogs)
    assert.ok(warnStub.calledWithMatch('Missing OpenTelemetry Logs API'))
    assert.ok(errorStub.notCalled)
  })

  it('throws if both primary and fallback otel fail', () => {
    const fallbackOtelError = new Error('fallback otel fail')
    assert.throws(() => {
      loadTelemetryDependencies([
        () => { throw new Error('fail otel') },
        () => { throw fallbackOtelError }
      ], [
        () => fallbackLogs,
        () => fallbackLogs
      ])
    }, fallbackOtelError)
    assert.ok(warnStub.calledWithMatch('Missing OpenTelemetry API'))
    assert.ok(errorStub.calledWithMatch('Failed to load bundled OpenTelemetry API fallback'))
  })

  it('throws if both primary and fallback logs fail', () => {
    const fallbackLogsError = new Error('fallback logs fail')
    assert.throws(() => {
      loadTelemetryDependencies([
        () => primaryOtel,
        () => primaryOtel
      ], [
        () => { throw new Error('fail logs') },
        () => { throw fallbackLogsError }
      ])
    }, fallbackLogsError)
    assert.ok(warnStub.calledWithMatch('Missing OpenTelemetry Logs API'))
    assert.ok(errorStub.calledWithMatch('Failed to load bundled OpenTelemetry Logs API fallback'))
  })
})
