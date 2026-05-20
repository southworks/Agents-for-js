// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { version } from '../package.json'
import os from 'os'
import { Activity, ExceptionHelper } from '@microsoft/agents-activity'
import { Errors } from './errorHelper'
import { HeaderPropagationCollection } from './headerPropagation'

const AGENT_NAME_PATTERN = /^[A-Za-z0-9 _-]+$/
const AGENT_REGISTRAR = 'A365'
const DEFAULT_AGENT_NAME = 'Agent-SDK-JS'

/**
 * Generates a string containing information about the SDK version and runtime environment.
 * This is used for telemetry and User-Agent headers in HTTP requests.
 *
 * @returns A formatted string containing the SDK version, Node.js version, and OS details
 */
export const getProductInfo = () : string => `agents-sdk-js/${version} nodejs/${process.version} ${os.platform()}-${os.arch()}/${os.release()}`

/**
 * Applies the SDK product information to the User-Agent header of outgoing requests.
 * @param headers The HeaderPropagationCollection to which the User-Agent header will be added or updated
 */
export function applyUserAgentHeader (headers: HeaderPropagationCollection): void {
  const userAgentKey = headers.key('User-Agent')
  const userAgent = headers.outgoing[userAgentKey]
  const productInfo = getProductInfo()
  if (!userAgent) {
    headers.add({ [userAgentKey]: productInfo })
  } else if (!userAgent.includes(productInfo)) {
    headers.concat({ [userAgentKey]: productInfo })
  }
}

/**
 * Applies standardized agent-related headers to the outgoing request based on the incoming activity and identity.
 *
 * @param headers The HeaderPropagationCollection to which the agent headers will be applied.
 * @param activity The incoming Activity that may contain agentic request information.
 * @param agentName An optional human-friendly name for the agent, which will be validated and included in the headers.
 * @param identity An optional JwtPayload containing identity claims, used to resolve the AgentID if not present in the activity.
 * @param clientId An optional default AgentID to use if it cannot be resolved from the activity or identity.
 *
 * @remarks
 * The function sets the following headers:
 * - `AgentRegistrar`: A fixed value indicating the registrar of the agent (e.g., "A365").
 * - `AgentName`: A human-friendly name for the agent, validated against a pattern to ensure it only contains allowed characters.
 * - `AgentID`: A unique identifier for the agent instance, resolved from the activity's agentic instance ID, identity claims, or a provided default.
 * - `Agent-Referrer`: The channel ID from the incoming activity, indicating the source of the request.
 * - `User-Agent`: Includes the SDK product information for telemetry and identification purposes.
 * The function ensures that the agent headers are consistently applied to outgoing requests for proper identification and tracing.
 */
export function applyAgentHeaders (
  headers: HeaderPropagationCollection,
  activity: Activity,
  agentName?: string,
  clientId?: string
): void {
  applyUserAgentHeader(headers)
  headers.override({
    AgentRegistrar: AGENT_REGISTRAR,
    AgentName: normalizeAgentName(agentName),
    AgentID: activity.getAgenticInstanceId() ?? activity.getAgenticUser() ?? clientId ?? '',
    'Agent-Referrer': activity.channelId ?? '',
  })
}

function normalizeAgentName (agentName?: string): string {
  const normalizedAgentName = agentName?.trim()
  if (!normalizedAgentName) {
    return DEFAULT_AGENT_NAME
  }

  if (!AGENT_NAME_PATTERN.test(normalizedAgentName)) {
    throw ExceptionHelper.generateException(Error, Errors.AgentNameInvalid, undefined, { agentName: normalizedAgentName })
  }

  return normalizedAgentName
}
