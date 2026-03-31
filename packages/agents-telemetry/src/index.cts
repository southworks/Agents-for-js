// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

/**
 * CommonJS entrypoint for agents-telemetry. This file exists alongside index.mts so the package can ship
 * both CommonJS and ESM builds: CommonJS consumers need synchronous require()-based loading, while the ESM
 * entrypoint uses async import() fallback loading that is only valid in an ES module.
 */

import { traceFactory } from './trace'
import { loggerFactory } from './logging'
import { loadTelemetryDependencies  } from "./utils/load";

export { SpanNames, MetricNames } from './constants'

const [_otel, logs] = loadTelemetryDependencies (
  [() => require('@opentelemetry/api'), () => require('@microsoft/agents-opentelemetry-api')],
  [() => require('@opentelemetry/api-logs'), () => require('@microsoft/agents-opentelemetry-api-logs')]
)

export const otel = _otel

export const trace = traceFactory(_otel)

export const createLogger = loggerFactory(logs)
