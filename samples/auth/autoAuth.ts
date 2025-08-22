// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { startServer } from '@microsoft/agents-hosting-express'
import { AgentApplication, AutoAuth, CardFactory, MemoryStorage, MessageFactory, TurnContext, TurnState } from '@microsoft/agents-hosting'
import { Template } from 'adaptivecards-templating'
import { getUserInfo } from '../_shared/userGraphClient.js'
import { getCurrentProfile, getPullRequests } from '../_shared/githubApiClient.js'

const auth = AutoAuth.create({
  graph: { text: 'Sign in with Microsoft Graph', title: 'Graph Sign In', },
  github: { text: 'Sign in with GitHub', title: 'GitHub Sign In', },
})

class OneProvider extends AgentApplication<TurnState> {
  constructor () {
    super({ storage: new MemoryStorage() })

    this.onConversationUpdate('membersAdded', this._status)
    this.onMessage('/logout', this._logout, [auth.graph, auth.github])
    this.onMessage('/me', this._profileRequest, [auth.graph])
    this.onMessage('/prs', this._pullRequests, [auth.github])
    this.onMessage('/status', this._status, [auth.graph, auth.github])
    this.onActivity('invoke', this._invoke)
    this.onActivity('message', this._message)

    // this.authorization.onSignInSuccess(this._singinSuccess)
    // this.authorization.onSignInFailure(this._singinFailure)
  }

  private async _status (context: TurnContext): Promise<void> {
    await context.sendActivity(MessageFactory.text('Welcome to the App Routes with auth demo!'))
    const graph = auth.graph.context(context)
    const github = auth.github.context(context)
    const statusGraph = graph.token !== undefined
    const statusGH = github.token !== undefined
    await context.sendActivity(MessageFactory.text(`Token status: Graph:${statusGraph} GH:${statusGH}`))
  }

  private async _logout (context: TurnContext): Promise<void> {
    const graph = auth.graph.context(context)
    const github = auth.github.context(context)
    await graph.logout()
    await github.logout()
    await context.sendActivity(MessageFactory.text('user logged out'))
  }

  private async _invoke (context: TurnContext): Promise<void> {
    await context.sendActivity(MessageFactory.text('Invoke received.'))
  }

  private async _message (context: TurnContext): Promise<void> {
    await context.sendActivity(MessageFactory.text('You said.' + context.activity.text))
  }

  private async _profileRequest (context: TurnContext): Promise<void> {
    const graph = auth.graph.context(context)
    const userTemplate = (await import('./../_resources/UserProfileCard.json'))
    const template = new Template(userTemplate)
    const userInfo = await getUserInfo(graph.token)
    const card = template.expand(userInfo)
    const activity = MessageFactory.attachment(CardFactory.adaptiveCard(card))
    await context.sendActivity(activity)
  }

  private async _pullRequests (context: TurnContext): Promise<void> {
    const github = auth.github.context(context)
    const ghProf = await getCurrentProfile(github.token)
    const userTemplate = (await import('./../_resources/UserProfileCard.json'))
    const template = new Template(userTemplate)
    const card = template.expand(ghProf)
    const activity = MessageFactory.attachment(CardFactory.adaptiveCard(card))
    await context.sendActivity(activity)

    const prs = await getPullRequests('microsoft', 'agents', github.token)
    for (const pr of prs) {
      const prCard = (await import('./../_resources/PullRequestCard.json'))
      const template = new Template(prCard)
      const toExpand = {
        $root: {
          title: pr.title,
          url: pr.url,
          id: pr.id,
        }
      }
      const card = template.expand(toExpand)
      await context.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(card)))
    }
  }

  // private _singinSuccess = async (context: TurnContext, state: TurnState, authId?: string): Promise<void> => {
  //   await context.sendActivity(MessageFactory.text(`User signed in successfully in ${authId}`))
  // }

  // private _singinFailure = async (context: TurnContext, state: TurnState, authId?: string, err?: string): Promise<void> => {
  //   await context.sendActivity(MessageFactory.text(`Signing Failure in auth handler: ${authId} with error: ${err}`))
  // }
}
startServer(new OneProvider())
