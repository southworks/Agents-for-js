// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { RouteHandler, TurnContext, TurnState } from '@microsoft/agents-hosting'
import { TeamsTurnContext } from './teamsTurnContext'

export type TeamsRouteHandler<TState extends TurnState> = (context: TeamsTurnContext, state: TState) => Promise<void>

export function createTeamsRouteHandler<TState extends TurnState> (handler: TeamsRouteHandler<TState>): RouteHandler<TState> {
  return async (context: TurnContext, state: TState) => {
    await handler(new TeamsTurnContext(context), state)
  }
}
