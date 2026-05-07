// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ActivityTypes } from '@microsoft/agents-activity'
import { AgentApplication, RouteHandler, RouteRank, RouteSelector, TurnContext, TurnState } from '@microsoft/agents-hosting'

export class Configuration<TState extends TurnState = TurnState> {
  private _app: AgentApplication<TState>

  constructor (app: AgentApplication<TState>) {
    this._app = app
  }

  onConfigFetch (handler: RouteHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      return Promise.resolve(
        context.activity.type === ActivityTypes.Invoke &&
        context.activity.channelId === 'msteams' &&
        context.activity.name === 'config/fetch'
      )
    }
    this._app.addRoute(routeSel, handler, true, rank, authHandlers)
    return this
  }

  onConfigSubmit (handler: RouteHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      return Promise.resolve(
        context.activity.type === ActivityTypes.Invoke &&
        context.activity.channelId === 'msteams' &&
        context.activity.name === 'config/submit'
      )
    }
    this._app.addRoute(routeSel, handler, true, rank, authHandlers)
    return this
  }
}
