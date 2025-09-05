/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { ActiveGuard } from './types'
import { TurnContext } from '../../turnContext'
import { Storage } from '../../storage'

/**
 * Storage manager for guard state.
 */
export class GuardStorage {
  constructor (private storage: Storage, private context: TurnContext) { }

  /**
   * Gets the unique key for this guard session.
   */
  get key () {
    if (!this.context.activity.channelId?.trim() && !this.context.activity.from?.id?.trim()) {
      throw new Error(`channelId and from.id properties must be set in the activity in order to generate the ${GuardStorage.name} key`)
    }

    return `${this.context.activity.channelId}/${this.context.activity.from?.id!}`
  }

  /**
   * Reads the active guard state from storage.
   */
  async read (): Promise<ActiveGuard | undefined> {
    const ongoing = await this.storage.read([this.key])
    return ongoing?.[this.key]
  }

  /**
   * Writes guard state to storage.
   */
  write (data: ActiveGuard) {
    return this.storage.write({ [this.key]: data })
  }

  /**
   * Deletes guard state from storage.
   */
  delete () {
    return this.storage.delete([this.key])
  }
}
