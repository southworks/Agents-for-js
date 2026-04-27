// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NodeSDK } from '@opentelemetry/sdk-node'
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc'
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc'
import {
  PeriodicExportingMetricReader,
  ConsoleMetricExporter,
  PushMetricExporter,
} from '@opentelemetry/sdk-metrics'
import { resourceFromAttributes } from '@opentelemetry/resources'
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions'
import { SpanExporter } from '@opentelemetry/sdk-trace-base'
import { credentials as grpcCredentials } from '@grpc/grpc-js'

import { LoggerProvider, BatchLogRecordProcessor } from '@opentelemetry/sdk-logs'
import { logs } from '@opentelemetry/api-logs'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-grpc'

const rawEndpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] || ''
const otlpEndpoint = rawEndpoint.replace('http://localhost:18889', 'https://localhost:18889')
const sampleDir = dirname(fileURLToPath(import.meta.url))
const localCertPath = join(sampleDir, 'aspire-dev-cert.pem')
const defaultCertPath = existsSync(localCertPath)
  ? localCertPath
  : join(process.env.TEMP || '', 'aspire-dev-cert.pem')
const certPath = process.env.OTEL_EXPORTER_OTLP_CERT_PATH || defaultCertPath

const exporterOptions: { url: string, credentials?: ReturnType<typeof grpcCredentials.createSsl> } = {
  url: otlpEndpoint
}

if (otlpEndpoint.startsWith('https://') && existsSync(certPath)) {
  exporterOptions.credentials = grpcCredentials.createSsl(readFileSync(certPath))
}

let traceExporter: SpanExporter
let metricExporter: PushMetricExporter

// Logs exporter setup
let logExporter: OTLPLogExporter

// Use OTLP gRPC Exporter if endpoint is provided, otherwise use Console Exporter.
if (otlpEndpoint.trim() !== '') {
  traceExporter = new OTLPTraceExporter(exporterOptions)
  metricExporter = new OTLPMetricExporter(exporterOptions)
  logExporter = new OTLPLogExporter(exporterOptions)
} else {
  traceExporter = new ConsoleSpanExporter() as any
  metricExporter = new ConsoleMetricExporter()
  // Console log exporter is not available in OTel JS, so skip logs if no endpoint
  logExporter = undefined as any
}

const rawMetricsExportInterval = Number(process.env.OTEL_METRICS_EXPORT_INTERVAL)
const metricsExportInterval =
  Number.isFinite(rawMetricsExportInterval) && rawMetricsExportInterval > 0
    ? rawMetricsExportInterval
    : 5000
const metricReaderOptions = { exporter: metricExporter, exportIntervalMillis: metricsExportInterval }

// configure the SDK to export telemetry data.
const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'EmptyAgent',
    [ATTR_SERVICE_VERSION]: '1.0.0'
  }),
  traceExporter,
  metricReader: new PeriodicExportingMetricReader(metricReaderOptions)

})

// Set up LoggerProvider for logs
if (logExporter) {
  const loggerProvider = new LoggerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: 'EmptyAgent',
      [ATTR_SERVICE_VERSION]: '1.0.0'
    }),
    processors: [new BatchLogRecordProcessor(logExporter)]
  })
  logs.setGlobalLoggerProvider(loggerProvider)

  // Graceful shutdown for logs
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => loggerProvider.shutdown().catch(console.error))
  }
}

sdk.start()
