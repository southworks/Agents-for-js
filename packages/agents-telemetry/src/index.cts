// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { OTelAPI } from "./types";
import { DecoratorFactory } from './traceDecorator'
import { createOtelLogging } from './logging'
import type { OTelLogsModule } from './logging'

export * from './constants'
export * from './logging'

export type { DecoratorContext } from './traceDecorator.js'

/**
 * Will contain the OpenTelemetry API if it's available, otherwise will contain a fallback implementation that allows agents-telemetry to function without OpenTelemetry support.
 */
export const otel = load()
const otelLogs = loadLogs()

const decoratorFactory = DecoratorFactory(otel)

export const createTracedDecorator = decoratorFactory.trace

const otelLogging = createOtelLogging(otelLogs)
export const createOtelLogger = otelLogging.createOtelLogger
export const emitOtelLoggerLog = otelLogging.emitOtelLoggerLog

/**
 * Attempts to load the OpenTelemetry API. First tries to load the official '@opentelemetry/api' package, and if that fails (e.g., because it's not installed), it falls back to a bundled version provided by '@microsoft/agents-opentelemetry-api'. This allows agents-telemetry to operate in environments where OpenTelemetry is not present, while still enabling full functionality when it is.
 * @returns The OpenTelemetry API if available, otherwise a fallback implementation.
 */
function load (): OTelAPI {
  try {
    return require('@opentelemetry/api')
  } catch (error) {
    console.warn('[agents-telemetry] Missing OpenTelemetry API. Falling back to bundled version. To enable full functionality, install @opentelemetry/api as a dependency.')
    return require('@microsoft/agents-opentelemetry-api')
  }
}

function loadLogs (): OTelLogsModule {
  try {
    return require('@opentelemetry/api-logs') as OTelLogsModule
  } catch (error) {
    console.warn('[agents-telemetry] Missing OpenTelemetry Logs API. Falling back to bundled version. To enable full functionality, install @opentelemetry/api-logs as a dependency.')
    return require('@microsoft/agents-opentelemetry-api-logs') as OTelLogsModule
  }
}
