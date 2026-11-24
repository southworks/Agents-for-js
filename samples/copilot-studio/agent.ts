// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { CopilotStudioClient, loadCopilotStudioConnectionSettingsFromEnv } from '@microsoft/agents-copilotstudio-client'
import { AgentApplication, MemoryStorage, type TurnContext, type TurnState, type CloudAdapter } from '@microsoft/agents-hosting'
import { Activity, ActivityTypes } from '@microsoft/agents-activity'
import { oauthConnectionKey, readSetting, type Mode } from '../_shared/config.js'
import { getSessionKey } from '../_shared/sessionKey.js'
import { scenarioCard } from '../_coordinator/cards.js'

const signInAction = { label: 'Sign in', command: '/login' }
const signOutAction = { label: 'Sign out', command: '/logout' }

export const copilotStudioCardDetails = {
  id: 'copilot-studio',
  name: 'Copilot Studio',
  quickActions: [signInAction, signOutAction]
}

export class CopilotStudioAgent extends AgentApplication<TurnState> {
  private readonly busy = new Map<string, number>()
  private readonly authStorage: MemoryStorage
  private readonly sessions = new Map<string, string>()
  private readonly activeSessions = new Set<string>()

  constructor (adapter: CloudAdapter, private readonly addResultNavigation: (context: TurnContext) => void, private readonly mode: Mode) {
    const storage = new MemoryStorage()
    super({
      storage,
      adapter,
      // Latest discovers the handler from env. Legacy requires an explicit ID.
      authorization: mode === 'legacy' ? { mcs: {} } : undefined,
      startTypingTimer: true
    })

    this.authStorage = storage

    // The SDK resumes this route after sign-in. Only chat messages go to Copilot Studio.
    this.onMessage(signInAction.command, context => this.showSignInCard(context, true), ['mcs'])
    this.onMessage(signOutAction.command, this.signOut)
    this.onActivity('message', this.sendToCopilot)
  }

  public async showIntroduction (context: TurnContext): Promise<void> {
    const signedIn = await this.checkSignIn(context)
    await this.showSignInCard(context, signedIn)
  }

  private async checkSignIn (context: TurnContext): Promise<boolean | undefined> {
    try {
      const { token } = await this.authorization.getToken(context, 'mcs')
      return Boolean(token)
    } catch {
      return undefined
    }
  }

  private async showSignInCard (context: TurnContext, signedIn?: boolean, note?: string): Promise<void> {
    let introduction = 'Sign in to chat with the configured Copilot Studio agent.'
    if (signedIn) {
      introduction = 'Signed in to Copilot Studio. Send a message to start chatting.'
    } else if (signedIn === undefined) {
      introduction = 'Could not check Copilot Studio sign-in status. Select Sign in to continue.'
    }

    await context.sendActivity(scenarioCard(this.mode, {
      ...copilotStudioCardDetails,
      introduction: note ?? introduction,
      quickActions: signedIn ? [signOutAction] : [signInAction]
    }))
  }

  private authKey (context: TurnContext): string {
    return `auth/${context.activity.channelId?.trim()}/${context.activity.from?.id?.trim()}`
  }

  public async canExit (context: TurnContext): Promise<boolean> {
    const key = this.authKey(context)
    return !this.busy.has(key) && !(await this.authStorage.read([key]))[key]
  }

  public override async run (context: TurnContext): Promise<void> {
    const key = this.authKey(context)
    const pending = (await this.authStorage.read([key]))[key]
    if (pending?.activity?.conversation?.id &&
      pending.activity.conversation.id !== context.activity.conversation?.id) {
      if (context.activity.type === 'invoke') {
        await context.sendActivity(Activity.fromObject({ type: 'invokeResponse', value: { status: 409 } }))
      } else {
        await context.sendActivity('Complete the pending Copilot Studio sign-in in its original conversation.')
      }
      return
    }
    await super.run(context)
  }

