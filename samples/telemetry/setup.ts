// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { NodeTracerProvider, SimpleSpanProcessor, type SpanExporter } from '@opentelemetry/sdk-trace-node'
import { isTelemetryEnabled } from './config.js'

let provider: NodeTracerProvider | undefined

// Export a deliberately small summary. Raw attributes, exception events, identity,
// activity content, and resource configuration are never printed by this exporter.
const consoleSummaryExporter: SpanExporter = {
  export (spans, callback) {
    for (const span of spans) {
      const status = ['UNSET', 'OK', 'ERROR'][span.status.code]
      const durationMs = span.duration[0] * 1000 + span.duration[1] / 1_000_000
      console.log(`[sample telemetry] ${span.name} status=${status} durationMs=${durationMs.toFixed(1)}`)
    }
    callback({ code: 0 })
  },
  async shutdown () {}
}

/** Call after mode configuration and before importing SDK consumers. */
export function initializeTelemetry (): void {
  if (!isTelemetryEnabled() || provider) {
    return
  }

  provider = new NodeTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(consoleSummaryExporter)]
  })
  provider.register()
  console.log('Sample telemetry enabled: span name, status, and duration only.')
}
