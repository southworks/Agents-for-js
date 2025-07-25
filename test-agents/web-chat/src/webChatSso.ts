// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ActivityHandler, CardFactory, MessageFactory, TurnContext, Storage, OAuthFlow, UserTokenClient } from '@microsoft/agents-hosting'
import { Template } from 'adaptivecards-templating'
import * as userTemplate from '../cards/UserProfileCard.json'
import { getUserInfo } from './userGraphClient'

export class WebChatSsoHandler extends ActivityHandler {
  oAuthFlow: OAuthFlow

  constructor (storage: Storage) {
    super()
    this.oAuthFlow = new OAuthFlow(storage, process.env.connectionName!, new UserTokenClient(process.env.clientId!))

    this.onConversationUpdate(async (context, next) => {
      await context.sendActivity('Welcome to the Web Chat SSO sample. Type "signin" to sign in or "signout" to sign out.')
      const tokenResponse = await this.oAuthFlow.beginFlow(context)
      if (tokenResponse && tokenResponse.token) {
        await this.sendLoggedUserInfo(context, tokenResponse.token!)
      }
      await next()
    })

    this.onMessage(async (context, next) => {
      if (context.activity.text === 'signout') {
        await this.oAuthFlow.signOut(context)
        await context.sendActivity(MessageFactory.text('User signed out'))
        return
      } else if (context.activity.text === 'signin') {
        await this.beginOAuthFlow(context)
      } else {
        if (/^\d{6}$/.test(context.activity.text!)) {
          const tokenResponse = await this.oAuthFlow.continueFlow(context)
          if (tokenResponse && tokenResponse.token) {
            await this.sendLoggedUserInfo(context, tokenResponse.token!)
          } else {
            await context.sendActivity(MessageFactory.text('Invalid code. Please try again.'))
          }
        } else {
          await context.sendActivity(MessageFactory.text('Please enter "signin" to sign in or "signour" to sign out'))
        }
      }

      await next()
    })

    this.onSignInInvoke(async (context, next) => {
      console.log('SignInInvoke event triggered')
      const tokenResponse = await this.oAuthFlow.continueFlow(context)
      if (tokenResponse && tokenResponse.token) {
        await this.sendLoggedUserInfo(context, tokenResponse.token!)
      }
      await next()
    })
  }

  async beginOAuthFlow (context: TurnContext): Promise<void> {
    const tokenResponse = await this.oAuthFlow.beginFlow(context)
    if (tokenResponse && tokenResponse.token) {
      await this.sendLoggedUserInfo(context, tokenResponse.token!)
    } else {
      await context.sendActivity(MessageFactory.text('Authentication in progress '))
    }
  }

  async sendLoggedUserInfo (context: TurnContext, token:string): Promise<void> {
    const template = new Template(userTemplate)
    const userInfo = await getUserInfo(token)
    const card = template.expand(userInfo)
    // await context.sendActivity(JSON.stringify(userInfo))
    const activity = MessageFactory.attachment(CardFactory.adaptiveCard(card))
    await context.sendActivity(activity)
  }

  async run (context: TurnContext) {
    await super.run(context)
  }
}
