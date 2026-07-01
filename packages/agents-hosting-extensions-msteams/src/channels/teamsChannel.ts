// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ActivityTypes } from '@microsoft/agents-activity'
import { AgentApplication, RouteHandler, RouteRank, RouteSelector, TurnContext, TurnState } from '@microsoft/agents-hosting'
import { parseTeamsChannelData } from '../activity-extensions'
import type { ChannelInfo } from '@microsoft/teams.api'
import { TeamsTurnContext } from '../teamsTurnContext'

const CHANNEL_CREATED_EVENT = 'channelCreated'
const CHANNEL_DELETED_EVENT = 'channelDeleted'
const CHANNEL_RENAMED_EVENT = 'channelRenamed'
const CHANNEL_RESTORED_EVENT = 'channelRestored'
const CHANNEL_SHARED_EVENT = 'channelShared'
const CHANNEL_UNSHARED_EVENT = 'channelUnshared'
const CHANNEL_MEMBER_ADDED_EVENT = 'channelMemberAdded'
const CHANNEL_MEMBER_REMOVED_EVENT = 'channelMemberRemoved'

type ChannelUpdateHandler<TState extends TurnState> = (context: TeamsTurnContext, state: TState, data: ChannelInfo) => Promise<void>

function isChannelUpdateEvent (context: TurnContext, eventType?: string): boolean {
  const channelData = parseTeamsChannelData(context.activity.channelData)
  const actualEventType = channelData?.eventType

  return (
    context.activity.type === ActivityTypes.ConversationUpdate &&
    context.activity.channelId === 'msteams' &&
    channelData?.channel != null &&
    (
      eventType != null
        ? actualEventType === eventType
        : typeof actualEventType === 'string' && actualEventType.startsWith('channel')
    )
  )
}

function getChannelInfo (context: TurnContext): ChannelInfo {
  return parseTeamsChannelData(context.activity.channelData).channel as ChannelInfo
}

export class TeamsChannel<TState extends TurnState = TurnState> {
  private _app: AgentApplication<TState>

  constructor (app: AgentApplication<TState>) {
    this._app = app
  }

  onChannelEventReceived (handler: ChannelUpdateHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      return Promise.resolve(isChannelUpdateEvent(context))
    }
    const routeHandler: RouteHandler<TState> = async (context: TurnContext, state: TState) => {
      await handler(new TeamsTurnContext(context), state, getChannelInfo(context))
    }
    this._app.addRoute(routeSel, routeHandler, false, rank, authHandlers)
    return this
  }

  onCreated (handler: ChannelUpdateHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      return Promise.resolve(isChannelUpdateEvent(context, CHANNEL_CREATED_EVENT))
    }
    const routeHandler: RouteHandler<TState> = async (context: TurnContext, state: TState) => {
      await handler(new TeamsTurnContext(context), state, getChannelInfo(context))
    }
    this._app.addRoute(routeSel, routeHandler, false, rank, authHandlers)
    return this
  }

  onDeleted (handler: ChannelUpdateHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      return Promise.resolve(isChannelUpdateEvent(context, CHANNEL_DELETED_EVENT))
    }
    const routeHandler: RouteHandler<TState> = async (context: TurnContext, state: TState) => {
      await handler(new TeamsTurnContext(context), state, getChannelInfo(context))
    }
    this._app.addRoute(routeSel, routeHandler, false, rank, authHandlers)
    return this
  }

  onRenamed (handler: ChannelUpdateHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      return Promise.resolve(isChannelUpdateEvent(context, CHANNEL_RENAMED_EVENT))
    }
    const routeHandler: RouteHandler<TState> = async (context: TurnContext, state: TState) => {
      await handler(new TeamsTurnContext(context), state, getChannelInfo(context))
    }
    this._app.addRoute(routeSel, routeHandler, false, rank, authHandlers)
    return this
  }

  onRestored (handler: ChannelUpdateHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      return Promise.resolve(isChannelUpdateEvent(context, CHANNEL_RESTORED_EVENT))
    }
    const routeHandler: RouteHandler<TState> = async (context: TurnContext, state: TState) => {
      await handler(new TeamsTurnContext(context), state, getChannelInfo(context))
    }
    this._app.addRoute(routeSel, routeHandler, false, rank, authHandlers)
    return this
  }

  onShared (handler: ChannelUpdateHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      return Promise.resolve(isChannelUpdateEvent(context, CHANNEL_SHARED_EVENT))
    }
    const routeHandler: RouteHandler<TState> = async (context: TurnContext, state: TState) => {
      await handler(new TeamsTurnContext(context), state, getChannelInfo(context))
    }
    this._app.addRoute(routeSel, routeHandler, false, rank, authHandlers)
    return this
  }

  onUnshared (handler: ChannelUpdateHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      return Promise.resolve(isChannelUpdateEvent(context, CHANNEL_UNSHARED_EVENT))
    }
    const routeHandler: RouteHandler<TState> = async (context: TurnContext, state: TState) => {
      await handler(new TeamsTurnContext(context), state, getChannelInfo(context))
    }
    this._app.addRoute(routeSel, routeHandler, false, rank, authHandlers)
    return this
  }

  onMemberAdded (handler: ChannelUpdateHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      return Promise.resolve(isChannelUpdateEvent(context, CHANNEL_MEMBER_ADDED_EVENT))
    }
    const routeHandler: RouteHandler<TState> = async (context: TurnContext, state: TState) => {
      await handler(new TeamsTurnContext(context), state, getChannelInfo(context))
    }
    this._app.addRoute(routeSel, routeHandler, false, rank, authHandlers)
    return this
  }

  onMemberRemoved (handler: ChannelUpdateHandler<TState>, rank: number = RouteRank.Unspecified, authHandlers: string[] = []) {
    const routeSel: RouteSelector = (context: TurnContext) => {
      return Promise.resolve(isChannelUpdateEvent(context, CHANNEL_MEMBER_REMOVED_EVENT))
    }
    const routeHandler: RouteHandler<TState> = async (context: TurnContext, state: TState) => {
      await handler(new TeamsTurnContext(context), state, getChannelInfo(context))
    }
    this._app.addRoute(routeSel, routeHandler, false, rank, authHandlers)
    return this
  }
}
