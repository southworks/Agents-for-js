// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { randomUUID } from 'node:crypto'
import { Activity, Channels } from '@microsoft/agents-activity'
import { CardFactory, CreateConversationOptionsBuilder, MessageFactory, AgentApplication, MemoryStorage, type CloudAdapter, type TurnContext, type TurnState } from '@microsoft/agents-hosting'
import { addQuotedReply, isRecipientTargeted, onTeamsFeedbackLoop, teamsEnableFeedbackLoop, parseTeamsChannelData, TeamsAgentExtension, TeamsTurnContext } from '@microsoft/agents-hosting-extensions-msteams'
import { getSessionKey } from '../_shared/sessionKey.js'
import { record } from './interaction.js'

const lifecycleEvents = new Set([
  'channelcreated', 'channelrenamed', 'channeldeleted', 'teamrenamed',
  'teammemberadded', 'teammemberremoved', 'channelmemberadded', 'channelmemberremoved'
])

function isLifecycleEvent (context: TurnContext): boolean {
  if (context.activity.type !== 'conversationUpdate') {
    return false
  }
  const { eventType } = record(context.activity.channelData)
  return (typeof eventType === 'string' && lifecycleEvents.has(eventType.toLowerCase())) ||
    !!context.activity.membersAdded?.length || !!context.activity.membersRemoved?.length
}

function feedbackRequest (context: TurnContext): Record<string, unknown> | undefined {
  if (context.activity.type !== 'invoke' || !['message/fetchTask', 'message/submitAction'].includes(context.activity.name ?? '')) {
    return undefined
  }
  const value = record(context.activity.value)
  const data = record(value.data)
  if (value.actionName === 'feedback' && (data.actionName === undefined || data.actionName === 'feedback')) {
    return value
  }
  return value.actionName === undefined && data.actionName === 'feedback' ? data : undefined
}

function editableCardAction (context: TurnContext) {
  const data = record(context.activity.value)
  if (context.activity.type === 'message' && data.sampleOwner === 'teams-editable-card' &&
      (data.command === 'update-card' || data.command === 'delete-card')) {
    return { command: data.command, token: data.token }
  }
  return undefined
}

export function ownsConversationActivity (context: TurnContext): boolean {
  return context.activity.channelId === Channels.Msteams && (
    editableCardAction(context) !== undefined ||
    feedbackRequest(context) !== undefined ||
    (context.activity.type === 'message' && isRecipientTargeted(context.activity)) ||
    (isLifecycleEvent(context) && !context.activity.membersAdded?.some(member => member.id === context.activity.recipient?.id))
  )
}

