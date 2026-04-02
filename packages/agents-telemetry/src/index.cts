/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { OTel, OTelLogs } from './types.js'
import { factory } from './factory.js'
import { createDebugLogger } from './loggers/debug.js'

export { SpanNames, MetricNames } from './traces/constants.js'

const logger = createDebugLogger('agents:telemetry')

/**
 * Will contain the OpenTelemetry API if it's available, otherwise will contain a fallback implementation that allows agents-telemetry to function without OpenTelemetry support.
 */
export const otel = load()
const otelLogs = loadLogs()

export const { trace, debug } = factory(otel, otelLogs)

/**
 * Attempts to load the OpenTelemetry API. First tries to load the official '@opentelemetry/api' package, and if that fails (e.g., because it's not installed), it falls back to a bundled version provided by '@microsoft/agents-opentelemetry-api'. This allows agents-telemetry to operate in environments where OpenTelemetry is not present, while still enabling full functionality when it is.
 * @returns The OpenTelemetry API if available, otherwise a fallback implementation.
 */
function load (): OTel {
  try {
    return require('@opentelemetry/api')
  } catch {
    logger.warn('Missing OpenTelemetry API. Falling back to bundled version. To enable full functionality, install @opentelemetry/api as a dependency.')
    try {
      return require('@microsoft/agents-opentelemetry-api')
    } catch (fallbackError) {
      logger.error('Failed to load bundled OpenTelemetry API fallback.')
      throw fallbackError
    }
  }
}

function loadLogs (): OTelLogs {
  try {
    return require('@opentelemetry/api-logs')
  } catch {
    logger.warn('Missing OpenTelemetry Logs API. Falling back to bundled version. To enable full functionality, install @opentelemetry/api-logs as a dependency.')
    try {
      return require('@microsoft/agents-opentelemetry-api-logs')
    } catch (fallbackError) {
      logger.error('Failed to load bundled OpenTelemetry Logs API fallback.')
      throw fallbackError
    }
  }
}
