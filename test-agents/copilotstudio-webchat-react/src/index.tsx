/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

window.localStorage.debug = 'copilot-studio:*,agents:telemetry:*,test:*'

import { getCopilotStudioConnectionUrl } from '@microsoft/agents-copilotstudio-client'

getCopilotStudioConnectionUrl({})
// import { debug, trace, SpanNames } from '@microsoft/agents-telemetry'

// debug('test').debug('testing')

// logs.getLogger('test').emit({ body: 'Testing OTel logs' })

// console.log(trace, logs)

// import React from 'react'
// import ReactDOM from 'react-dom'
// import Chat from './Chat'

// localStorage.DEBUG = 'agents:telemetry:*'

// import { WebTracerProvider } from '@opentelemetry/sdk-trace-web'
// import { DocumentLoadInstrumentation } from '@opentelemetry/instrumentation-document-load'
// // import { ZoneContextManager } from '@opentelemetry/context-zone'
// import { registerInstrumentations } from '@opentelemetry/instrumentation'

// import {
//   ConsoleSpanExporter,
//   BatchSpanProcessor
// } from '@opentelemetry/sdk-trace-base'

// import { SpanNames, trace } from '@microsoft/agents-telemetry'

// new WebTracerProvider({})

// const definition = trace.define({
//   name: SpanNames.ADAPTER_PROCESS,
//   record: {
//     test: 'initial-value',
//   },
//   end ({ span, record, duration }) {
//     console.log('Span ended with attributes:', record)
//     span.setAttribute('test-attribute', record.test)
//     span.setAttribute('duration', duration)
//   }
// })

// trace(definition, ({ record }) => {
//   console.log('Vite import test - @microsoft/agents-telemetry:', 'trace function executed', 'record:', record)
//   record({ test: 'updated-value' })
// })

// const managed = trace(definition)
// managed.record({ test: 'updated-value' })
// managed.end()

// ReactDOM.render(
//   <div style={{
//     width: '100vw',
//     height: '100vh',
//     margin: 0,
//   }}
//   >
//     <Chat />
//   </div>, document.getElementById('root')
// )
