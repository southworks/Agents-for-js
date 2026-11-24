# Sample scenarios

Use the [coordinator setup](README.md) to start the mode you need. Select a
scenario from the menu. The scenario breadcrumb reopens its card, and **All
scenarios** returns to the menu without clearing scenario data.

## Echo

**Mode** Latest. Select **Send hello** or type a message. The result card shows text
such as `You said: hello`. Try `1` after opening Echo to see that scenario input
stays in Echo. Return to the menu and reopen Echo to check routing.

<a id="setup-state"></a>

## State and storage

**Mode** Latest. Memory, Blob, and Cosmos demonstrate the same conversation
counter with different SDK providers. File uses local persistence and maintains
both a user counter and a conversation counter.

| Scenario | Setup | Restart behavior |
| --- | --- | --- |
| State - Memory | None | Counters reset |
| State - File | Writable `samples/.state-files/` | Counters persist in local files |
| State - Blob | `BLOB_STORAGE_CONNECTION_STRING` and `BLOB_CONTAINER_ID` in `latest.env`. The template defaults to local Azurite. | Counters persist in the container |
| State - Cosmos | `COSMOS_ENDPOINT`, `COSMOS_KEY`, `COSMOS_DATABASE_ID`, and `COSMOS_CONTAINER_ID` in `latest.env`. Create a container with partition key `/id`. | Counters persist in the container |

1. Select **Reset**, then **Increment** twice. Expect the counter on
   the same card to be 2. File reports both counters. A channel that cannot
   update the original activity receives a replacement card.
2. Leave and reopen the same scenario. The card should show the same value.
3. Open the scenario in another conversation. Expect an independent
   conversation counter. File's user counter follows the same user across chats.
4. Restart and reopen the same conversation to check persistence. Reset the first
   conversation and verify the other conversation's counter is unchanged.

Use a dedicated container for each persistent provider. Start the emulator before
testing. For Cosmos, trust the emulator certificate through
`NODE_EXTRA_CA_CERTS` or, on supported Windows Node versions, start with
`NODE_OPTIONS=--use-system-ca`. Set these options before launching Node. If a
write fails, reopen the scenario and check the counter before retrying.

<a id="setup-authorization"></a>

## Authorization

**Modes** Latest and Legacy. Configure an Azure Bot, its OAuth connections, and
host credentials in the selected mode file. Latest uses
`AgentApplication__UserAuthorization__Handlers__...` keys. Legacy uses keys such
as `auth_connectionName` and explicitly registers handler IDs in the SDK. Legacy
can use flat or named bot credentials. To use a separate OBO app in Legacy, configure
named bot and OBO connections and the appropriate `_obo_connection` setting.

| Flow | Handler ID | What to verify |
| --- | --- | --- |
| OAuth | `auth` | Sign-in callback, token availability, and Graph profile access |
| SSO | `sso` | Channel SSO and downstream token exchange |
| OBO Auto | `obo_auto` | SDK automatic downstream token acquisition |
| OBO Manual | `obo_manual` | Explicit exchange for Graph after sign-in |

1. Open a flow, select **Sign in**, and follow the channel prompt. If the sign-in
   page shows a verification code, paste it into the original chat.
2. Read the result and **Details**. A cached token can produce Graph results
   without another sign-in callback. Check token, callback, exchange, and Graph
   outcomes independently.
3. Select **Check status**, **Sign out**, then **Check status** again. Expect the
   final check to show a signed-out state.
4. Repeat in each mode with a channel that supports the chosen flow. Reopen the
   same conversation to verify that the selected flow and sign-in state persist.

The equivalent typed actions are `--login <handler>`, `--status <handler>`, and
`--logout <handler>`. The same commands without a handler target all four flows.
Select the flow breadcrumb on a result to reopen **Check status** and the available sign-in actions.

Finish pending sign-in in its original conversation. **All scenarios** is
blocked until the sign-in or its background continuation settles. Leaving
preserves established credentials. Restart clears pending local state and reloads
the selected configuration format.

## Copilot Studio

**Modes** Latest and Legacy. Set the published agent's `environmentId` and
`schemaName`, host credentials, and an OAuth connection dedicated to Copilot
Studio. Use the `mcs` handler from the selected template. Configure consent for
Power Platform on the downstream application.

Open **Copilot Studio**, select **Sign in**, and complete the channel sign-in
prompt. When the card shows that you are signed in, send a message. Send a
follow-up in the same chat to exercise session reuse. A different user or chat gets its own session. Select
**Sign out** or send `/logout` to sign out of this scenario and clear its chat
session. The local session map lasts until process restart.

## Route matching

**Mode** Latest. Select the exact-match actions for `foo` and `fooBar`. Use
`dupText` to see the higher-ranked of two matching handlers, then send `hello`
to see the fallback.

## HTTP scenarios

