# M365 Agents SDK Telemetry

OpenTelemetry traces, metrics, and span attributes for the M365 Agents SDK across C#, Python, and JavaScript.

The M365 Agents SDK provides built-in OpenTelemetry instrumentation to help developers monitor and debug their agent applications. When OpenTelemetry is configured in your application, the SDK automatically emits traces and metrics for key operations.

---

## Quick Navigation

### JavaScript Telemetry
- [Traces (Spans)](#javascript-spans)
  - [CloudAdapter Spans](#cloudadapter-spans)
  - [AgentApplication Spans](#agentapplication-spans)
  - [ConnectorClient Spans](#connectorclient-spans)
  - [AgentClient Spans](#agentclient-spans)
- [Metrics](#javascript-metrics)
  - [Activity Counters](#activity-counters)
  - [Duration Histograms](#duration-histograms)
  - [Request Counters](#request-counters)

### C# Telemetry
- [Coming Soon](#c-telemetry)

### Python Telemetry
- [Coming Soon](#python-telemetry)

---

## Using This Document

This document describes the telemetry signals emitted by the M365 Agents SDK. Use this reference to:

1. **Understand what data is collected** - Each span and metric is documented with its name, attributes, and purpose.
2. **Build dashboards and alerts** - Use the metric and span names to create observability dashboards in tools like Azure Monitor, Jaeger, or Grafana.
3. **Debug issues** - Trace spans help identify where latency or errors occur in your agent's request processing pipeline.
4. **Ensure consistency** - Multi-language implementations follow the same naming conventions for spans and metrics.

### Enabling OpenTelemetry

To enable telemetry in your agent application, ensure you have the OpenTelemetry SDK configured:

**JavaScript:**
```bash
npm install @opentelemetry/api @opentelemetry/sdk-node
```

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';

const sdk = new NodeSDK({
  traceExporter: new ConsoleSpanExporter(),
  // Configure your exporters (Jaeger, Azure Monitor, etc.)
});

sdk.start();
```

---

# JavaScript Telemetry

This section documents the OpenTelemetry spans and metrics emitted by the JavaScript/TypeScript M365 Agents SDK.

---

## JavaScript Spans

Spans represent individual operations within your agent's request processing. Each span includes attributes that provide context about the operation.

### CloudAdapter Spans

The CloudAdapter is the main entry point for processing incoming activities from channels.

#### agents.adapter.process

Main processing span for incoming activities.

| Attribute | Type | Description |
|-----------|------|-------------|
| `agents.activity.type` | string | The type of activity (message, conversationUpdate, etc.) |
| `agents.activity.channel_id` | string | The channel the activity originated from (msteams, webchat, etc.) |
| `agents.activity.delivery_mode` | string | The delivery mode of the activity |
| `agents.activity.conversation_id` | string | The conversation identifier |
| `agents.activity.is_agentic` | boolean | Whether this is an agentic (agent-to-agent) request |

**Events:**
- `process.failed` - Emitted when processing fails, includes `error.type` attribute

---

#### agents.adapter.sendActivities

Span for sending one or more activities to a conversation.

| Attribute | Type | Description |
|-----------|------|-------------|
| `agents.activity.count` | number | Number of activities being sent |
| `agents.activity.conversation_id` | string | The target conversation identifier |

**Events:**
- `sendActivities.failed` - Emitted on failure, includes `error.type` attribute

---

#### agents.adapter.updateActivity

Span for updating an existing activity.

| Attribute | Type | Description |
|-----------|------|-------------|
| `agents.activity.id` | string | The ID of the activity being updated |
| `agents.activity.conversation_id` | string | The conversation identifier |

**Events:**
- `updateActivity.failed` - Emitted on failure, includes `error.type` attribute

---

#### agents.adapter.deleteActivity

Span for deleting an activity from a conversation.

| Attribute | Type | Description |
|-----------|------|-------------|
| `agents.activity.id` | string | The ID of the activity being deleted |
| `agents.activity.conversation_id` | string | The conversation identifier |

**Events:**
- `deleteActivity.failed` - Emitted on failure, includes `error.type` attribute

---

#### agents.adapter.continueConversation

Span for continuing a conversation proactively.

| Attribute | Type | Description |
|-----------|------|-------------|
| `agents.bot.app_id` | string | The bot's application ID |
| `agents.activity.conversation_id` | string | The conversation identifier |
| `agents.is_agentic` | boolean | Whether this is an agentic request |

**Events:**
- `continueConversation.failed` - Emitted on failure, includes `error.type` attribute

---

#### agents.adapter.createConnectorClient

Span for creating a connector client instance.

| Attribute | Type | Description |
|-----------|------|-------------|
| `agents.service_url` | string | The Bot Framework service URL |
| `agents.auth.scope` | string | The authentication scope |
| `agents.is_agentic` | boolean | Whether this is for an agentic request (when using identity variant) |

**Events:**
- `createConnectorClient.failed` - Emitted on failure, includes `error.type` attribute
- `createConnectorClientWithIdentity.failed` - Emitted on identity variant failure

---

#### agents.adapter.runMiddleware

Span for executing the middleware pipeline.

*Currently defined but attributes vary based on middleware configuration.*

---

### AgentApplication Spans

The AgentApplication class provides a higher-level abstraction for building agents with routing and handlers.

#### agents.app.run

Main execution span for the AgentApplication.

| Attribute | Type | Description |
|-----------|------|-------------|
| `agents.activity.type` | string | The type of activity being processed |
| `agents.activity.id` | string | The activity identifier |
| `agents.route.authorized` | boolean | Whether the request was authorized |
| `agents.route.matched` | boolean | Whether a route handler matched the activity |

**Child Spans:**
- `agents.app.routeHandler` - Includes `agents.route.is_invoke` and `agents.route.is_agentic` attributes
- `agents.app.downloadFiles` - Includes `agents.attachments.count` attribute

**Events:**
- `appRun.failed` - Emitted on failure, includes `error.type` attribute

---

#### agents.app.routeHandler

Child span for executing a matched route handler.

| Attribute | Type | Description |
|-----------|------|-------------|
| `agents.route.is_invoke` | boolean | Whether this is an invoke activity route |
| `agents.route.is_agentic` | boolean | Whether this is an agentic route |

---

#### agents.app.beforeTurn

Span for before-turn handlers execution.

*Attributes depend on handler implementation.*

---

#### agents.app.afterTurn

Span for after-turn handlers execution.

*Attributes depend on handler implementation.*

---

#### agents.app.downloadFiles

Span for downloading file attachments.

| Attribute | Type | Description |
|-----------|------|-------------|
| `agents.attachments.count` | number | Number of attachments being downloaded |

---

### ConnectorClient Spans

The ConnectorClient handles HTTP communication with the Bot Framework Connector service.

#### agents.connector.replyToActivity

Span for replying to a specific activity.

| Attribute | Type | Description |
|-----------|------|-------------|
| `agents.activity.conversation_id` | string | The conversation identifier |
| `agents.activity.id` | string | The activity being replied to |

**Events:**
- `replyToActivity.failed` - Emitted on failure, includes `error.type` attribute

---

#### agents.connector.sendToConversation

Span for sending an activity to a conversation.

| Attribute | Type | Description |
|-----------|------|-------------|
| `agents.activity.conversation_id` | string | The target conversation identifier |

**Events:**
- `sendToConversation.failed` - Emitted on failure, includes `error.type` attribute

---

#### agents.connector.updateActivity

Span for updating an activity via the connector.

| Attribute | Type | Description |
|-----------|------|-------------|
| `agents.activity.conversation_id` | string | The conversation identifier |
| `agents.activity.id` | string | The activity being updated |

**Events:**
- `updateActivity.failed` - Emitted on failure, includes `error.type` attribute

---

#### agents.connector.deleteActivity

Span for deleting an activity via the connector.

| Attribute | Type | Description |
|-----------|------|-------------|
| `agents.activity.conversation_id` | string | The conversation identifier |
| `agents.activity.id` | string | The activity being deleted |

**Events:**
- `deleteActivity.failed` - Emitted on failure, includes `error.type` attribute

---

#### agents.connector.createConversation

Span for creating a new conversation.

*Attributes recorded via metrics (operation, http.method, http.status_code).*

**Events:**
- `createConversation.failed` - Emitted on failure, includes `error.type` attribute

---

#### agents.connector.getConversations

Span for retrieving conversations.

*Attributes recorded via metrics (operation, http.method, http.status_code).*

**Events:**
- `getConversations.failed` - Emitted on failure, includes `error.type` attribute

---

#### agents.connector.getConversationMembers

Span for retrieving conversation members.

*Attributes recorded via metrics (operation, http.method, http.status_code).*

**Events:**
- `getConversationMember.failed` - Emitted on failure, includes `error.type` attribute

---

#### agents.connector.uploadAttachment

Span for uploading an attachment.

| Attribute | Type | Description |
|-----------|------|-------------|
| `agents.activity.conversation_id` | string | The conversation identifier |

**Events:**
- `uploadAttachment.failed` - Emitted on failure, includes `error.type` attribute

---

#### agents.connector.getAttachment

Span for retrieving attachment content or info.

| Attribute | Type | Description |
|-----------|------|-------------|
| `agents.attachment.id` | string | The attachment identifier |

**Events:**
- `getAttachment.failed` - Emitted on failure, includes `error.type` attribute
- `getAttachmentInfo.failed` - Emitted on info retrieval failure

---

### AgentClient Spans

The AgentClient handles agent-to-agent communication.

#### agents.agentClient.postActivity

Span for posting an activity to another agent.

| Attribute | Type | Description |
|-----------|------|-------------|
| `agents.target.endpoint` | string | The target agent's endpoint URL |
| `agents.target.client_id` | string | The target agent's client ID |
| `http.status_code` | number | HTTP response status code |

**Events:**
- `postActivity.failed` - Emitted on failure, includes `error.type` attribute

---

## JavaScript Metrics

Metrics provide aggregated measurements of your agent's operation over time.

### Activity Counters

Counters track the total number of activities processed.

#### agents.activities.received

**Type:** Counter  
**Unit:** activities  
**Description:** Total number of activities received by the adapter.

| Attribute | Type | Description |
|-----------|------|-------------|
| `agents.activity.type` | string | Type of activity received |
| `agents.activity.channel_id` | string | Channel the activity came from |

---

#### agents.activities.sent

**Type:** Counter  
**Unit:** activities  
**Description:** Total number of outbound activities sent by the adapter.

| Attribute | Type | Description |
|-----------|------|-------------|
| `agents.activity.type` | string | Type of activity sent |
| `agents.activity.channel_id` | string | Target channel |

---

#### agents.activities.updated

**Type:** Counter  
**Unit:** activities  
**Description:** Total number of activities updated by the adapter.

| Attribute | Type | Description |
|-----------|------|-------------|
| `agents.activity.channel_id` | string | Channel where activity was updated |

---

#### agents.activities.deleted

**Type:** Counter  
**Unit:** activities  
**Description:** Total number of activities deleted by the adapter.

| Attribute | Type | Description |
|-----------|------|-------------|
| `agents.activity.channel_id` | string | Channel where activity was deleted |

---

### Request Counters

Counters for outbound requests.

#### agents.connector.requests

**Type:** Counter  
**Unit:** request  
**Description:** Total number of outbound connector HTTP requests.

| Attribute | Type | Description |
|-----------|------|-------------|
| `operation` | string | Connector operation name (replyToActivity, sendToConversation, etc.) |
| `http.method` | string | HTTP method used (POST, GET, DELETE, etc.) |
| `http.status_code` | number | HTTP response status code |

---

#### agents.agentClient.requests

**Type:** Counter  
**Unit:** request  
**Description:** Total number of inter-agent calls.

| Attribute | Type | Description |
|-----------|------|-------------|
| `agents.target.endpoint` | string | Target agent endpoint |
| `http.status_code` | number | HTTP response status code |

---

### Duration Histograms

Histograms track the distribution of operation durations.

#### agents.adapter.process.duration

**Type:** Histogram  
**Unit:** milliseconds  
**Description:** Duration of the adapter process method in milliseconds.

| Attribute | Type | Description |
|-----------|------|-------------|
| `agents.activity.type` | string | Type of activity processed |

---

#### agents.connector.request.duration

**Type:** Histogram  
**Unit:** milliseconds  
**Description:** Duration of outbound connector HTTP requests in milliseconds.

| Attribute | Type | Description |
|-----------|------|-------------|
| `operation` | string | Connector operation name |
| `http.status_code` | number | HTTP response status code |

---

#### agents.agentClient.request.duration

**Type:** Histogram  
**Unit:** milliseconds  
**Description:** Duration of inter-agent call latency in milliseconds.

| Attribute | Type | Description |
|-----------|------|-------------|
| `agents.target.endpoint` | string | Target agent endpoint |

---

## JavaScript Span Constants Reference

All span names are available as constants in the `@microsoft/agents-telemetry` package:

```typescript
import { SpanNames } from '@microsoft/agents-telemetry';

// CloudAdapter
SpanNames.ADAPTER_PROCESS              // 'agents.adapter.process'
SpanNames.ADAPTER_SEND_ACTIVITIES      // 'agents.adapter.sendActivities'
SpanNames.ADAPTER_UPDATE_ACTIVITY      // 'agents.adapter.updateActivity'
SpanNames.ADAPTER_DELETE_ACTIVITY      // 'agents.adapter.deleteActivity'
SpanNames.ADAPTER_CONTINUE_CONVERSATION // 'agents.adapter.continueConversation'
SpanNames.ADAPTER_CREATE_CONNECTOR_CLIENT // 'agents.adapter.createConnectorClient'
SpanNames.ADAPTER_RUN_MIDDLEWARE       // 'agents.adapter.runMiddleware'

// ActivityHandler
SpanNames.HANDLER_RUN                  // 'agents.handler.run'
SpanNames.HANDLER_ON_TURN              // 'agents.handler.onTurn'
SpanNames.HANDLER_ON_MESSAGE           // 'agents.handler.onMessage'
SpanNames.HANDLER_ON_INVOKE            // 'agents.handler.onInvoke'
SpanNames.HANDLER_ON_CONVERSATION_UPDATE // 'agents.handler.onConversationUpdate'

// AgentApplication
SpanNames.AGENTS_APP_RUN               // 'agents.app.run'
SpanNames.AGENTS_APP_ROUTE_HANDLER     // 'agents.app.routeHandler'
SpanNames.AGENTS_APP_BEFORE_TURN       // 'agents.app.beforeTurn'
SpanNames.AGENTS_APP_AFTER_TURN        // 'agents.app.afterTurn'
SpanNames.AGENTS_APP_DOWNLOAD_FILES    // 'agents.app.downloadFiles'

// Dialogs
SpanNames.DIALOG_BEGIN                 // 'agents.dialog.begin'
SpanNames.DIALOG_CONTINUE              // 'agents.dialog.continue'
SpanNames.DIALOG_RESUME                // 'agents.dialog.resume'

// ConnectorClient
SpanNames.CONNECTOR_SEND_TO_CONVERSATION   // 'agents.connector.sendToConversation'
SpanNames.CONNECTOR_REPLY_TO_ACTIVITY      // 'agents.connector.replyToActivity'
SpanNames.CONNECTOR_UPDATE_ACTIVITY        // 'agents.connector.updateActivity'
SpanNames.CONNECTOR_DELETE_ACTIVITY        // 'agents.connector.deleteActivity'
SpanNames.CONNECTOR_CREATE_CONVERSATION    // 'agents.connector.createConversation'
SpanNames.CONNECTOR_GET_CONVERSATIONS      // 'agents.connector.getConversations'
SpanNames.CONNECTOR_GET_CONVERSATION_MEMBERS // 'agents.connector.getConversationMembers'
SpanNames.CONNECTOR_UPLOAD_ATTACHMENT      // 'agents.connector.uploadAttachment'
SpanNames.CONNECTOR_GET_ATTACHMENT         // 'agents.connector.getAttachment'

// Storage
SpanNames.STORAGE_READ                 // 'agents.storage.read'
SpanNames.STORAGE_WRITE                // 'agents.storage.write'
SpanNames.STORAGE_DELETE               // 'agents.storage.delete'

// CopilotStudio Client
SpanNames.COPILOT_CONNECT              // 'agents.copilot.connect'
SpanNames.COPILOT_SEND_ACTIVITY        // 'agents.copilot.sendActivity'
SpanNames.COPILOT_RECEIVE_ACTIVITY     // 'agents.copilot.receiveActivity'

// AgentClient
SpanNames.AGENT_CLIENT_POST_ACTIVITY   // 'agents.agentClient.postActivity'
```

---

## JavaScript Metric Constants Reference

All metric names are available as constants:

```typescript
import { MetricNames } from '@microsoft/agents-telemetry';

// CloudAdapter
MetricNames.ADAPTER_PROCESSED_ACTIVITIES  // 'agents.adapter.processed.activities'
MetricNames.ADAPTER_PROCESS_DURATION      // 'agents.adapter.process.duration'

// Activity counters
MetricNames.ACTIVITIES_RECEIVED           // 'agents.activities.received'
MetricNames.ACTIVITIES_SENT               // 'agents.activities.sent'
MetricNames.ACTIVITIES_UPDATED            // 'agents.activities.updated'
MetricNames.ACTIVITIES_DELETED            // 'agents.activities.deleted'

// Connector metrics
MetricNames.CONNECTOR_REQUESTS            // 'agents.connector.requests'
MetricNames.CONNECTOR_REQUEST_DURATION    // 'agents.connector.request.duration'

// AgentClient metrics
MetricNames.AGENT_CLIENT_REQUESTS         // 'agents.agentClient.requests'
MetricNames.AGENT_CLIENT_REQUEST_DURATION // 'agents.agentClient.request.duration'
```

---

# C# Telemetry

*This section will document OpenTelemetry traces and metrics for the C# M365 Agents SDK.*

**Coming Soon**

The C# SDK telemetry implementation is under development. This section will include:

- Trace span names and attributes
- Metric names and dimensions
- Configuration guidance for .NET applications
- Integration with Azure Monitor and Application Insights

---

# Python Telemetry

*This section will document OpenTelemetry traces and metrics for the Python M365 Agents SDK.*

**Coming Soon**

The Python SDK telemetry implementation is under development. This section will include:

- Trace span names and attributes
- Metric names and dimensions
- Configuration guidance for Python applications
- Integration with popular Python observability tools

---

# Appendix: Common Span Attributes

These attributes appear across multiple spans and follow OpenTelemetry semantic conventions where applicable.

| Attribute | Type | Description |
|-----------|------|-------------|
| `agents.activity.type` | string | Bot Framework activity type (message, conversationUpdate, invoke, etc.) |
| `agents.activity.id` | string | Unique identifier for the activity |
| `agents.activity.channel_id` | string | Channel identifier (msteams, webchat, directline, etc.) |
| `agents.activity.conversation_id` | string | Unique identifier for the conversation |
| `error.type` | string | Exception/error class name when an error occurs |
| `http.method` | string | HTTP method for outbound requests |
| `http.status_code` | number | HTTP response status code |

---

# Appendix: Span Kind Reference

The SDK uses OpenTelemetry SpanKind to categorize spans:

| Kind | Value | Usage |
|------|-------|-------|
| `INTERNAL` | 0 | Internal operations within the SDK |
| `SERVER` | 1 | Handling incoming requests (e.g., adapter.process) |
| `CLIENT` | 2 | Outbound calls (e.g., connector requests, agent-to-agent calls) |
| `PRODUCER` | 3 | Producing messages to a broker |
| `CONSUMER` | 4 | Consuming messages from a broker |

---

*This documentation is current as of the latest version of the Microsoft 365 Agents SDK. For the most up-to-date information, refer to the official SDK documentation and release notes.*
