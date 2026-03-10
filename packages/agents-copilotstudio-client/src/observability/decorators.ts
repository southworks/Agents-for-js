// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { createTracedDecorator, SpanNames } from '@microsoft/agents-telemetry'
import { CopilotStudioClientMetrics } from './metrics'
import { CopilotStudioClient } from '../copilotStudioClient'
import { CopilotStudioWebChat } from '../copilotStudioWebChat'

const fallback = <T>(value: T | undefined | null) => value ?? 'unknown'

// CopilotStudioClient decorators
interface StartConversationDecoratorContext {
  args: Parameters<CopilotStudioClient['startConversationStreaming']>
  result?: ReturnType<CopilotStudioClient['startConversationStreaming']>
  duration: () => number
}

export const traceStartConversation = createTracedDecorator<StartConversationDecoratorContext>({
  spanName: SpanNames.COPILOT_START_CONVERSATION,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onError (span, error) {
    span.addEvent('start.conversation.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    const { args: [emitStartConversationEvent], duration } = context
    const emitStart = emitStartConversationEvent ?? true

    span.setAttribute('agents.copilot.emit_start_event', emitStart)

    CopilotStudioClientMetrics.conversationsStartedCounter.add(1)
    CopilotStudioClientMetrics.requestDuration.record(duration(), { operation: 'startConversation' })
  }
})

interface SendActivityStreamingDecoratorContext {
  args: Parameters<CopilotStudioClient['sendActivityStreaming']>
  result?: ReturnType<CopilotStudioClient['sendActivityStreaming']>
  duration: () => number
}

export const traceSendActivityStreaming = createTracedDecorator<SendActivityStreamingDecoratorContext>({
  spanName: SpanNames.COPILOT_SEND_ACTIVITY,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onError (span, error) {
    span.addEvent('send.activity.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    const { args: [activity, conversationId], duration } = context
    const activityType = fallback(activity?.type)
    const activityConversationId = fallback(activity?.conversation?.id)
    const argsConversationId = fallback(conversationId)

    span.setAttribute('agents.copilot.activity.type', activityType)
    span.setAttribute('agents.copilot.activity.conversation.id', activityConversationId)
    span.setAttribute('agents.copilot.conversation.id', argsConversationId)

    CopilotStudioClientMetrics.activitiesSentCounter.add(1, {
      'agents.copilot.activity.type': activityType,
      'agents.copilot.activity.conversation.id': activityConversationId
    })
    CopilotStudioClientMetrics.streamDuration.record(duration(), { operation: 'sendActivityStreaming' })
  }
})

interface PostRequestAsyncDecoratorContext {
  args: Parameters<CopilotStudioClient['postRequestAsync']>
  result?: ReturnType<CopilotStudioClient['postRequestAsync']>
  duration: () => number
}

export const tracePostRequestAsync = createTracedDecorator<PostRequestAsyncDecoratorContext>({
  spanName: SpanNames.COPILOT_POST_REQUEST,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onError (span, error) {
    span.addEvent('post.request.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEnd (span, context) {
    const { args: [url, body, method], duration } = context
    const postUrl = fallback(url)
    const postMethod = fallback(method)

    span.setAttribute('agents.copilot.post_request.url', postUrl)
    span.setAttribute('agents.copilot.post_request.method', postMethod)

    if (body.activity) {
      const actType = fallback(body.activity.type)
      const actConversationId = fallback(body.activity.conversation?.id)

      span.setAttribute('agents.copilot.post_request.activity.type', actType)
      span.setAttribute('agents.copilot.post_request.activity.conversation.id', actConversationId)
    }

    CopilotStudioClientMetrics.webchatConnectionsCounter.add(1)
    CopilotStudioClientMetrics.streamDuration.record(duration(), {
      operation: 'postRequestAsync',
      url: postUrl,
      method: postMethod
    })
  }
})

interface CreateConnectionDecoratorContext {
  args: Parameters<typeof CopilotStudioWebChat['createConnection']>
  result?: ReturnType<typeof CopilotStudioWebChat['createConnection']>
  duration: () => number
}

// CopilotStudioWebChat decorators
export const traceCreateConnection = createTracedDecorator<CreateConnectionDecoratorContext>({
  spanName: SpanNames.COPILOT_CREATE_CONNECTION,
  onStart (span, context) {
    const start = performance.now()
    context.duration = () => performance.now() - start
  },
  onError (span, error) {
    span.addEvent('create.connection.failed', {
      'error.type': fallback(error?.constructor?.name)
    })
  },
  onEvent (span, eventName, eventData) {
    const data = eventData as { activityType?: string; conversationId?: string } | undefined
    span.addEvent(eventName, {
      'activity.type': fallback(data?.activityType),
      'activity.conversation.id': fallback(data?.conversationId)
    })
  },
  onEnd (span, context) {
    const { args: [, settings], duration } = context
    const showTyping = settings?.showTyping ?? false

    span.setAttribute('agents.copilot.webchat.show_typing', showTyping)

    CopilotStudioClientMetrics.webchatConnectionsCounter.add(1)
    CopilotStudioClientMetrics.requestDuration.record(duration(), { operation: 'createConnection' })
  }
})