  protected override startLongRunningCall (context: TurnContext, handler: (context: TurnContext) => Promise<void>): void {
    const key = this.authKey(context)
    this.busy.set(key, (this.busy.get(key) ?? 0) + 1)
    const activity = Activity.fromObject(context.activity)
    this.continueConversationAsync(context.identity, activity.getConversationReference(), async continued => {
      Object.assign(continued.activity, activity)
      this.addResultNavigation(continued)
      await handler(continued)
    }).catch(() => {
      console.error('Copilot Studio continuation failed. Check configuration and try again.')
    }).finally(() => {
      const count = (this.busy.get(key) ?? 1) - 1
      if (count) {
        this.busy.set(key, count)
      } else {
        this.busy.delete(key)
      }
    })
  }

  private signOut = async (context: TurnContext, state: TurnState): Promise<void> => {
    const key = getSessionKey(context)
    if (!key || this.activeSessions.has(key)) {
      await context.sendActivity('Wait for the current Copilot Studio reply before signing out.')
      return
    }
    this.activeSessions.add(key)
    try {
      await this.authorization.signOut(context, state, 'mcs')
      this.sessions.delete(key)
      await this.showSignInCard(context, false, 'Signed out of Copilot Studio. Select Sign in to start a new session.')
    } finally {
      this.activeSessions.delete(key)
    }
  }

  private sendToCopilot = async (context: TurnContext): Promise<void> => {
    const key = getSessionKey(context)
    const text = context.activity.text?.trim()
    if (!key || !text) {
      await context.sendActivity('Send a text message to chat with the configured Copilot Studio agent.')
      return
    }
    if (this.activeSessions.has(key)) {
      await context.sendActivity('Copilot Studio is replying. Wait before sending another message.')
      return
    }

    this.activeSessions.add(key)
    try {
      let token: string | undefined
      try {
        const exchanged = await this.authorization.exchangeToken(context, 'mcs', { scopes: ['https://api.powerplatform.com/.default'] })
        token = exchanged?.token
      } catch {
        await context.sendActivity('Copilot Studio token exchange failed. Check the OAuth connection and Power Platform consent, then try again.')
        return
      }
      if (!token) {
        const signedIn = await this.checkSignIn(context)
        const note = signedIn
          ? 'Copilot Studio did not return a downstream token. Check the OAuth connection and Power Platform consent.'
          : undefined
        await this.showSignInCard(context, signedIn, note)
        return
      }

      const client = this.createClient(token)
      let conversationId = this.sessions.get(key)
      if (!conversationId) {
        for await (const activity of client.startConversationStreaming()) {
          conversationId = activity.conversation?.id || conversationId
          if (activity.type === ActivityTypes.Message) {
            await context.sendActivity(activity)
          }
        }
        if (!conversationId) {
          await context.sendActivity('Copilot Studio did not return a conversation ID. Check the agent settings and try again.')
          return
        }
        this.sessions.set(key, conversationId)
      }

      const message = Activity.fromObject({ type: 'message', text, conversation: { id: conversationId } })
      for await (const activity of client.sendActivityStreaming(message)) {
        if (activity.type === ActivityTypes.Message) {
          await context.sendActivity(activity)
        } else if (activity.type === ActivityTypes.Typing) {
          await context.sendActivity(new Activity(ActivityTypes.Typing))
        }
      }
    } finally {
      this.activeSessions.delete(key)
    }
  }

  private createClient (token: string): CopilotStudioClient {
    return new CopilotStudioClient(loadCopilotStudioConnectionSettingsFromEnv(), token)
  }
}

export function ownsCopilotStudioActivity (context: TurnContext, mode: Mode): boolean {
  if (mode === 'compat') {
    return false
  }
  const { value, type, name } = context.activity
  const connectionName = readSetting(oauthConnectionKey(mode, 'mcs'))
  return Boolean(connectionName && value && typeof value === 'object' &&
    'connectionName' in value && value.connectionName === connectionName &&
    ((type === 'invoke' && name?.startsWith('signin/')) || (type === 'event' && name === 'tokens/response')))
}
