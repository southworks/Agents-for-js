// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { TraceDecoratorFactory } from './traceDecorator'
import { createOtelLogging } from './logging'
import type { OTelLogsModule } from './logging'

export * from './constants'
export * from './logging'

/**
 * Will contain the OpenTelemetry API if it's available, otherwise will contain a fallback implementation that allows agents-telemetry to function without OpenTelemetry support.
 */
export const otel = load()
const otelLogs = loadLogs()

export const createTracedDecorator = TraceDecoratorFactory(otel)
const otelLogging = createOtelLogging(otelLogs)
export const createOtelLogger = otelLogging.createOtelLogger
export const emitOtelLoggerLog = otelLogging.emitOtelLoggerLog

/**
 * Attempts to load the OpenTelemetry API. First tries to load the official '@opentelemetry/api' package, and if that fails (e.g., because it's not installed), it falls back to a bundled version provided by '@microsoft/agents-opentelemetry-api'. This allows agents-telemetry to operate in environments where OpenTelemetry is not present, while still enabling full functionality when it is.
 * @returns The OpenTelemetry API if available, otherwise a fallback implementation.
 */
function load (): typeof import('@microsoft/agents-opentelemetry-api') {
  try {
    return require('@opentelemetry/api')
  } catch (error) {
    // TODO: add agents-activity logger warning here about missing OpenTelemetry API and how to add it as a dependency
    return require('@microsoft/agents-opentelemetry-api')
  }
}

function loadLogs (): OTelLogsModule {
  try {
    return require('@opentelemetry/api-logs') as OTelLogsModule
  } catch (error) {
    // TODO: add agents-activity logger warning here about missing OpenTelemetry Logs API and how to add it as a dependency
    return require('@microsoft/agents-opentelemetry-api-logs') as OTelLogsModule
  }
}
