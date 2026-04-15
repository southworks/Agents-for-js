/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import express from 'express'
import { ActivityHandler, AgentApplication, AuthConfiguration, authorizeJWT, getAuthConfigWithDefaults, Request, TurnState } from '@microsoft/agents-hosting'
import { version } from '@microsoft/agents-hosting/package.json'
import { createCloudAdapter } from './createRequestHandler.js'
import { type Server } from 'node:http'

/**
 * Options for configuring `startServer`.
 */
export interface StartServerOptions {
  /** Authentication configuration. Defaults to environment variables when omitted. */
  authConfig?: AuthConfiguration
  /** Port to listen on. Defaults to `process.env.PORT` or `3978`. */
  port?: number | string
  /** Route path for the agent message endpoint. Defaults to `'/api/messages'`. */
  routePath?: string
  /**
   * Hook invoked with the Express app after middleware is applied but before `listen` is called.
   * Use this to add custom routes or additional middleware.
   *
   * @example
   * ```typescript
   * startServer(agent, {
   *   beforeListen: (app) => {
   *     app.get('/health', (_req, res) => res.json({ status: 'ok' }));
   *   }
   * });
   * ```
   */
  beforeListen?: (app: express.Express) => void
}

/**
 * Starts an Express server for handling Agent requests.
 *
 * @param agent - The AgentApplication or ActivityHandler instance to process incoming activities.
 * @param authConfiguration - Optional custom authentication configuration. If not provided,
 * configuration will be loaded from environment variables using loadAuthConfigFromEnv().
 * @returns {express.Express} - The Express server instance.
 */
export function startServer (agent: AgentApplication<TurnState<any, any>> | ActivityHandler, authConfiguration?: AuthConfiguration): express.Express & { httpServer: Server }
/**
 * Starts an Express server for handling Agent requests.
 *
 * @param agent - The AgentApplication or ActivityHandler instance to process incoming activities.
 * @param options - Configuration options including auth config, port, route path, and a pre-listen hook.
 * @returns {express.Express & { httpServer: Server }} - The Express server instance augmented with the underlying `http.Server` for lifecycle management (e.g. `httpServer.close()`).
 *
 * @remarks
 * This function sets up an Express server with the necessary middleware and routes for handling
 * agent requests. It configures JWT authorization middleware scoped to the agent route and sets
 * up the message endpoint. The server will listen on the port specified in `options.port`, the
 * `PORT` environment variable, or `3978` by default.
 *
 * Use `options.beforeListen` to add custom routes (e.g. `/health`) before the server starts.
 * Those routes are not protected by JWT middleware.
 *
 * @example
 * ```typescript
 * import { AgentApplication, TurnState } from '@microsoft/agents-hosting';
 * import { startServer } from '@microsoft/agents-hosting-express';
 *
 * const app = new AgentApplication<TurnState>();
 * app.onMessage('hello', async (context, state) => {
 *   await context.sendActivity('Hello, world!');
 * });
 *
 * startServer(app, {
 *   port: 4000,
 *   beforeListen: (server) => {
 *     server.get('/health', (_req, res) => res.json({ status: 'ok' }));
 *   }
 * });
 * ```
 */
export function startServer (agent: AgentApplication<TurnState<any, any>> | ActivityHandler, options?: StartServerOptions): express.Express & { httpServer: Server }
export function startServer (agent: AgentApplication<TurnState<any, any>> | ActivityHandler, optionsOrAuthConfig?: AuthConfiguration | StartServerOptions): express.Express & { httpServer: Server } {
  const options: StartServerOptions = isStartServerOptions(optionsOrAuthConfig)
    ? optionsOrAuthConfig
    : { authConfig: optionsOrAuthConfig }

  const authConfig: AuthConfiguration = getAuthConfigWithDefaults(options.authConfig)
  const routePath = options.routePath ?? '/api/messages'
  const adapter = createCloudAdapter(agent)
  const headerPropagation = agent instanceof ActivityHandler
    ? undefined
    : (agent as AgentApplication<TurnState<any, any>>)?.options.headerPropagation

  const server = express()
  server.use(express.json())

  server.post(routePath, authorizeJWT(authConfig), (req: Request, res) =>
    adapter.process(req, res, (context) =>
      agent.run(context)
    , headerPropagation)
  )

  options.beforeListen?.(server)

  const port = options.port ?? process.env.PORT ?? 3978
  const httpServer = server.listen(port, async () => {
    console.log(`\nServer listening to port ${port} on sdk ${version} for appId ${authConfig.clientId} debug ${process.env.DEBUG}`)
  })
  httpServer.on('error', console.error)
  ;(server as any).httpServer = httpServer
  return server as express.Express & { httpServer: Server }
}

function isStartServerOptions (v: AuthConfiguration | StartServerOptions | undefined): v is StartServerOptions {
  if (v == null || typeof v !== 'object') return false
  return 'authConfig' in v || 'port' in v || 'routePath' in v || 'beforeListen' in v
}
