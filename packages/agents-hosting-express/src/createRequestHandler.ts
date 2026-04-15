/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { Response } from 'express'
import {
  ActivityHandler,
  AgentApplication,
  AuthConfiguration,
  authorizeJWT,
  CloudAdapter,
  getAuthConfigWithDefaults,
  HeaderPropagationDefinition,
  Request,
  TurnState
} from '@microsoft/agents-hosting'

/**
 * Creates a `CloudAdapter` from an agent instance.
 *
 * If the agent is an `AgentApplication` that already owns an adapter, that adapter is returned.
 * Otherwise a new `CloudAdapter()` is constructed.
 *
 * @param agent - The agent whose adapter should be extracted or created.
 * @returns A `CloudAdapter` ready to process incoming activities.
 *
 * @example
 * ```typescript
 * import { createCloudAdapter } from '@microsoft/agents-hosting-express';
 *
 * const adapter = createCloudAdapter(myAgent);
 * ```
 */
export const createCloudAdapter = (agent: AgentApplication<TurnState<any, any>> | ActivityHandler): CloudAdapter => {
  if (agent instanceof ActivityHandler || !(agent as AgentApplication<TurnState<any, any>>).adapter) {
    return new CloudAdapter()
  }
  return (agent as AgentApplication<TurnState<any, any>>).adapter as CloudAdapter
}

/**
 * Creates a pre-configured request handler that processes agent activities.
 *
 * The returned function is compatible with any Express-compatible framework
 * (Express, Restify, etc.) and can be registered as a route handler directly.
 * JWT authentication is applied inside the handler using `authorizeJWT`.
 *
 * @param agent - The agent to process incoming activities.
 * @param authConfig - Optional authentication configuration. Defaults to environment variables.
 * @returns An async route handler `(req, res) => Promise<void>`.
 *
 * @remarks
 * Unlike `startServer`, this function does **not** create an HTTP server or call `listen`.
 * Use it when you need full control over server setup, want to add custom routes before
 * registering the agent endpoint, or are using a framework other than Express.
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { createAgentRequestHandler } from '@microsoft/agents-hosting-express';
 *
 * const app = express();
 * app.use(express.json());
 *
 * // Custom routes are unaffected by JWT middleware
 * app.get('/health', (_req, res) => res.json({ status: 'ok' }));
 *
 * app.post('/api/messages', createAgentRequestHandler(myAgent));
 *
 * app.listen(3978);
 * ```
 */
export const createAgentRequestHandler = (
  agent: AgentApplication<TurnState<any, any>> | ActivityHandler,
  authConfig?: AuthConfiguration
): (req: Request, res: Response) => Promise<void> => {
  const resolvedAuthConfig: AuthConfiguration = getAuthConfigWithDefaults(authConfig)
  const adapter = createCloudAdapter(agent)
  const headerPropagation: HeaderPropagationDefinition | undefined =
    agent instanceof ActivityHandler ? undefined : (agent as AgentApplication<TurnState<any, any>>)?.options.headerPropagation

  const jwtMiddleware = authorizeJWT(resolvedAuthConfig)

  return (req: Request, res: Response): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      jwtMiddleware(req as any, res, (err?: unknown) => {
        if (err) {
          reject(err instanceof Error ? err : new Error(String(err)))
          return
        }
        adapter.process(req, res, (context) => agent.run(context), headerPropagation).then(resolve, reject)
      })
    })
}
