// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export const SpanNames = {
  // CloudAdapter / BaseAdapter
  ADAPTER_PROCESS: 'agents.adapter.process',
  ADAPTER_SEND_ACTIVITIES: 'agents.adapter.send.activities',
  ADAPTER_UPDATE_ACTIVITY: 'agents.adapter.update.activity',
  ADAPTER_DELETE_ACTIVITY: 'agents.adapter.delete.activity',
  ADAPTER_CONTINUE_CONVERSATION: 'agents.adapter.continue.conversation',
  ADAPTER_CREATE_CONNECTOR_CLIENT: 'agents.adapter.create.connector.client',
  ADAPTER_TURN: 'agents.adapter.turn',

  // ActivityHandler
  HANDLER_RUN: 'agents.handler.run',
  HANDLER_ON_TURN: 'agents.handler.on.turn',
  HANDLER_ON_MESSAGE: 'agents.handler.on.message',
  HANDLER_ON_INVOKE: 'agents.handler.on.invoke',
  HANDLER_ON_CONVERSATION_UPDATE: 'agents.handler.on.conversation.update',

  // AgentApplication
  AGENTS_APP_RUN: 'agents.app.run',
  AGENTS_APP_ROUTE_HANDLER: 'agents.app.route.handler',
  AGENTS_APP_BEFORE_TURN: 'agents.app.before.turn',
  AGENTS_APP_AFTER_TURN: 'agents.app.after.turn',
  AGENTS_APP_DOWNLOAD_FILES: 'agents.app.download.files',

  // Dialogs
  DIALOG_BEGIN: 'agents.dialog.begin',
  DIALOG_CONTINUE: 'agents.dialog.continue',
  DIALOG_RESUME: 'agents.dialog.resume',

  // ConnectorClient
  CONNECTOR_SEND_TO_CONVERSATION: 'agents.connector.send.to.conversation',
  CONNECTOR_REPLY_TO_ACTIVITY: 'agents.connector.reply.to.activity',
  CONNECTOR_UPDATE_ACTIVITY: 'agents.connector.update.activity',
  CONNECTOR_DELETE_ACTIVITY: 'agents.connector.delete.activity',
  CONNECTOR_CREATE_CONVERSATION: 'agents.connector.create.conversation',
  CONNECTOR_GET_CONVERSATIONS: 'agents.connector.get.conversations',
  CONNECTOR_GET_CONVERSATION_MEMBERS: 'agents.connector.get.conversation.members',
  CONNECTOR_UPLOAD_ATTACHMENT: 'agents.connector.upload.attachment',
  CONNECTOR_GET_ATTACHMENT: 'agents.connector.get.attachment',

  // Storage
  STORAGE_READ: 'agents.storage.read',
  STORAGE_WRITE: 'agents.storage.write',
  STORAGE_DELETE: 'agents.storage.delete',

  // CopilotStudio Client
  COPILOT_CONNECT: 'agents.copilot.connect',
  COPILOT_SEND_ACTIVITY: 'agents.copilot.send.activity',
  COPILOT_RECEIVE_ACTIVITY: 'agents.copilot.receive.activity',

  // AgentClient
  AGENT_CLIENT_POST_ACTIVITY: 'agents.agent.client.post.activity',

  // Authentication
  AUTHENTICATION_GET_ACCESS_TOKEN: 'agents.authentication.get.access.token',
  AUTHENTICATION_ACQUIRE_TOKEN_ON_BEHALF_OF: 'agents.authentication.acquire.token.on.behalf.of',
  AUTHENTICATION_GET_AGENTIC_INSTANCE_TOKEN: 'agents.authentication.get.agentic.instance.token',
  AUTHENTICATION_GET_AGENTIC_USER_TOKEN: 'agents.authentication.get.agentic.user.token',

  // Authorization
  AUTHORIZATION_MANAGER_PROCESS: 'agents.authorization.manager.process',
  AUTHORIZATION_AGENTIC_TOKEN: 'agents.authorization.agentic.token',
  AUTHORIZATION_AZURE_BOT_TOKEN: 'agents.authorization.azure.bot.token',
  AUTHORIZATION_AZURE_BOT_SIGNIN: 'agents.authorization.azure.bot.signin',
  AUTHORIZATION_AZURE_BOT_SIGNOUT: 'agents.authorization.azure.bot.signout',

  // UserTokenClient
  USER_TOKEN_CLIENT_GET_USER_TOKEN: 'agents.user.token.client.get.user.token',
  USER_TOKEN_CLIENT_SIGN_OUT: 'agents.user.token.client.sign.out',
  USER_TOKEN_CLIENT_GET_SIGN_IN_RESOURCE: 'agents.user.token.client.get.sign.in.resource',
  USER_TOKEN_CLIENT_EXCHANGE_TOKEN: 'agents.user.token.client.exchange.token',
  USER_TOKEN_CLIENT_GET_TOKEN_OR_SIGNIN_RESOURCE: 'agents.user.token.client.get.token.or.sign.in.resource',
  USER_TOKEN_CLIENT_GET_TOKEN_STATUS: 'agents.user.token.client.get.token.status',
  USER_TOKEN_CLIENT_GET_AAD_TOKENS: 'agents.user.token.client.get.aad.tokens',

  // TurnContext
  TURN_SEND_ACTIVITY: 'agents.turn.send.activity',
  TURN_SEND_ACTIVITIES: 'agents.turn.send.activities',
  TURN_UPDATE_ACTIVITY: 'agents.turn.update.activity',
  TURN_DELETE_ACTIVITY: 'agents.turn.delete.activity',
} as const

