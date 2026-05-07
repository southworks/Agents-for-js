// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ActivityTypes } from '@microsoft/agents-activity'
import { AgentApplication, RouteHandler, RouteRank, RouteSelector, TurnContext, TurnState } from '@microsoft/agents-hosting'
import { parseTeamsChannelData } from '../activity-extensions'

const CHANNEL_EVENT_TYPES = ['channelCreated', 'channelDeleted', 'channelRenamed', 'channelRestored', 'channelShared', 'channelUnshared']

export class TeamsChannel<TState extends TurnState = TurnState> {
  private _app: AgentApplication<TState>

  constructor (app: AgentApplication<TState>) {
    this._app = app
  }

  onChannelEventReceived (handler: RouteHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      const channelData = parseTeamsChannelData(context.activity.channelData)
      return Promise.resolve(
        context.activity.type === ActivityTypes.ConversationUpdate &&
        context.activity.channelId === 'msteams' &&
        !!channelData?.eventType &&
        CHANNEL_EVENT_TYPES.includes(channelData.eventType as string)
      )
    }
    this._app.addRoute(routeSel, handler, false, rank, authHandlers)
    return this
  }

  onCreated (handler: RouteHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      const channelData = parseTeamsChannelData(context.activity.channelData)
      return Promise.resolve(
        context.activity.type === ActivityTypes.ConversationUpdate &&
        context.activity.channelId === 'msteams' &&
        channelData?.eventType === 'channelCreated'
      )
    }
    this._app.addRoute(routeSel, handler, false, rank, authHandlers)
    return this
  }

  onDeleted (handler: RouteHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      const channelData = parseTeamsChannelData(context.activity.channelData)
      return Promise.resolve(
        context.activity.type === ActivityTypes.ConversationUpdate &&
        context.activity.channelId === 'msteams' &&
        channelData?.eventType === 'channelDeleted'
      )
    }
    this._app.addRoute(routeSel, handler, false, rank, authHandlers)
    return this
  }

  onRenamed (handler: RouteHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      const channelData = parseTeamsChannelData(context.activity.channelData)
      return Promise.resolve(
        context.activity.type === ActivityTypes.ConversationUpdate &&
        context.activity.channelId === 'msteams' &&
        channelData?.eventType === 'channelRenamed'
      )
    }
    this._app.addRoute(routeSel, handler, false, rank, authHandlers)
    return this
  }

  onRestored (handler: RouteHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      const channelData = parseTeamsChannelData(context.activity.channelData)
      return Promise.resolve(
        context.activity.type === ActivityTypes.ConversationUpdate &&
        context.activity.channelId === 'msteams' &&
        channelData?.eventType === 'channelRestored'
      )
    }
    this._app.addRoute(routeSel, handler, false, rank, authHandlers)
    return this
  }

  onShared (handler: RouteHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      const channelData = parseTeamsChannelData(context.activity.channelData)
      return Promise.resolve(
        context.activity.type === ActivityTypes.ConversationUpdate &&
        context.activity.channelId === 'msteams' &&
        channelData?.eventType === 'channelShared'
      )
    }
    this._app.addRoute(routeSel, handler, false, rank, authHandlers)
    return this
  }

  onUnshared (handler: RouteHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      const channelData = parseTeamsChannelData(context.activity.channelData)
      return Promise.resolve(
        context.activity.type === ActivityTypes.ConversationUpdate &&
        context.activity.channelId === 'msteams' &&
        channelData?.eventType === 'channelUnshared'
      )
    }
    this._app.addRoute(routeSel, handler, false, rank, authHandlers)
    return this
  }

  onMemberAdded (handler: RouteHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      return Promise.resolve(
        context.activity.type === ActivityTypes.ConversationUpdate &&
        context.activity.channelId === 'msteams' &&
        !!context.activity.membersAdded &&
        context.activity.membersAdded.length > 0
      )
    }
    this._app.addRoute(routeSel, handler, false, rank, authHandlers)
    return this
  }

  onMemberRemoved (handler: RouteHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      return Promise.resolve(
        context.activity.type === ActivityTypes.ConversationUpdate &&
        context.activity.channelId === 'msteams' &&
        !!context.activity.membersRemoved &&
        context.activity.membersRemoved.length > 0
      )
    }
    this._app.addRoute(routeSel, handler, false, rank, authHandlers)
    return this
  }
}
