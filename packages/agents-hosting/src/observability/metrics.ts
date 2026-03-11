// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { MetricNames } from '@microsoft/agents-telemetry'
import { metrics, trace } from '@opentelemetry/api'

export class HostingMetrics {
  public static tracer = trace.getTracer('OTelAgent', '1.0.0')
  private static meter = metrics.getMeter('OTelAgent', '1.0.0')

  // Counters
  public static activitiesReceivedCounter = this.meter.createCounter(MetricNames.ACTIVITIES_RECEIVED, {
    unit: 'activities',
    description: 'Total number of activities received by the adapter'
  })

  public static activitiesSentCounter = this.meter.createCounter(MetricNames.ACTIVITIES_SENT, {
    unit: 'activities',
    description: 'Total number of outbound activities sent by the adapter'
  })

  public static activitiesUpdatedCounter = this.meter.createCounter(MetricNames.ACTIVITIES_UPDATED, {
    unit: 'activities',
    description: 'Total number of activities updated by the adapter'
  })

  public static activitiesDeletedCounter = this.meter.createCounter(MetricNames.ACTIVITIES_DELETED, {
    unit: 'activities',
    description: 'Total number of activities deleted by the adapter'
  })

  public static connectorRequestsCounter = this.meter.createCounter(MetricNames.CONNECTOR_REQUESTS, {
    unit: 'request',
    description: 'Total number of outbound connector HTTP requests'
  })

  public static agentClientRequestsCounter = this.meter.createCounter(MetricNames.AGENT_CLIENT_REQUESTS, {
    unit: 'request',
    description: 'Total number of inter-agent calls'
  })

  public static turnsTotalCounter = this.meter.createCounter(MetricNames.TURNS_TOTAL, {
    unit: 'turn',
    description: 'Total turns processed'
  })

  public static turnsErrorsCounter = this.meter.createCounter(MetricNames.TURNS_ERRORS, {
    unit: 'turn',
    description: 'Total turns that resulted in an error'
  })

  public static authTokenRequestsCounter = this.meter.createCounter(MetricNames.AUTH_TOKEN_REQUESTS, {
    unit: 'request',
    description: 'Total number of token acquisition attempts'
  })

  public static userTokenClientRequestsCounter = this.meter.createCounter(MetricNames.USER_TOKEN_CLIENT_REQUESTS, {
    unit: 'request',
    description: 'Total number of user token client HTTP requests'
  })

  // Duration Histograms
  public static adapterProcessDuration = this.meter.createHistogram(MetricNames.ADAPTER_PROCESS_DURATION, {
    unit: 'ms',
    description: 'Duration of the adapter process method in milliseconds'
  })

  public static connectorRequestDuration = this.meter.createHistogram(MetricNames.CONNECTOR_REQUEST_DURATION, {
    unit: 'ms',
    description: 'Duration of outbound connector HTTP requests in milliseconds'
  })

  public static agentClientRequestDuration = this.meter.createHistogram(MetricNames.AGENT_CLIENT_REQUEST_DURATION, {
    unit: 'ms',
    description: 'Duration of inter-agent call latency in milliseconds'
  })

  public static turnDuration = this.meter.createHistogram(MetricNames.TURN_DURATION, {
    unit: 'ms',
    description: 'Duration of end-to-end turn processing in milliseconds'
  })

  public static storageOperationDuration = this.meter.createHistogram(MetricNames.STORAGE_OPERATION_DURATION, {
    unit: 'ms',
    description: 'Duration of storage operations in milliseconds'
  })

  public static authTokenDuration = this.meter.createHistogram(MetricNames.AUTH_TOKEN_DURATION, {
    unit: 'ms',
    description: 'Duration of token acquisition latency in milliseconds'
  })

  public static userTokenClientRequestDuration = this.meter.createHistogram(MetricNames.USER_TOKEN_CLIENT_REQUEST_DURATION, {
    unit: 'ms',
    description: 'Duration of user token client HTTP requests in milliseconds'
  })
}
