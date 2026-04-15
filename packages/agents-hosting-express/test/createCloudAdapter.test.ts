/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { describe, it } from 'node:test'
import assert from 'assert'
import { ActivityHandler, CloudAdapter } from '@microsoft/agents-hosting'
import { createCloudAdapter } from '../src/createCloudAdapter'

describe('createCloudAdapter', () => {
  it('should create a new CloudAdapter for an ActivityHandler', () => {
    const handler = new ActivityHandler()
    const result = createCloudAdapter(handler)

    assert.ok(result.adapter instanceof CloudAdapter)
    assert.strictEqual(result.headerPropagation, undefined)
  })

  it('should return adapter and headerPropagation properties', () => {
    const handler = new ActivityHandler()
    const result = createCloudAdapter(handler)

    assert.ok('adapter' in result)
    assert.ok('headerPropagation' in result)
  })
})
