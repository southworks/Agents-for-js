/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { Activity } from '@microsoft/agents-activity'
import { StoreItem } from '../../storage'
import { TurnContext } from '../../turnContext'

/**
 * Options for guard registration.
 */
export interface GuardRegisterOptions {
  context: TurnContext
  active?: ActiveGuard
}

/**
 * Interface for all guard implementations.
 */
export interface Guard {
  get id(): string
  register(options: GuardRegisterOptions): boolean | Promise<boolean>
}

/**
 * Active guard manager information.
 */
export interface ActiveGuard extends StoreItem {
  activity: Activity
  attempts: number
  guard: string
}
