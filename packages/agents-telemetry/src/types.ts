/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { SpanNames } from './traces/constants.js'

export type * from '@microsoft/agents-opentelemetry-api'
export type * from '@microsoft/agents-opentelemetry-api-logs'

export type OTel = typeof import('@microsoft/agents-opentelemetry-api')
export type OTelLogs = typeof import('@microsoft/agents-opentelemetry-api-logs')

export type SpanName = typeof SpanNames[keyof typeof SpanNames]
