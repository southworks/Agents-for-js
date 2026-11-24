// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ActivityHandler, CardFactory, MessageFactory, TurnContext } from '@microsoft/agents-hosting'
import AdaptiveCardActions from '../_resources/AdaptiveCardActions.json'
import ToggleVisible from '../_resources/ToggleVisibleCard.json'

const colors = ['Red', 'Green', 'Blue']

export class AdaptiveCardHandler extends ActivityHandler {
  constructor () {
    super()

    this.onMessage(async (context, next) => {
      const text = context.activity.text?.trim().toLowerCase()
      const data = context.activity.value as { name?: unknown, value?: unknown, color?: unknown } | undefined
      const color = colors.find(choice => choice.toLowerCase() === text || choice === data?.color)

      if (text === 'card actions') {
        await context.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(AdaptiveCardActions)))
      } else if (text === 'suggested actions') {
        await AdaptiveCardHandler.sendColorChoices(context)
      } else if (text === 'togglevisibility') {
        await context.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(ToggleVisible)))
      } else if (color) {
        await context.sendActivity(`You selected ${color}.`)
      } else if (typeof data?.name === 'string' && data.name.trim()) {
        await context.sendActivity(`Form submitted. Name: ${data.name.trim()}`)
      } else if (data?.value === 'The button has been clicked') {
        await context.sendActivity('The nested card button was clicked.')
      } else {
        await context.sendActivity('Open Adaptive Cards from the breadcrumb to choose an action.')
      }

      await next()
    })
  }

  private static async sendColorChoices (context: TurnContext): Promise<void> {
    // Playground does not support the native imBack buttons.
    if (context.activity.channelId === 'emulator' || context.activity.channelId === 'webchat') {
      await context.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard({
        type: 'AdaptiveCard',
        version: '1.3',
        body: [{ type: 'TextBlock', text: 'What is your favorite color?', wrap: true }],
        actions: colors.map(color => ({ type: 'Action.Submit', title: color, data: { color } }))
      })))
      return
    }

    const reply = MessageFactory.text('What is your favorite color?')
    reply.suggestedActions = {
      actions: colors.map(color => ({ title: color, type: 'imBack', value: color })),
      to: [context.activity.from?.id ?? 'defaultId']
    }

    await context.sendActivity(reply)
  }
}
