# Sample scenarios

Use the [coordinator setup](README.md) to start the mode you need. Select a
scenario from the menu. The scenario breadcrumb reopens its card, and **All
scenarios** returns to the menu without clearing scenario data.

## Echo

**Mode** Latest. Select **Send hello** or type a message. The result card shows text
such as `You said: hello`. Try `1` after opening Echo to see that scenario input
stays in Echo. Return to the menu and reopen Echo to check routing.

<a id="setup-state"></a>

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
