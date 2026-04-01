// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import assert from 'assert'
import sinon from 'sinon'
import { beforeEach, afterEach, describe, it } from 'node:test'
import { SpanNames } from '../src/constants'

describe('isSpanDisabled', () => {
  let originalEnv = process.env
  let warnStub: sinon.SinonStub<unknown[], unknown> | sinon.SinonStub<any[], any>
  let debugStub: sinon.SinonStub<any[], any> | sinon.SinonStub<unknown[], unknown>

  beforeEach(() => {
    // Store original environment variables
    originalEnv = { ...process.env }
    // Reset environment variables before each test
    process.env.AGENTS_TELEMETRY_DISABLED_SPAN_CATEGORIES = ''
    // Clear the require cache for category and logger
    delete require.cache[require.resolve('../src/category')]
    delete require.cache[require.resolve('../src/utils/logger')]
    // Stub logger methods
    const logger = require('../src/utils/logger').logger
    debugStub = sinon.stub(logger, 'debug')
    warnStub = sinon.stub(logger, 'warn')
  })

  afterEach(() => {
    // Restore original environment variables
    process.env = originalEnv
    debugStub.restore()
    warnStub.restore()
    delete require.cache[require.resolve('../src/category')]
    delete require.cache[require.resolve('../src/utils/logger')]
  })

  it('returns false if no env var set', () => {
    const { isSpanDisabled } = require('../src/category')
    assert.strictEqual(isSpanDisabled(SpanNames.STORAGE_READ), false)
  })

  it('returns false if category is invalid', () => {
    process.env.AGENTS_TELEMETRY_DISABLED_SPAN_CATEGORIES = 'INVALID'
    const { isSpanDisabled } = require('../src/category')
    assert.strictEqual(isSpanDisabled(SpanNames.STORAGE_READ), false)
    assert.ok(warnStub.calledOnce)
  })

  it('disables all spans in a valid category', () => {
    process.env.AGENTS_TELEMETRY_DISABLED_SPAN_CATEGORIES = 'STORAGE'
    const { isSpanDisabled } = require('../src/category')
    assert.strictEqual(isSpanDisabled(SpanNames.STORAGE_READ), true)
    assert.strictEqual(isSpanDisabled(SpanNames.STORAGE_WRITE), true)
    assert.strictEqual(isSpanDisabled(SpanNames.STORAGE_DELETE), true)
    assert.strictEqual(isSpanDisabled(SpanNames.AGENTS_APP_RUN), false)
    assert.ok(debugStub.calledWithMatch(sinon.match.string, sinon.match.array))
  })

  it('handles multiple categories (comma/space separated)', () => {
    process.env.AGENTS_TELEMETRY_DISABLED_SPAN_CATEGORIES = 'STORAGE,AUTHENTICATION'
    const { isSpanDisabled } = require('../src/category')
    assert.strictEqual(isSpanDisabled(SpanNames.STORAGE_READ), true)
    assert.strictEqual(isSpanDisabled(SpanNames.AUTHENTICATION_GET_ACCESS_TOKEN), true)
    assert.strictEqual(isSpanDisabled(SpanNames.AGENTS_APP_RUN), false)
  })

  it('is case-insensitive and trims whitespace', () => {
    process.env.AGENTS_TELEMETRY_DISABLED_SPAN_CATEGORIES = '  storage  '
    const { isSpanDisabled } = require('../src/category')
    assert.strictEqual(isSpanDisabled(SpanNames.STORAGE_READ), true)
  })

  it('does not duplicate disabled spans for overlapping prefixes', () => {
    process.env.AGENTS_TELEMETRY_DISABLED_SPAN_CATEGORIES = 'AUTHORIZATION'
    const { isSpanDisabled } = require('../src/category')
    // Both AUTHORIZATION_ and USER_TOKEN_CLIENT_ prefixes
    assert.strictEqual(isSpanDisabled(SpanNames.AUTHORIZATION_AGENTIC_TOKEN), true)
    assert.strictEqual(isSpanDisabled(SpanNames.USER_TOKEN_CLIENT_GET_USER_TOKEN), true)
  })
})
