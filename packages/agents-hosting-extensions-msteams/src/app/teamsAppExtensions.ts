// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Activity, ActivityTypes, Channels } from '@microsoft/agents-activity'
import { AgentApplication, ConversationUpdateEvents, RouteHandler, RouteRank, RouteSelector, TurnContext, TurnState } from '@microsoft/agents-hosting'
import { createTeamsRouteHandler, TeamsRouteHandler } from '../teamsRouteHandler'
import { TeamsTurnContext } from '../teamsTurnContext'

export interface FeedbackActionValue {
  reaction?: string;
  feedback?: string | Record<string, unknown>;
}

export interface FeedbackData {
  actionName?: string;
  actionValue?: FeedbackActionValue;
  replyToId?: string;
}

export type TeamsHandoffHandler<TState extends TurnState> = (context: TeamsTurnContext, state: TState, continuation: string) => Promise<void>
export type TeamsFeedbackLoopHandler<TState extends TurnState> = (context: TeamsTurnContext, state: TState, feedbackData: FeedbackData) => Promise<void>

function isTeamsRouteContext (context: TurnContext, isAgenticRoute: boolean): boolean {
  return context.activity.channelId === Channels.Msteams &&
    (!isAgenticRoute || (isAgenticRoute && context.activity.isAgenticRequest()))
}

function matchesValue (actual: string | undefined, expected: string | RegExp): boolean {
  if (typeof expected === 'string') {
    return expected.toLocaleLowerCase() === actual?.toLocaleLowerCase()
  }

  return actual != null && expected.test(actual)
}

function addTeamsRoute<TState extends TurnState> (
  app: AgentApplication<TState>,
  selector: RouteSelector,
  handler: RouteHandler<TState>,
  isInvokeRoute: boolean,
  rank: number,
  authHandlers: string[],
  isAgenticRoute: boolean
): AgentApplication<TState> {
  return app.addRoute(selector, handler, isInvokeRoute, rank, authHandlers, isAgenticRoute)
}

function addTeamsRouteHandler<TState extends TurnState> (
  app: AgentApplication<TState>,
  selector: RouteSelector,
  handler: TeamsRouteHandler<TState>,
  rank: number,
  authHandlers: string[],
  isAgenticRoute: boolean
): AgentApplication<TState> {
  return addTeamsRoute(app, selector, createTeamsRouteHandler(handler), false, rank, authHandlers, isAgenticRoute)
}

function createInvokeResponse (): Activity {
  const invokeResponse = new Activity(ActivityTypes.InvokeResponse)
  invokeResponse.value = { status: 200 }
  return invokeResponse
}

export function onTeamsActivity<TState extends TurnState> (
  app: AgentApplication<TState>,
  type: string | RegExp,
  handler: TeamsRouteHandler<TState>,
  rank: number = RouteRank.Unspecified,
  authHandlers: string[] = [],
  isAgenticRoute: boolean = false
): AgentApplication<TState> {
  const selector: RouteSelector = async (context) =>
    isTeamsRouteContext(context, isAgenticRoute) &&
    matchesValue(context.activity.type, type)

  return addTeamsRouteHandler(app, selector, handler, rank, authHandlers, isAgenticRoute)
}

export function onTeamsConversationUpdate<TState extends TurnState> (
  app: AgentApplication<TState>,
  event: ConversationUpdateEvents | string,
  handler: TeamsRouteHandler<TState>,
  rank: number = RouteRank.Unspecified,
  authHandlers: string[] = [],
  isAgenticRoute: boolean = false
): AgentApplication<TState> {
  const selector: RouteSelector = async (context) => {
    if (!isTeamsRouteContext(context, isAgenticRoute) ||
      context.activity.type !== ActivityTypes.ConversationUpdate) {
      return false
    }

    if (event === 'membersAdded') {
      return Array.isArray(context.activity.membersAdded) && context.activity.membersAdded.length > 0
    }

    if (event === 'membersRemoved') {
      return Array.isArray(context.activity.membersRemoved) && context.activity.membersRemoved.length > 0
    }

    return true
  }

  return addTeamsRouteHandler(app, selector, handler, rank, authHandlers, isAgenticRoute)
}

export function onTeamsMessage<TState extends TurnState> (
  app: AgentApplication<TState>,
  text: string | RegExp,
  handler: TeamsRouteHandler<TState>,
  rank: number = RouteRank.Unspecified,
  authHandlers: string[] = [],
  isAgenticRoute: boolean = false
): AgentApplication<TState> {
  const selector: RouteSelector = async (context) =>
    isTeamsRouteContext(context, isAgenticRoute) &&
    context.activity.type === ActivityTypes.Message &&
    matchesValue(context.activity.text, text)

  return addTeamsRouteHandler(app, selector, handler, rank, authHandlers, isAgenticRoute)
}

