# @microsoft/agents-telemetry

## Overview

The `@microsoft/agents-telemetry` package provides OpenTelemetry instrumentation for the Microsoft Agents SDK. It enables distributed tracing across your agent applications, allowing you to monitor and debug agent interactions, message processing, and connector operations.

### Peer Dependency

This package requires `@opentelemetry/api` as a peer dependency. Install it in your agent:

```sh
npm install @opentelemetry/api
```

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

### 2. Production Setup with OTLP Exporter

For production, use an OTLP exporter to send traces to your observability backend (e.g., Azure Monitor, Jaeger, Grafana):

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

## Using recordSpan

The `recordSpan` utility wraps any async operation in an OpenTelemetry span with automatic error handling:

```ts
import { recordSpan, SpanNames } from '@microsoft/agents-telemetry'

const result = await recordSpan({
  name: 'my-custom-operation',
  attributes: {
    'operation.type': 'database',
    'db.name': 'users',
  },
  fn: async (span) => {
    // Your operation here
    span.setAttribute('result.count', 42)
    return await fetchData()
  },
})
```

### Features

- **Automatic span lifecycle**: Spans are automatically started and ended
- **Error recording**: Exceptions are recorded on the span with stack traces
- **Status tracking**: Span status is set to ERROR on failures
- **No-op fallback**: If telemetry is not initialized, operations run with a no-op span (zero overhead)

## Using `@otelTrace` decorator

You can instrument class methods with the `@otelTrace` decorator:

```ts
import { otelTrace, SpanNames } from '@microsoft/agents-telemetry'
import type { Span } from '@opentelemetry/api'

class CloudAdapter {
  @otelTrace<CloudAdapter, [unknown, unknown, (...args: unknown[]) => Promise<unknown>, unknown]>({
    name: SpanNames.ADAPTER_PROCESS,
    injectSpan: true,
  })
  public async process (
    request: unknown,
    res: unknown,
    logic: (...args: unknown[]) => Promise<unknown>,
    headerPropagation?: unknown,
    span?: Span
  ): Promise<unknown> {
    span?.setAttribute('agents.adapter.hasHeaderPropagation', Boolean(headerPropagation))
    return await logic(request, res)
  }
}
```

Decorator options:

- `name`: static span name or a callback to derive it from method arguments
- `options`: static `SpanOptions` or a callback to derive span options at call time
- `injectSpan`: when `true`, appends the active span as the final argument

## Span Names

The package exports predefined span names for consistent tracing across the SDK:

```ts
import { SpanNames } from '@microsoft/agents-telemetry'

// Available span names:
SpanNames.ADAPTER_PROCESS          // 'agents.adapter.process'
SpanNames.ADAPTER_SEND_ACTIVITIES  // 'agents.adapter.sendActivities'
SpanNames.HANDLER_RUN              // 'agents.handler.run'
SpanNames.HANDLER_ON_MESSAGE       // 'agents.handler.onMessage'
SpanNames.DIALOG_BEGIN             // 'agents.dialog.begin'
SpanNames.STORAGE_READ             // 'agents.storage.read'
SpanNames.CONNECTOR_REPLY_TO_ACTIVITY // 'agents.connector.replyToActivity'
// ... and more
```

## API Reference

### `initTelemetry(options?)`

Initializes the telemetry system.

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.serviceName` | `string` | Service name for the tracer (default: `'microsoft-agents'`) |

### `getOtel()`

Returns the initialized OpenTelemetry modules or `null` if not initialized.

### `recordSpan<T>(options)`

Wraps an operation in a span.

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.name` | `string` | Span name |
| `options.attributes` | `Record<string, string \| number \| boolean>` | Initial span attributes |
| `options.options` | `SpanOptions` | OpenTelemetry span options |
| `options.fn` | `(span: Span) => Promise<T> \| T` | Function to execute within the span |

## License

MIT
