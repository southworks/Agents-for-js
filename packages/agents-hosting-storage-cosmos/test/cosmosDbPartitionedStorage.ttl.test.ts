import assert from 'assert'
import { describe, it } from 'node:test'
import { CosmosDbPartitionedStorage } from '../src'

describe('CosmosDbPartitionedStorage TTL', () => {
  it('should write native ttl and sdk expiry metadata when ttl is provided', async () => {
    let writtenDocument: any
    const storage = Object.create(CosmosDbPartitionedStorage.prototype) as CosmosDbPartitionedStorage
    const storageAsAny = storage as any
    storageAsAny.container = {
      items: {
        upsert: async (document: any) => {
          writtenDocument = document
        }
      }
    }
    storageAsAny.cosmosDbStorageOptions = {
      compatibilityMode: false
    }

    await storage.write({ key1: { value: 'test' } }, { ttl: 60 })

    assert.strictEqual(writtenDocument.id, 'key1')
    assert.strictEqual(writtenDocument.realId, 'key1')
    assert.deepStrictEqual(writtenDocument.document, { value: 'test' })
    assert.strictEqual(writtenDocument.ttl, 60)
    assert.ok(writtenDocument.expiresAt > Date.now())
  })

  it('should omit expired items on read and attempt cleanup', async () => {
    let deleteCalled = false
    const storage = Object.create(CosmosDbPartitionedStorage.prototype) as CosmosDbPartitionedStorage
    const storageAsAny = storage as any
    storageAsAny.container = {
      item: () => ({
        read: async () => ({
          resource: {
            id: 'key1',
            realId: 'key1',
            document: { value: 'test' },
            expiresAt: Date.now() - 1000,
            _etag: 'etag-1'
          }
        }),
        delete: async () => {
          deleteCalled = true
        }
      })
    }
    storageAsAny.cosmosDbStorageOptions = {
      compatibilityMode: false
    }

    const result = await storage.read(['key1'])

    assert.deepStrictEqual(result, {})
    assert.strictEqual(deleteCalled, true)
  })
})
