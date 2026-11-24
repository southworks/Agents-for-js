// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { fileURLToPath } from 'node:url'
import { FileStorage, MemoryStorage, type StorageProvider } from '@microsoft/agents-hosting'
import type { Scenario } from '../_coordinator/catalog.js'
import { createStateAgent } from './agent.js'
import { createBlobStateStorage, createCosmosStateStorage } from './storage.js'

function stateScenario (
  details: Pick<Scenario, 'id' | 'name' | 'menuLabel' | 'unavailableMessage'>,
  createStorage: () => StorageProvider | Promise<StorageProvider>,
  includeUserCounter = false
): Scenario {
  const scenario = {
    ...details,
    group: 'State and storage',
    introduction: includeUserCounter
      ? 'Increment or reset the user and conversation counters stored in local files.'
      : 'Increment or reset the counter for this conversation.',
    quickActions: [
      { label: 'Increment', command: 'increment' },
      { label: 'Reset', command: 'reset' }
    ],
    modes: ['latest']
  } satisfies Omit<Scenario, 'create'>

  return {
    ...scenario,
    create: async (adapter, _addResultNavigation, mode) =>
      createStateAgent(adapter, await createStorage(), mode, scenario, includeUserCounter)
  }
}

export const stateScenarios: Scenario[] = [
  stateScenario({
    id: 'state-memory',
    menuLabel: 'Memory',
    name: 'State - Memory'
  }, () => new MemoryStorage()),
  stateScenario({
    id: 'state-blob',
    menuLabel: 'Blob',
    name: 'State - Blob',
    unavailableMessage: 'Check the Blob connection string, container name, access permissions, and whether Azure Storage or Azurite is reachable.'
  }, createBlobStateStorage),
  stateScenario({
    id: 'state-cosmos',
    menuLabel: 'Cosmos',
    name: 'State - Cosmos',
    unavailableMessage: 'Check the Cosmos endpoint, key, database, container, network access, and emulator certificate if applicable. The container must use /id as its partition key.'
  }, createCosmosStateStorage),
  stateScenario({
    id: 'state-file',
    menuLabel: 'File',
    name: 'State - File'
  }, () => new FileStorage(fileURLToPath(new URL('../.state-files/', import.meta.url))), true)
]
