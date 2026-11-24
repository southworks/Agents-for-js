// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { AgentApplication, MemoryStorage, type CloudAdapter, type TurnContext } from '@microsoft/agents-hosting'
import { parseTeamsChannelData, TeamsAgentExtension } from '@microsoft/agents-hosting-extensions-msteams'
import { getSessionKey } from '../_shared/sessionKey.js'

const meetingEvents = [
  'application/vnd.microsoft.meetingstart',
  'application/vnd.microsoft.meetingend',
  'application/vnd.microsoft.meetingparticipantjoin',
  'application/vnd.microsoft.meetingparticipantleave'
]

export function ownsMeetingEvent (context: TurnContext): boolean {
  return context.activity.channelId === 'msteams' && context.activity.type === 'event' &&
    meetingEvents.includes(context.activity.name?.toLowerCase() ?? '')
}

function meetingKey (context: TurnContext): string | undefined {
  const meetingId = parseTeamsChannelData(context.activity.channelData).meeting?.id
  const conversationId = context.activity.conversation?.id
  return meetingId && conversationId ? JSON.stringify([conversationId, meetingId]) : undefined
}

export function createTeamsMeetingAgent (adapter: CloudAdapter) {
  const observers = new Map<string, string>()
  const app = new AgentApplication({ adapter, storage: new MemoryStorage() })
  const teams = new TeamsAgentExtension(app)
  app.registerExtension(teams, extension => {
    extension.meetings
      .onStart(async (context, _state, details) => {
        const title = details?.title
        await context.sendActivity(title ? `Teams meetings · Meeting started: ${title}.` : 'Teams meetings · Meeting started.')
      })
      .onEnd(async (context, _state, details) => {
        const title = details?.title
        await context.sendActivity(title ? `Teams meetings · Meeting ended: ${title}.` : 'Teams meetings · Meeting ended.')
      })
      .onParticipantsJoin(async (context, _state, details) => {
        const count = details?.members?.length ?? 0
        await context.sendActivity(`Teams meetings · Participant join event (${count} members reported).`)
      })
      .onParticipantsLeave(async (context, _state, details) => {
        const count = details?.members?.length ?? 0
        await context.sendActivity(`Teams meetings · Participant leave event (${count} members reported).`)
      })
  })
  app.onMessage('meeting-info', async context => {
    const id = parseTeamsChannelData(context.activity.channelData).meeting?.id
    if (!id) {
      await context.sendActivity('Open this sample in a Teams meeting chat to read meeting information.')
      return
    }
    const info = await teams.getTeamsClient(context).meetings.getById(id)
    await context.sendActivity(`Teams meetings · ${info.details?.title ?? 'Meeting information retrieved'}.`)
  })
  app.onMessage('observe', async context => {
    const meeting = meetingKey(context)
    const session = getSessionKey(context)
    if (!meeting || !session) {
      await context.sendActivity('Open a Teams meeting chat with a user identity to observe its events.')
      return
    }
    observers.set(session, meeting)
    await context.sendActivity('Teams meetings · Ready to observe. Join or leave this meeting, or ask another participant to do so. Event messages will appear here. Select All scenarios to stop observing.')
  })
  app.onActivity('message', async context => {
    await context.sendActivity('Open the scheduled meeting chat and select Observe events, then join or leave the meeting to test. Mention the bot when typing commands in the meeting chat.')
  })

  return {
    async onExit (context: TurnContext): Promise<void> {
      const key = getSessionKey(context)
      if (key) {
        observers.delete(key)
      }
    },
    async run (context: TurnContext): Promise<void> {
      if (context.activity.channelId !== 'msteams') {
        await context.sendActivity('This sample requires a Microsoft Teams meeting chat.')
        return
      }
      if (ownsMeetingEvent(context)) {
        const key = meetingKey(context)
        if (!context.activity.from?.id) {
          console.info('Teams meeting event skipped: the SDK application requires a sender identity.')
          return
        }
        if (!key || ![...observers.values()].includes(key)) {
          console.info('Teams meeting event skipped: no matching active meeting observation.')
          return
        }
      }
      try {
        await app.run(context)
      } catch {
        if (context.activity.type === 'event') {
          console.error('Teams meeting event could not be processed. Check channel setup and permissions.')
        } else {
          await context.sendActivity('Could not read the meeting. Check app installation, meeting context, and meeting RSC permissions. Use samples/SCENARIOS.md for setup.')
        }
      }
    }
  }
}
