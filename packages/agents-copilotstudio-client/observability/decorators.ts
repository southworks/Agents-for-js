// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { createTracedDecorator, SpanNames } from '@microsoft/agents-telemetry'
import { SpanStatusCode, type Span } from '@opentelemetry/api'
import type { Activity } from '@microsoft/agents-activity'
import { CopilotStudioClientMetrics } from './metrics'
import { CopilotStudioClient } from '../../dist/src'

const fallback = <T>(value: T | undefined | null) => value ?? 'unknown'

/**
 * Wraps an async generator function with OpenTelemetry tracing.
 * Creates a span that encompasses the entire generator lifecycle.
 */
// export async function * traceAsyncGenerator<T> (
//   spanName: string,
//   generator: AsyncGenerator<T>,
//   options?: {
//     onStart?: (span: Span) => void
//     onYield?: (span: Span, value: T) => void
//     onEnd?: (span: Span, context: { itemCount: number, duration: number }) => void
//     onError?: (span: Span, error: unknown) => void
//   }
// ): AsyncGenerator<T> {
//   const start = performance.now()
//   let itemCount = 0

//   const span = CopilotStudioClientMetrics.tracer.startSpan(spanName)

//   try {
//     options?.onStart?.(span)

//     for await (const value of generator) {
//       itemCount++
//       options?.onYield?.(span, value)
//       yield value
//     }

//     span.setStatus({ code: SpanStatusCode.OK })
//   } catch (error) {
//     options?.onError?.(span, error)
//     if (error instanceof Error) {
//       span.recordException(error)
//       span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
//     } else {
//       span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) })
//     }
//     throw error
//   } finally {
//     options?.onEnd?.(span, { itemCount, duration: performance.now() - start })
//     span.end()
//   }
// }

interface StartConversationDecoratorContext {
  args: Parameters<CopilotStudioClient['* startConversationStreaming']>
  // data?: { emitStartConversationEvent: boolean, conversationId: string }
  result?: ReturnType<CopilotStudioClient['* startConversationStreaming']>
  duration: () => number
}

/**
 * Creates a traced async generator for startConversationStreaming
 */
export const traceStartConversation = createTracedDecorator<StartConversationDecoratorContext>({
  spanName: SpanNames.COPILOT_START_CONVERSATION,
  onError (span, error) {
    span.addEvent('start.conversation.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    const { emitStartConversationEvent } = context.args
    const emitStart = fallback(emitStartConversationEvent)

    span.setAttribute('agents.copilot.emit_start_event', emitStart)

    CopilotStudioClientMetrics.conversationsStartedCounter.add(1)
  }
}

/**
 * Creates a traced async generator for sendActivityStreaming
 */
// export function traceSendActivity (
//   generator: AsyncGenerator<Activity>,
//   activity: Activity,
//   conversationId?: string
// ): AsyncGenerator<Activity> {
//   const activityType = fallback(activity?.type)
//   const initialConversationId = fallback(activity?.conversation?.id ?? conversationId)

//   CopilotStudioClientMetrics.activitiesSentCounter.add(1, {
//     'copilot.activity.type': activityType
//   })
//   CopilotStudioClientMetrics.requestsTotalCounter.add(1, { operation: 'sendActivity' })

//   return traceAsyncGenerator(SpanNames.COPILOT_SEND_ACTIVITY, generator, {
//     onStart (span) {
//       span.setAttribute('copilot.activity.type', activityType)
//       span.setAttribute('copilot.conversation_id', initialConversationId)
//     },
//     onYield (span, responseActivity) {
//       const responseType = fallback(responseActivity?.type)
//       CopilotStudioClientMetrics.activitiesReceivedCounter.add(1, {
//         'copilot.activity.type': responseType
//       })
//     },
//     onError (span, error) {
//       span.addEvent('sendActivity.failed', {
//         'error.type': fallback((error as Error)?.constructor?.name)
//       })
//       CopilotStudioClientMetrics.requestsErrorsCounter.add(1, { operation: 'sendActivity' })
//     },
//     onEnd (span, context) {
//       span.setAttribute('copilot.activities_received', context.itemCount)
//       CopilotStudioClientMetrics.requestDuration.record(context.duration, { operation: 'sendActivity' })
//     }
//   })
// }

// /**
//  * Creates a traced async generator for postRequestAsync (internal HTTP/SSE request)
//  */
// export function tracePostRequest (
//   generator: AsyncGenerator<Activity>,
//   url: string,
//   method: string = 'POST'
// ): AsyncGenerator<Activity> {
//   let conversationId: string | undefined

//   return traceAsyncGenerator(SpanNames.COPILOT_POST_REQUEST, generator, {
//     onStart (span) {
//       span.setAttribute('http.url', url)
//       span.setAttribute('http.method', method)
//     },
//     onYield (span, activity) {
//       if (!conversationId && activity?.conversation?.id) {
//         conversationId = activity.conversation.id
//         span.setAttribute('copilot.conversation_id', conversationId)
//       }
//     },
//     onError (span, error) {
//       span.addEvent('postRequest.failed', {
//         'error.type': fallback((error as Error)?.constructor?.name)
//       })
//     },
//     onEnd (span, context) {
//       span.setAttribute('copilot.activities_count', context.itemCount)
//       CopilotStudioClientMetrics.streamDuration.record(context.duration, { operation: 'postRequest' })
//     }
//   })
// }
