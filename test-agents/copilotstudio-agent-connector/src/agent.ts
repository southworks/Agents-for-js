// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import axios, { AxiosInstance } from 'axios'
import { startServer } from '@microsoft/agents-hosting-express'
import { AgentApplication, MemoryStorage, RouteSelector, TokenResponse, TurnContext, TurnState } from '@microsoft/agents-hosting'
import { ActivityTypes } from '../../../packages/agents-activity/dist/src/activityTypes'
import { RoleTypes } from '../../../packages/agents-activity/dist/src/conversation/roleTypes'

class AgentConnector extends AgentApplication<TurnState> {
  constructor () {
    super({
      startTypingTimer: true,
      storage: new MemoryStorage(),
      authorization: {
        graph: { text: 'Sign in with Microsoft Graph', title: 'Graph Sign In' }
      }
    })

    this.onConversationUpdate('membersAdded', this.welcome)
    this.onActivity(this.mcsMessageSelector, this.mcsMessage)
  }

  welcome = async (context: TurnContext) => {
    await context.sendActivity('Welcome to the MCS Connector sample!')
  }

  echo = async (context: TurnContext) => {
    await context.sendActivity(`You said now: ${context.activity.text}`)
  }

  mcsMessage = async (ctx: TurnContext, state: TurnState) => {
    const accessToken = await this.authorization.getToken(ctx, 'graph')
    const name = this.getDisplayName(accessToken)
    await ctx.sendActivity(`Hi ${name}!`)
  }

  mcsMessageSelector: RouteSelector = async (context: TurnContext) => {
    if (context.activity.type === ActivityTypes.Message &&
        context.activity.recipient?.role &&
        context.activity.recipient.role === RoleTypes.ConnectorUser) {
      return true
    } else {
      return false
    }
  }

  private async getDisplayName (tokenResponse: TokenResponse) {
    let displayName = 'Unknown'
    if (tokenResponse.token) {
      const graphInfo = await this.getGraphInfo(tokenResponse.token)
      if (graphInfo) {
        displayName = graphInfo.displayName
      }
    }
    return displayName
  }

  private async getGraphInfo (token: string) {
    const graphApiUrl = 'https://graph.microsoft.com/v1.0/me'
    try {
      const axiosInstance: AxiosInstance = axios.create({ baseURL: graphApiUrl })
      axiosInstance.defaults.headers.common.Authorization = `Bearer ${token}`

      const response = await axiosInstance.get(graphApiUrl)
      if (response.status === 200) {
        const content = response.data
        return JSON.parse(content)
      }
    } catch (err) {
      // Handle error response from Graph API
      console.log(`Error getting display name: ${(err as Error).message}`)
    }
    return undefined
  }
}

startServer(new AgentConnector())
