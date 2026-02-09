// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { NodeSDK } from '@opentelemetry/sdk-node'
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node'
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http'
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express'
import { AzureMonitorMetricExporter, AzureMonitorTraceExporter } from '@azure/monitor-opentelemetry-exporter'
import {
  PeriodicExportingMetricReader,
  ConsoleMetricExporter,
} from '@opentelemetry/sdk-metrics'
import { resourceFromAttributes } from '@opentelemetry/resources'
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions'
import { ParentBasedSampler, AlwaysOnSampler } from '@opentelemetry/sdk-trace-base'

const connectionString = process.env['APPLICATIONINSIGHTS_CONNECTION_STRING'] || ''
let traceExporter: any
let metricExporter: any

// Use Azure Monitor Exporter if connection string is provided, otherwise use Console Exporter.
if (connectionString.trim() !== '') {
  traceExporter = new AzureMonitorTraceExporter({
    connectionString,
  })
  metricExporter = new AzureMonitorMetricExporter({ connectionString })
} else {
  traceExporter = new ConsoleSpanExporter()
  metricExporter = new ConsoleMetricExporter()
}

const metricsExportInterval = Number(process.env.OTEL_METRICS_EXPORT_INTERVAL) || 5000
const metricReaderOptions = { exporter: metricExporter, exportIntervalMillis: metricsExportInterval }

// configure the SDK to export telemetry data.
const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'OTelAgent',
    [ATTR_SERVICE_VERSION]: '1.0.0'
  }),
  instrumentations: [
    new HttpInstrumentation(),
    new ExpressInstrumentation(),
  ],
  traceExporter,
  metricReader: new PeriodicExportingMetricReader(metricReaderOptions),
  sampler: new ParentBasedSampler({
    root: new AlwaysOnSampler(),
    remoteParentNotSampled: new AlwaysOnSampler(),
  }),

})

sdk.start()
