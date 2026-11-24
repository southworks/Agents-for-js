// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { AgentApplication, MemoryStorage, type CloudAdapter, type TurnContext } from '@microsoft/agents-hosting'

export function createTelemetryAgent (adapter: CloudAdapter) {
  const app = new AgentApplication({ adapter, storage: new MemoryStorage() })

  app.onMessage('telemetry-success', async context => {
    await context.sendActivity('Telemetry · Turn succeeded. When enabled, inspect agents.app.route_handler and agents.app.run in the terminal.')
  })

  app.onMessage('telemetry-error', async () => {
    throw new Error('Intentional telemetry sample failure')
  })

  app.onMessage('trace-activity', async context => {
    await context.sendTraceActivity('Sample trace activity', 'Fixed sample diagnostic; no activity content or credentials.')
    await context.sendActivity('Telemetry · Trace activity sent. Inspect channel diagnostics where supported; this is not an OpenTelemetry span.')
  })

  return {
    async run (context: TurnContext): Promise<void> {
      try {
        await app.run(context)
      } catch (error) {
        await adapter.onTurnError(context, error as Error)
      }
    }
  }
}
