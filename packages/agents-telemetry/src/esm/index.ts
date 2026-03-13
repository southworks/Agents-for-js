// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// IMPORTANT: make sure not to export '@microsoft/agents-opentelemetry-api' types directly as this is a development dependency.
// Instead, re-export types from 'typeof import('@opentelemetry/api')' directly.

import { TraceDecoratorFactory } from '../traceDecorator.js'
import { otel } from './otel.js'

export * from '../constants.js'
export { otel } from './otel.js'

export const createTracedDecorator = TraceDecoratorFactory(otel)
