/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { type Response } from 'express'
import { ActivityHandler, AgentApplication, AuthConfiguration, authorizeJWT, getAuthConfigWithDefaults, Request, TurnState } from '@microsoft/agents-hosting'
import { createCloudAdapter } from './createCloudAdapter'

/**
 * Minimal response interface describing the methods used by the Agent request handler.
 * Any HTTP framework whose response object satisfies this shape (Express, Koa with adapter, etc.) is compatible.
 */
export interface WebResponse {
  status (code: number): this
  setHeader (name: string, value: string): this
  send (body?: unknown): this
  end (): this
  headersSent: boolean
}

/**
 * A request handler function signature that does not depend on Express types.
 * Compatible with Express, Fastify, Koa (with adapters), or any framework whose response satisfies {@link WebResponse}.
 */
export type AgentRequestHandler = (req: Request, res: WebResponse) => Promise<void>

/**
 * Creates a framework-agnostic request handler for processing Agent activities.
 *
 * This decouples the core agent request processing logic from Express, allowing it to be used
 * with any HTTP framework that provides compatible `req` and `res` objects (Express, Fastify, raw `http`, etc.).
 *
 * JWT authorization is applied within the handler before processing the activity.
 *
 * @param agent - The AgentApplication or ActivityHandler instance to process incoming activities.
 * @param authConfiguration - Optional custom authentication configuration. If not provided,
 * configuration will be loaded from environment variables using loadAuthConfigFromEnv().
 * @returns A request handler function `(req, res) => Promise<void>`.
 *
 * @example
 * ```typescript
 * import http from 'node:http';
 * import { AgentApplication, TurnState } from '@microsoft/agents-hosting';
 * import { createAgentRequestHandler } from '@microsoft/agents-hosting-express';
 *
 * const agent = new AgentApplication<TurnState>();
 * const handler = createAgentRequestHandler(agent);
 *
 * // Use with raw Node.js http server
 * const server = http.createServer(async (req, res) => {
 *   if (req.method === 'POST' && req.url === '/api/messages') {
 *     await handler(req, res);
 *   }
 * });
 * server.listen(3978);
 * ```
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { AgentApplication, TurnState } from '@microsoft/agents-hosting';
 * import { createAgentRequestHandler } from '@microsoft/agents-hosting-express';
 *
 * const agent = new AgentApplication<TurnState>();
 * const handler = createAgentRequestHandler(agent);
 *
 * const app = express();
 * app.use(express.json());
 * app.post('/api/messages', handler);
 * app.get('/health', (req, res) => res.json({ status: 'ok' }));
 * app.listen(3978);
 * ```
 */
export const createAgentRequestHandler = (
  agent: AgentApplication<TurnState<any, any>> | ActivityHandler,
  authConfiguration?: AuthConfiguration
): AgentRequestHandler => {
  const authConfig = getAuthConfigWithDefaults(authConfiguration)
  const { adapter, headerPropagation } = createCloudAdapter(agent)
  const jwtMiddleware = authorizeJWT(authConfig)

  return async (req: Request, res: WebResponse): Promise<void> => {
    await new Promise<void>((resolve, reject) => {
      jwtMiddleware(req, res as Response, (err?: any) => {
        if (err) {
          reject(err)
        } else {
          resolve()
        }
      })
    })

    // If the middleware already sent a response (e.g., 401), don't process the activity
    if (res.headersSent) {
      return
    }

    await adapter.process(req, res as Response, (context) => agent.run(context), headerPropagation)
  }
}
