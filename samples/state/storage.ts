// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { readSetting } from '../_shared/config.js'
import { BlobsStorageV2 } from '@microsoft/agents-hosting-storage-blob'
import { CosmosDbPartitionedStorageV2 } from '@microsoft/agents-hosting-storage-cosmos'

export async function createBlobStateStorage () {
  const storage = new BlobsStorageV2(
    readSetting('BLOB_CONTAINER_ID')!,
    readSetting('BLOB_STORAGE_CONNECTION_STRING')!,
    { storagePipelineOptions: { retryOptions: { maxTries: 1, tryTimeoutInMs: 5000 } } }
  )

  // Initialize and check the connection before entering the scenario. This reads
  // a reserved key; it does not write a counter or delete any existing data.
  await storage.read(['dev-samples/state-blob/connection-check'])
  return storage
}

export async function createCosmosStateStorage () {
  const storage = new CosmosDbPartitionedStorageV2({
    databaseId: readSetting('COSMOS_DATABASE_ID')!,
    containerId: readSetting('COSMOS_CONTAINER_ID')!,
    compatibilityMode: false,
    keySuffix: 'dev-samples-state-cosmos',
    cosmosClientOptions: {
      endpoint: readSetting('COSMOS_ENDPOINT')!,
      key: readSetting('COSMOS_KEY')!,
      connectionPolicy: {
        requestTimeout: 5000,
        retryOptions: { maxRetryAttemptCount: 0 },
        enableEndpointDiscovery: false
      }
    }
  })

  // Cosmos uses /id partitions and a sample suffix to avoid unrelated state keys.
  await storage.read(['dev-samples/state-cosmos/connection-check'])
  return storage
}
