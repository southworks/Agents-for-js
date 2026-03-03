// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { MetricNames } from '@microsoft/agents-telemetry'
import { metrics, trace } from '@opentelemetry/api'

export class HostingMetrics {
  public static tracer = trace.getTracer('OTelAgent', '1.0.0')
  private static meter = metrics.getMeter('OTelAgent', '1.0.0')

  public static activitiesProcessedCounter = this.meter.createCounter(MetricNames.ADAPTER_PROCESSED_ACTIVITIES, {
    unit: 'activities',
    description: 'Total number of activities processed by the adapter'
  })

  public static messageProcessingDuration = this.meter.createHistogram(MetricNames.ADAPTER_PROCESS_DURATION, {
    unit: 'ms',
    description: 'Duration of the adapter process method in milliseconds'
  })
}
