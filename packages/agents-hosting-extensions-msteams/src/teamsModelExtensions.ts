// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import type { MessagingExtensionAction, TaskModuleRequest } from '@microsoft/teams.api'

type TeamsDataContainer = Pick<TaskModuleRequest, 'data'> | Pick<MessagingExtensionAction, 'data'> | null | undefined

function hasDataProperty (value: unknown): value is { data?: unknown } {
  return typeof value === 'object' && value !== null && Object.prototype.hasOwnProperty.call(value, 'data')
}

function getSourceData (source: TeamsDataContainer | unknown): unknown {
  return hasDataProperty(source) ? source.data : source
}

/**
 * Gets the data payload from a Teams task module request or message extension action as the specified type.
 */
export function teamsGetDataAs<T = unknown> (request: TeamsDataContainer): T | undefined {
  return request?.data == null ? undefined : request.data as T
}

/**
 * Gets a string property from a Teams task module request, message extension action, or raw data object.
 */
export function teamsGetDataString (source: TeamsDataContainer | unknown, key: string, defaultValue?: string): string {
  const data = getSourceData(source)
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return defaultValue ?? ''
  }

  const value = (data as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : defaultValue ?? ''
}
