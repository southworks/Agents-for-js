// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Activity, DeliveryModes } from '@microsoft/agents-activity'
import { AgentApplication, CloudAdapter, getAuthConfigWithDefaults, MemoryStorage, type TurnContext, type TurnState } from '@microsoft/agents-hosting'
import type { Mode } from '../agent.js'
import { scenarios, type Scenario, type ScenarioAgent } from './catalog.js'
import { menuCard, scenarioCard } from './cards.js'
import { addBreadcrumbs } from './navigation.js'
import { getSessionKey } from '../_shared/sessionKey.js'
import { ownsCopilotStudioActivity } from '../copilot-studio/agent.js'
import { isAuthorizationActivity } from '../authorization/agent.js'
import { authorizationScenarioId } from '../authorization/flows.js'
import { configureSampleHeaders } from './httpScenarios.js'
import { readSetting, scenarioSettings, templateHostCredentials } from '../_shared/config.js'

function readCardCommand (context: TurnContext) {
  const value = context.activity.value
  if (context.activity.type === 'message' && value && typeof value === 'object' && 'samplesCommand' in value) {
    return {
      command: value.samplesCommand,
      scenarioId: 'scenarioId' in value ? value.scenarioId : undefined,
      action: 'command' in value ? value.command : undefined
    }
  }
}

export class SamplesCoordinator extends AgentApplication<TurnState> {
  private readonly availableScenarios: Scenario[]
  private readonly selections = new Map<string, Scenario>()
  private readonly agents = new Map<string, Promise<ScenarioAgent>>()
  private readonly activeTurns = new Map<string, number>()
  private readonly exiting = new Set<string>()
  private readonly authorizationOwners = new Map<string, Scenario>()
  private readonly activeAuthorizationTurns = new Set<string>()

  constructor (private readonly mode: Mode, private readonly hostAdapter = new CloudAdapter()) {
    // The SDK discovers mode-wide auth handlers on every application and requires
    // a store for them. Navigation still lives only in the selections map.
    super({ adapter: hostAdapter, storage: new MemoryStorage(), headerPropagation: configureSampleHeaders })
    this.availableScenarios = scenarios.filter(scenario => scenario.modes.includes(mode))
    this.onError(async (context, error) => {
      await context.sendActivity('The sample turn failed. Check configuration and retry, or use All scenarios.')
      if (error.message === 'Intentional telemetry sample failure') {
        await context.sendTraceActivity('Sample error handler', error.stack, error.message)
      }
    })
  }

  // Dispatch directly: only the selected scenario runs its application pipeline.
  public override async run (context: TurnContext): Promise<void> {
    const key = getSessionKey(context)
    if (!key) {
      await this.dispatch(context)
      return
    }
    if (this.exiting.has(key)) {
      await context.sendActivity('Returning to scenarios. Wait for the menu before starting another operation.')
      return
    }
    this.activeTurns.set(key, (this.activeTurns.get(key) ?? 0) + 1)
    try {
      await this.dispatch(context)
    } finally {
      const remaining = (this.activeTurns.get(key) ?? 1) - 1
      if (remaining) {
        this.activeTurns.set(key, remaining)
      } else {
        this.activeTurns.delete(key)
      }
      this.exiting.delete(key)
    }
  }

