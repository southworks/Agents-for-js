import assert from 'assert'
import { describe, it } from 'node:test'
import { parseValueMessagingExtensionQuery } from '../src/messageExtension/messagingExtensionQuery'
import { ZodError } from 'zod'

describe('parseValueMessagingExtensionQuery test', () => {
  it('Parse with all properties', () => {
    const messagingExtensionQueryObj = {
      commandId: 'commandId',
      parameters: [{
        name: 'name',
        value: 'value'
      }],
      queryOptions: {
        skip: 1,
        count: 1
      },
      state: 'state'
    }
    const messagingExtensionQuery = parseValueMessagingExtensionQuery(messagingExtensionQueryObj)
    assert.deepEqual(messagingExtensionQuery, messagingExtensionQueryObj)
  })

  it('Parse with no commandId', () => {
    const messagingExtensionQueryObj = {
      parameters: [{
        name: 'name',
        value: 'value'
      }],
      queryOptions: {
        skip: 1,
        count: 1
      },
      state: 'state'
    }
    const messagingExtensionQuery = parseValueMessagingExtensionQuery(messagingExtensionQueryObj)
    assert.deepEqual(messagingExtensionQuery, messagingExtensionQueryObj)
  })

  it('Should trhow with wrong commandId', () => {
    const messagingExtensionQueryObj = {
      commandId: 1,
      parameters: [{
        name: 'name',
        value: 'value'
      }],
      queryOptions: {
        skip: 1,
        count: 1
      },
      state: 'state'
    }
    assert.throws(() => {
      parseValueMessagingExtensionQuery(messagingExtensionQueryObj)
    }, ZodError)
  })

  it('Parse with no parameters', () => {
    const messagingExtensionQueryObj = {
      commandId: 'commandId',
      queryOptions: {
        skip: 1,
        count: 1
      },
      state: 'state'
    }
    const messagingExtensionQuery = parseValueMessagingExtensionQuery(messagingExtensionQueryObj)
    assert.deepEqual(messagingExtensionQuery, messagingExtensionQueryObj)
  })

  it('Should trhow with wrong parameters', () => {
    const messagingExtensionQueryObj = {
      commandId: 'commandId',
      parameters: {
        name: 1,
        value: 1
      },
      queryOptions: {
        skip: 1,
        count: 1
      },
      state: 'state'
    }
    assert.throws(() => {
      parseValueMessagingExtensionQuery(messagingExtensionQueryObj)
    }, ZodError)
  })

  it('Parse with no queryOptions', () => {
    const messagingExtensionQueryObj = {
      commandId: 'commandId',
      parameters: [{
        name: 'name',
        value: 'value'
      }],
      state: 'state'
    }
    const messagingExtensionQuery = parseValueMessagingExtensionQuery(messagingExtensionQueryObj)
    assert.deepEqual(messagingExtensionQuery, messagingExtensionQueryObj)
  })

  it('Should trhow with wrong queryOptions', () => {
    const messagingExtensionQueryObj = {
      commandId: 1,
      parameters: [{
        name: 'name',
        value: 'value'
      }],
      queryOptions: {
        skip: '1',
        count: '1'
      },
      state: 'state'
    }
    assert.throws(() => {
      parseValueMessagingExtensionQuery(messagingExtensionQueryObj)
    }, ZodError)
  })

  it('Parse with no state', () => {
    const messagingExtensionQueryObj = {
      commandId: 'commandId',
      parameters: [{
        name: 'name',
        value: 'value'
      }],
      queryOptions: {
        skip: 1,
        count: 1
      }
    }
    const messagingExtensionQuery = parseValueMessagingExtensionQuery(messagingExtensionQueryObj)
    assert.deepEqual(messagingExtensionQuery, messagingExtensionQueryObj)
  })

  it('Should trhow with wrong state', () => {
    const messagingExtensionQueryObj = {
      commandId: 1,
      parameters: [{
        name: 'name',
        value: 'value'
      }],
      queryOptions: {
        skip: 1,
        count: 1
      },
      state: 1
    }
    assert.throws(() => {
      parseValueMessagingExtensionQuery(messagingExtensionQueryObj)
    }, ZodError)
  })
})