function registerConversationActions (app: AgentApplication<TurnState>, teams: TeamsAgentExtension<TurnState>) {
  const cards = new Map<string, { id: string, token: string, updates: number, busy: boolean }>()
  const feedback = new Map<string, string>()
  const observers = new Map<string, string>()

  function editableCard (updates: number, token: string) {
    return MessageFactory.attachment(CardFactory.adaptiveCard({
      type: 'AdaptiveCard',
      version: '1.3',
      body: [
        { type: 'TextBlock', text: 'Editable sample card', weight: 'Bolder' },
        { type: 'TextBlock', text: `Updates: ${updates}` }
      ],
      actions: [
        { type: 'Action.Submit', title: 'Update', data: { sampleOwner: 'teams-editable-card', command: 'update-card', token } },
        { type: 'Action.Submit', title: 'Delete', data: { sampleOwner: 'teams-editable-card', command: 'delete-card', token } }
      ]
    }))
  }

  app.onMessage('quote', async context => {
    if (!context.activity.id) {
      await context.sendActivity('Send a message with an activity ID to try a quoted reply.')
      return
    }
    const reply = Activity.fromObject({ type: 'message', text: '' })
    addQuotedReply(reply, context.activity.id, 'This reply quotes the message that started this action.')
    await context.sendActivity(reply)
  })
  app.onMessage('editable-card', async context => {
    const key = getSessionKey(context)
    if (!key) {
      return
    }
    const token = randomUUID()
    const response = await context.sendActivity(editableCard(0, token))
    if (response?.id) {
      cards.set(key, { id: response.id, token, updates: 0, busy: false })
    }
  })

  async function changeCard (context: TurnContext): Promise<void> {
    const action = editableCardAction(context)
    const key = getSessionKey(context)
    const card = key ? cards.get(key) : undefined
    if (action && (!card || action.token !== card.token)) {
      await context.sendActivity('This card has expired or belongs to another user. Select Show editable card for a new one.')
      return
    }
    if (!card || !key) {
      await context.sendActivity('Select Show editable card first.')
      return
    }
    if (card.busy) {
      await context.sendActivity('Wait for the current card action to finish, then try again.')
      return
    }

    const command = action?.command ?? context.activity.text?.trim().toLowerCase()
    card.busy = true
    try {
      if (command === 'delete-card') {
        await context.deleteActivity(card.id)
        if (cards.get(key) === card) {
          cards.delete(key)
        }
        await context.sendActivity('Sample card deleted.')
      } else {
        const updated = editableCard(card.updates + 1, card.token)
        updated.id = card.id
        await context.updateActivity(updated)
        card.updates++
      }
    } finally {
      card.busy = false
    }
  }

  app.onActivity(async context => editableCardAction(context) !== undefined, changeCard)
  app.onMessage(['update-card', 'delete-card'], changeCard)
  app.onMessage('targeted', async context => {
    if (context.activity.from?.id) {
      await new TeamsTurnContext(context).sendTargetedActivity('This targeted message is visible only to you.', context.activity.from)
    }
  })
  app.onMessage('message-group', async context => {
    const { conversation, serviceUrl, recipient } = context.activity
    const appId = context.identity?.aud
    if (conversation?.conversationType?.toLowerCase() !== 'groupchat' || !conversation.id || !conversation.tenantId || !serviceUrl || typeof appId !== 'string') {
      await context.sendActivity('Use this action in a dedicated Teams test group chat with up to five people.')
      return
    }
    const page = await teams.getTeamsClient(context).conversations.getPagedMembers(conversation.id, 7)
    const members = page.members.filter(member => member?.id && member.id !== recipient?.id)
    if (page.continuationToken || members.length === 0 || members.length > 5) {
      await context.sendActivity('Use a test group chat with one to five members. No messages were sent.')
      return
    }
    let sent = 0
    for (const member of members) {
      try {
        const options = CreateConversationOptionsBuilder.create(appId, Channels.Msteams, serviceUrl)
          .withUser(member.id, member.name)
          .withTenantId(conversation.tenantId)
          .isGroup(false)
          .build()
        await app.proactive.createConversation(context.adapter, options, async continued => {
          await continued.sendActivity('Hello from the Teams group messaging sample.')
        })
        sent++
      } catch {
        // Continue with the remaining members and report partial delivery.
      }
    }
    await context.sendActivity(`Sent ${sent} of ${members.length} sample messages.`)
  })
  app.onMessage('observe-conversation', async context => {
    const key = getSessionKey(context)
    const conversationId = context.activity.conversation?.id
    if (!key || !conversationId || context.activity.conversation?.conversationType === 'personal') {
      await context.sendActivity('Open the sample in a Teams group chat or channel to observe conversation events.')
      return
    }
    observers.set(key, conversationId)
    await context.sendActivity('Observing membership and channel changes delivered to this chat. Select All scenarios to stop.')
  })

  const notify = (text: string) => async (context: TurnContext): Promise<void> => {
    await context.sendActivity(text)
  }
  teams.channels
    .onMemberAdded(notify('Teams conversations · Member added.'))
    .onMemberRemoved(notify('Teams conversations · Member removed.'))
    .onCreated(notify('Teams conversations · Channel created.'))
    .onRenamed(notify('Teams conversations · Channel renamed.'))
    .onDeleted(notify('Teams conversations · Channel deleted.'))
  teams.teams.onRenamed(notify('Teams conversations · Team renamed.'))
  app.onConversationUpdate('membersAdded', notify('Teams conversations · Member added.'))
  app.onConversationUpdate('membersRemoved', notify('Teams conversations · Member removed.'))

  app.onMessage('customfeedback', async context => {
    const key = getSessionKey(context)
    if (!key) {
      return
    }
    const activity = MessageFactory.text('Select thumbs up or thumbs down to test the feedback dialog.')
    teamsEnableFeedbackLoop(activity, 'custom')
    const response = await context.sendActivity(activity)
    if (response?.id) {
      feedback.set(key, response.id)
    }
  })
  app.onActivity(async context => context.activity.name === 'message/fetchTask' && feedbackRequest(context) !== undefined, async context => {
    await context.sendActivity(Activity.fromObject({
      type: 'invokeResponse',
      value: {
        status: 200,
        body: {
          task: {
            type: 'continue',
            value: {
              title: 'Feedback',
              height: 'small',
              width: 'small',
              card: CardFactory.adaptiveCard({
                type: 'AdaptiveCard',
                version: '1.4',
                body: [{ type: 'Input.Text', id: 'feedbackText', label: 'Optional feedback', isMultiline: true, maxLength: 200 }],
                actions: [{ type: 'Action.Submit', title: 'Submit' }]
              })
            }
          }
        }
      }
    }))
  })
  onTeamsFeedbackLoop(app, async context => {
    const key = getSessionKey(context)
    if (key) {
      feedback.delete(key)
    }
    console.info('Teams sample feedback received.')
  })

  return {
    clear (context: TurnContext): void {
      const key = getSessionKey(context)
      if (key) {
        cards.delete(key)
        observers.delete(key)
        feedback.delete(key)
      }
    },
    async shouldRun (context: TurnContext): Promise<boolean> {
      if (isLifecycleEvent(context)) {
        const id = context.activity.conversation?.id
        return !!id && !!context.activity.from?.id && [...observers.values()].includes(id)
      }
      const request = feedbackRequest(context)
      if (!request) {
        return context.activity.type === 'message' || context.activity.type === 'messageReaction'
      }
      const key = getSessionKey(context)
      const replyId = context.activity.replyToId
      if (!key || !replyId || feedback.get(key) !== replyId) {
        await context.sendActivity(Activity.fromObject({
          type: 'invokeResponse',
          value: { status: 400, body: { task: { type: 'message', value: 'This feedback request has expired. Select Try feedback again.' } } }
        }))
        return false
      }
      context.activity.value = request
      return true
    }
  }
}

