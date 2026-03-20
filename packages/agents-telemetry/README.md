# @microsoft/agents-telemetry

## Overview

The `@microsoft/agents-telemetry` package provides OpenTelemetry instrumentation primitives used across the Microsoft Agents SDK. It enables distributed tracing, structured log emission, and stable metric naming across your agent applications so you can monitor agent interactions, connector calls, storage operations, authentication flows, and turn processing.

The package currently provides:

- `createTracedDecorator` for decorator-based span creation around class methods
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

Once your SDK is configured, components that use `createTracedDecorator` will emit spans through the global OpenTelemetry tracer provider.

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

Then create and use a logger from this package:

```ts
import { createLogger } from '@microsoft/agents-telemetry'

const info = createLogger('agents:sample', 'info')
const error = createLogger('agents:sample', 'error')

info('agent started', { port: 3978 })
error('request failed', new Error('Connection lost'))
```

Each emitted record includes `log.namespace` and `log.level` attributes. Additional arguments are serialized into the log body.

### 2. Production Setup with OTLP Exporter

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

## Using createTracedDecorator

The `createTracedDecorator` utility wraps a class method in an OpenTelemetry span and gives you lifecycle hooks for enriching the span with attributes and error details:

```ts
import { createTracedDecorator, SpanNames } from '@microsoft/agents-telemetry'

const TraceMessage = createTracedDecorator<MessageService['handleMessage'], { conversationId?: string }>({
  spanName: SpanNames.AGENTS_APP_ROUTE_HANDLER,
  onStart (span, decorator) {
    span.setAttribute('code.function', String(decorator.name))
    span.setAttribute('message.arg_count', decorator.args.length)
  },
  onEnd (span, decorator) {
    span.setAttribute('conversation.id', decorator.scope.conversationId ?? 'unknown')
  },
})

class MessageService {
  @TraceMessage
  async handleMessage (conversationId: string, text: string) {
    TraceMessage.share(this, { conversationId })
    return { accepted: true, text }
  }
}
```

If you are tracing a function call path that is not using decorator syntax, you can still apply the same traced wrapper with `process(...)`:

```ts
await TraceMessage.process(async () => {
  return await service.handleMessage('conversation-123', 'hello')
})
```

### Features

- **Automatic span lifecycle**: Spans are automatically started and ended
- **Lifecycle hooks**: `onStart`, `onSuccess`, `onError`, and `onEnd` let you enrich spans at each stage
- **Shared decorator scope**: `decorator.share(...)` allows method code to pass context into lifecycle hooks
- **Error recording**: Exceptions are recorded on the span and failures set span status to `ERROR`
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
MetricNames.AUTH_TOKEN_REQUESTS        // 'agents.auth.token.request.count'
// ... and more
```

## API Reference

### `otel`

Exposes the OpenTelemetry API module loaded by this package. Use it when you need access to the same tracer, meter, or context API instance used by `@microsoft/agents-telemetry`.

### `createTracedDecorator(config?)`

Creates a method decorator that wraps execution in an OpenTelemetry span.

| Parameter | Type | Description |
|-----------|------|-------------|
| `config.spanName` | `string` | Span name to create. If omitted, the method name is used. |
| `config.spanOptions` | `SpanOptions` | Base OpenTelemetry span options. |
| `config.onStart` | `(span, decorator, context) => void` | Called before the original method executes. |
| `config.onSuccess` | `(span, decorator, context) => void` | Called after successful execution. |
| `config.onError` | `(span, error, decorator, context) => void` | Called when the wrapped method throws. |
| `config.onEnd` | `(span, decorator, context) => void` | Called in the `finally` path before the span ends. |

The returned decorator also exposes:

- `share(this, scope)` to pass contextual values from the decorated method into later lifecycle hooks
- `process(fn)` to run a function through the same traced wrapper without decorator syntax

### `createLogger(namespace, level?)`

Creates a function that emits OpenTelemetry log records.

| Parameter | Type | Description |
|-----------|------|-------------|
| `namespace` | `string` | Logger namespace written to `log.namespace`. |
| `level` | `'debug' \| 'info' \| 'warn' \| 'error'` | Optional severity level. Defaults to `debug`. |

The returned logger accepts `(message: string, ...args: unknown[])` and serializes additional arguments into the emitted log body.

### `SpanNames`

Provides stable span name constants used by Agents SDK components, including adapter, application, connector, storage, authentication, authorization, user token client, and turn-processing operations.

### `MetricNames`

Provides stable metric name constants for counters and histograms used by Agents SDK components, including activity counts, request counts, turn counts, and duration metrics.

### `TracedMethodConfig<T>`

The configuration type used by `createTracedDecorator`. Exported for advanced typing scenarios when you want to build reusable tracing helpers. It includes the lifecycle hooks shown above and is parameterized by the decorator context for the traced method.

## License

MIT
