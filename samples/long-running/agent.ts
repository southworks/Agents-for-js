// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { getSessionKey } from '../_shared/sessionKey.js'
import { Activity } from '@microsoft/agents-activity'
import { AgentApplication, MemoryStorage, TurnContext, type CloudAdapter, type TurnState } from '@microsoft/agents-hosting'

interface RunningOperation {
  continued: boolean
}

/** Demonstrates the SDK continuation path, with navigation held until it settles. */
export class LongRunningSample extends AgentApplication<TurnState> {
  private readonly running = new Map<string, RunningOperation>()

  constructor (adapter: CloudAdapter, private readonly addResultNavigation: (context: TurnContext) => void) {
    super({ adapter, storage: new MemoryStorage(), longRunningMessages: true, startTypingTimer: true })

    this.onActivity('message', async context => {
      const response = context.streamingResponse
      response.queueInformativeUpdate('Starting work… You can keep chatting.')
      try {
        await new Promise(resolve => setTimeout(resolve, 2000))
        response.queueInformativeUpdate('Still working… Almost done.')
        await new Promise(resolve => setTimeout(resolve, 3000))

        if (context.activity.text?.trim() === 'work-error') {
          throw new Error('Intentional long-running sample failure')
        }

        response.queueTextChunk('Long-running · Completed. You can start another operation or return to scenarios.')
      } catch {
        response.queueTextChunk('Long-running · Failed. Select Start work to retry, or use All scenarios.')
      } finally {
        await response.endStream()
      }
    })
  }

  public async canExit (context: TurnContext): Promise<boolean> {
    const key = getSessionKey(context)
    return !key || !this.running.has(key)
  }

  public override async run (context: TurnContext): Promise<void> {
    if (context.activity.type !== 'message') {
      return
    }

    const key = getSessionKey(context)
    if (!key) {
      return
    }
    const command = context.activity.text?.trim()
    if (command !== 'work' && command !== 'work-error') {
      const status = this.running.has(key)
        ? 'The background work is still running.'
        : 'No background work is running. Select Start work to begin.'
      await context.sendActivity(`Message received. ${status}`)
      return
    }

    if (this.running.has(key)) {
      await context.sendActivity('Work is already running. You can keep sending messages while it finishes.')
      return
    }

    const operation: RunningOperation = { continued: false }
    this.running.set(key, operation)

    try {
      await super.run(context)
    } finally {
      // If routing fails before the continuation starts, there is no background
      // work to hold the navigation lock. Otherwise its own finally releases it.
      if (!operation.continued) {
        this.running.delete(key)
      }
    }
  }

  protected override startLongRunningCall (
    context: TurnContext,
    handler: (context: TurnContext) => Promise<void>
  ): void {
    const key = getSessionKey(context)
    if (!key) {
      return
    }
    const operation = this.running.get(key)
    if (operation) {
      operation.continued = true
    }

    const activity = Activity.fromObject(context.activity)
    const adapter = context.adapter
    const identity = context.identity

    const reportFailure = async (errorContext: TurnContext) => {
      await errorContext.sendActivity('Long-running · Failed. Select Start work to retry, or use All scenarios.')
    }

    // The inbound context is revoked after its HTTP request returns. SDK
    // continuation supplies the live context used by all delayed output.
    this.continueConversationAsync(identity, activity.getConversationReference(), async continued => {
      Object.assign(continued.activity, activity)
      this.addResultNavigation(continued)
      try {
        await handler(continued)
      } catch {
        await reportFailure(continued)
      }
    }).catch(async () => {
      const errorContext = new TurnContext(adapter, Activity.fromObject(activity), identity)
      this.addResultNavigation(errorContext)
      await reportFailure(errorContext)
    }).catch(() => {
      console.error('Could not deliver the long-running sample failure message.')
    }).finally(() => {
      this.running.delete(key)
    })
  }
}
