/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import type { Metric, TraceFunction } from '../types.js'

const noopFn = () => {}

/**
 * No-op trace implementation used when tracing is unavailable or disabled.
 */
export const noopTrace = function (target, callback) {
  return noopContext(callback)
} as TraceFunction

noopTrace.define = definition => definition

/**
 * No-op metric implementation used when the OTel metrics API is unavailable.
 */
export function noopMetric (): Metric {
  return {
    histogram: () => ({ record: noopFn }),
    counter: () => ({ add: noopFn }),
  }
}

/**
 * Creates a callback/manually-managed trace context that safely does nothing.
 */
export function noopContext (callback: Function) {
  const actions = new Proxy({}, { get: () => noopFn })

  if (callback) {
    return callback({ record: noopFn, actions })
  }

  return {
    record: noopFn,
    actions,
    end: noopFn,
    fail: (error: unknown) => error,
  }
}
