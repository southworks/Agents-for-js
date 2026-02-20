export const SpanNames = {
  // CloudAdapter / BaseAdapter
  ADAPTER_PROCESS: 'agents.adapter.process',
  ADAPTER_SEND_ACTIVITIES: 'agents.adapter.sendActivities',
  ADAPTER_UPDATE_ACTIVITY: 'agents.adapter.updateActivity',
  ADAPTER_DELETE_ACTIVITY: 'agents.adapter.deleteActivity',
  ADAPTER_RUN_MIDDLEWARE: 'agents.adapter.runMiddleware',

  // ActivityHandler
  HANDLER_RUN: 'agents.handler.run',
  HANDLER_ON_TURN: 'agents.handler.onTurn',
  HANDLER_ON_MESSAGE: 'agents.handler.onMessage',
  HANDLER_ON_INVOKE: 'agents.handler.onInvoke',
  HANDLER_ON_CONVERSATION_UPDATE: 'agents.handler.onConversationUpdate',

  // AgentApplication
  APP_RUN: 'agents.app.run',
  APP_ROUTE: 'agents.app.route',

  // Dialogs
  DIALOG_BEGIN: 'agents.dialog.begin',
  DIALOG_CONTINUE: 'agents.dialog.continue',
  DIALOG_RESUME: 'agents.dialog.resume',

  // ConnectorClient
  CONNECTOR_SEND_TO_CONVERSATION: 'agents.connector.sendToConversation',
  CONNECTOR_REPLY_TO_ACTIVITY: 'agents.connector.replyToActivity',
  CONNECTOR_UPDATE_ACTIVITY: 'agents.connector.updateActivity',
  CONNECTOR_DELETE_ACTIVITY: 'agents.connector.deleteActivity',

  // Storage
  STORAGE_READ: 'agents.storage.read',
  STORAGE_WRITE: 'agents.storage.write',
  STORAGE_DELETE: 'agents.storage.delete',

  // CopilotStudio Client
  COPILOT_CONNECT: 'agents.copilot.connect',
  COPILOT_SEND_ACTIVITY: 'agents.copilot.sendActivity',
  COPILOT_RECEIVE_ACTIVITY: 'agents.copilot.receiveActivity',
} as const
