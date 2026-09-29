import assert from 'node:assert'
import { describe, it } from 'node:test'
import { Activity } from '@microsoft/agents-activity'
import {
  addQuotedReply,
  addTargetedMessageInfo,
  teamsEnableFeedbackLoop,
  teamsGetChannelId,
  teamsGetMeetingInfo,
  getQuotedMessages,
  getTargetedMessageInfo,
  teamsGetTeamInfo,
  isRecipientTargeted,
  teamsGetSelectedChannelId
} from '../src/teamsActivityExtensions'

describe('teamsActivityExtensions', () => {
  describe('teamsGetSelectedChannelId', () => {
    it('should return the selected channel ID when settings contain one', () => {
      const activity = Activity.fromObject({
        type: 'message',
        channelData: { settings: { selectedChannel: { id: 'channel-1' } } }
      })
      assert.strictEqual(teamsGetSelectedChannelId(activity), 'channel-1')
    })

    it('should return undefined when settings are absent', () => {
      const activity = Activity.fromObject({ type: 'message', channelData: {} })
      assert.strictEqual(teamsGetSelectedChannelId(activity), undefined)
    })

    it('should return undefined when channelData is undefined', () => {
      const activity = Activity.fromObject({ type: 'message' })
      assert.strictEqual(teamsGetSelectedChannelId(activity), undefined)
    })
  })

  describe('teamsGetChannelId', () => {
    it('should return the channel ID when channelData contains one', () => {
      const activity = Activity.fromObject({
        type: 'message',
        channelData: { channel: { id: 'chan-42' } }
      })
      assert.strictEqual(teamsGetChannelId(activity), 'chan-42')
    })

    it('should return undefined when channel is absent', () => {
      const activity = Activity.fromObject({ type: 'message', channelData: {} })
      assert.strictEqual(teamsGetChannelId(activity), undefined)
    })
  })

  describe('teamsGetMeetingInfo', () => {
    it('should return meeting information when channelData contains it', () => {
      const activity = Activity.fromObject({
        type: 'message',
        channelData: { meeting: { id: 'meeting-1' } }
      })
      const result = teamsGetMeetingInfo(activity)
      assert.deepStrictEqual(result, { id: 'meeting-1' })
    })

    it('should return undefined when meeting is absent', () => {
      const activity = Activity.fromObject({ type: 'message', channelData: {} })
      assert.strictEqual(teamsGetMeetingInfo(activity), undefined)
    })
  })

  describe('teamsGetTeamInfo', () => {
    it('should return team information when channelData contains it', () => {
      const activity = Activity.fromObject({
        type: 'message',
        channelData: { team: { id: 'team-1', name: 'Team A' } }
      })
      const result = teamsGetTeamInfo(activity)
      assert.deepStrictEqual(result, { id: 'team-1', name: 'Team A' })
    })

    it('should return undefined when team is absent', () => {
      const activity = Activity.fromObject({ type: 'message', channelData: {} })
      assert.strictEqual(teamsGetTeamInfo(activity), undefined)
    })
  })

  describe('teamsEnableFeedbackLoop', () => {
    it('should set feedbackLoop channelData and return true when channelData is null', () => {
      const activity = Activity.fromObject({ type: 'message' })
      activity.channelData = null
      const result = teamsEnableFeedbackLoop(activity)
      assert.strictEqual(result, true)
      assert.deepStrictEqual(activity.channelData, { feedbackLoop: { type: 'default' } })
    })

    it('should set a custom feedbackLoop type', () => {
      const activity = Activity.fromObject({ type: 'message' })
      activity.channelData = null
      const result = teamsEnableFeedbackLoop(activity, 'custom')
      assert.strictEqual(result, true)
      assert.deepStrictEqual(activity.channelData, { feedbackLoop: { type: 'custom' } })
    })

    it('should return false when channelData is already set', () => {
      const activity = Activity.fromObject({ type: 'message', channelData: { existing: true } })
      const result = teamsEnableFeedbackLoop(activity)
      assert.strictEqual(result, false)
      assert.deepStrictEqual(activity.channelData, { existing: true })
    })
  })

  describe('QuotedReply', () => {
    it('adds a quoted reply entity and XML-escaped placeholder', () => {
      const activity = Activity.fromObject({ type: 'message', text: '' })

      const result = addQuotedReply(activity, 'message&"id', 'response')

      assert.strictEqual(result, activity)
      assert.deepStrictEqual(getQuotedMessages(activity), [{
        type: 'quotedReply',
        quotedReply: { messageId: 'message&"id' }
      }])
      assert.strictEqual(activity.text, '<quoted messageId="message&amp;&quot;id"/> response')
    })

    it('returns all wire-format quoted reply entities', () => {
      const activity = Activity.fromObject({
        type: 'message',
        entities: [
          { type: 'quotedReply', quotedReply: { messageId: 'one' } },
          { type: 'mention', text: '<at>User</at>' },
          { type: 'quotedReply', quotedReply: { messageId: 'two', preview: 'preview' } }
        ]
      })

      assert.deepStrictEqual(getQuotedMessages(activity).map(entity => entity.quotedReply.messageId), ['one', 'two'])
    })

    it('rejects an empty quoted reply message ID', () => {
      const activity = Activity.fromObject({ type: 'message' })
      assert.throws(() => addQuotedReply(activity, '  '), /messageId parameter must be a non-empty string/)
    })
  })

  describe('TargetedMessageInfo', () => {
    it('adds targeted message information idempotently', () => {
      const activity = Activity.fromObject({ type: 'message' })
      assert.strictEqual(addTargetedMessageInfo(activity, 'first-message'), activity)

      addTargetedMessageInfo(activity, 'second-message')

      assert.deepStrictEqual(getTargetedMessageInfo(activity), {
        type: 'targetedMessageInfo',
        messageId: 'first-message'
      })
      assert.strictEqual(activity.entities?.length, 1)
    })

    it('recognizes a recipient marked as targeted', () => {
      const targeted = Activity.fromObject({ type: 'message', recipient: { id: 'user', isTargeted: true } })
      const regular = Activity.fromObject({ type: 'message', recipient: { id: 'user' } })

      assert.strictEqual(isRecipientTargeted(targeted), true)
      assert.strictEqual(isRecipientTargeted(regular), false)
    })
  })
})
