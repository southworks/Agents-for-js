/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { ActivityHandler, AgentApplication, CloudAdapter, HeaderPropagationDefinition, TurnState } from '@microsoft/agents-hosting'

/**
 * Result of creating a CloudAdapter from an agent.
 */
export interface CloudAdapterResult {
  adapter: CloudAdapter
  headerPropagation: HeaderPropagationDefinition | undefined
}

/**
 * Creates a CloudAdapter for the given agent.
 *
 * If the agent is an AgentApplication with a pre-configured adapter, that adapter is reused.
 * Otherwise, a new CloudAdapter is created.
 *
 * @param agent - The AgentApplication or ActivityHandler instance.
 * @returns An object containing the CloudAdapter and optional header propagation configuration.
 *
 * @example
 * ```typescript
 * import { AgentApplication, TurnState } from '@microsoft/agents-hosting';
 * import { createCloudAdapter } from '@microsoft/agents-hosting-express';
 *
 * const app = new AgentApplication<TurnState>();
 * const { adapter, headerPropagation } = createCloudAdapter(app);
 *
 * // Use the adapter directly with any HTTP framework
 * adapter.process(req, res, (context) => app.run(context), headerPropagation);
 * ```
 */
export const createCloudAdapter = (agent: AgentApplication<TurnState<any, any>> | ActivityHandler): CloudAdapterResult => {
  let adapter: CloudAdapter
  let headerPropagation: HeaderPropagationDefinition | undefined
  if (agent instanceof ActivityHandler || !agent.adapter) {
    adapter = new CloudAdapter()
  } else {
    adapter = agent.adapter as CloudAdapter
    headerPropagation = (agent as AgentApplication<TurnState<any, any>>)?.options.headerPropagation
  }
  return { adapter, headerPropagation }
}
