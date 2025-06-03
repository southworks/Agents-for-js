import assert from 'assert'
import { describe, it } from 'node:test'
import { ZodError } from 'zod'
import { parseValueCommandId } from '../../src/app/adaptiveCards/activityValueParsers'

describe('parseValueCommandId test', () => {
  it('Parse with all properties', () => {
    const valueObject = {
      commandId: 'botMessagePreviewAction'
    }
    const parsedValue = parseValueCommandId(valueObject)
    assert.deepEqual(parsedValue, valueObject)
  })

  it('Should throw with not string commandId', () => {
    const valueObject = {
      commandId: 1
    }
    assert.throws(() => {
      parseValueCommandId(valueObject)
    }, ZodError)
  })
})
