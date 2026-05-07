// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ActivityTypes } from '@microsoft/agents-activity'
import { AgentApplication, RouteHandler, RouteRank, RouteSelector, TurnContext, TurnState } from '@microsoft/agents-hosting'
import { parseTeamsChannelData } from '../activity-extensions'

export class Message<TState extends TurnState = TurnState> {
  private _app: AgentApplication<TState>

  constructor (app: AgentApplication<TState>) {
    this._app = app
  }

  onMessageEdit (handler: RouteHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      const channelData = parseTeamsChannelData(context.activity.channelData)
      return Promise.resolve(
        context.activity.type === ActivityTypes.MessageUpdate &&
        context.activity.channelId === 'msteams' &&
        channelData?.eventType === 'editMessage'
      )
    }
    this._app.addRoute(routeSel, handler, false, rank, authHandlers)
    return this
  }

  onMessageDelete (handler: RouteHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      const channelData = parseTeamsChannelData(context.activity.channelData)
      return Promise.resolve(
        context.activity.type === ActivityTypes.MessageDelete &&
        context.activity.channelId === 'msteams' &&
        channelData?.eventType === 'softDeleteMessage'
      )
    }
    this._app.addRoute(routeSel, handler, false, rank, authHandlers)
    return this
  }

  onMessageUndelete (handler: RouteHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      const channelData = parseTeamsChannelData(context.activity.channelData)
      return Promise.resolve(
        context.activity.type === ActivityTypes.MessageUpdate &&
        context.activity.channelId === 'msteams' &&
        channelData?.eventType === 'undeleteMessage'
      )
    }
    this._app.addRoute(routeSel, handler, false, rank, authHandlers)
    return this
  }

  onReadReceipt (handler: RouteHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      return Promise.resolve(
        context.activity.type === ActivityTypes.Event &&
        context.activity.channelId === 'msteams' &&
        context.activity.name === 'application/vnd.microsoft.readReceipt'
      )
    }
    this._app.addRoute(routeSel, handler, false, rank, authHandlers)
    return this
  }

  onO365ConnectorCardAction (handler: RouteHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      return Promise.resolve(
        context.activity.type === ActivityTypes.Invoke &&
        context.activity.channelId === 'msteams' &&
        context.activity.name === 'actionableMessage/executeAction'
      )
    }
    this._app.addRoute(routeSel, handler, true, rank, authHandlers)
    return this
  }
}
