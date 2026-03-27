// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { otel, MetricNames } from '@microsoft/agents-telemetry'
import { name, version } from '../../package.json'

const meter = otel.metrics.getMeter(name, version)
export const BlobsStorageMetrics = {
  storageOperationDuration: meter.createHistogram(MetricNames.STORAGE_OPERATION_DURATION, {
    unit: 'ms',
    description: 'Duration of storage operations in milliseconds'
  })
}
