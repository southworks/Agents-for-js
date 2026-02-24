// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import type { Tracer, SpanStatusCode as SpanStatusCodeType, PropagationAPI, ContextAPI } from '@opentelemetry/api'

export interface OTelModules {
  tracer: Tracer
  SpanStatusCode: typeof SpanStatusCodeType
  propagation: PropagationAPI
  context: ContextAPI
}

let otelPromise: Promise<OTelModules> | null = null

/*
 * Initializes OpenTelemetry by dynamically importing the API and setting up the tracer.
 */
export function initTelemetry (options?: { serviceName?: string }): void {
  const serviceName = options?.serviceName ?? 'microsoft-agents'
  otelPromise = import('@opentelemetry/api')
    .then((api) => ({
      tracer: api.trace.getTracer(serviceName),
      SpanStatusCode: api.SpanStatusCode,
      propagation: api.propagation,
      context: api.context,
    }))
    .catch(() => {
      otelPromise = null
      throw new Error(
        '@opentelemetry/api is not available. Install it to enable tracing.'
      )
    })
}

export function getOtel (): Promise<OTelModules> | null {
  return otelPromise
}
