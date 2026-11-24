# Development samples coordinator

Requires Node.js 22+. From the repository root, install dependencies with the
root lockfile and build the SDK packages. The private samples workspace uses
those locally built packages.

```powershell
npm ci
npm run build
Copy-Item samples/latest.env.TEMPLATE samples/latest.env
npx tsx samples/agent.ts
```

Select Latest, Legacy, or Compat in the terminal. For unattended startup, use
`npx tsx samples/agent.ts --mode latest`. Copy the corresponding template for
Legacy or Compat. Mode files are loaded relative to the entry point. Restart to
change mode or configuration. To restart manually after source edits, start
with `--reload` in an interactive terminal and press **R**. The picker highlights
the mode you were using. Press **Enter** to keep it or select another mode.
If you start with `--mode`, restart keeps that mode and skips the picker.
Use `--help` at the CLI for startup syntax.

The selected mode file owns the SDK and scenario settings. Conflicting inherited settings
are rejected by key name. Fill service credentials and storage settings only
for the scenarios you use. The repository root environment file is outside this
startup flow.

Latest uses named bot connections and current OAuth settings. Legacy defaults to
flat bot credentials and uses legacy OAuth keys. It also accepts named host
connections. Compat demonstrates older SDK interfaces and uses flat bot
credentials. Leave bot credentials blank for local Playground testing. Storage,
proactive messaging, and the interactive Telemetry scenario are in Latest.
Console telemetry can be enabled in all modes.

## Connect chat

Start the coordinator with `npx tsx samples/agent.ts`, or use
`npm start --workspace samples -- --mode latest`. The server listens at
`http://localhost:3978/api/messages` by default. Set `PORT` in the selected
environment file to change the port.

In a second terminal, from the repository root, start the installed playground:

```text
npm run play -- --app-endpoint http://localhost:3978/api/messages --channel-id emulator
```

Open the local URL printed by the playground. The default templates support
local development without credentials. If you configure host authentication, the
chat client must use matching credentials.

If the playground returns 401 with no credentials configured, check that another
agent is not already listening on port 3978. In PowerShell:

```powershell
Get-NetTCPConnection -LocalPort 3978 -State Listen
```

To use a different port, set `PORT=3979` in the selected mode's environment file,
restart the coordinator, and connect the playground to
`http://localhost:3979/api/messages`. Anonymous development requires no configured
host client ID and `NODE_ENV` other than `production`.

## Navigation

The menu groups scenarios into Basics, State and storage, Authorization and
integrations, Messaging, Diagnostics, Compatibility, and Teams. Scenario buttons
are sent as one action set per group, with layout handled by the chat host. Teams is the final group.

Select a scenario, then use its variant actions. A completed variant shows its
result with breadcrumbs. Select the scenario breadcrumb to
reopen its full card. Use the **Authorization** breadcrumb to return to the flow list. Select **All scenarios** to return to the menu. Pending sign-in or background delivery
must finish before leaving, or use the provided cancellation action where available.

The mode name appears in bold at the top right. Legacy
lists Authorization and Copilot Studio, which exercise legacy authorization
configuration. Compat lists the scenarios that exercise older programming
interfaces. Use Latest for the general scenarios. Disabled
scenario actions explain their setup requirement in the hover tooltip.

Sample inputs such as Echo messages and route-matching commands remain available.
Navigation uses buttons. See [SCENARIOS.md](SCENARIOS.md) for every sample's setup,
expected behavior, and limitations. The [Teams guide](teams/TeamsSamples.md)
covers app setup, manifest permissions, and Teams-specific walkthroughs.

## Add a scenario

Export an agent factory from the relevant sample folder and register it in the
coordinator catalog with a name, introduction, modes, and action buttons.
Document setup and validation in SCENARIOS.md. Keep server startup in agent.ts.