  private async dispatch (context: TurnContext): Promise<void> {
    const activity = context.activity
    const isMessage = activity.type === 'message'
    if (isMessage && activity.channelId === 'msteams') {
      activity.removeRecipientMention()
    }
    const sessionKey = getSessionKey(context)
    const selectedScenario = sessionKey ? this.selections.get(sessionKey) : undefined
    if (selectedScenario) {
      this.addResultNavigation(context, selectedScenario)
    }

    if (await this.routeCallback(context)) {
      return
    }

    // The playground sends membersAdded when opening or reopening a conversation.
    // Restore navigation before the activity reaches a scenario's handlers.
    if (activity.type === 'conversationUpdate' && activity.membersAdded?.some(member =>
      member.id === activity.from?.id || member.id === activity.recipient?.id
    )) {
      if (selectedScenario) {
        await this.showScenario(context, selectedScenario)
      } else {
        await this.showMenu(context)
      }

      return
    }

    const card = readCardCommand(context)
    if (card) {
      if (!selectedScenario) {
        if (card.command === 'select' && typeof card.scenarioId === 'string' && sessionKey) {
          await this.selectScenario(context, sessionKey, card.scenarioId)
        } else {
          await this.showMenu(context)
        }
        return
      }

      if (card.scenarioId !== selectedScenario.id || card.command === 'open') {
        await this.showScenario(context, selectedScenario)
        return
      }
      if (card.command === 'back' && sessionKey) {
        await this.leaveScenario(context, sessionKey, selectedScenario)
        return
      }
      if (card.command !== 'authorization' || selectedScenario.id !== authorizationScenarioId) {
        const action = card.command === 'run' && selectedScenario.quickActions?.find(action => action.command === card.action)
        if (!action) {
          await this.showScenario(context, selectedScenario)
          return
        }
        // Card actions and typed commands use the same scenario handlers.
        activity.text = action.command
      }
    }

    if (selectedScenario) {
      try {
        const agent = await this.getAgent(selectedScenario)
        await this.runScenario(context, selectedScenario, agent)
      } catch (error) {
        if (!selectedScenario.unavailableMessage) {
          throw error
        }

        await this.showUnavailableScenario(context, selectedScenario)
      }

      return
    }

    if (activity.type === 'invoke') {
      await context.sendActivity(Activity.fromObject({ type: 'invokeResponse', value: { status: 501 } }))
      return
    }

    if (!isMessage) {
      return
    }

    if (!sessionKey) {
      await context.sendActivity('Cannot select a scenario without channel, conversation, and user IDs.')
      return
    }

    await this.selectScenario(context, sessionKey, activity.text?.trim() ?? '')
  }

  private async selectScenario (context: TurnContext, sessionKey: string, text: string): Promise<void> {
    const scenario = this.availableScenarios.find((entry, index) =>
      text === String(index + 1) || text.toLowerCase() === entry.id
    )

    if (!scenario) {
      await this.showMenu(context)
      return
    }

    const disabledReason = scenario.disabledReason?.(this.mode)
    if (disabledReason) {
      await context.sendActivity(disabledReason)
      await this.showMenu(context)
      return
    }

    const missingSettings = scenarioSettings(this.mode, scenario.id).filter(key => !readSetting(key))
    if (scenario.usesUserAuthorization && !getAuthConfigWithDefaults().clientId) {
      missingSettings.push(`bot identity (template keys: ${templateHostCredentials(this.mode)})`)
    }
    if (missingSettings.length > 0) {
      await context.sendActivity(`${scenario.name} needs ${missingSettings.join(', ')} in samples/${this.mode}.env. See samples/SCENARIOS.md for setup, then restart the coordinator.`)
      await this.showMenu(context)
      return
    }

    try {
      await this.getAgent(scenario)
    } catch (error) {
      if (!scenario.unavailableMessage) {
        throw error
      }

      await this.showUnavailableScenario(context, scenario)
      return
    }

    this.selections.set(sessionKey, scenario)
    await this.showScenario(context, scenario)
  }

  private authorizationKey (context: TurnContext): string {
    return JSON.stringify([context.activity.channelId, context.activity.from?.id])
  }

  private async runScenario (context: TurnContext, scenario: Scenario, agent: ScenarioAgent): Promise<void> {
    if (!scenario.usesUserAuthorization) {
      await agent.run(context)
      return
    }

    const key = this.authorizationKey(context)
    if (this.activeAuthorizationTurns.has(key)) {
      await this.showAuthorizationBusy(context)
      return
    }
    this.activeAuthorizationTurns.add(key)
    try {
      const owner = this.authorizationOwners.get(key)
      if (owner && owner !== scenario) {
        const previousAgent = await this.getAgent(owner)
        if (previousAgent.canExit && !await previousAgent.canExit(context)) {
          await this.showAuthorizationBusy(context)
          return
        }
      }

      // Claim ownership when an operation runs, not when a scenario card opens.
      this.authorizationOwners.set(key, scenario)
      await agent.run(context)
    } finally {
      this.activeAuthorizationTurns.delete(key)
    }
  }

  private async showAuthorizationBusy (context: TurnContext): Promise<void> {
    if (context.activity.type === 'invoke') {
      await context.sendActivity(Activity.fromObject({ type: 'invokeResponse', value: { status: 409 } }))
    } else {
      await context.sendActivity('Finish the pending sign-in or authorization operation in its original conversation, then try again.')
    }
  }