export function onTeamsEvent<TState extends TurnState> (
  app: AgentApplication<TState>,
  name: string | RegExp,
  handler: TeamsRouteHandler<TState>,
  rank?: number,
  authHandlers?: string[],
  isAgenticRoute?: boolean
): AgentApplication<TState>
export function onTeamsEvent<TState extends TurnState> (
  app: AgentApplication<TState>,
  selector: RouteSelector,
  handler: TeamsRouteHandler<TState>,
  rank?: number,
  authHandlers?: string[],
  isAgenticRoute?: boolean
): AgentApplication<TState>
export function onTeamsEvent<TState extends TurnState> (
  app: AgentApplication<TState>,
  nameOrSelector: string | RegExp | RouteSelector,
  handler: TeamsRouteHandler<TState>,
  rank: number = RouteRank.Unspecified,
  authHandlers: string[] = [],
  isAgenticRoute: boolean = false
): AgentApplication<TState> {
  const selector: RouteSelector = async (context) => {
    if (!isTeamsRouteContext(context, isAgenticRoute) ||
      context.activity.type !== ActivityTypes.Event) {
      return false
    }

    if (typeof nameOrSelector === 'function') {
      return await nameOrSelector(context)
    }

    return matchesValue(context.activity.name, nameOrSelector)
  }

  return addTeamsRouteHandler(app, selector, handler, rank, authHandlers, isAgenticRoute)
}

export function onTeamsMessageReactionsAdded<TState extends TurnState> (
  app: AgentApplication<TState>,
  handler: TeamsRouteHandler<TState>,
  rank: number = RouteRank.Unspecified,
  authHandlers: string[] = [],
  isAgenticRoute: boolean = false
): AgentApplication<TState> {
  const selector: RouteSelector = async (context) =>
    isTeamsRouteContext(context, isAgenticRoute) &&
    context.activity.type === ActivityTypes.MessageReaction &&
    Array.isArray(context.activity.reactionsAdded) &&
    context.activity.reactionsAdded.length > 0

  return addTeamsRouteHandler(app, selector, handler, rank, authHandlers, isAgenticRoute)
}

export function onTeamsMessageReactionsRemoved<TState extends TurnState> (
  app: AgentApplication<TState>,
  handler: TeamsRouteHandler<TState>,
  rank: number = RouteRank.Unspecified,
  authHandlers: string[] = [],
  isAgenticRoute: boolean = false
): AgentApplication<TState> {
  const selector: RouteSelector = async (context) =>
    isTeamsRouteContext(context, isAgenticRoute) &&
    context.activity.type === ActivityTypes.MessageReaction &&
    Array.isArray(context.activity.reactionsRemoved) &&
    context.activity.reactionsRemoved.length > 0

  return addTeamsRouteHandler(app, selector, handler, rank, authHandlers, isAgenticRoute)
}

export function onTeamsHandoff<TState extends TurnState> (
  app: AgentApplication<TState>,
  handler: TeamsHandoffHandler<TState>,
  rank: number = RouteRank.Unspecified,
  authHandlers: string[] = [],
  isAgenticRoute: boolean = false
): AgentApplication<TState> {
  const selector: RouteSelector = async (context) =>
    isTeamsRouteContext(context, isAgenticRoute) &&
    context.activity.type === ActivityTypes.Invoke &&
    context.activity.name?.toLocaleLowerCase() === 'handoff/action'

  const routeHandler: RouteHandler<TState> = async (context, state) => {
    const value = context.activity.value as { continuation?: unknown, Continuation?: unknown } | undefined
    const continuation = typeof value?.continuation === 'string'
      ? value.continuation
      : typeof value?.Continuation === 'string' ? value.Continuation : ''

    await handler(new TeamsTurnContext(context), state, continuation)
    await context.sendActivity(createInvokeResponse())
  }

  return addTeamsRoute(app, selector, routeHandler, true, rank, authHandlers, isAgenticRoute)
}

export function onTeamsFeedbackLoop<TState extends TurnState> (
  app: AgentApplication<TState>,
  handler: TeamsFeedbackLoopHandler<TState>,
  rank: number = RouteRank.Unspecified,
  authHandlers: string[] = [],
  isAgenticRoute: boolean = false
): AgentApplication<TState> {
  const selector: RouteSelector = async (context) => {
    const actionName = (context.activity.value as { actionName?: unknown } | undefined)?.actionName
    return isTeamsRouteContext(context, isAgenticRoute) &&
      context.activity.type === ActivityTypes.Invoke &&
      context.activity.name === 'message/submitAction' &&
      actionName === 'feedback'
  }

  const routeHandler: RouteHandler<TState> = async (context, state) => {
    const feedbackData = {
      ...(context.activity.value as FeedbackData),
      replyToId: context.activity.replyToId
    }

    await handler(new TeamsTurnContext(context), state, feedbackData)
    await context.sendActivity(createInvokeResponse())
  }

  return addTeamsRoute(app, selector, routeHandler, true, rank, authHandlers, isAgenticRoute)
}
