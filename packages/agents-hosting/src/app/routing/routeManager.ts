/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { debug } from '@microsoft/agents-activity/logger'
import { AgentApplication } from '../agentApplication'
import { GuardStorage } from '../guards/guardStorage'
import { ActiveGuard, Guard, GuardRegisterStatus } from '../guards/types'
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
    let { route, active } = await this.active()
    if (active) {
      logger.debug(`Active guard session found: ${active.guard}`)
    }

    let activity = this.context.activity
    const guards = (route ?? this._route)?.guards ?? []

    for (const guard of guards) {
      const context = new TurnContext(this.context.adapter, activity)
      const status = await this.onGuardError(guard, () => guard.register({ context, active }))
      logger.debug(`Guard ${guard.id} registration status: ${status}`)

      if (status === GuardRegisterStatus.IGNORED) {
        await this._storage?.delete()
        return false
      }

      if (status === GuardRegisterStatus.PENDING) {
        return true
      }

      if (status === GuardRegisterStatus.REJECTED) {
        await this._storage?.delete()
        return true
      }

      if (status === GuardRegisterStatus.APPROVED) {
        this._route = route
        await this._storage?.delete()
      }

      if (active) {
        // Save originating activity for next guard in the chain.
        activity = Activity.fromObject(active.activity)
        active = undefined
      }
    }

    return false
  }

  /**
   * Handles errors that occur during guard registration.
   * @returns The result of the registration or an error.
   */
  private async onGuardError<T>(guard: Guard, cb: () => T) {
    try {
      return await cb()
    } catch (cause) {
      await this._storage?.delete()
      throw new Error(`Error registering guard '${guard.id}`, { cause })
    }
  }

  /**
   * Gets the active guard session from the storage.
   */
  private async active (): Promise<{ route?: AppRoute<any>, active?: ActiveGuard }> {
    const active = await this._storage?.read()
    if (!active) {
      return {}
    }

    const context = new TurnContext(this.context.adapter, Activity.fromObject(active.activity))
    const route = await this.getRoute(context)

    if (!route) {
      return { active }
    }

    // Sort guards to ensure the active guard is processed first.
    const index = route.guards?.findIndex(e => e.id === active.guard) ?? -1
    const guards = index >= 0 ? route.guards?.slice(index) : []
    return { route: { ...route, guards }, active }
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
