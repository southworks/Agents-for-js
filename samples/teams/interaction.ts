// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { randomUUID } from 'node:crypto'
import type { TurnContext } from '@microsoft/agents-hosting'
import { getSessionKey } from '../_shared/sessionKey.js'

export function record (value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {}
}

export function interactionData (context: TurnContext): Record<string, unknown> {
  const value = record(context.activity.value)
  if (context.activity.name === 'adaptiveCard/action') {
    return record(record(value.action).data)
  }
  return context.activity.type === 'invoke' ? record(value.data) : value
}

/** One active card/form per session. Exit and replacement invalidate older actions. */
export class TeamsInteractions {
  private readonly tokens = new Map<string, string>()

  issue (context: TurnContext): string | undefined {
    const key = getSessionKey(context)
    if (!key) {
      return undefined
    }
    const token = randomUUID()
    this.tokens.set(key, token)
    return token
  }

  accepts (context: TurnContext): boolean {
    const key = getSessionKey(context)
    const token = key ? this.tokens.get(key) : undefined
    return token !== undefined && token === interactionData(context).token
  }

  clear (context: TurnContext): void {
    const key = getSessionKey(context)
    if (key) {
      this.tokens.delete(key)
    }
  }
}
