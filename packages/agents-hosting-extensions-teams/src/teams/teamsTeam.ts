// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ActivityTypes } from '@microsoft/agents-activity'
import { AgentApplication, RouteHandler, RouteRank, RouteSelector, TurnContext, TurnState } from '@microsoft/agents-hosting'
import { parseTeamsChannelData } from '../activity-extensions'

const TEAM_EVENT_TYPES = ['teamArchived', 'teamUnarchived', 'teamRenamed', 'teamRestored', 'teamDeleted', 'teamHardDeleted']

export class TeamsTeam<TState extends TurnState = TurnState> {
  private _app: AgentApplication<TState>

  constructor (app: AgentApplication<TState>) {
    this._app = app
  }

  onTeamEventReceived (handler: RouteHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      const channelData = parseTeamsChannelData(context.activity.channelData)
      return Promise.resolve(
        context.activity.type === ActivityTypes.ConversationUpdate &&
        context.activity.channelId === 'msteams' &&
        !!channelData?.eventType &&
        TEAM_EVENT_TYPES.includes(channelData.eventType as string)
      )
    }
    this._app.addRoute(routeSel, handler, false, rank, authHandlers)
    return this
  }

  onArchived (handler: RouteHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      const channelData = parseTeamsChannelData(context.activity.channelData)
      return Promise.resolve(
        context.activity.type === ActivityTypes.ConversationUpdate &&
        context.activity.channelId === 'msteams' &&
        channelData?.eventType === 'teamArchived'
      )
    }
    this._app.addRoute(routeSel, handler, false, rank, authHandlers)
    return this
  }

  onUnarchived (handler: RouteHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      const channelData = parseTeamsChannelData(context.activity.channelData)
      return Promise.resolve(
        context.activity.type === ActivityTypes.ConversationUpdate &&
        context.activity.channelId === 'msteams' &&
        channelData?.eventType === 'teamUnarchived'
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
        channelData?.eventType === 'teamRenamed'
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
        channelData?.eventType === 'teamRestored'
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
        channelData?.eventType === 'teamDeleted'
      )
    }
    this._app.addRoute(routeSel, handler, false, rank, authHandlers)
    return this
  }

  onHardDeleted (handler: RouteHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      const channelData = parseTeamsChannelData(context.activity.channelData)
      return Promise.resolve(
        context.activity.type === ActivityTypes.ConversationUpdate &&
        context.activity.channelId === 'msteams' &&
        channelData?.eventType === 'teamHardDeleted'
      )
    }
    this._app.addRoute(routeSel, handler, false, rank, authHandlers)
    return this
  }
}
