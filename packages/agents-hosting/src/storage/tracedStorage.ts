// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Storage, StoreItem } from './storage'
import { SpanNames, trace } from '@microsoft/agents-telemetry'
import { HostingMetrics } from '../observability/metrics'

/**
 * A wrapper that adds OpenTelemetry tracing to any Storage implementation.
 *
 * @remarks
 * By default, the internal storage operations used for state management are not traced
 * to avoid noise in telemetry. Use TracedStorage when you want explicit visibility
 * into storage operations for debugging or monitoring purposes.
 *
 * This wrapper implements the decorator pattern, allowing it to wrap any Storage
 * implementation (MemoryStorage, BlobsStorage, CosmosDbPartitionedStorage, etc.).
 *
 * @example
 * ```typescript
 * // Without tracing (default behavior)
 * const storage = new BlobsStorage(connectionString, containerName);
 *
 * // With tracing enabled
 * const storage = new TracedStorage(new BlobsStorage(connectionString, containerName));
 *
 * const app = new AgentApplication({ storage });
 * ```
 */
export class TracedStorage implements Storage {
  /**
   * Creates a new TracedStorage instance.
   *
   * @param storage - The underlying storage implementation to wrap with tracing.
   */
  constructor (private readonly storage: Storage) {}

  /**
   * Reads store items from storage with tracing.
   *
   * @param keys - The keys of the items to read.
   * @returns A promise that resolves to the store items.
   */
  async read (keys: string[]): Promise<StoreItem> {
    const start = performance.now()
    return trace(SpanNames.STORAGE_READ, async (span) => {
      span.setAttribute('storage.key.count', keys.length)
      return this.storage.read(keys)
    }).finally(() => {
      HostingMetrics.storageOperationDuration.record(performance.now() - start, {
        'storage.operation': 'read'
      })
    })
  }

  /**
   * Writes store items to storage with tracing.
   *
   * @param changes - The items to write to storage, indexed by key.
   * @returns A promise that resolves when the write operation is complete.
   */
  async write (changes: StoreItem): Promise<void> {
    const start = performance.now()
    return trace(SpanNames.STORAGE_WRITE, async (span) => {
      span.setAttribute('storage.key.count', Object.keys(changes).length)
      return this.storage.write(changes)
    }).finally(() => {
      HostingMetrics.storageOperationDuration.record(performance.now() - start, {
        'storage.operation': 'write'
      })
    })
  }

  /**
   * Deletes store items from storage with tracing.
   *
   * @param keys - The keys of the items to delete.
   * @returns A promise that resolves when the delete operation is complete.
   */
  async delete (keys: string[]): Promise<void> {
    const start = performance.now()
    return trace(SpanNames.STORAGE_DELETE, async (span) => {
      span.setAttribute('storage.key.count', keys.length)
      return this.storage.delete(keys)
    }).finally(() => {
      HostingMetrics.storageOperationDuration.record(performance.now() - start, {
        'storage.operation': 'delete'
      })
    })
  }
}
