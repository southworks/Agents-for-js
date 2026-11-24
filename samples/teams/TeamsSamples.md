# Teams samples

These development samples use `AgentApplication` and the Microsoft 365
Agents SDK Teams extension. These scenarios run through the same Latest
mode coordinator and share one Teams app package.

## Set up Teams

1. Install Node.js 22 or later and follow the [sample setup](../README.md) to
   install dependencies, build the SDK, and create `samples/latest.env`.
2. Configure the Azure Bot's Teams channel. In `samples/latest.env`, set
   `connections__serviceConnection__settings__clientId`,
   `connections__serviceConnection__settings__clientSecret`, and
   `connections__serviceConnection__settings__tenantId`.
3. From the repository root, run `npm start --workspace samples -- --mode latest`.
   The default endpoint is `http://localhost:3978/api/messages`. Set `PORT` in
   `samples/latest.env` if you need a different port.
4. Expose the endpoint with an HTTPS tunnel, such as
   [Dev Tunnels](https://learn.microsoft.com/en-us/azure/developer/dev-tunnels/overview).
   Keep Azure Bot authentication enabled and configure the public endpoint and app
   package as described below.

| Scenario | What to try | Source |
| --- | --- | --- |
| [Teams attachments](#teams-attachments) | Personal-chat file download and counting | [attachments.ts](attachments.ts) |
| [Teams conversations](#teams-conversations) | Member lookup, mentions, quotes, private replies, editable cards, feedback, and events | [conversations.ts](conversations.ts) |
| [Meetings](#meetings) | Meeting details and lifecycle events | [meetings.ts](meetings.ts) |

## Teams app manifest

Use [manifest.json](manifest/manifest.json) and the two icons in the same folder.
Combines upstream Teams capabilities and adapts command declarations to the handlers
in this repository.
Manifest version 1.29 includes the targeted-message command fields. App names and
descriptions identify this combined development app. Icons come from the existing
local sample app package.

### Configure and package

1. Replace every `${{AAD_APP_CLIENT_ID}}` with your Microsoft Entra bot application
   client ID, including the manifest ID, bot IDs, and web application ID.
2. Replace `<<BOT_DOMAIN>>` with your HTTPS host name, without a scheme or path.
   Replace the example developer website, privacy, and terms URLs with your URLs. Use your tunnel
   hostname when running locally.
3. Retain the upstream meeting manifest's web application resource
   `https://RscPermission`. An SSO-specific `api://<client-id>` resource requires a
   separate configuration. The upstream manifests omit SSO scopes.
4. Configure the Azure Bot Teams channel endpoint as `https://<host>/api/messages`.
   Keep credentials in the existing mode environment file.
5. Configure the template, then generate a local ZIP containing `manifest.json`,
   `color.png`, and `outline.png` at the archive root. Upload
   the custom app where your Teams tenant permits it. The launcher does not replace
   placeholders automatically.
6. Increase `version` when updating an installed app. Review the meeting permissions
   when installing the app for a scheduled meeting.

### Combined declarations

| Source | Features |
| --- | --- |
| agent-targeted-messages | Personal, team, and group chat scopes, targeted messages, and the identity and messageTeamMembers permissions |
| bot-ai-messages | Personal bot support. AI metadata uses the same bot capability. |
| bot-attachments | supportsFiles enabled |
| bot-cards | Team and groupChat bot support |
| bot-meetings | Web application identity and Application RSC permissions OnlineMeeting.ReadBasic.Chat, ChannelMeeting.ReadBasic.Group, OnlineMeetingParticipant.Read.Chat |
| bot-message-extensions | Search and Create Card commands, settings, and link previews. See the command IDs below. |
| bot-task-modules | Personal bot support and bot domain for task-module pages |

File support is enabled in the union even though other source samples disable it.
All features share one bot registration. Meeting permissions are part of the full
development package. Attachments and member lookup do not use meeting operations.

The manifest enables **Create Card**, link previews, targeted messaging, and
message extension settings. Upstream reminder commands are outside this sample.
The local message extension uses `searchQuery` with the `query` parameter and
the `createCard` action. Link previews use `*.example.com` by default.

## Teams attachments

`M365AttachmentDownloader` puts the downloaded files in turn state.
Teams shows the file upload control because the manifest enables `supportsFiles`.

Use a **personal chat** with the bot. Select Teams attachments from the coordinator.
Send a short text message. The sample should report zero downloads and show upload instructions.
Attach a small image or text file in Teams. Check the downloaded file count.
Files remain in turn memory and their contents, names, and URLs are not printed.
If some eligible attachments are not downloaded, the response states that some
could not be downloaded and suggests checks. Exceptions produce safe guidance.

The scenario constructs `M365AttachmentDownloader` explicitly. It uses the connector
client supplied by normal authenticated adapter processing, including its outbound
headers. No anonymous download context or public sample fixture is substituted.
HTML body attachments are excluded from the file count. Group/channel uploads,
Copilot, and Playground receive guidance to use a Teams personal chat.

Try an unavailable attachment, then select **All scenarios** and open **Generic
attachments** to compare its separate public image fixture.

### Manifest excerpt for teams attachments

Teams uses `supportsFiles` to show the upload control. Test uploads in the personal bot scope.

```json
{
  "bots": [
    {
      "botId": "${{AAD_APP_CLIENT_ID}}",
      "scopes": [
        "personal",
        "team",
        "groupChat"
      ],
      "supportsFiles": true
    }
  ]
}
```

## Teams conversations

Install in a personal chat, ordinary group chat, or standard team channel. Select
**Teams conversations**, then select **Who am I?** to see your Teams member name.
Select **Mention me** to see a Teams mention of the requesting member. The scenario
registers `TeamsAgentExtension` and calls its Teams client directly. Team channels
resolve members against the team ID. Other chats use the conversation ID.

In a group or channel, address typed commands to the bot, for example
`@YourBot quote`. The coordinator removes the recipient mention. Use **All
scenarios** to return to the menu. Try the interaction with a second user to
verify that selections are separate.
Replies are visible to everyone in the shared conversation. Card actions from an old
scenario must not execute after exit or after selecting another scenario.

The **Quote reply** action quotes the request. For a visible text quote, mention the
bot and send `quote` in chat. Select **Show editable card**, then click **Update**
on that card to increment its counter or **Delete** to remove it. Only the user
who requested the latest card in that conversation can change it. Exit or opening
a new editable card expires the old buttons.

Send `targeted` for a sample message addressed only to you. To try Prompt Preview,
select the bot through the Teams `/` picker and send a private prompt. **Try feedback**
sends a message with thumbs up/down controls. Select a reaction, then submit the
optional feedback dialog. The terminal confirms receipt without logging the comment.

The manifest enables `supportsTargetedMessages` for the private prompt flow.
Targeted replies use `TeamsTurnContext.sendTargetedActivity()`. Custom feedback
uses `channelData.feedbackLoop.type: "custom"`. The sample handles
`message/fetchTask` to open the dialog and `message/submitAction` to acknowledge
the submission through `onTeamsFeedbackLoop`. The handler accepts direct and
`data`-wrapped payloads. See [Teams custom feedback](https://learn.microsoft.com/microsoftteams/platform/bots/how-to/bot-messages-ai-generated-content#feedback-buttons).

Select **Try message reactions**, then add and remove a reaction on the reply.
Keep the scenario selected to see both event reports.

In a dedicated test group chat with up to five people, send `message-group` to send
one sample private chat message to each roster member. The bot reports the number
of successful sends. To try lifecycle events, send `observe-conversation` in a group
or channel. Add or remove a member, create, rename, or delete a channel, or rename
the team. Notices are scoped to
events delivered to the observed conversation. Exit clears your observation and the
references for your editable card and feedback message.

### Manifest excerpt for teams conversations

The bot scopes enable the supported chat types. The targeted-message flag enables private prompts, and the permissions cover identity and messaging to team members.

```json
{
  "bots": [
    {
      "botId": "${{AAD_APP_CLIENT_ID}}",
      "scopes": [
        "personal",
        "team",
        "groupChat"
      ],
      "supportsTargetedMessages": true
    }
  ],
  "permissions": [
    "identity",
    "messageTeamMembers"
  ]
}
```

## Meetings

The sample uses `TeamsAgentExtension.meetings`. Start and end handlers receive
`MeetingDetails`. Participant handlers receive distinct
`MeetingParticipantJoinValue` and `MeetingParticipantLeaveValue` payloads.
Use a scheduled Teams meeting.

Install the combined manifest and consent to its three Application RSC permissions:
OnlineMeeting.ReadBasic.Chat, ChannelMeeting.ReadBasic.Group, and
OnlineMeetingParticipant.Read.Chat. Add the app to a test meeting and open the
meeting chat. Select Teams meetings and Meeting info: the sample calls the Teams
meeting API and shows the title when supplied. Outside a meeting, expect guidance.

Select Observe events. Start/end the meeting or join/leave with a test participant.
The extension reports start, end, participant join, and participant leave events
only when the activity's conversation and meeting IDs match an active observation.
Start and end notices show the title when provided. Join and leave notices report
the number of members in the event payload.
An event without these identifiers, an active observation, or the sender identity
required by SDK application state is skipped with a safe terminal message. No
anonymous user selection or inferred meeting destination is created. Exit removes
your observation. Another observer in that meeting can keep notices active.
Notices are visible in the shared meeting conversation. Restart clears observations.
Transcripts, meeting management, and cross-tenant edge cases remain outside scope.

### Manifest excerpt for meetings

The web application entry and the three application permissions enable the meeting features. Install or add the app in the meeting context to grant access.

```json
{
  "webApplicationInfo": {
    "id": "${{AAD_APP_CLIENT_ID}}",
    "resource": "https://RscPermission"
  },
  "authorization": {
    "permissions": {
      "resourceSpecific": [
        {
          "name": "OnlineMeeting.ReadBasic.Chat",
          "type": "Application"
        },
        {
          "name": "ChannelMeeting.ReadBasic.Group",
          "type": "Application"
        },
        {
          "name": "OnlineMeetingParticipant.Read.Chat",
          "type": "Application"
        }
      ]
    }
  }
}
```

## Verify in Teams

Use a test app installation to check rendering, file delivery, permissions,
and channel events. The sample build and lint checks cover the source.
