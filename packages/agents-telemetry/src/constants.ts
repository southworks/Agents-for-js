// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export const SpanNames = {
  // CloudAdapter / BaseAdapter
  ADAPTER_PROCESS: 'agents.adapter.process',
  ADAPTER_SEND_ACTIVITIES: 'agents.adapter.sendActivities',
  ADAPTER_UPDATE_ACTIVITY: 'agents.adapter.updateActivity',
  ADAPTER_DELETE_ACTIVITY: 'agents.adapter.deleteActivity',
  ADAPTER_CONTINUE_CONVERSATION: 'agents.adapter.continueConversation',
  ADAPTER_CREATE_CONNECTOR_CLIENT: 'agents.adapter.createConnectorClient',
  ADAPTER_TURN: 'agents.adapter.turn',

  // ActivityHandler
  HANDLER_RUN: 'agents.handler.run',
  HANDLER_ON_TURN: 'agents.handler.onTurn',
  HANDLER_ON_MESSAGE: 'agents.handler.onMessage',
  HANDLER_ON_INVOKE: 'agents.handler.onInvoke',
  HANDLER_ON_CONVERSATION_UPDATE: 'agents.handler.onConversationUpdate',

  // AgentApplication
  AGENTS_APP_RUN: 'agents.app.run',
  AGENTS_APP_ROUTE_HANDLER: 'agents.app.routeHandler',
  AGENTS_APP_BEFORE_TURN: 'agents.app.beforeTurn',
  AGENTS_APP_AFTER_TURN: 'agents.app.afterTurn',
  AGENTS_APP_DOWNLOAD_FILES: 'agents.app.downloadFiles',

  // Dialogs
  DIALOG_BEGIN: 'agents.dialog.begin',
  DIALOG_CONTINUE: 'agents.dialog.continue',
  DIALOG_RESUME: 'agents.dialog.resume',

  // ConnectorClient
  CONNECTOR_SEND_TO_CONVERSATION: 'agents.connector.sendToConversation',
  CONNECTOR_REPLY_TO_ACTIVITY: 'agents.connector.replyToActivity',
  CONNECTOR_UPDATE_ACTIVITY: 'agents.connector.updateActivity',
  CONNECTOR_DELETE_ACTIVITY: 'agents.connector.deleteActivity',
  CONNECTOR_CREATE_CONVERSATION: 'agents.connector.createConversation',
  CONNECTOR_GET_CONVERSATIONS: 'agents.connector.getConversations',
  CONNECTOR_GET_CONVERSATION_MEMBERS: 'agents.connector.getConversationMembers',
  CONNECTOR_UPLOAD_ATTACHMENT: 'agents.connector.uploadAttachment',
  CONNECTOR_GET_ATTACHMENT: 'agents.connector.getAttachment',

  // Storage
  STORAGE_READ: 'agents.storage.read',
  STORAGE_WRITE: 'agents.storage.write',
  STORAGE_DELETE: 'agents.storage.delete',

  // CopilotStudio Client
  COPILOT_CONNECT: 'agents.copilot.connect',
  COPILOT_SEND_ACTIVITY: 'agents.copilot.sendActivity',
  COPILOT_RECEIVE_ACTIVITY: 'agents.copilot.receiveActivity',

  // AgentClient
  AGENT_CLIENT_POST_ACTIVITY: 'agents.agentClient.postActivity',

  // TurnContext
  TURN_SEND_ACTIVITY: 'agents.turn.sendActivity',
  TURN_SEND_ACTIVITIES: 'agents.turn.sendActivities',
  TURN_UPDATE_ACTIVITY: 'agents.turn.updateActivity',
  TURN_DELETE_ACTIVITY: 'agents.turn.deleteActivity',
} as const

export const SpanKind = {
  /** Default value. Indicates that the span is used internally. */
  INTERNAL: 0,
  /**
   * Indicates that the span covers server-side handling of an RPC or other
   * remote request.
   */
  SERVER: 1,
  /**
   * Indicates that the span covers the client-side wrapper around an RPC or
   * other remote request.
   */
  CLIENT: 2,
  /**
   * Indicates that the span describes producer sending a message to a
   * broker. Unlike client and server, there is no direct critical path latency
   * relationship between producer and consumer spans.
   */
  PRODUCER: 3,
  /**
   * Indicates that the span describes consumer receiving a message from a
   * broker. Unlike client and server, there is no direct critical path latency
   * relationship between producer and consumer spans.
   */
  CONSUMER: 4
} as const

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
  CONNECTOR_REQUESTS: 'agents.connector.requests',
  CONNECTOR_REQUEST_DURATION: 'agents.connector.request.duration',

  // AgentClient metrics
  AGENT_CLIENT_REQUESTS: 'agents.agentClient.requests',
  AGENT_CLIENT_REQUEST_DURATION: 'agents.agentClient.request.duration',

  // Turn metrics
  TURNS_TOTAL: 'agents.turns.total',
  TURNS_ERRORS: 'agents.turns.errors',
  TURN_DURATION: 'agents.turn.duration',

  // Storage metrics
  STORAGE_OPERATION_DURATION: 'agents.storage.operation.duration'
} as const
