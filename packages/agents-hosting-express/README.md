# microsoft/agents-hosting-express

## Overview

Provides integration to host the agent in Express using `startServer`, and exposes lower-level helpers for advanced scenarios.

## Usage

### Quick start with `startServer`

```ts
import { AgentApplication, TurnState } from '@microsoft/agents-hosting';
import { startServer } from '@microsoft/agents-hosting-express';

const app = new AgentApplication<TurnState>();
app.onMessage('hello', async (context, state) => {
  await context.sendActivity('Hello, world!');
});
startServer(app);
```

### Custom routes alongside the agent endpoint

Use the `beforeListen` option to add custom routes (e.g. a health check) before the server starts.
Routes added via `beforeListen` are **not** protected by JWT middleware.

```ts
startServer(app, {
  port: 4000,
  routePath: '/api/messages', // default
  beforeListen: (server) => {
    server.get('/health', (_req, res) => res.json({ status: 'ok' }));
  }
});
```

### Manual server setup with `createAgentRequestHandler`

Use `createAgentRequestHandler` when you need full control over the HTTP server, want to
integrate with an existing Express app, or need to add middleware before the agent route.

JWT authentication is handled inside the returned handler — only `/api/messages` (or whatever
route you register it on) requires a valid token.

```ts
import express from 'express';
import { createAgentRequestHandler } from '@microsoft/agents-hosting-express';

const server = express();
server.use(express.json());

// Unprotected routes
server.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Agent endpoint — JWT auth applied here only
server.post('/api/messages', createAgentRequestHandler(myAgent));

server.listen(process.env.PORT ?? 3978);
```

### Accessing the adapter directly with `createCloudAdapter`

Use `createCloudAdapter` to obtain the `CloudAdapter` for an agent without using `startServer`.

```ts
import { createCloudAdapter } from '@microsoft/agents-hosting-express';

const adapter = createCloudAdapter(myAgent);
// adapter.process(...) can now be called manually in any HTTP framework
```

### Manual auth middleware for advanced scenarios

If you need to customise how JWT validation is applied, use `authorizeJWT` from
`@microsoft/agents-hosting` directly:

```ts
import express from 'express';
import { authorizeJWT } from '@microsoft/agents-hosting';
import { createCloudAdapter } from '@microsoft/agents-hosting-express';

const server = express();
server.use(express.json());

const adapter = createCloudAdapter(myAgent);
const authConfig = { clientId: process.env.CLIENT_ID! };

server.post('/api/messages', authorizeJWT(authConfig), (req, res) =>
  adapter.process(req, res, (context) => myAgent.run(context))
);

server.listen(3978);
```
