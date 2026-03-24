// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

export const AGENTS_TELEMETRY_DISABLED_SPAN_CATEGORIES = 'AGENTS_TELEMETRY_DISABLED_SPAN_CATEGORIES'

export const SpanCategories = {
  STORAGE: ['STORAGE_'],
  AUTHORIZATION: ['AUTHORIZATION_', 'USER_TOKEN_CLIENT_'],
  AUTHENTICATION: ['AUTHENTICATION_'],
} as const

export const SpanNames = {
  // CloudAdapter / BaseAdapter
  ADAPTER_PROCESS: 'agents.adapter.process',
  ADAPTER_SEND_ACTIVITIES: 'agents.adapter.send_activities',
  ADAPTER_UPDATE_ACTIVITY: 'agents.adapter.update_activity',
  ADAPTER_DELETE_ACTIVITY: 'agents.adapter.delete_activity',
  ADAPTER_CONTINUE_CONVERSATION: 'agents.adapter.continue_conversation',
  ADAPTER_CREATE_CONNECTOR_CLIENT: 'agents.adapter.create_connector_client',
  ADAPTER_CREATE_USER_TOKEN_CLIENT: 'agents.adapter.create_user_token_client',

  // AgentApplication
  AGENTS_APP_RUN: 'agents.app.run',
  AGENTS_APP_ROUTE_HANDLER: 'agents.app.route_handler',
  AGENTS_APP_BEFORE_TURN: 'agents.app.before_turn',
  AGENTS_APP_AFTER_TURN: 'agents.app.after_turn',
  AGENTS_APP_DOWNLOAD_FILES: 'agents.app.download_files',

  // ConnectorClient
  CONNECTOR_SEND_TO_CONVERSATION: 'agents.connector.send_to_conversation',
  CONNECTOR_REPLY_TO_ACTIVITY: 'agents.connector.reply_to_activity',
  CONNECTOR_UPDATE_ACTIVITY: 'agents.connector.update_activity',
  CONNECTOR_DELETE_ACTIVITY: 'agents.connector.delete_activity',
  CONNECTOR_CREATE_CONVERSATION: 'agents.connector.create_conversation',
  CONNECTOR_GET_CONVERSATIONS: 'agents.connector.get_conversations',
  CONNECTOR_GET_CONVERSATION_MEMBERS: 'agents.connector.get_conversation_members',
  CONNECTOR_UPLOAD_ATTACHMENT: 'agents.connector.upload_attachment',
  CONNECTOR_GET_ATTACHMENT: 'agents.connector.get_attachment',

  // Storage
  STORAGE_READ: 'agents.storage.read',
  STORAGE_WRITE: 'agents.storage.write',
  STORAGE_DELETE: 'agents.storage.delete',

  // AgentClient
  AGENT_CLIENT_POST_ACTIVITY: 'agents.agent_client.post_activity',

  // Authentication
  AUTHENTICATION_GET_ACCESS_TOKEN: 'agents.authentication.get_access_token',
  AUTHENTICATION_ACQUIRE_TOKEN_ON_BEHALF_OF: 'agents.authentication.acquire_token_on_behalf_of',
  AUTHENTICATION_GET_AGENTIC_INSTANCE_TOKEN: 'agents.authentication.get_agentic_instance_token',
  AUTHENTICATION_GET_AGENTIC_USER_TOKEN: 'agents.authentication.get_agentic_user_token',

  // Authorization
  AUTHORIZATION_AGENTIC_TOKEN: 'agents.authorization.agentic_token',
  AUTHORIZATION_AZURE_BOT_TOKEN: 'agents.authorization.azure_bot_token',
  AUTHORIZATION_AZURE_BOT_SIGNIN: 'agents.authorization.azure_bot_signin',
  AUTHORIZATION_AZURE_BOT_SIGNOUT: 'agents.authorization.azure_bot_signout',

  // UserTokenClient
  USER_TOKEN_CLIENT_GET_USER_TOKEN: 'agents.user_token_client.get_user_token',
  USER_TOKEN_CLIENT_SIGN_OUT: 'agents.user_token_client.sign_out',
  USER_TOKEN_CLIENT_GET_SIGN_IN_RESOURCE: 'agents.user_token_client.get_sign_in_resource',
  USER_TOKEN_CLIENT_EXCHANGE_TOKEN: 'agents.user_token_client.exchange_token',
  USER_TOKEN_CLIENT_GET_TOKEN_OR_SIGNIN_RESOURCE: 'agents.user_token_client.get_token_or_sign_in_resource',
  USER_TOKEN_CLIENT_GET_TOKEN_STATUS: 'agents.user_token_client.get_token_status',
  USER_TOKEN_CLIENT_GET_AAD_TOKENS: 'agents.user_token_client.get_aad_tokens',

  // TurnContext
  TURN_SEND_ACTIVITIES: 'agents.turn.send_activities',
} as const

export const MetricNames = {
  // CloudAdapter
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
  AGENT_CLIENT_REQUESTS: 'agents.agent_client.request.count',
  AGENT_CLIENT_REQUEST_DURATION: 'agents.agent_client.request.duration',

  // Turn metrics
  TURNS_COUNT: 'agents.turn.count',
  TURNS_ERRORS: 'agents.turn.error.count',
  TURN_DURATION: 'agents.turn.duration',

  // Storage metrics
  STORAGE_OPERATION_DURATION: 'agents.storage.operation.duration',

  // Authentication metrics
  AUTH_TOKEN_REQUESTS: 'agents.auth.token.request.count',
  AUTH_TOKEN_DURATION: 'agents.auth.token.duration',

  // UserTokenClient metrics
  USER_TOKEN_CLIENT_REQUESTS: 'agents.user_token_client.request.count',
  USER_TOKEN_CLIENT_REQUEST_DURATION: 'agents.user_token_client.request.duration'
} as const
