// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// IMPORTANT: make sure not to export '@microsoft/agents-opentelemetry-api' types directly as this is a development dependency.
// Instead, re-export types from 'typeof import('@opentelemetry/api')' directly.

export * from './constants'
export { otel } from './otel'
export { createTracedDecorator } from './traceDecorator'
