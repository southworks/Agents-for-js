// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import modes from './modes.json'

export type Mode = keyof typeof modes

export function readSetting (key: string): string | undefined {
  const normalized = key.toLowerCase()
  for (const [name, value] of Object.entries(process.env)) {
    if (name.toLowerCase() === normalized && value?.trim()) {
      return value.trim()
    }
  }
}

export function scenarioSettings (mode: Mode, scenarioId: string): readonly string[] {
  const settings: Partial<Record<string, string[]>> = modes[mode].scenarios
  return settings[scenarioId] ?? []
}

export function templateHostCredentials (mode: Mode): string {
  return modes[mode].hostCredentials.join(', ')
}

export const copilotSettings = [
  'appClientId', 'tenantId', 'authorityEndpoint', 'environmentId', 'agentIdentifier', 'schemaName',
  'cloud', 'customPowerPlatformCloud', 'copilotAgentType', 'directConnectUrl',
  'useExperimentalEndpoint', 'enableDiagnostics', 'diagnosticsPseudonymKey'
]
