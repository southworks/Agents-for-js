// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { otel, MetricNames } from '@microsoft/agents-telemetry'
import { name, version } from '../../package.json'

const meter = otel.metrics.getMeter(name, version)
export const CopilotStudioClientMetrics = {
  // Counters
  activitiesReceivedCounter: meter.createCounter(MetricNames.CSC_ACTIVITIES_RECEIVED, {
    unit: 'activities',
    description: 'Total number of activities received by the Copilot Studio client'
  }),

  activitiesSentCounter: meter.createCounter(MetricNames.CSC_ACTIVITIES_SENT, {
    unit: 'activities',
    description: 'Total number of activities sent to Copilot Studio'
  }),

  conversationsStartedCounter: meter.createCounter(MetricNames.CSC_CONVERSATIONS_STARTED, {
    unit: 'conversations',
    description: 'Total number of conversations started with Copilot Studio'
  }),

  webchatConnectionsCounter: meter.createCounter(MetricNames.CSC_WEBCHAT_CONNECTIONS, {
    unit: 'connections',
    description: 'Total number of webchat connections created with Copilot Studio'
  }),

  requestsCounter: meter.createCounter(MetricNames.CSC_REQUEST_COUNT, {
    unit: 'requests',
    description: 'Total number of HTTP/SSE requests made to Copilot Studio'
  }),

  requestsErrorCounter: meter.createCounter(MetricNames.CSC_REQUEST_ERRORS, {
    unit: 'requests',
    description: 'Total number of failed requests to Copilot Studio'
  }),

  executeStreamingCounter: meter.createCounter(MetricNames.CSC_EXECUTE_STREAMING, {
    unit: 'operations',
    description: 'Total number of execute streaming operations'
  }),

  subscribeAsyncCounter: meter.createCounter(MetricNames.CSC_SUBSCRIBE_ASYNC, {
    unit: 'operations',
    description: 'Total number of subscribeAsync operations'
  }),

  subscribeEventCounter: meter.createCounter(MetricNames.CSC_SUBSCRIBE_EVENT, {
    unit: 'events',
    description: 'Total number of events received via subscribeAsync'
  }),

  // Duration Histograms
  streamDuration: meter.createHistogram(MetricNames.CSC_STREAM_DURATION, {
    unit: 'ms',
    description: 'Duration of SSE stream sessions in milliseconds'
  }),

  requestDuration: meter.createHistogram(MetricNames.CSC_REQUEST_DURATION, {
    unit: 'ms',
    description: 'Duration of requests to Copilot Studio in milliseconds'
  })
}
