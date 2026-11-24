// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
import { ActivityHandler, ConversationState, TurnContext, UserState, AgentStatePropertyAccessor, Storage } from '@microsoft/agents-hosting'

interface ConversationData {
  promptedForUserName: boolean;
  timestamp?: string;
  channelId?: string;
}

interface UserProfile {
  name?: string;
}

export class StateManagementHandler extends ActivityHandler {
  conversationState: ConversationState
  userState: UserState
  conversationDataAccessor: AgentStatePropertyAccessor<ConversationData>
  userProfileAccessor: AgentStatePropertyAccessor<UserProfile>

  constructor (storage: Storage) {
    super()

    this.conversationState = new ConversationState(storage)
    this.userState = new UserState(storage)

    this.conversationDataAccessor = this.conversationState.createProperty<ConversationData>('conversationData')
    this.userProfileAccessor = this.userState.createProperty<UserProfile>('userProfile')

    this.onMessage(async (turnContext, next) => {
      try {
        const text = turnContext.activity.text?.trim()
        if (text === '/reset') {
          await this.conversationDataAccessor.delete(turnContext)
          await this.userProfileAccessor.delete(turnContext)
          await turnContext.sendActivity('Conversation and user state cleared.')
        } else {
          const profile = await this.userProfileAccessor.get(turnContext, {})
          const conversation = await this.conversationDataAccessor.get(turnContext, { promptedForUserName: false })

          if (!profile.name) {
            if (conversation.promptedForUserName && text && text !== '/start') {
              profile.name = text
              conversation.promptedForUserName = false
              await turnContext.sendActivity(`Thanks, ${profile.name}. Send a message to try the stored profile.`)
            } else {
              conversation.promptedForUserName = true
              await turnContext.sendActivity('What is your name?')
            }
          } else if (text === '/start') {
            await turnContext.sendActivity(`Your stored name is ${profile.name}. Send a message to continue.`)
          } else {
            conversation.timestamp = (turnContext.activity.timestamp ?? new Date()).toLocaleString()
            conversation.channelId = turnContext.activity.channelId
            await turnContext.sendActivity(`${profile.name} sent: ${text ?? ''}`)
          }
        }
      } catch (error) {
        console.error('State accessor error:', error)
        await turnContext.sendActivity('Sorry, there was an error processing your message.')
      }

      await next()
    })
  }

  async run (context: TurnContext) {
    await super.run(context)

    await this.conversationState.saveChanges(context, false)
    await this.userState.saveChanges(context, false)
  }
}
