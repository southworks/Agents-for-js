// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import type { HeaderPropagationCollection } from '@microsoft/agents-hosting'
import { version } from '../package.json'

const USER_AGENT_HEADER = 'User-Agent'
export const TEAMS_USER_AGENT_PRODUCT = `agents-sdk-js-teams/${version}`

export function applyTeamsHeaderPropagation (headers: HeaderPropagationCollection): void {
  const userAgentKey = headers.key?.(USER_AGENT_HEADER) ?? USER_AGENT_HEADER
  const userAgent = headers.outgoing[userAgentKey] ?? headers.incoming[userAgentKey]

  if (!userAgent) {
    headers.add({ [userAgentKey]: TEAMS_USER_AGENT_PRODUCT })
  } else if (!userAgent.includes(TEAMS_USER_AGENT_PRODUCT)) {
    headers.concat({ [userAgentKey]: TEAMS_USER_AGENT_PRODUCT })
  } else if (!headers.outgoing[userAgentKey]) {
    headers.propagate([userAgentKey])
  }
}
