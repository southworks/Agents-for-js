// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ActivityTypes } from '@microsoft/agents-activity'
import { AgentApplication, RouteHandler, RouteRank, RouteSelector, TurnContext, TurnState } from '@microsoft/agents-hosting'
import { parseTeamsChannelData } from '../activity-extensions'
import type { TeamInfo } from '@microsoft/teams.api'
import { TeamsTurnContext } from '../teamsTurnContext'

const TEAM_ARCHIVED_EVENT = 'teamArchived'
const TEAM_UNARCHIVED_EVENT = 'teamUnarchived'
const TEAM_RENAMED_EVENT = 'teamRenamed'
const TEAM_RESTORED_EVENT = 'teamRestored'
const TEAM_DELETED_EVENT = 'teamDeleted'
const TEAM_HARD_DELETED_EVENT = 'teamHardDeleted'

type TeamUpdateHandler<TState extends TurnState> = (context: TeamsTurnContext, state: TState, data: TeamInfo) => Promise<void>

function isTeamUpdateEvent (context: TurnContext, eventType?: string): boolean {
  const channelData = parseTeamsChannelData(context.activity.channelData)
  const actualEventType = channelData?.eventType

  return (
    context.activity.type === ActivityTypes.ConversationUpdate &&
    context.activity.channelId === 'msteams' &&
    channelData?.team != null &&
    (
      eventType != null
        ? actualEventType === eventType
        : typeof actualEventType === 'string' && actualEventType.startsWith('team')
    )
  )
}

function getTeamInfo (context: TurnContext): TeamInfo {
  return parseTeamsChannelData(context.activity.channelData).team as TeamInfo
}

export class TeamsTeam<TState extends TurnState = TurnState> {
  private _app: AgentApplication<TState>

  constructor (app: AgentApplication<TState>) {
    this._app = app
  }

  onTeamEventReceived (handler: TeamUpdateHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      return Promise.resolve(isTeamUpdateEvent(context))
    }
    const routeHandler: RouteHandler<TState> = async (context: TurnContext, state: TState) => {
      await handler(new TeamsTurnContext(context), state, getTeamInfo(context))
    }
    this._app.addRoute(routeSel, routeHandler, false, rank, authHandlers)
    return this
  }

  onArchived (handler: TeamUpdateHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      return Promise.resolve(isTeamUpdateEvent(context, TEAM_ARCHIVED_EVENT))
    }
    const routeHandler: RouteHandler<TState> = async (context: TurnContext, state: TState) => {
      await handler(new TeamsTurnContext(context), state, getTeamInfo(context))
    }
    this._app.addRoute(routeSel, routeHandler, false, rank, authHandlers)
    return this
  }

  onUnarchived (handler: TeamUpdateHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      return Promise.resolve(isTeamUpdateEvent(context, TEAM_UNARCHIVED_EVENT))
    }
    const routeHandler: RouteHandler<TState> = async (context: TurnContext, state: TState) => {
      await handler(new TeamsTurnContext(context), state, getTeamInfo(context))
    }
    this._app.addRoute(routeSel, routeHandler, false, rank, authHandlers)
    return this
  }

  onRenamed (handler: TeamUpdateHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      return Promise.resolve(isTeamUpdateEvent(context, TEAM_RENAMED_EVENT))
    }
    const routeHandler: RouteHandler<TState> = async (context: TurnContext, state: TState) => {
      await handler(new TeamsTurnContext(context), state, getTeamInfo(context))
    }
    this._app.addRoute(routeSel, routeHandler, false, rank, authHandlers)
    return this
  }

  onRestored (handler: TeamUpdateHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      return Promise.resolve(isTeamUpdateEvent(context, TEAM_RESTORED_EVENT))
    }
    const routeHandler: RouteHandler<TState> = async (context: TurnContext, state: TState) => {
      await handler(new TeamsTurnContext(context), state, getTeamInfo(context))
    }
    this._app.addRoute(routeSel, routeHandler, false, rank, authHandlers)
    return this
  }

  onDeleted (handler: TeamUpdateHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      return Promise.resolve(isTeamUpdateEvent(context, TEAM_DELETED_EVENT))
    }
    const routeHandler: RouteHandler<TState> = async (context: TurnContext, state: TState) => {
      await handler(new TeamsTurnContext(context), state, getTeamInfo(context))
    }
    this._app.addRoute(routeSel, routeHandler, false, rank, authHandlers)
    return this
  }

  onHardDeleted (handler: TeamUpdateHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      return Promise.resolve(isTeamUpdateEvent(context, TEAM_HARD_DELETED_EVENT))
    }
    const routeHandler: RouteHandler<TState> = async (context: TurnContext, state: TState) => {
      await handler(new TeamsTurnContext(context), state, getTeamInfo(context))
    }
    this._app.addRoute(routeSel, routeHandler, false, rank, authHandlers)
    return this
  }
}
