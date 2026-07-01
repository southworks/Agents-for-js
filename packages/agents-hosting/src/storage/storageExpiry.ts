import { StorageWriteOptions } from './storage'

export function getStorageWriteExpiry (options?: StorageWriteOptions): number | undefined {
  const ttl = options?.ttl
  if (ttl === undefined) {
    return undefined
  }

  if (!Number.isFinite(ttl) || ttl <= 0) {
    throw new RangeError('StorageWriteOptions.ttl must be a finite number greater than zero.')
  }

  return Date.now() + ttl * 1000
}
