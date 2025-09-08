/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { debug } from '@microsoft/agents-activity/logger'
import { AgentApplication } from '../agentApplication'
import { GuardStorage } from '../guards/guardStorage'
import { ActiveGuard } from '../guards/types'
import { AppRoute } from './appRoute'
import { RouteList } from './routeList'
import { TurnContext } from '../../turnContext'
import { Activity } from '@microsoft/agents-activity'

const logger = debug('agents:route-manager')

/**
 * Manages route handlers and guard validation.
 */
export class RouteManager {
  private _route: AppRoute<any> | undefined
  private _storage?: GuardStorage

  private constructor (app: AgentApplication<any>, private routes: RouteList<any>, private context: TurnContext) {
    if (app.options.storage) {
      this._storage = new GuardStorage(app.options.storage, context)
    }
  }

  /**
   * Initializes a route manager for the current context.
   */
  static async initialize (app: AgentApplication<any>, routes: RouteList<any>, context: TurnContext) {
    const manager = new RouteManager(app, routes, context)
    manager._route = await manager.getRoute(context)
    return manager
  }

  /**
   * Gets the current active route.
   */
  public get route () {
    return this._route
  }

  /**
   * Processes guards for the current route, verifying that each guard is properly registered.
   * @returns true if the current route is guarded, meaning that at least one guard wasn't registered successfully.
   */
  public async guarded (): Promise<boolean> {
    let active = await this.active()
    if (active) {
      logger.debug(`Active guard session found: ${active.guard}`)
    }

    let activity = this.context.activity
    for (const guard of this._route?.guards ?? []) {
      const context = new TurnContext(this.context.adapter, activity)
      const registered = await guard.register({ context, active })
      logger.debug(`Guard ${guard.id} registered: ${registered}`)
      if (!registered) {
        return true
      }

      // Reset active for next guard, but keep original activity.
      if (active) {
        activity = Activity.fromObject(active.activity)
      }
      active = undefined
      await this._storage?.delete()
    }

    return false
  }

  /**
   * Gets the active guard session from the storage.
   */
  private async active (): Promise<ActiveGuard | undefined> {
    const active = await this._storage?.read()
    if (!active) {
      return
    }

    const context = new TurnContext(this.context.adapter, Activity.fromObject(active.activity))
    const route = await this.getRoute(context)

    if (!route) {
      return active
    }

    // Sort guards to ensure the active guard is processed first.
    const index = route.guards?.findIndex(e => e.id === active.guard)
    const guards = route.guards?.slice(index) ?? []
    this._route = { ...route, guards }
    return active
  }

  /**
   * Finds the appropriate route for the given context.
   */
  private async getRoute (context: TurnContext): Promise<AppRoute<any> | undefined> {
    for (const route of this.routes) {
      if (await route.selector(context)) {
        return route
      }
    }
  }
}
