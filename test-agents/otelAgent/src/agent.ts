// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { startServer } from '@microsoft/agents-hosting-express'
import { AgentApplication, MemoryStorage, TurnContext, TurnState } from '@microsoft/agents-hosting'
import { SpanStatusCode, trace, type Span } from '@opentelemetry/api'

class OTelAgent extends AgentApplication<TurnState> {
  private tracer = trace.getTracer('OTelAgent')

  constructor () {
    super({ startTypingTimer: true, storage: new MemoryStorage() })

    this.onConversationUpdate('membersAdded', this.welcome)
    this.onActivity('message', this.echo)
  }

  welcome = async (ctx: TurnContext) => {
    return this.tracer.startActiveSpan('agent.welcome_message', async (span: Span) => {
      try {
        span.setAttribute('conversation.id', ctx.activity.conversation?.id ?? '')
        span.setAttribute('channel.id', ctx.activity.channelId ?? '')
        span.setAttribute('members.added.count', ctx.activity.membersAdded?.length ?? 0)

        ctx.activity.membersAdded?.forEach(async (member) => {
          span.addEvent(
            'member.added',
            {
              'member.id': member.id,
              'member.name': member.name,
            },
            Date.now())
        })
        await ctx.sendActivity('Hello and Welcome!')
        // TODO: Add RouteExecutedCounter
        span.setStatus({ code: SpanStatusCode.OK })
      } catch (error) {
        if (error instanceof Error) {
          span.recordException(error)
          span.addEvent(
            'exception',
            {
              'exception.name': error.name,
              'exception.message': error.message,
              'exception.stacktrace': error.stack,
            },
            Date.now())
        }
        span.setStatus({ code: SpanStatusCode.ERROR })
        throw error
      } finally {
        span.end()
      }
    })
  }

  echo = async (ctx: TurnContext) => {
    return this.tracer.startActiveSpan('agent.message_handler', async (span: Span) => {
      try {
        span.setAttribute('conversation.id', ctx.activity.conversation?.id ?? '')
        span.setAttribute('channel.id', ctx.activity.channelId ?? '')
        span.setAttribute('message.text.length', ctx.activity.text?.length ?? 0)
        span.setAttribute('user.id', ctx.activity.from?.id ?? '')

        span.addEvent(
          'message.received',
          {
            'message.id': ctx.activity.id,
            'message.text': ctx.activity.text,
            'user.id': ctx.activity.from?.id,
            'channel.id': ctx.activity.channelId,
          },
          Date.now())
        // TODO: Add HTTP call

        await ctx.sendActivity(`You said now: ${ctx.activity.text}`)
      } catch (error) {
        if (error instanceof Error) {
          span.recordException(error)
          span.addEvent(
            'exception',
            {
              'exception.name': error.name,
              'exception.message': error.message,
              'exception.stacktrace': error.stack,
            },
            Date.now())
        }
        span.setStatus({ code: SpanStatusCode.ERROR })
        throw error
      } finally {
        span.end()
      }
    })
  }
}

startServer(new OTelAgent())
