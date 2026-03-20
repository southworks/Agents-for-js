// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { OTel, OTelLogs } from "./types.js";
import { traceFactory } from './trace.js'
import { loggerFactory } from './logging.js'

export * from './constants.js'
export * from './logging.js'

export type { TracedMethodConfig } from './trace.js'

/**
 * Will contain the OpenTelemetry API if it's available, otherwise will contain a fallback implementation that allows agents-telemetry to function without OpenTelemetry support.
 */
export const otel = await load()
const otelLogs = await loadLogs()

export const createTracedDecorator = traceFactory(otel)
export const createLogger = loggerFactory(otelLogs)


/**
 * Attempts to load the OpenTelemetry API. First tries to load the official '@opentelemetry/api' package, and if that fails (e.g., because it's not installed), it falls back to a bundled version provided by '@microsoft/agents-opentelemetry-api'. This allows agents-telemetry to operate in environments where OpenTelemetry is not present, while still enabling full functionality when it is.
 * @returns The OpenTelemetry API if available, otherwise a fallback implementation.
 */
async function load(): Promise<OTel> {
  try {
    return await import('@opentelemetry/api')
  } catch (error) {
    // TODO: falling back dep, add version reference
    console.warn('[agents-telemetry] Missing OpenTelemetry API. Falling back to bundled version. To enable full functionality, install @opentelemetry/api as a dependency.')
    return await import('@microsoft/agents-opentelemetry-api')
  }
}

async function loadLogs(): Promise<OTelLogs> {
  try {
    return await import('@opentelemetry/api-logs')
  } catch (error) {
    // TODO: falling back dep, add version reference
    console.warn('[agents-telemetry] Missing OpenTelemetry Logs API. Falling back to bundled version. To enable full functionality, install @opentelemetry/api-logs as a dependency.')
    return await import('@microsoft/agents-opentelemetry-api-logs')
  }
}
