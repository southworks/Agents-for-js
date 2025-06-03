// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ActivityTypes, ConversationParameters } from '@microsoft/agents-activity'
import {
  AdaptiveCard,
  AgentApplication,
  CardFactory,
  CloudAdapter,
  MessageFactory,
  TurnContext,
  TurnState,
}
  from '@microsoft/agents-hosting'
import { MeetingNotification, TeamsAgentExtension, TeamsInfo, TeamsMember, parseTeamsChannelData } from '@microsoft/agents-hosting-extensions-teams'

type ApplicationTurnState = TurnState
export const app = new AgentApplication({
  // removeRecipientMention: false
})

const teamsExtension = new TeamsAgentExtension(app)

app.registerExtension(teamsExtension, tae => {

})

app.adaptiveCards.actionExecute('doStuff', async (context, state, data) => {
  const card = {
    type: 'AdaptiveCard',
    body: [
      {
        type: 'TextBlock',
        size: 'Medium',
        weight: 'Bolder',
        text: '✅[ACK] Test'
      },
      {
        type: 'TextBlock',
        text: 'doStuff action executed',
        wrap: true
      }
    ],
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4'
  }
  return card as AdaptiveCard
})

app.onConversationUpdate('membersAdded', async (context: TurnContext, state: ApplicationTurnState) => {
  const membersAdded = context.activity.membersAdded ?? []
  const welcomeText = 'Hello from teamsApp!'
  for (const member of membersAdded) {
    if (member.id !== (context.activity.recipient?.id ?? '')) {
      await context.sendActivity(MessageFactory.text(welcomeText, welcomeText))
    }
  }
})

app.onMessage('/acInvoke', async (context: TurnContext, state: ApplicationTurnState) => {
  const card = {
    type: 'AdaptiveCard',
    body: [
      {
        type: 'TextBlock',
        size: 'Medium',
        weight: 'Bolder',
        text: 'Test Adaptive Card'
      },
      {
        type: 'TextBlock',
        text: 'Click the button to execute an action',
        wrap: true
      }
    ],
    actions: [
      {
        type: 'Action.Execute',
        title: 'Do Stuff',
        verb: 'doStuff'
      }
    ],
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4'
  }
  await context.sendActivity(MessageFactory.attachment(CardFactory.adaptiveCard(card)))
})

app.onMessage('/getMeetingParticipant', async (context: TurnContext, state: ApplicationTurnState) => {
  const meetingParticipant = await TeamsInfo.getMeetingParticipant(context)
  await context.sendActivity(MessageFactory.text(`Meeting participant ${JSON.stringify(meetingParticipant)}`))
})

app.onMessage('/getMeetingInfo', async (context: TurnContext, state: ApplicationTurnState) => {
  const meeting = await TeamsInfo.getMeetingInfo(context)
  await context.sendActivity(MessageFactory.text(`Meeting Info ${JSON.stringify(meeting)}`))
})

app.onMessage('/getTeamDetails', async (context: TurnContext, state: ApplicationTurnState) => {
  const channels = await TeamsInfo.getTeamDetails(context)
  await context.sendActivity(MessageFactory.text(`Meeting participant ${JSON.stringify(channels)}`))
})

app.onMessage('/sendMessageToTeamsChannel', async (context: TurnContext, state: ApplicationTurnState) => {
  const teamsChannelData = parseTeamsChannelData(context.activity.channelData)
  const channelId = teamsChannelData.channel?.id
  if (!channelId) {
    await context.sendActivity(MessageFactory.text('channelId not found'))
    return
  }
  const sentResult = await TeamsInfo.sendMessageToTeamsChannel(context, MessageFactory.text('msg from agent to channel'), channelId!, context.adapter.authConfig.clientId)
  await context.sendActivity(MessageFactory.text(`sebt ${JSON.stringify(sentResult)}`))
})

app.onMessage('/getTeamChannels', async (context: TurnContext, state: ApplicationTurnState) => {
  const channels = await TeamsInfo.getTeamChannels(context)
  await context.sendActivity(MessageFactory.text(`list channels: ${JSON.stringify(channels)}`))
})

app.onMessage('/getPagedMembers', async (context: TurnContext, state: ApplicationTurnState) => {
  const members = await TeamsInfo.getPagedMembers(context, 2)
  await context.sendActivity(MessageFactory.text(`members ${JSON.stringify(members.members.map(m => m.email!))}`))
})

app.onMessage('/getMember', async (context: TurnContext, state: ApplicationTurnState) => {
  const me = await TeamsInfo.getMember(context, context.activity.from!.id!)
  await context.sendActivity(MessageFactory.text(`You mentioned me! ${JSON.stringify(me)}`))
})

app.onMessage('/getPagedTeamMembers', async (context: TurnContext, state: ApplicationTurnState) => {
  const members = await TeamsInfo.getPagedTeamMembers(context, undefined, 2)
  await context.sendActivity(MessageFactory.text(`team members ${JSON.stringify(members.members.map(m => m.email!))}`))
})

