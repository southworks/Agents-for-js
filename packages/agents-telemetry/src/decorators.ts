// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { otelTrace } from './otel'
import { SpanNames } from './constants'

// ---------------------------------------------------------------------------
// CloudAdapter / BaseAdapter
// ---------------------------------------------------------------------------

export const traceAdapterProcess = otelTrace({
  name: SpanNames.ADAPTER_PROCESS,
  options: ({ args }) => {
    const [request] = args
    const activity = request as { type?: string, channelId?: string } | undefined
    return {
      attributes: {
        'agents.activity.type': activity?.type ?? 'unknown',
        'agents.activity.channel': activity?.channelId ?? 'unknown',
        'http.method': 'POST',
      },
    }
  },
})

export const traceAdapterSendActivities = otelTrace({
  name: SpanNames.ADAPTER_SEND_ACTIVITIES,
})

export const traceAdapterUpdateActivity = otelTrace({
  name: SpanNames.ADAPTER_UPDATE_ACTIVITY,
})

export const traceAdapterDeleteActivity = otelTrace({
  name: SpanNames.ADAPTER_DELETE_ACTIVITY,
})

export const traceAdapterRunMiddleware = otelTrace({
  name: SpanNames.ADAPTER_RUN_MIDDLEWARE,
})

// ---------------------------------------------------------------------------
// ActivityHandler
// ---------------------------------------------------------------------------

export const traceHandlerRun = otelTrace({
  name: SpanNames.HANDLER_RUN,
})

export const traceHandlerOnTurn = otelTrace({
  name: SpanNames.HANDLER_ON_TURN,
})

export const traceHandlerOnMessage = otelTrace({
  name: SpanNames.HANDLER_ON_MESSAGE,
})

export const traceHandlerOnInvoke = otelTrace({
  name: SpanNames.HANDLER_ON_INVOKE,
})

export const traceHandlerOnConversationUpdate = otelTrace({
  name: SpanNames.HANDLER_ON_CONVERSATION_UPDATE,
})

// ---------------------------------------------------------------------------
// AgentApplication
// ---------------------------------------------------------------------------

export const traceAppRun = otelTrace({
  name: SpanNames.APP_RUN,
})

export const traceAppRoute = otelTrace({
  name: SpanNames.APP_ROUTE,
})

// ---------------------------------------------------------------------------
// Dialogs
// ---------------------------------------------------------------------------

export const traceDialogBegin = otelTrace({
  name: SpanNames.DIALOG_BEGIN,
})

export const traceDialogContinue = otelTrace({
  name: SpanNames.DIALOG_CONTINUE,
})

export const traceDialogResume = otelTrace({
  name: SpanNames.DIALOG_RESUME,
})

// ---------------------------------------------------------------------------
// ConnectorClient
// ---------------------------------------------------------------------------

export const traceConnectorSendToConversation = otelTrace({
  name: SpanNames.CONNECTOR_SEND_TO_CONVERSATION,
})

export const traceConnectorReplyToActivity = otelTrace({
  name: SpanNames.CONNECTOR_REPLY_TO_ACTIVITY,
})

export const traceConnectorUpdateActivity = otelTrace({
  name: SpanNames.CONNECTOR_UPDATE_ACTIVITY,
})

export const traceConnectorDeleteActivity = otelTrace({
  name: SpanNames.CONNECTOR_DELETE_ACTIVITY,
})

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

export const traceStorageRead = otelTrace({
  name: SpanNames.STORAGE_READ,
})

export const traceStorageWrite = otelTrace({
  name: SpanNames.STORAGE_WRITE,
})

export const traceStorageDelete = otelTrace({
  name: SpanNames.STORAGE_DELETE,
})

// ---------------------------------------------------------------------------
// CopilotStudio Client
// ---------------------------------------------------------------------------

export const traceCopilotConnect = otelTrace({
  name: SpanNames.COPILOT_CONNECT,
})

export const traceCopilotSendActivity = otelTrace({
  name: SpanNames.COPILOT_SEND_ACTIVITY,
})

export const traceCopilotReceiveActivity = otelTrace({
  name: SpanNames.COPILOT_RECEIVE_ACTIVITY,
})
