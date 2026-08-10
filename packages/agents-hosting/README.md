# microsoft/agents-hosting

## Overview

The `@microsoft/agents-hosting` package provides the necessary tools and components to create and host Microsoft Agents. This package includes a compatible API to migrate a bot using `botbuilder` from the BotFramework SDK.

## Installation

To install the package:

```sh
npm install @microsoft/agents-hosting
```

## Hosting integration APIs

To make hosting an agent independent of any single web framework, this package
exposes framework-agnostic primitives that the
[`@microsoft/agents-hosting-express`](../agents-hosting-express) and
[`@microsoft/agents-hosting-fastify`](../agents-hosting-fastify) packages build on:

- `createCloudAdapter(agent, authConfig)` — returns `{ adapter, headerPropagation }` for processing incoming activities. Use this from any web framework.
- `CloudAdapterResult` — return type of `createCloudAdapter`.
- `createAgentResponseHandler(adapter, agent, conversationState)` — framework-agnostic handler `(req, res, params) => Promise<void>` for the agent-to-agent response route.
- `AgentResponseHandler`, `AgentResponseHandlerParams`, `AGENT_RESPONSE_ROUTE_PATH` — supporting types and the canonical route path.
- `WebResponse`, `NextFunction`, `WebRequestParamsCarrier` — minimal structural interfaces (no Express/Fastify imports) used by the cross-framework helpers above.

Most consumers should keep using `startServer`/`createAgentRequestHandler` from the
Express or Fastify packages; reach for these APIs when adapting another framework.

## Outbound request host validation

`OutboundHostValidator` provides an opt-in allowlist for server-side requests made
to activity service URLs and attachment URLs. Enforcement is disabled by default.
It can be configured with environment variables:

```dotenv
OutboundHostValidator__Enabled=true
OutboundHostValidator__IncludeDefaultMicrosoftHosts=true
OutboundHostValidator__Hosts=contoso.com,fabrikam.com
```

Indexed host variables such as `OutboundHostValidator__Hosts__0=contoso.com` are
also supported. A host entry matches both the exact host and its subdomains.

For explicit configuration, reuse the same immutable policy in the adapter and
attachment downloaders:

```ts
import {
  AgentApplication,
  AttachmentDownloader,
  CloudAdapter,
  OutboundHostValidator
} from '@microsoft/agents-hosting'

const outboundHostValidator = new OutboundHostValidator({
  enabled: true,
  hosts: ['contoso.com']
})

const adapter = new CloudAdapter(undefined, undefined, undefined, undefined, outboundHostValidator)

const agent = new AgentApplication({
  adapter,
  fileDownloaders: [new AttachmentDownloader('inputFiles', outboundHostValidator)]
})
```

The validator checks the URL supplied to the downloader. Redirects retain native
`fetch` behavior.

## Example Usage based on the AgentApplication object

```ts
import { AgentApplication, MemoryStorage, TurnContext, TurnState } from '@microsoft/agents-hosting'

const echo = new AgentApplication<TurnState>({ storage: new MemoryStorage() })
echo.onConversationUpdate('membersAdded', async (context: TurnContext) => {
  await context.sendActivity('Welcome to the Echo sample, send a message to see the echo feature in action.')
})
echo.onActivity('message', async (context: TurnContext, state: TurnState) => {
  let counter: number = state.getValue('conversation.counter') || 0
  await context.sendActivity(`[${counter++}]You said: ${context.activity.text}`)
  state.setValue('conversation.counter', counter)
})
```

## Example Usage based on bot framework Activity Handler

Create an Echo bot using the ActivityHandler

```ts
// myHandler.ts
import { ActivityHandler, MessageFactory } from '@microsoft/agents-hosting'

export class MyHandler extends ActivityHandler {
  constructor () {
    super()
    this.onMessage(async (context, next) => {
      const replyText = `Agent: ${context.activity.text}`
      await context.sendActivity(MessageFactory.text(replyText))
      await next()
    })
  }
}
```

Host the bot with express

```ts
// index.ts
import express, { Response } from 'express'
import { Request, CloudAdapter, authorizeJWT, AuthConfiguration, loadAuthConfigFromEnv } from '@microsoft/agents-hosting'
import { EchoBot } from './myHandler'

const authConfig: AuthConfiguration = loadAuthConfigFromEnv()

const adapter = new CloudAdapter(authConfig)
const myHandler = new MyHandler()

const app = express()

app.use(express.json())
app.use(authorizeJWT(authConfig))

app.post('/api/messages', async (req: Request, res: Response) => {
  await adapter.process(req, res, async (context) => await myHandler.run(context))
})

```
