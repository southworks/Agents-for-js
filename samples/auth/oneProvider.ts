// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { startServer } from '@microsoft/agents-hosting-express'
import { AgentApplication, MemoryStorage, MessageFactory, TurnContext, TurnState } from '@microsoft/agents-hosting'

class OneProvider extends AgentApplication<TurnState> {
  constructor () {
    super({
      storage: new MemoryStorage(),
      authorization: {
        graph: { name: 'SSOSelf' }
      }
    })
    this.onConversationUpdate('membersAdded', this._status)
    this.authorization.onSignInSuccess(this._singinSuccess)
    this.onMessage('logout', this._logout)
    this.onActivity('invoke', this._invoke)
    this.onActivity('message', this._message, ['graph'])
  }

  private _status = async (context: TurnContext, state: TurnState): Promise<void> => {
    await context.sendActivity(MessageFactory.text('Welcome to the Basic App demo!'))
    const tresp = await this.authorization.getToken(context, 'graph')
    if (tresp && tresp.token) {
      await context.sendActivity(MessageFactory.text('Token received: ' + tresp.token?.length))
    } else {
      await context.sendActivity(MessageFactory.text('Token request status: '))
    }
  }

  private _logout = async (context: TurnContext, state: TurnState): Promise<void> => {
    await this.authorization.signOut(context, state, 'graph')
    await context.sendActivity(MessageFactory.text('user logged out'))
  }

  private _invoke = async (context: TurnContext, state: TurnState): Promise<void> => {
    await context.sendActivity(MessageFactory.text('Invoke received.'))
  }

  private _singinSuccess = async (context: TurnContext, state: TurnState): Promise<void> => {
    await context.sendActivity(MessageFactory.text('User signed in successfully'))
  }

  private _message = async (context: TurnContext, state: TurnState): Promise<void> => {
    await this.authorization.beginOrContinueFlow(context, state, 'graph')
    await context.sendActivity(MessageFactory.text('You said.' + context.activity.text))
  }
}

startServer(new OneProvider())
