// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { readSetting } from '../_shared/config.js'

export function isTelemetryEnabled (): boolean {
  const setting = readSetting('SAMPLES_TELEMETRY')?.toLowerCase() || 'on'
  if (setting !== 'on' && setting !== 'off') {
    throw new Error('SAMPLES_TELEMETRY must be on or off. Update the mode environment file and restart.')
  }
  return setting === 'on'
}