// export const SpanKind = {
//   /** Default value. Indicates that the span is used internally. */
//   INTERNAL: 0,
//   /**
//    * Indicates that the span covers server-side handling of an RPC or other
//    * remote request.
//    */
//   SERVER: 1,
//   /**
//    * Indicates that the span covers the client-side wrapper around an RPC or
//    * other remote request.
//    */
//   CLIENT: 2,
//   /**
//    * Indicates that the span describes producer sending a message to a
//    * broker. Unlike client and server, there is no direct critical path latency
//    * relationship between producer and consumer spans.
//    */
//   PRODUCER: 3,
//   /**
//    * Indicates that the span describes consumer receiving a message from a
//    * broker. Unlike client and server, there is no direct critical path latency
//    * relationship between producer and consumer spans.
//    */
//   CONSUMER: 4
// } as const

export const MetricNames = {
  // CloudAdapter
  ADAPTER_PROCESSED_ACTIVITIES: 'agents.adapter.processed.activities',
  ADAPTER_PROCESS_DURATION: 'agents.adapter.process.duration',

  // Hosting activity counters
  ACTIVITIES_RECEIVED: 'agents.activities.received',
  ACTIVITIES_SENT: 'agents.activities.sent',
  ACTIVITIES_UPDATED: 'agents.activities.updated',
  ACTIVITIES_DELETED: 'agents.activities.deleted',

  // Connector metrics
  CONNECTOR_REQUESTS: 'agents.connector.request.count',
  CONNECTOR_REQUEST_DURATION: 'agents.connector.request.duration',

  // AgentClient metrics
  AGENT_CLIENT_REQUESTS: 'agents.agent.client.request.count',
  AGENT_CLIENT_REQUEST_DURATION: 'agents.agent.client.request.duration',

  // Turn metrics
  TURNS_COUNT: 'agents.turns.count',
  TURNS_ERRORS: 'agents.turns.error.count',
  TURN_DURATION: 'agents.turn.duration',

  // Storage metrics
  STORAGE_OPERATION_DURATION: 'agents.storage.operation.duration',

  // Authentication metrics
  AUTH_TOKEN_REQUESTS: 'agents.auth.token.request.count',
  AUTH_TOKEN_DURATION: 'agents.auth.token.duration',

  // Authorization metrics
  AUTHORIZATION_REQUESTS: 'agents.authorization.request.count',
  AUTHORIZATION_DURATION: 'agents.authorization.duration',

  // UserTokenClient metrics
  USER_TOKEN_CLIENT_REQUESTS: 'agents.user.token.client.request.count',
  USER_TOKEN_CLIENT_REQUEST_DURATION: 'agents.user.token.client.request.duration'
} as const
