/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

/**
 * A class that implements the HeaderPropagationCollection interface.
 * It filters the incoming request headers based on the definition provided and loads them into the outgoing headers collection.
 */
export class HeaderPropagation implements HeaderPropagationCollection {
  private _keys = new Set<string>()
  private _incomingRequests: Record<string, string>
  private _outgoingHeaders: Record<string, string> = {}

  private _headersToPropagate = ['x-ms-correlation-id']

  public get incoming (): Record<string, string> {
    return this._incomingRequests
  }

  public get outgoing (): Record<string, string> {
    return this._outgoingHeaders
  }

  constructor (headers: Record<string, string | string[] | undefined>) {
    if (!headers) {
      throw new Error('Headers must be provided.')
    }

    this._incomingRequests = this.normalizeHeaders(headers)
    this.propagate(this._headersToPropagate)
  }

  propagate (headers: string[]) {
    for (const key of headers ?? []) {
      const realKey = this.key(key)
      if (this._incomingRequests[realKey] && !this._outgoingHeaders[realKey]) {
        this._outgoingHeaders[realKey] = this._incomingRequests[realKey]
        this._keys.add(realKey)
      }
    }
  }

  add (headers: Record<string, string>) {
    for (const [key, value] of Object.entries(headers ?? {})) {
      const realKey = this.key(key)
      if (!this._incomingRequests[realKey] && !this._outgoingHeaders[realKey]) {
        this._outgoingHeaders[realKey] = value
        this._keys.add(realKey)
      }
    }
  }

  concat (headers: Record<string, string>) {
    for (const [key, value] of Object.entries(headers ?? {})) {
      const realKey = this.key(key)
      if (this._incomingRequests[realKey] && !this._headersToPropagate.includes(realKey.toLowerCase())) {
        this._outgoingHeaders[realKey] = `${this._outgoingHeaders[realKey] ?? this._incomingRequests[realKey]} ${value}`.trim()
        this._keys.add(realKey)
      }
    }
  }

  override (headers: Record<string, string>) {
    for (const [key, value] of Object.entries(headers ?? {})) {
      const realKey = this.key(key)
      if (!this._headersToPropagate.includes(realKey.toLowerCase())) {
        this._outgoingHeaders[realKey] = value
        this._keys.add(realKey)
      }
    }
  }

  key (key: string) {
    return Array.from(this._keys).find(k => k.toLowerCase() === key.toLowerCase()) ?? key
  }

  /**
   * Normalizes the headers by ensuring the values are strings.
   * @param headers The headers to normalize.
   * @returns A new object with normalized headers.
   */
  private normalizeHeaders (headers: Record<string, string | string[] | undefined>) {
    return Object.entries(headers).reduce((acc, [key, value]) => {
      if (value) {
        acc[key] = Array.isArray(value) ? value.join(' ') : value
      }
      return acc
    }, {} as Record<string, string>)
  }
}

/**
 * A function type that defines how headers should be propagated.
 */
export interface HeaderPropagationDefinition {
  (headers: HeaderPropagationCollection): void
}

/**
 * Defines the interface for managing header propagation.
 */
export interface HeaderPropagationCollection {
  /**
   * The collection of incoming headers from the incoming request.
   *
   * @remarks
   * This collection is built based on the headers received in the request.
   */
  incoming: Record<string, string>
  /**
   * The collection of headers that will be propagated to outgoing requests.
   *
   * @remarks
   * This collection is built based on the incoming headers and the definition provided.
   */
  outgoing: Record<string, string>
  /**
   * Propagates the incoming header value to the outgoing collection based on the header definition key.
   * @param headers List of header keys to propagate.
   *
   * @remarks
   * If the header does not exist in the incoming headers, it will be ignored.
   */
  propagate(headers: string[]): void
  /**
   * Adds a header definition to the outgoing collection.
   * @param headers Headers to add to the outgoing collection.
   *
   * @remarks
   * If the header already exists, it will not be added.
   */
  add(headers: Record<string, string>): void
  /**
   * Concatenates a header definition to the outgoing collection.
   * @param headers Headers to concatenate to the outgoing collection.
   *
   * @remarks
   * If the header does not exist in the incoming headers, it will be ignored. Unless the header is already present in the outgoing collection.
   */
  concat(headers: Record<string, string>): void
  /**
   * Overrides a header definition in the outgoing collection.
   * @param headers Headers to override in the outgoing collection.
   *
   * @remarks
   * If the header does not exist in the incoming headers, it will be added to the outgoing collection.
   */
  override(headers: Record<string, string>): void
  /**
   * Finds the real key in the incoming headers based on a case-insensitive search.
   * If the key is not found, it returns the provided key.
   * This is necessary because HTTP headers are case-insensitive, but the incoming headers may have different casing.
   * The outgoing headers should maintain the same casing as the incoming headers for consistency.
   * @param key The header key to find.
   * @returns The real key from the incoming headers or the provided key if not found.
   */
  key(key: string): string
}