**Mode** Latest. **Expect replies** buffers three native replies in one HTTP
response. **Header propagation** checks the fixed test header on the SDK's
connector and user token clients. Each scenario card has a local simulation
button. Use the [HTTP walkthrough](README.md#try-the-http-scenarios) to exercise
the real host.

## Rate limiting

**Mode** Latest. With a fresh 10-second window, **User burst** accepts 3 of 4,
**Conversation burst** accepts 5 of 6, and **Combined burst** accepts 3 of 4
because the user rule is checked first. These are local SDK simulations. The
card shows one row per limit. A single-limit action replaces only that row.
A combined action updates both and shows checks skipped after the user rule
throttles a turn.
Repeated bursts and ordinary turns share the counters. Results update the scenario
card in place. A channel that cannot update the original activity receives a
replacement card.

To exercise real turns, send `1` (user), `2` (conversation), or `3` (both).
Wait the reported time before retrying. Use several users in one conversation to
exercise overlapping rules. Menu navigation stays outside the limiter.

<a id="setup-attachments"></a>

## Generic attachments

**Mode** Latest. Select **Test sample attachment** to download and preview the
fixed public Adaptive Cards PNG through the SDK. In a supported channel, upload a
small file to test the channel's attachment path. Text alone reports zero files.
HTML attachments are excluded and downloaded files stay in turn memory. For a
failed download, check file access, channel credentials, and the outbound URL
policy.

<a id="setup-streaming"></a>

## Streaming

**Mode** Latest. Select **Send cited reply** for a regular message with citations
and the AI-generated label. **Start stream** shows progress, then streamed text
and citations. **Test failure** stops partway and marks the response incomplete.
Retry once the stream settles. **Web Chat citations** uses the bundled Markdown
citation fixture for client rendering checks. The result card contains the response text and breadcrumbs.

The content is deterministic and requires no AI credentials. Inspect activity
payloads when the client renders progress or citations differently. Starting
another stream or leaving is blocked until the stream settles.

<a id="setup-long-running"></a>

## Long-running turns

**Mode** Latest. Use a channel that supports conversation continuation with
configured bot credentials. Select **Start work**, then **Send a message**
while it runs. Expect an immediate acknowledgement, progress updates where
supported, and a result after about five seconds. **Test failure** exercises
the error path. Retry after it settles. In-progress work is local to the process,
and **All scenarios** is blocked while the continuation runs.

<a id="setup-proactive"></a>

## Proactive messaging

**Mode** Latest. Use a channel that supports proactive delivery with bot
credentials. Select **Send proactive message** for a separate reply, or
**Remind me in 5 seconds** for delayed delivery. **Cancel reminder** cancels a
pending timer. Wait for a send in progress before leaving.

**Create browser link** shows a one-time link valid for two minutes. Select
**Send from browser** and look for the new message in chat. Set
`SAMPLES_PROACTIVE_BASE_URL` to the coordinator's browser-accessible origin if
localhost is unavailable. The scenario uses an in-memory timer. Restart clears
pending reminders and links.

## Transcripts

**Mode** Latest. Start Azurite or configure `BLOB_STORAGE_CONNECTION_STRING`
for a sample storage account. Open **Transcripts** and send a test message.
Select **List** to read stored activities for the current conversation and
**Delete** to remove them. Turns in the Transcripts scenario are recorded,
including the delete turn, so a transcript can contain new records after deletion.
After leaving, send a message in another scenario and verify it does not appear
when you return to **Transcripts** and select **List**.

<a id="setup-telemetry"></a>

## Telemetry

**Mode** Latest. Set `SAMPLES_TELEMETRY=on` and restart. **Successful turn**
emits OK spans. **Controlled error** emits ERROR spans and a safe chat message.
**Trace activity** sends a fixed channel diagnostic that some clients show only
in inspection tools. The exporter prints span names, status, and duration.
Leave and reopen the scenario to check that it does not duplicate span lines.
Console telemetry can be enabled in all modes.

## Compatibility

**Mode** Compat. These scenarios exercise the SDK's older programming interfaces.

| Scenario | What to try |
| --- | --- |
| State | Select **Start name prompt**, enter a name, then send another message. Reopen to check the stored name. **Reset state** clears it and restarting clears memory. |
| Adaptive Cards | Try **Card actions**, **Suggested actions**, and **Toggle visibility** in a channel that renders them. |
| Card Factory | Select a card type and inspect its payload or rendering. For classic previews, use the breadcrumb on the selector card. |
| Events and attachments | Try the inline and internet attachment actions or **Typing demonstration**. Upload a small file with a caption and confirm the saved file in `samples/.attachments/`. Supported channels also deliver edits, deletes, and reactions. |

Compat downloads are anonymous and use the SDK HTTPS host allowlist. For a
trusted file host outside the default list, set
`OutboundHostValidator__Hosts` in `compat.env` and restart.

## Teams scenarios

**Mode** Latest. Use the [Teams sample guide](teams/TeamsSamples.md) to set up
the Azure Bot and app manifest, then test attachments, conversations, card actions,
meetings, message extensions, and task modules.

## Upstream sources

These Microsoft Agents manifests track the latest version on the upstream
main branch. The local Teams guide explains which declarations this coordinator uses.

- [agent-targeted-messages](https://github.com/microsoft/Agents/blob/main/samples/nodejs/teams/agent-targeted-messages/manifest/manifest.json)
- [bot-ai-messages](https://github.com/microsoft/Agents/blob/main/samples/nodejs/teams/bot-ai-messages/manifest/manifest.json)
- [bot-attachments](https://github.com/microsoft/Agents/blob/main/samples/nodejs/teams/bot-attachments/manifest/manifest.json)
- [bot-cards](https://github.com/microsoft/Agents/blob/main/samples/nodejs/teams/bot-cards/manifest/manifest.json)
- [bot-meetings](https://github.com/microsoft/Agents/blob/main/samples/nodejs/teams/bot-meetings/manifest/manifest.json)
- [bot-message-extensions](https://github.com/microsoft/Agents/blob/main/samples/nodejs/teams/bot-message-extensions/manifest/manifest.json)
- [bot-task-modules](https://github.com/microsoft/Agents/blob/main/samples/nodejs/teams/bot-task-modules/manifest/manifest.json)
