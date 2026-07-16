import assert from 'assert'
import { Container, CosmosClient } from '@azure/cosmos'
import { describe, it } from 'node:test'
import { CosmosDbPartitionedStorage } from '../src/cosmosDbPartitionedStorage'

interface StorageInternals {
  client: CosmosClient;
  container: Container;
  compatibilityModePartitionKey: boolean;
  initialize: () => Promise<void>;
  getOrCreateContainer: () => Promise<{
    container: Container;
    compatibilityModePartitionKey: boolean;
  }>;
}

function createStorage (endpoint: string): CosmosDbPartitionedStorage {
  return new CosmosDbPartitionedStorage({
    cosmosClientOptions: { endpoint, key: 'test-key' },
    databaseId: 'shared-database',
    containerId: 'shared-container',
  })
}

describe('CosmosDbPartitionedStorage initialization', () => {
  it('does not share cached containers across Cosmos accounts', async () => {
    const firstContainer = {} as Container
    const secondContainer = {} as Container
    const firstStorage = createStorage('https://first-account.documents.azure.com/') as unknown as StorageInternals
    const secondStorage = createStorage('https://second-account.documents.azure.com/') as unknown as StorageInternals

    firstStorage.client = {} as CosmosClient
    secondStorage.client = {} as CosmosClient
    firstStorage.getOrCreateContainer = async () => ({
      container: firstContainer,
      compatibilityModePartitionKey: false,
    })
    secondStorage.getOrCreateContainer = async () => ({
      container: secondContainer,
      compatibilityModePartitionKey: false,
    })

    await firstStorage.initialize()
    await secondStorage.initialize()

    assert.strictEqual(firstStorage.container, firstContainer)
    assert.strictEqual(secondStorage.container, secondContainer)
  })

  it('shares the detected partition-key mode with cached containers', async () => {
    const container = {} as Container
    const endpoint = 'https://partition-mode-account.documents.azure.com/'
    const firstStorage = createStorage(endpoint) as unknown as StorageInternals
    const secondStorage = createStorage(endpoint) as unknown as StorageInternals

    firstStorage.client = {} as CosmosClient
    secondStorage.client = {} as CosmosClient
    firstStorage.getOrCreateContainer = async () => ({
      container,
      compatibilityModePartitionKey: true,
    })
    secondStorage.getOrCreateContainer = async () => {
      throw new Error('The cached initialization should be reused')
    }

    await firstStorage.initialize()
    await secondStorage.initialize()

    assert.strictEqual(secondStorage.container, container)
    assert.strictEqual(secondStorage.compatibilityModePartitionKey, true)
  })
})
