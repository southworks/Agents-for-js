import assert from 'node:assert'
import { describe, it } from 'node:test'
import type { MessagingExtensionAction, TaskModuleRequest } from '@microsoft/teams.api'
import { teamsGetDataAs, teamsGetDataString } from '../src/teamsModelExtensions'

describe('TeamsModelExtensions', () => {
  it('teamsGetDataAs returns typed data from a task module request', () => {
    const request: TaskModuleRequest = {
      data: {
        title: 'Quarterly report',
        count: 3
      }
    }

    const data = teamsGetDataAs<{ title: string, count: number }>(request)

    assert.deepStrictEqual(data, { title: 'Quarterly report', count: 3 })
  })

  it('teamsGetDataAs returns typed data from a message extension action', () => {
    const action = {
      commandId: 'create',
      commandContext: 'compose',
      data: {
        id: 'item-1'
      }
    } as MessagingExtensionAction

    const data = teamsGetDataAs<{ id: string }>(action)

    assert.deepStrictEqual(data, { id: 'item-1' })
  })

  it('teamsGetDataAs returns undefined when data is missing', () => {
    assert.strictEqual(teamsGetDataAs({}), undefined)
    assert.strictEqual(teamsGetDataAs(undefined), undefined)
  })

  it('teamsGetDataString returns a string from request data', () => {
    const request: TaskModuleRequest = {
      data: {
        title: 'Quarterly report',
        count: 3
      }
    }

    assert.strictEqual(teamsGetDataString(request, 'title'), 'Quarterly report')
  })

  it('teamsGetDataString returns a string from raw data', () => {
    assert.strictEqual(teamsGetDataString({ title: 'Quarterly report' }, 'title'), 'Quarterly report')
  })

  it('teamsGetDataString returns the default value for missing or non-string data', () => {
    const request: TaskModuleRequest = {
      data: {
        count: 3
      }
    }

    assert.strictEqual(teamsGetDataString(request, 'missing'), '')
    assert.strictEqual(teamsGetDataString(request, 'count', 'fallback'), 'fallback')
    assert.strictEqual(teamsGetDataString(undefined, 'title', 'fallback'), 'fallback')
  })
})
