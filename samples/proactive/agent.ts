// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { AgentApplication, CardFactory, Conversation, MemoryStorage, MessageFactory, type CloudAdapter, type TurnContext } from '@microsoft/agents-hosting'
import { createProactiveTrigger } from './httpTrigger.js'
import { getSessionKey } from '../_shared/sessionKey.js'

interface Reminder {
  conversation: Conversation
  timer?: ReturnType<typeof setTimeout>
  sending: boolean
}

const reminderDelayMs = 5000

export function createProactiveAgent (adapter: CloudAdapter, addResultNavigation: (context: TurnContext) => void) {
  const reminders = new Map<string, Reminder>()
  const failedDeliveries = new Set<string>()
  const browserLinks = new Map<string, () => void>()
  const app = new AgentApplication({ adapter, storage: new MemoryStorage(), proactive: {} })

  async function deliverReminder (key: string, reminder: Reminder, text: string): Promise<boolean> {
    reminder.sending = true
    try {
      // Keep only the SDK conversation reference, never the expired inbound context.
      await app.proactive.continueConversation(adapter, reminder.conversation, async context => {
        addResultNavigation(context)
        await context.sendActivity(text)
      })
      return true
    } catch {
      failedDeliveries.add(key)
      console.error('Could not deliver the proactive reminder. Check channel configuration and try again.')
      return false
    } finally {
      reminders.delete(key)
    }
  }

  async function scheduleReminder (context: TurnContext, key: string, delay: number): Promise<void> {
    if (reminders.has(key)) {
      await context.sendActivity('A reminder is already on its way. You can keep chatting while you wait.')
      return
    }

    const conversation = new Conversation(context)
    conversation.validate()
    const reminder: Reminder = { conversation, sending: false }
    reminders.set(key, reminder)
    failedDeliveries.delete(key)

    try {
      await context.sendActivity(delay
        ? 'I’ll send your reminder in about five seconds.'
        : 'I’ll send a separate proactive message here shortly.')
    } catch (error) {
      if (reminders.get(key) === reminder) {
        reminders.delete(key)
      }
      throw error
    }

    // Cancellation can arrive while the acknowledgement is being delivered.
    if (reminders.get(key) === reminder) {
      reminder.timer = setTimeout(async () => {
        await deliverReminder(key, reminder, delay
          ? 'Here’s your proactive reminder.'
          : 'This proactive message was sent after your chat request.')
      }, delay)
    }
  }

  async function offerBrowserLink (context: TurnContext, key: string): Promise<void> {
    const conversation = new Conversation(context)
    conversation.validate()
    browserLinks.get(key)?.()
    const { url, revoke } = createProactiveTrigger(async () => {
      if (reminders.has(key)) {
        return false
      }
      failedDeliveries.delete(key)
      const reminder = { conversation, sending: false }
      reminders.set(key, reminder)
      if (!(await deliverReminder(key, reminder, 'This proactive message was triggered by your browser request.'))) {
        throw new Error('Proactive delivery failed.')
      }
      return true
    }, () => browserLinks.delete(key))
    browserLinks.set(key, revoke)
    try {
      await context.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard({
        type: 'AdaptiveCard',
        version: '1.3',
        body: [{ type: 'TextBlock', text: 'This one-time link expires in two minutes.', wrap: true }],
        actions: [{ type: 'Action.OpenUrl', title: 'Send from browser', url }]
      })))
    } catch (error) {
      revoke()
      throw error
    }
  }

  async function cancelReminder (context: TurnContext, key: string): Promise<void> {
    const reminder = reminders.get(key)
    if (!reminder) {
      await context.sendActivity('There is no pending reminder.')
      return
    }
    if (reminder.sending) {
      await context.sendActivity('The reminder is already being delivered. Wait for it to finish.')
      return
    }

    clearTimeout(reminder.timer)
    reminders.delete(key)
    await context.sendActivity('Proactive · Reminder canceled.')
  }

  return {
    async canExit (context: TurnContext): Promise<boolean> {
      const key = getSessionKey(context)
      return !key || !reminders.has(key)
    },
    async onExit (context: TurnContext): Promise<void> {
      const key = getSessionKey(context)
      if (key) {
        browserLinks.get(key)?.()
      }
    },
    async run (context: TurnContext): Promise<void> {
      if (context.activity.type !== 'message') {
        return
      }

      const key = getSessionKey(context)
      if (!key) {
        return
      }
      try {
        if (failedDeliveries.delete(key)) {
          await context.sendActivity('The last reminder could not be delivered. Check channel configuration with samples/SCENARIOS.md, then try again.')
        }

        switch (context.activity.text?.trim()) {
          case 'remind':
            await scheduleReminder(context, key, reminderDelayMs)
            break
          case 'send-proactive':
            await scheduleReminder(context, key, 0)
            break
          case 'proactive-link':
            await offerBrowserLink(context, key)
            break
          case 'cancel-reminder':
            await cancelReminder(context, key)
            break
          default:
            await context.sendActivity(reminders.has(key)
              ? 'Message received. Your reminder is still on its way.'
              : 'Select Send proactive message or Create browser link.')
        }
      } catch {
        await context.sendActivity('Could not set up the reminder. Check channel credentials and configuration with samples/SCENARIOS.md, then try again.')
      }
    }
  }
}