export function createTeamsConversationAgent (adapter: CloudAdapter) {
  const app = new AgentApplication({ adapter, storage: new MemoryStorage(), proactive: {} })
  const teams = new TeamsAgentExtension(app)
  app.registerExtension(teams, () => {})
  const demos = registerConversationActions(app, teams)

  async function currentMember (context: TurnContext) {
    const channelData = parseTeamsChannelData(context.activity.channelData)
    const conversationId = channelData.team?.id ?? context.activity.conversation?.id
    const userId = context.activity.from?.id
    if (!conversationId || !userId) {
      throw new Error('Teams conversation and sender are required.')
    }

    return await teams.getTeamsClient(context).conversations.getMemberById(conversationId, userId)
  }

  app.onMessage('test-reaction', async context => {
    await context.sendActivity('Add a reaction to this message, then remove it.')
  })
  app.onMessageReactionAdded(async context => {
    const reactions = context.activity.reactionsAdded?.map(reaction => reaction.type)
    if (reactions?.length) {
      await context.sendActivity(`Reactions added: ${reactions.join(', ')}`)
    }
  })
  app.onMessageReactionRemoved(async context => {
    const reactions = context.activity.reactionsRemoved?.map(reaction => reaction.type)
    if (reactions?.length) {
      await context.sendActivity(`Reactions removed: ${reactions.join(', ')}`)
    }
  })

  app.onMessage('whoami', async context => {
    const member = await currentMember(context)
    await context.sendActivity(`Teams · You are ${member.name ?? 'a member of this conversation'}.`)
  })

  app.onMessage('mentionme', async context => {
    const member = await currentMember(context)
    const name = member.name ?? 'you'
    const mentionText = `<at>${name}</at>`
    await context.sendActivity(Activity.fromObject({
      type: 'message',
      text: `Hello ${mentionText}.`,
      entities: [{ type: 'mention', text: mentionText, mentioned: { id: member.id, name } }]
    }))
  })

  app.onActivity('message', async context => {
    await context.sendActivity('Use the Teams conversations card to choose a demo. See samples/SCENARIOS.md for the available actions.')
  })

  return {
    async onExit (context: TurnContext): Promise<void> {
      demos.clear(context)
    },
    async run (context: TurnContext): Promise<void> {
      if (context.activity.channelId !== 'msteams') {
        await context.sendActivity('This sample requires Microsoft Teams. Open the installed app in a personal chat, group chat, or team channel.')
        return
      }

      if (context.activity.type === 'message' && isRecipientTargeted(context.activity)) {
        if (context.activity.from?.id) {
          try {
            await new TeamsTurnContext(context).sendTargetedActivity('This private reply includes your original message in Prompt Preview.', context.activity.from)
          } catch {
            console.error('Teams private reply could not be delivered.')
          }
        }
        return
      }

      try {
        if (await demos.shouldRun(context)) {
          await app.run(context)
        }
      } catch {
        if (context.activity.type === 'invoke') {
          await context.sendActivity(Activity.fromObject({ type: 'invokeResponse', value: { status: 500 } }))
        } else if (context.activity.type === 'message') {
          await context.sendActivity('The Teams operation failed. Check app installation, channel credentials, and member access. Use samples/SCENARIOS.md for setup, then retry.')
        } else {
          console.error('Teams conversation event could not be processed.')
        }
      }
    }
  }
}
