// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { otel, MetricNames } from '@microsoft/agents-telemetry'
import { name, version } from '../../package.json'

const meter = otel.metrics.getMeter(name, version)
export const HostingMetrics = {
  // Counters
  activitiesReceivedCounter: meter.createCounter(MetricNames.ACTIVITIES_RECEIVED, {
    unit: 'activities',
    description: 'Total number of activities received by the adapter'
  }),

  activitiesSentCounter: meter.createCounter(MetricNames.ACTIVITIES_SENT, {
    unit: 'activities',
    description: 'Total number of outbound activities sent by the adapter'
  }),

  activitiesUpdatedCounter: meter.createCounter(MetricNames.ACTIVITIES_UPDATED, {
    unit: 'activities',
    description: 'Total number of activities updated by the adapter'
  }),

  activitiesDeletedCounter: meter.createCounter(MetricNames.ACTIVITIES_DELETED, {
    unit: 'activities',
    description: 'Total number of activities deleted by the adapter'
  }),

  connectorRequestsCounter: meter.createCounter(MetricNames.CONNECTOR_REQUESTS, {
    unit: 'request',
    description: 'Total number of outbound connector HTTP requests'
  }),

  agentClientRequestsCounter: meter.createCounter(MetricNames.AGENT_CLIENT_REQUESTS, {
    unit: 'request',
    description: 'Total number of inter-agent calls'
  }),

  turnsTotalCounter: meter.createCounter(MetricNames.TURNS_COUNT, {
    unit: 'turn',
    description: 'Total turns processed'
  }),

  turnsErrorsCounter: meter.createCounter(MetricNames.TURNS_ERRORS, {
    unit: 'turn',
    description: 'Total turns that resulted in an error'
  }),

  authTokenRequestsCounter: meter.createCounter(MetricNames.AUTH_TOKEN_REQUEST_COUNT, {
    unit: 'request',
    description: 'Total number of token acquisition attempts'
  }),

  userTokenClientRequestsCounter: meter.createCounter(MetricNames.USER_TOKEN_CLIENT_REQUESTS, {
    unit: 'request',
    description: 'Total number of user token client HTTP requests'
  }),

  // Duration Histograms
  adapterProcessDuration: meter.createHistogram(MetricNames.ADAPTER_PROCESS_DURATION, {
    unit: 'ms',
    description: 'Duration of the adapter process method in milliseconds'
  }),

  connectorRequestDuration: meter.createHistogram(MetricNames.CONNECTOR_REQUEST_DURATION, {
    unit: 'ms',
    description: 'Duration of outbound connector HTTP requests in milliseconds'
  }),

  agentClientRequestDuration: meter.createHistogram(MetricNames.AGENT_CLIENT_REQUEST_DURATION, {
    unit: 'ms',
    description: 'Duration of inter-agent call latency in milliseconds'
  }),

  turnDuration: meter.createHistogram(MetricNames.TURN_DURATION, {
    unit: 'ms',
    description: 'Duration of end-to-end turn processing in milliseconds'
  }),

  storageOperationDuration: meter.createHistogram(MetricNames.STORAGE_OPERATION_DURATION, {
    unit: 'ms',
    description: 'Duration of storage operations in milliseconds'
  }),

  authTokenDuration: meter.createHistogram(MetricNames.AUTH_TOKEN_DURATION, {
    unit: 'ms',
    description: 'Duration of token acquisition latency in milliseconds'
  }),

  userTokenClientRequestDuration: meter.createHistogram(MetricNames.USER_TOKEN_CLIENT_REQUEST_DURATION, {
    unit: 'ms',
    description: 'Duration of user token client HTTP requests in milliseconds'
  })
}
