// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { MetricNames } from '@microsoft/agents-telemetry'
import { metrics, trace } from '@opentelemetry/api'

export class CopilotStudioClientMetrics {
  public static tracer = trace.getTracer('OTelAgent', '1.0.0')
  private static meter = metrics.getMeter('OTelAgent', '1.0.0')

  // Counters
  public static activitiesReceivedCounter = this.meter.createCounter(MetricNames.CSC_ACTIVITIES_RECEIVED, {
    unit: 'activities',
    description: 'Total number of activities received by the Copilot Studio client'
  })

  public static activitiesSentCounter = this.meter.createCounter(MetricNames.CSC_ACTIVITIES_SENT, {
    unit: 'activities',
    description: 'Total number of activities sent to Copilot Studio'
  })

  public static conversationsStartedCounter = this.meter.createCounter(MetricNames.CSC_CONVERSATIONS_STARTED, {
    unit: 'conversations',
    description: 'Total number of conversations started with Copilot Studio'
  })

  public static webchatConnectionsCounter = this.meter.createCounter(MetricNames.CSC_WEBCHAT_CONNECTIONS, {
    unit: 'connections',
    description: 'Total number of webchat connections created with Copilot Studio'
  })

  public static requestsCounter = this.meter.createCounter(MetricNames.CSC_REQUEST_COUNT, {
    unit: 'requests',
    description: 'Total number of HTTP/SSE requests made to Copilot Studio'
  })

  public static requestsErrorCounter = this.meter.createCounter(MetricNames.CSC_REQUEST_ERRORS, {
    unit: 'requests',
    description: 'Total number of failed requests to Copilot Studio'
  })

  // Duration Histograms
  public static streamDuration = this.meter.createHistogram(MetricNames.CSC_STREAM_DURATION, {
    unit: 'ms',
    description: 'Duration of SSE stream sessions in milliseconds'
  })

  public static requestDuration = this.meter.createHistogram(MetricNames.CSC_REQUEST_DURATION, {
    unit: 'ms',
    description: 'Duration of requests to Copilot Studio in milliseconds'
  })
}
