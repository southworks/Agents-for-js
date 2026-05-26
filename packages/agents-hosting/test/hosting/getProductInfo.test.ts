import { strict as assert } from 'assert'
import { describe, it } from 'node:test'
import { Activity, ActivityTypes } from '@microsoft/agents-activity'
import { HeaderPropagation } from '../../src/headerPropagation'
import { applyAgentHeaders, applyUserAgentHeader, getProductInfo } from '../../src/getProductInfo'

describe('getProductInfo helpers', () => {
  it('should append product info using incoming header casing without requiring key()', () => {
    const headers = new HeaderPropagation({ 'user-agent': 'TestUserAgent/1.0' })

    applyUserAgentHeader(headers)

    assert.equal(headers.outgoing['user-agent'], `TestUserAgent/1.0 ${getProductInfo()}`)
  })

  it('should propagate user agent when incoming header already includes product info', () => {
    const productInfo = getProductInfo()
    const headers = new HeaderPropagation({ 'user-agent': `TestUserAgent/1.0 ${productInfo}` })

    applyUserAgentHeader(headers)

    assert.equal(headers.outgoing['user-agent'], `TestUserAgent/1.0 ${productInfo}`)
  })

  it('should apply agent headers for non-agentic activities with a client id fallback', () => {
    const headers = new HeaderPropagation({ 'user-agent': 'TestUserAgent/1.0' })
    const activity = Activity.fromObject({
      type: ActivityTypes.Message,
      channelId: 'test-channel',
      recipient: { id: 'test-bot-id', name: 'test-bot-name' }
    })

    applyAgentHeaders(headers, activity, 'Valid Agent_1', 'clientId')

    assert.equal(headers.outgoing.AgentRegistrar, 'A365')
    assert.equal(headers.outgoing.AgentName, 'Valid Agent_1')
    assert.equal(headers.outgoing.AgentID, 'clientId')
    assert.equal(headers.outgoing['Agent-Referrer'], 'test-channel')
    assert.equal(headers.outgoing['user-agent'], `TestUserAgent/1.0 ${getProductInfo()}`)
  })

  it('should throw when no agent id can be resolved', () => {
    const headers = new HeaderPropagation({})
    const activity = Activity.fromObject({
      type: ActivityTypes.Message,
      channelId: 'test-channel',
    })

    assert.throws(() => applyAgentHeaders(headers, activity), {
      name: 'Error',
      message: '[-120640] - Agent ID is required to apply outbound agent headers - https://aka.ms/M365AgentsErrorCodesJS/#-120640'
    })
  })
})
