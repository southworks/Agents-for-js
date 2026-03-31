/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { Logger } from './loggers/base'
import { createDebugLogger, link } from './loggers/debug'
import { createOTelLogger } from './loggers/otel'
import { OTel, OTelLogs, Span, SpanName } from './types'
import { SpanNames } from './traces/constants'
import { createSpanTracer } from './traces/trace'

interface Factory {
  /**
   * Creates a logger that links a debug logger with an OpenTelemetry logger for the given namespace. The returned logger will log to both the debug logger and the OpenTelemetry logger, allowing for flexible logging that can be viewed in different ways depending on the environment and configuration.
   * @param namespace The namespace for the logger, which is used to categorize log messages. This should typically be the name of the component or module that is doing the logging.
   * @returns A logger that links a debug logger with an OpenTelemetry logger for the given namespace.
   */
  debug(namespace: string): Logger
  /**
   * Creates a span tracer that wraps the provided function with OpenTelemetry span creation and error handling. The span will be created with the given name, and the provided function will be executed within the context of that span. If the function throws an error, it will be recorded in the span and re-thrown. The span will be ended after the function completes, regardless of whether it threw an error or not.
   * @param name The name of the span to create. This should typically be a constant from the `SpanNames` object to ensure consistency across the codebase.
   * @param fn The function to execute within the context of the created span. This function receives the created span as an argument, allowing it to add attributes, events, or record exceptions as needed.
   * @returns The return value of the provided function `fn`. If the function throws an error, that error will be re-thrown after being recorded in the span.
   */
  trace<TReturn>(name: SpanName, fn: (span: Span) => TReturn): TReturn
}

/**
 * Factory function to create loggers and tracers for the Agents SDK using OpenTelemetry and debug.
 */
export function factory (otel: OTel, otelLogs: OTelLogs): Factory {
  const validSpanNames = new Set(Object.values(SpanNames))
  return {
    debug (namespace: string): Logger {
      const debugLogger = createDebugLogger(namespace)
      const otelLogger = createOTelLogger(otelLogs, namespace)

      return link(debugLogger, otelLogger)
    },
    trace<TReturn>(name: SpanName, fn: (span: Span) => TReturn): TReturn {
      if (!validSpanNames.has(name)) {
        throw new Error(`Unrecognized span name "${name}". See SpanNames constants.`)
      }

      return createSpanTracer(otel, name, fn)
    }
  }
}
