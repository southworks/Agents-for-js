// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { startServer } from '@microsoft/agents-hosting-express'
import { AgentApplication, Authorization, CardFactory, MemoryStorage, MessageFactory, TurnContext } from '@microsoft/agents-hosting'
import { Template } from 'adaptivecards-templating'
import { getUserInfo } from '../_shared/userGraphClient.js'
import { getCurrentProfile, getPullRequests } from '../_shared/githubApiClient.js'
import { BlobsStorage } from '../../packages/agents-hosting-storage-blob/src/blobsStorage.js'

const app = new AgentApplication({ storage: new BlobsStorage('test', 'UseDevelopmentStorage=true;') })

const auth = new Authorization(app).create({
  graph: { text: 'Sign in with Microsoft Graph', title: 'Graph Sign In', },
  github: { text: 'Sign in with GitHub', title: 'GitHub Sign In', },
})

// app.onConversationUpdate('membersAdded', _status, [auth.graph, auth.github])
app.onMessage('/logout', _logout)
app.onMessage('/me', _profileRequest, [auth.graph])
app.onMessage('/prs', _pullRequests, [auth.github])
app.onMessage('/status', _status, [auth.graph, auth.github])
app.onActivity('invoke', _invoke)
app.onActivity('message', _message)

async function _status (context: TurnContext): Promise<void> {
  await context.sendActivity(MessageFactory.text('Welcome to the App Routes with auth demo!'))
  const graph = auth.graph.context(context)
  const github = auth.github.context(context)
  const statusGraph = graph.token !== undefined
  const statusGH = github.token !== undefined
  await context.sendActivity(MessageFactory.text(`Token status: Graph:${statusGraph} GH:${statusGH}`))
}

async function _logout (context: TurnContext): Promise<void> {
  await auth.graph.logout(context)
  await auth.github.logout(context)
  await context.sendActivity(MessageFactory.text('user logged out'))
}

async function _profileRequest (context: TurnContext): Promise<void> {
  const graph = auth.graph.context(context)
  const userTemplate = (await import('./../_resources/UserProfileCard.json'))
  const template = new Template(userTemplate)
  const userInfo = await getUserInfo(graph.token)
  const card = template.expand(userInfo)
  const activity = MessageFactory.attachment(CardFactory.adaptiveCard(card))
  await context.sendActivity(activity)
}

async function _invoke (context: TurnContext): Promise<void> {
  await context.sendActivity(MessageFactory.text('Invoke received.'))
}

async function _message (context: TurnContext): Promise<void> {
  await context.sendActivity(MessageFactory.text('You said.' + context.activity.text))
}

async function _pullRequests (context: TurnContext): Promise<void> {
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

// this.authorization.onSignInSuccess(this._singinSuccess)
// this.authorization.onSignInFailure(this._singinFailure)

// private _singinSuccess = async (context: TurnContext, state: TurnState, authId?: string): Promise<void> => {
//   await context.sendActivity(MessageFactory.text(`User signed in successfully in ${authId}`))
// }

// private _singinFailure = async (context: TurnContext, state: TurnState, authId?: string, err?: string): Promise<void> => {
//   await context.sendActivity(MessageFactory.text(`Signing Failure in auth handler: ${authId} with error: ${err}`))
// }

startServer(app)
