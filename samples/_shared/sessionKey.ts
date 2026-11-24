// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import type { TurnContext } from '@microsoft/agents-hosting'

export function getSessionKey (context: TurnContext): string | undefined {
  const { channelId, conversation, from } = context.activity
  if (!channelId || !conversation?.id || !from?.id) {
    return undefined
  }
  return JSON.stringify([channelId, conversation.id, from.id])
}
