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
  it('should not share cached containers across Cosmos accounts', async () => {
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

  it('should share the detected partition-key mode with cached containers', async () => {
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

  it('should evict failed initialization attempts so a later call can retry', async () => {
    const endpoint = 'https://retry-account.documents.azure.com/'
    const firstStorage = createStorage(endpoint) as unknown as StorageInternals
    const concurrentStorage = createStorage(endpoint) as unknown as StorageInternals
    const retryStorage = createStorage(endpoint) as unknown as StorageInternals
    const container = {} as Container
    let attempts = 0
    let rejectInitialization!: (reason: Error) => void
    const failedInitialization = new Promise<{
      container: Container;
      compatibilityModePartitionKey: boolean;
    }>((_resolve, reject) => {
      rejectInitialization = reject
    })

    firstStorage.client = {} as CosmosClient
    concurrentStorage.client = {} as CosmosClient
    retryStorage.client = {} as CosmosClient
    firstStorage.getOrCreateContainer = async () => {
      attempts++
      return failedInitialization
    }
    concurrentStorage.getOrCreateContainer = async () => {
      throw new Error('Concurrent callers should share the cached attempt')
    }
    retryStorage.getOrCreateContainer = async () => {
      attempts++
      return { container, compatibilityModePartitionKey: false }
    }

    const initializations = Promise.allSettled([
      firstStorage.initialize(),
      concurrentStorage.initialize(),
    ])
    rejectInitialization(new Error('Transient initialization failure'))

    const results = await initializations
    assert.deepStrictEqual(results.map(result => result.status), ['rejected', 'rejected'])
    assert.strictEqual(attempts, 1)

    await retryStorage.initialize()

    assert.strictEqual(attempts, 2)
    assert.strictEqual(retryStorage.container, container)
  })
})