app.onMessage('/getTeamMember', async (context: TurnContext, state: ApplicationTurnState) => {
  const teamsChannelData = parseTeamsChannelData(context.activity.channelData)
  const teamId = teamsChannelData.team?.id
  const member = await TeamsInfo.getTeamMember(context, teamId!, context.activity.from!.id!)
  await context.sendActivity(MessageFactory.text(`team member ${JSON.stringify(member)}`))
})

app.onMessage('/sendMeetingNotification', async (context: TurnContext, state: ApplicationTurnState) => {
  const notification: MeetingNotification = { type: 'targetedMeetingNotification', value: { recipients: ['rido'], surfaces: [] } }
  const teamsChannelData = parseTeamsChannelData(context.activity.channelData)
  const meetingId = teamsChannelData.meeting?.id
  const resp = await TeamsInfo.sendMeetingNotification(context, notification, meetingId)
  await context.sendActivity(MessageFactory.text(`sendMeetingNotification ${JSON.stringify(resp)}`))
})

app.onMessage('/sendMessageToListOfUsers', async (context: TurnContext, state: ApplicationTurnState) => {
  const members = await TeamsInfo.getPagedMembers(context, 2)
  const users: TeamsMember[] = []
  members.members.forEach(m => {
    if (m.email) {
      users.push({ id: m.id! })
    }
  })
  await TeamsInfo.sendMessageToListOfUsers(context, MessageFactory.text('msg from agent to list of users'), context.adapter.authConfig.tenantId!, users)
})

app.onMessage('/sendMessageToAllUsersInTenant', async (context: TurnContext, state: ApplicationTurnState) => {
  const batchResp = await TeamsInfo.sendMessageToAllUsersInTenant(context, MessageFactory.text('msg from agent to all users'), context.adapter.authConfig.tenantId!)
  console.log(batchResp.operationId)
})

app.onMessage('/sendMessageToAllUsersInTeam', async (context: TurnContext, state: ApplicationTurnState) => {
  const teamsChannelData = parseTeamsChannelData(context.activity.channelData)
  const teamId = teamsChannelData.team?.id
  const batchResp = await TeamsInfo.sendMessageToAllUsersInTeam(context, MessageFactory.text('msg from agent to all users in team'), context.adapter.authConfig.tenantId!, teamId!)
  console.log(batchResp.operationId)
})

app.onMessage('/sendMessageToListOfChannels', async (context: TurnContext, state: ApplicationTurnState) => {
  const members = await TeamsInfo.getPagedMembers(context, 2)
  const users: TeamsMember[] = []
  members.members.forEach(m => {
    if (m.email) {
      users.push({ id: m.id! })
    }
  })
  await TeamsInfo.sendMessageToListOfChannels(context, MessageFactory.text('msg from agent to list of channels'), context.adapter.authConfig.tenantId!, users)
})

app.onMessage('/msgAllMembers', async (context: TurnContext, state: ApplicationTurnState) => {
  await messageAllMembers(context)
})

app.onActivity(ActivityTypes.Message, async (context: TurnContext, state: ApplicationTurnState) => {
  await context.sendActivities([
    MessageFactory.text('Welcome to teamsApp!'),
    MessageFactory.text(`options: 
      /getMember,
      /getMeetingInfo,
      /getMeetingParticipant,
      /sendMeetingNotification,
      /sendMessageToAllUsersInTenant,
      /getTeamChannels,
      /getTeamDetails,
      /getPagedTeamMembers,
      /getPagedMembers,
      /sendMessageToTeamsChannel,
      /sendMessageToListOfUsers,
      /sendMessageToAllUsersInTenant,
      /acInvoke,
      /msgAllMembers`
    )])
})

async function messageAllMembers (context: TurnContext) {
  const author = await TeamsInfo.getMember(context, context.activity.from!.id!)
  const membersResult = await TeamsInfo.getPagedMembers(context, 2)
  await Promise.all(membersResult.members.map(async (member) => {
    const message = MessageFactory.text(
      `Hello ${member.givenName} ${member.surname}. I'm a Teams conversation agent. from ${author.email}`
    )

    const convoParams: ConversationParameters = {
      members: [{ id: member.id }],
      isGroup: false,
      agent: context.activity.recipient!,
      tenantId: context.activity.conversation!.tenantId,
      activity: message,
      channelData: context.activity.channelData
    }

    await (context.adapter as CloudAdapter).createConversationAsync(
      context.adapter.authConfig.clientId!,
      context.activity.channelId!,
      context.activity.serviceUrl!,
      'http://api.botframework.com',
      convoParams,
      async (context: TurnContext) => {
        const ref = context.activity.getConversationReference()

        await context.adapter.continueConversation(
          ref,
          async (context) => {
            await context.sendActivity(message)
          })
      })
  }))

  await context.sendActivity(MessageFactory.text('All messages have been sent.'))
}
