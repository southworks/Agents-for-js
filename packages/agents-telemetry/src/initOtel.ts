// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const LIBRARY_NAME = 'Agents SDK'

let otelApi: typeof import('@opentelemetry/api') | undefined
let resolveAttempted = false
let importOverride: (() => Promise<typeof import('@opentelemetry/api') | undefined>) | undefined

export async function loadOtelApi (): Promise<typeof import('@opentelemetry/api') | undefined> {
  if (resolveAttempted) return otelApi
  resolveAttempted = true
  try {
    otelApi = importOverride
      ? await importOverride()
      : require('@opentelemetry/api') as typeof import('@opentelemetry/api')
  } catch {
    console.warn(
      `[${LIBRARY_NAME}] @opentelemetry/api is not installed. ` +
      'Telemetry is disabled. To enable instrumentation, install it:\n\n' +
      '  npm install @opentelemetry/api\n'
    )
  }

  return otelApi
}

/**
 * @internal
 * Resets the internal module state for testing purposes.
 * Allows tests to simulate scenarios where `@opentelemetry/api` is not installed.
 *
 * @param options.mockImport - Optional function to override the dynamic import behavior
 */
export function _resetForTesting (options?: {
  mockImport?: () => Promise<typeof import('@opentelemetry/api') | undefined>
}): void {
  otelApi = undefined
  resolveAttempted = false
  importOverride = options?.mockImport
}
