// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export type * from '@microsoft/agents-opentelemetry-api'

/**
 * Will contain the OpenTelemetry API if it's available, otherwise will contain a fallback implementation that allows agents-telemetry to function without OpenTelemetry support.
 */
export const otel = await load()

/**
 * Attempts to load the OpenTelemetry API. First tries to load the official '@opentelemetry/api' package, and if that fails (e.g., because it's not installed), it falls back to a bundled version provided by '@microsoft/agents-opentelemetry-api'. This allows agents-telemetry to operate in environments where OpenTelemetry is not present, while still enabling full functionality when it is.
 * @returns The OpenTelemetry API if available, otherwise a fallback implementation.
 */
async function load (): Promise<typeof import('@microsoft/agents-opentelemetry-api')> {
  try {
    // @ts-ignore-next-line - We want to try loading the official OpenTelemetry API first, but it may not be present in all environments where agents-telemetry is used, so we ignore TypeScript errors here.
    return await import('@opentelemetry/api')
  } catch (error) {
    // TODO: add agents-activity logger warning here about missing OpenTelemetry API and how to add it as a dependency
    return await import('@microsoft/agents-opentelemetry-api')
  }
}
