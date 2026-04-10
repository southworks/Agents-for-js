/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { AttemptOptions } from '../types.js'

/**
 * Detects promise-like values returned by internal loaders and callbacks.
 */
export function isPromise<T> (value: T | Promise<T>): value is Promise<T> {
  return (
    (typeof value === 'object' || typeof value === 'function') &&
    value !== null &&
    'then' in value &&
    typeof value.then === 'function'
  )
}

/**
 * Runs a callback and normalizes sync and async error/finally handling.
 *
 * @remarks
 * - Async results use the returned promise chain for `catch` and `finally`.
 * - Sync failures are passed to `catch` and do not rethrow automatically.
 */
export function attempt<TResult> (options: AttemptOptions<Promise<TResult>>): Promise<TResult>
export function attempt<TResult> (options: AttemptOptions<TResult>): TResult
export function attempt<TResult> (options: AttemptOptions<TResult>) {
  let isAsync = false
  try {
    const result = options.try()

    if (isPromise(result)) {
      isAsync = true
      return result
        .catch(options.catch)
        .finally(options.finally)
    }

    return result
  } catch (error) {
    options.catch(error)
  } finally {
    !isAsync && options.finally?.()
  }
}
