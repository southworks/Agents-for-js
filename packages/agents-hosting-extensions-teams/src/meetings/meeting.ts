// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ActivityTypes } from '@microsoft/agents-activity'
import { AgentApplication, RouteHandler, RouteRank, RouteSelector, TurnContext, TurnState } from '@microsoft/agents-hosting'

export class Meeting<TState extends TurnState> {
  private _app: AgentApplication<TState>

  constructor (app: AgentApplication<TState>) {
    this._app = app
  }

  onStart (handler: RouteHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      return Promise.resolve(
        context.activity.type === ActivityTypes.Event &&
        context.activity.channelId === 'msteams' &&
        context.activity.name === 'application/vnd.microsoft.meetingStart'
      )
    }
    this._app.addRoute(routeSel, handler, false, rank, authHandlers)
    return this
  }

  onEnd (handler: RouteHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      return Promise.resolve(
        context.activity.type === ActivityTypes.Event &&
        context.activity.channelId === 'msteams' &&
        context.activity.name === 'application/vnd.microsoft.meetingEnd'
      )
    }
    this._app.addRoute(routeSel, handler, false, rank, authHandlers)
    return this
  }

  onParticipantsJoin (handler: RouteHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      return Promise.resolve(
        context.activity.type === ActivityTypes.Event &&
        context.activity.channelId === 'msteams' &&
        context.activity.name === 'application/vnd.microsoft.meetingParticipantJoin'
      )
    }
    this._app.addRoute(routeSel, handler, false, rank, authHandlers)
    return this
  }

  onParticipantsLeave (handler: RouteHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      return Promise.resolve(
        context.activity.type === ActivityTypes.Event &&
        context.activity.channelId === 'msteams' &&
        context.activity.name === 'application/vnd.microsoft.meetingParticipantLeave'
      )
    }
    this._app.addRoute(routeSel, handler, false, rank, authHandlers)
    return this
  }
}
