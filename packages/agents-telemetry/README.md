# @microsoft/agents-telemetry

## Overview

The `@microsoft/agents-telemetry` package provides OpenTelemetry instrumentation primitives used across the Microsoft Agents SDK. It enables distributed tracing, structured log emission, and stable metric naming across your agent applications so you can monitor agent interactions, connector calls, storage operations, authentication flows, and turn processing.

The package currently provides:

- `trace(name, fn)` for creating validated spans around synchronous or asynchronous operations
- `createLogger` for emitting OpenTelemetry log records with namespace and level metadata
- `SpanNames` and `MetricNames` constants for consistent observability naming across the SDK
- `otel`, which exposes the OpenTelemetry API instance loaded by the package

This package supports both ESM and CommonJS consumers and requires Node.js 20 or later.

### Peer Dependencies

For full integration with your application's OpenTelemetry SDK, install the OpenTelemetry API packages in your agent:

```sh
npm install @opentelemetry/api @opentelemetry/api-logs
```

Both peer dependencies are optional. If either package is missing, `@microsoft/agents-telemetry` falls back to bundled compatible APIs and logs a warning. That fallback keeps instrumentation calls safe, but installing the official OpenTelemetry APIs is the recommended configuration.

## Enabling Tracing

### 1. Configure OpenTelemetry SDK

For traces to be exported, you need to configure the OpenTelemetry SDK with an exporter. Here's an example using the console exporter for development:

```ts
import { NodeSDK } from '@opentelemetry/sdk-node'
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node'

const sdk = new NodeSDK({
  traceExporter: new ConsoleSpanExporter(),
  serviceName: 'my-agent-service',
})

sdk.start()
```

Once your SDK is configured, components that use `trace(...)` will emit spans through the global OpenTelemetry tracer provider.

If you also want to export metrics referenced by `MetricNames`, configure a metric reader/exporter in your OpenTelemetry SDK as well.

## Enabling Logs (OTLP)

To export logs produced by `createLogger` to an OTLP backend, add a logs processor during startup:

```ts
import { NodeSDK } from '@opentelemetry/sdk-node'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-grpc'
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs'

const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317'

const sdk = new NodeSDK({
  resource: resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'my-agent-service',
    [ATTR_SERVICE_VERSION]: '1.0.0',
  }),
  logRecordProcessors: [
    new BatchLogRecordProcessor(new OTLPLogExporter({ url: otlpEndpoint })),
  ],
})

sdk.start()
```

### Production Setup with OTLP Exporter

For production, use an OTLP exporter to send traces to your observability backend, such as Azure Monitor, Jaeger, or Grafana:

```ts
import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'

const sdk = new NodeSDK({
  traceExporter: new OTLPTraceExporter({
    url: 'http://localhost:4318/v1/traces', // Your OTLP endpoint
  }),
  serviceName: 'my-agent-service',
})

sdk.start()
```

## Using trace

Use `trace(name, fn)` to run code inside an active span. The `name` must be one of the exported `SpanNames` values.

```ts
import { SpanNames, trace } from '@microsoft/agents-telemetry'

const result = await trace(SpanNames.AGENTS_APP_ROUTE_HANDLER, async (span) => {
  span.setAttribute('conversation.id', conversationId)
  span.setAttribute('code.function', 'handleMessage')

  return await service.handleMessage(conversationId, text)
})
```

Behavior details:

- On success, `trace` marks span status as `OK` and ends the span.
- On failure, `trace` records the exception (when the thrown value is an `Error`), sets span status to `ERROR`, adds a `*_failed` event, rethrows, and ends the span.
- If the span name is not part of `SpanNames`, `trace` throws an error immediately.
- If a span category is disabled via environment variable, the callback still runs with a non-recording span.

## Disabling Span Categories

All built-in span categories are enabled by default.

If you want to disable one or more categories without changing code, set `AGENTS_TELEMETRY_DISABLED_SPAN_CATEGORIES` in your environment. The value accepts comma and whitespace separators, and category names are trimmed before evaluation.

```env
AGENTS_TELEMETRY_DISABLED_SPAN_CATEGORIES=STORAGE,AUTHORIZATION

# or

AGENTS_TELEMETRY_DISABLED_SPAN_CATEGORIES=STORAGE AUTHORIZATION
```

Valid category names are:

- `STORAGE`
- `AUTHENTICATION`
- `AUTHORIZATION`

When a span category is disabled, the trace helper still executes your callback with an active non-recording span so your code path and span API calls remain safe, but no telemetry is emitted for that span.

### Features

- **Automatic span lifecycle**: Spans are automatically started and ended
- **Error recording**: Exceptions are recorded on the span and failures set span status to `ERROR`
- **Span name validation**: Unknown span names are rejected early to keep instrumentation consistent
- **Category-based span disabling**: Disable groups of spans using environment configuration
- **Fallback OpenTelemetry APIs**: If the official API packages are not installed, the package falls back to bundled compatible APIs

## Span Names

The package exports predefined span names and metric names for consistent observability across the SDK:

```ts
import { SpanNames, MetricNames } from '@microsoft/agents-telemetry'

// Available span names:
SpanNames.ADAPTER_PROCESS          // 'agents.adapter.process'
SpanNames.ADAPTER_SEND_ACTIVITIES  // 'agents.adapter.send_activities'
SpanNames.AGENTS_APP_RUN           // 'agents.app.run'
SpanNames.AGENTS_APP_ROUTE_HANDLER // 'agents.app.route_handler'
SpanNames.STORAGE_READ             // 'agents.storage.read'
SpanNames.CONNECTOR_REPLY_TO_ACTIVITY // 'agents.connector.reply_to_activity'
SpanNames.AUTHENTICATION_GET_ACCESS_TOKEN // 'agents.authentication.get_access_token'

// Available metric names:
MetricNames.ACTIVITIES_RECEIVED        // 'agents.activities.received'
MetricNames.CONNECTOR_REQUEST_DURATION // 'agents.connector.request.duration'
MetricNames.TURN_DURATION              // 'agents.turn.duration'
MetricNames.AUTH_TOKEN_REQUEST_COUNT   // 'agents.auth.token.request.count'
// ... and more
```

## API Reference

### `otel`

Exposes the OpenTelemetry API module loaded by this package. Use it when you need access to the same tracer, meter, or context API instance used by `@microsoft/agents-telemetry`.

### `trace(name, fn)`

Runs `fn` inside an OpenTelemetry active span.

| Parameter | Type | Description |
|-----------|------|-------------|
| `name` | `string` | Span name to create. Must be one of `SpanNames` values. |
| `fn` | `(span) => TReturn` | Callback executed in the active span. Return value (including a `Promise`) is forwarded. |

Return value:

- Returns whatever `fn` returns.
- Supports both sync and async callbacks.

### `SpanNames`

Provides stable span name constants used by Agents SDK components, including adapter, application, connector, storage, authentication, authorization, user token client, and turn-processing operations.

### `MetricNames`

Provides stable metric name constants for counters and histograms used by Agents SDK components, including activity counts, request counts, turn counts, and duration metrics.

## License

MIT
