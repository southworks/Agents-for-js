// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { MetricNames } from '@microsoft/agents-telemetry'
import { metrics, trace } from '@opentelemetry/api'

export class HostingMetrics {
  public static tracer = trace.getTracer('OTelAgent', '1.0.0')
  private static meter = metrics.getMeter('OTelAgent', '1.0.0')

  // Counters
  public static activitiesReceivedCounter = this.meter.createCounter('agents.activities.received', {
    unit: 'activities',
    description: 'Total number of activities received by the adapter'
  })

  public static activitiesSentCounter = this.meter.createCounter('agents.activities.sent', {
    unit: 'activities',
    description: 'Total number of outbound activities sent by the adapter'
  })

  public static activitiesUpdatedCounter = this.meter.createCounter('agents.activities.updated', {
    unit: 'activities',
    description: 'Total number of activities updated by the adapter'
  })

  public static activitiesDeletedCounter = this.meter.createCounter('agents.activities.deleted', {
    unit: 'activities',
    description: 'Total number of activities deleted by the adapter'
  })

  // Duration Histograms
  public static adapterProcessDuration = this.meter.createHistogram('agents.adapter.process.duration', {
    unit: 'ms',
    description: 'Duration of the adapter process method in milliseconds'
  })
}