  private findCallbackOwner (context: TurnContext): Scenario | undefined {
    // Copilot Studio callbacks carry a dedicated OAuth connection name.
    if (ownsCopilotStudioActivity(context, this.mode)) {
      return this.availableScenarios.find(scenario => scenario.id === 'copilot-studio')
    }

    // Other sign-in callbacks follow the scenario that started the operation.
    if (isAuthorizationActivity(context)) {
      const owner = this.authorizationOwners.get(this.authorizationKey(context))
      if (owner) {
        return owner
      }
    }

    return this.availableScenarios.find(scenario => scenario.handlesActivity?.(context))
  }

  private async routeCallback (context: TurnContext): Promise<boolean> {
    const callbackOwner = this.findCallbackOwner(context)
    if (!callbackOwner) {
      return false
    }

    const owner = callbackOwner.initializeOnActivity
      ? this.getAgent(callbackOwner)
      : this.agents.get(callbackOwner.id)
    if (owner) {
      await this.runScenario(context, callbackOwner, await owner)
    } else if (context.activity.type === 'invoke') {
      await context.sendActivity(Activity.fromObject({ type: 'invokeResponse', value: { status: 400 } }))
    }
    return true
  }

  private async leaveScenario (context: TurnContext, sessionKey: string, scenario: Scenario): Promise<void> {
    if ((this.activeTurns.get(sessionKey) ?? 0) > 1) {
      await context.sendActivity('Another turn is still processing. Select All scenarios when it finishes.')
      return
    }

    // Claim navigation before awaiting scenario checks so no new operation can start.
    this.exiting.add(sessionKey)
    const agent = await this.getAgent(scenario)
    if (agent.canExit && !(await agent.canExit(context))) {
      await context.sendActivity(scenario.blockedExitMessage ?? 'Finish the pending sign-in in the original conversation before selecting All scenarios.')
      return
    }
    await agent.onExit?.(context)
    this.selections.delete(sessionKey)
    await this.showMenu(context)
  }

  private async getAgent (scenario: Scenario): Promise<ScenarioAgent> {
    // Cache initialization too, so concurrent selections share one client.
    let agent = this.agents.get(scenario.id)
    if (!agent) {
      agent = Promise.resolve().then(() => scenario.create(this.hostAdapter, context => this.addResultNavigation(context, scenario), this.mode))
      this.agents.set(scenario.id, agent)
      const initializing = agent
      agent.catch(() => {
        if (this.agents.get(scenario.id) === initializing) {
          this.agents.delete(scenario.id)
        }
      })
    }

    return agent
  }

  private async showUnavailableScenario (context: TurnContext, scenario: Scenario): Promise<void> {
    this.agents.delete(scenario.id)
    const sessionKey = getSessionKey(context)
    if (sessionKey && this.selections.get(sessionKey)?.id === scenario.id) {
      this.selections.delete(sessionKey)
    }

    // Connection errors can include credentials or request headers. Show setup
    // guidance instead of forwarding raw provider errors to chat.
    await context.sendActivity(`${scenario.name} is unavailable. ${scenario.unavailableMessage}\n\nReview samples/${this.mode}.env and samples/SCENARIOS.md. Restart after configuration changes. If a command failed, reopen the scenario and check the counter before retrying; a write may already have reached storage.`)
    await this.showMenu(context)
  }

  private addResultNavigation (context: TurnContext, scenario: Scenario): void {
    const sessionKey = getSessionKey(context)
    const keepNativeReplies = scenario.preserveBufferedReplies && context.activity.deliveryMode === DeliveryModes.ExpectReplies
    if (!sessionKey || keepNativeReplies) {
      return
    }

    addBreadcrumbs(context, this.mode, async () => {
      if (this.selections.get(sessionKey) !== scenario) {
        return undefined
      }

      const agent = await this.getAgent(scenario)
      return { id: scenario.id, name: scenario.name, flow: agent.selectedFlow?.(context) }
    })
  }

  private async showScenario (context: TurnContext, scenario: Scenario): Promise<void> {
    const agent = await this.getAgent(scenario)
    if (agent.showIntroduction) {
      await agent.showIntroduction(context)
    } else {
      await context.sendActivity(scenarioCard(this.mode, scenario))
    }
  }

  private async showMenu (context: TurnContext): Promise<void> {
    await context.sendActivity(menuCard(this.mode, this.availableScenarios))
  }
}
