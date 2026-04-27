/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * Browser entrypoint for agents-telemetry.
 *
 * @remarks
 * Browser bundlers such as esbuild often emit IIFE output, which cannot include top-level await.
 * This entrypoint starts with the no-op telemetry surface and upgrades to the OpenTelemetry-backed
 * implementation after the optional browser imports resolve.
 */

import type { Factory, Metric, TraceFunction } from './types.js'
import { createDebugLogger } from './loggers/debug.js'
import { index } from './index.js'
import { MetricNames, SpanNames } from './observability/constants.js'
import { noopMetric, noopTrace } from './utils/noop.js'

const fallbackMetric = noopMetric()
const fallbackTrace = noopTrace

let factory: Factory | undefined

// eslint-disable-next-line no-void
void (index({
  otel: () => import('@opentelemetry/api'),
  logs: () => import('@opentelemetry/api-logs'),
}) as Promise<Factory>).then(value => {
  factory = value
})

export {
  SpanNames,
  MetricNames,
}

export function debug (namespace: string) {
  return (factory?.debug ?? createDebugLogger)(namespace)
}

export const trace = function (definition: unknown, callback?: unknown) {
  return (factory?.trace ?? fallbackTrace)(definition as never, callback as never)
} as TraceFunction

trace.define = definition => {
  return (factory?.trace ?? fallbackTrace).define(definition)
}

export const metric: Metric = {
  histogram (...args) {
    return (factory?.metric ?? fallbackMetric).histogram(...args)
  },
  counter (...args) {
    return (factory?.metric ?? fallbackMetric).counter(...args)
  },
}
