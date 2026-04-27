// import { WebTracerProvider } from '@opentelemetry/sdk-trace-web'
// import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load'
// // import { ZoneContextManager } from '@opentelemetry/context-zone'
// import { registerInstrumentations } from '@opentelemetry/instrumentation'

// import {
//   ConsoleSpanExporter,
//   BatchSpanProcessor
// } from '@opentelemetry/sdk-trace-base'

// const provider = new WebTracerProvider({
//   spanProcessors: [new BatchSpanProcessor(new ConsoleSpanExporter())],
// })

// provider.register({
//   // Changing default contextManager to use ZoneContextManager - supports asynchronous operations - optional
// //   contextManager: new ZoneContextManager(),
// })

// // Registering instrumentations
// registerInstrumentations({
//   instrumentations: [new DocumentLoadInstrumentation()],
// })

// const tracer = agentsTelemetry.otel.trace.getTracer('test-tracer')
// const span = tracer.startSpan('test-span')

// span.setAttribute('test-attribute', 'test-value')

// span.end()

// console.log('Vite import test - @microsoft/agents-telemetry:', agentsTelemetry)

localStorage.DEBUG = 'agents:telemetry:*'

import { SpanNames, trace } from '@microsoft/agents-telemetry'

const definition = trace.define({
  name: SpanNames.ADAPTER_PROCESS,
  record: {
    test: 'initial-value',
  },
  end ({ span, record, duration }) {
    console.log('Span ended with attributes:', record)
    span.setAttribute('test-attribute', record.test)
    span.setAttribute('duration', duration)
  }
})

trace(definition, ({ record }) => {
  console.log('Vite import test - @microsoft/agents-telemetry:', 'trace function executed')
  record({ test: 'updated-value' })
})

const managed = trace(definition)
managed.record({ test: 'updated-value' })
managed.end()
