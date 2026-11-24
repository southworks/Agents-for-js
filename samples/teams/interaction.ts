// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export function record (value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {}
}
