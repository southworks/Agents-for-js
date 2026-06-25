// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Activity, ActivityTypes } from '@microsoft/agents-activity'
import { AgentApplication, RouteHandler, RouteRank, RouteSelector, TurnContext, TurnState } from '@microsoft/agents-hosting'
import { parseTeamsChannelData } from '../activity-extensions'
import type { O365ConnectorCardActionQuery } from '@microsoft/teams.api'
import { TeamsTurnContext } from '../teamsTurnContext'
import { createTeamsRouteHandler, type TeamsRouteHandler } from '../teamsRouteHandler'

type O365ConnectorCardActionHandler<TState extends TurnState> = (context: TeamsTurnContext, state: TState, query: O365ConnectorCardActionQuery) => Promise<void>
type ReadReceiptHandler<TState extends TurnState> = (context: TeamsTurnContext, state: TState, data: unknown) => Promise<void>

export class Message<TState extends TurnState = TurnState> {
  private _app: AgentApplication<TState>

  constructor (app: AgentApplication<TState>) {
    this._app = app
  }

  onMessageEdit (handler: TeamsRouteHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      const channelData = parseTeamsChannelData(context.activity.channelData)
      return Promise.resolve(
        context.activity.type === ActivityTypes.MessageUpdate &&
        context.activity.channelId === 'msteams' &&
        channelData?.eventType === 'editMessage'
      )
    }
    this._app.addRoute(routeSel, createTeamsRouteHandler(handler), false, rank, authHandlers)
    return this
  }

  onMessageDelete (handler: TeamsRouteHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      const channelData = parseTeamsChannelData(context.activity.channelData)
      return Promise.resolve(
        context.activity.type === ActivityTypes.MessageDelete &&
        context.activity.channelId === 'msteams' &&
        channelData?.eventType === 'softDeleteMessage'
      )
    }
    this._app.addRoute(routeSel, createTeamsRouteHandler(handler), false, rank, authHandlers)
    return this
  }

  onMessageUndelete (handler: TeamsRouteHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      const channelData = parseTeamsChannelData(context.activity.channelData)
      return Promise.resolve(
        context.activity.type === ActivityTypes.MessageUpdate &&
        context.activity.channelId === 'msteams' &&
        channelData?.eventType === 'undeleteMessage'
      )
    }
    this._app.addRoute(routeSel, createTeamsRouteHandler(handler), false, rank, authHandlers)
    return this
  }

  onReadReceipt (handler: ReadReceiptHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      return Promise.resolve(
        context.activity.type === ActivityTypes.Event &&
        context.activity.channelId === 'msteams' &&
        context.activity.name === 'application/vnd.microsoft.readReceipt'
      )
    }
    const routeHandler: RouteHandler<TState> = async (context: TurnContext, state: TState) => {
      await handler(new TeamsTurnContext(context), state, context.activity.value)
    }
    this._app.addRoute(routeSel, routeHandler, false, rank, authHandlers)
    return this
  }

  onO365ConnectorCardAction (handler: O365ConnectorCardActionHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      return Promise.resolve(
        context.activity.type === ActivityTypes.Invoke &&
        context.activity.channelId === 'msteams' &&
        context.activity.name === 'actionableMessage/executeAction'
      )
    }
    const routeHandler: RouteHandler<TState> = async (context: TurnContext, state: TState) => {
      const query = (context.activity.value ?? {}) as O365ConnectorCardActionQuery
      await handler(new TeamsTurnContext(context), state, query)
      const invokeResponse = new Activity(ActivityTypes.InvokeResponse)
      invokeResponse.value = { status: 200 }
      await context.sendActivity(invokeResponse)
    }
    this._app.addRoute(routeSel, routeHandler, true, rank, authHandlers)
    return this
  }
}
