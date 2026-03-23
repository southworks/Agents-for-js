// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { OTel, OTelLogs } from "./types";
import { traceFactory, traceFactory2, startManagedSpan } from './trace'
import { loggerFactory } from './logging'

export * from './constants'
export * from './logging'

export type { TracedMethodConfig, ManagedSpanOptions, ManagedSpanResult } from './trace'

/**
 * Will contain the OpenTelemetry API if it's available, otherwise will contain a fallback implementation that allows agents-telemetry to function without OpenTelemetry support.
 */
export const otel = load()
const otelLogs = loadLogs()

export const trace = traceFactory2(otel)

export const managedSpan = startManagedSpan(otel)

export const createTracedDecorator = traceFactory(otel)
export const createLogger = loggerFactory(otelLogs)

/**
 * Attempts to load the OpenTelemetry API. First tries to load the official '@opentelemetry/api' package, and if that fails (e.g., because it's not installed), it falls back to a bundled version provided by '@microsoft/agents-opentelemetry-api'. This allows agents-telemetry to operate in environments where OpenTelemetry is not present, while still enabling full functionality when it is.
 * @returns The OpenTelemetry API if available, otherwise a fallback implementation.
 */
function load(): OTel {
  try {
    return require('@opentelemetry/api')
  } catch (error) {
    console.warn('[agents-telemetry] Missing OpenTelemetry API. Falling back to bundled version. To enable full functionality, install @opentelemetry/api as a dependency.')
    return require('@microsoft/agents-opentelemetry-api')
  }
}

function loadLogs(): OTelLogs {
  try {
    return require('@opentelemetry/api-logs')
  } catch (error) {
    console.warn('[agents-telemetry] Missing OpenTelemetry Logs API. Falling back to bundled version. To enable full functionality, install @opentelemetry/api-logs as a dependency.')
    return require('@microsoft/agents-opentelemetry-api-logs')
  }
}
