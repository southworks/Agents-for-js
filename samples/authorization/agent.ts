// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Activity } from '@microsoft/agents-activity'
import { AgentApplication, MemoryStorage, TurnContext, type CloudAdapter, type TurnState } from '@microsoft/agents-hosting'
import type { Mode } from '../agent.js'
import { getUserInfo } from '../_shared/userGraphClient.js'
import { authorizationFlows, authorizationScenarioId, type AuthorizationFlow } from './flows.js'
import { authorizationCard, authorizationResultCard } from './cards.js'

export function isAuthorizationActivity (context: TurnContext): boolean {
  const activity = context.activity
  return (activity.type === 'invoke' && activity.name?.startsWith('signin/') === true) ||
    (activity.type === 'event' && activity.name === 'tokens/response')
}

const handlerIds = authorizationFlows.map(flow => flow.id)
type HandlerId = typeof handlerIds[number]

type UserStatus = {
  signedIn: boolean | undefined
  userInfo: string
  graph?: 'Succeeded' | 'Succeeded; profile name unavailable' | 'Failed' | 'Not requested'
  exchange?: 'Succeeded' | 'Failed'
  callback?: string
  displayName?: string
}
export type AuthorizationStatus = UserStatus & { handlerId: string }

class AuthorizationSample extends AgentApplication<TurnState> {
  private readonly busy = new Map<string, number>()
  private readonly signInObservations = new Set<string>()

  constructor (
    adapter: CloudAdapter,
    private readonly addResultNavigation: (context: TurnContext) => void,
    private readonly mode: Mode,
    private readonly authStorage = new MemoryStorage()
  ) {
    // Legacy configuration loads values only for explicitly registered handler IDs.
    const legacyHandlers = Object.fromEntries(handlerIds.map(id => [id, {}]))
    super({ adapter, storage: authStorage, authorization: mode === 'legacy' ? legacyHandlers : undefined })

    this.onMessage(['--login', '+'], context => this.showLoginResult(context, handlerIds), handlerIds)
    this.onMessage(['--status', '='], context => this.showStatus(context, handlerIds))
    this.onMessage(['--logout', '-'], (context, state) => this.signOut(context, state, handlerIds))
    for (const id of handlerIds) {
      this.onMessage([`--login ${id}`, `+${id}`], context => this.showLoginResult(context, [id]), [id])
      this.onMessage([`--status ${id}`, `=${id}`], context => this.showStatus(context, [id]))
      this.onMessage([`--logout ${id}`, `-${id}`], (context, state) => this.signOut(context, state, [id]))
    }

    this.authorization.onSignInSuccess(async (context, _state, id) => {
      if (id) {
        this.signInObservations.add(this.observationKey(context, id))
      }
    })
    this.authorization.onSignInFailure(async (context, _state, id) => {
      this.clearCallbackObservations(context)
      await context.sendActivity(authorizationResultCard('Sign in', [{
        handlerId: id ?? 'unknown',
        signedIn: undefined,
        userInfo: 'Sign-in failed. Check the OAuth connection and channel setup in samples/SCENARIOS.md, then retry.',
        callback: 'onSignInFailure',
        graph: 'Not requested'
      }]))
    })
    this.onActivity('message', context => this.showIntroduction(context))
  }

  private readonly flows = new Map<string, AuthorizationFlow>()

  private flowKey (context: TurnContext): string {
    return JSON.stringify([context.activity.channelId, context.activity.conversation?.id, context.activity.from?.id])
  }

  public selectedFlow (context: TurnContext) {
    return this.flows.get(this.flowKey(context))
  }

  public async showIntroduction (context: TurnContext): Promise<void> {
    const flow = this.selectedFlow(context)
    let signedIn: boolean | undefined
    if (flow?.id === 'auth') {
      try {
        signedIn = !!(await this.authorization.getToken(context, flow.id))?.token
      } catch {
        // A lookup failure does not establish whether the user is signed out.
      }
    }
    await context.sendActivity(authorizationCard(flow, this.mode, signedIn))
  }

  private observationKey (context: TurnContext, handlerId: string): string {
    return JSON.stringify([this.flowKey(context), handlerId])
  }

  private clearCallbackObservations (context: TurnContext): void {
    for (const id of handlerIds) {
      this.signInObservations.delete(this.observationKey(context, id))
    }
  }

  private async showLoginResult (context: TurnContext, ids: HandlerId[]): Promise<void> {
    const statuses = await Promise.all(ids.map(id => this.getStatus(context, id)))
    for (const status of statuses) {
      const observed = this.signInObservations.delete(this.observationKey(context, status.handlerId))
      status.callback = observed ? 'onSignInSuccess' : 'not observed'
    }
    await context.sendActivity(authorizationResultCard('Sign in', statuses))
  }

  private async showStatus (context: TurnContext, ids: HandlerId[]): Promise<void> {
    const statuses = await Promise.all(ids.map(id => this.getStatus(context, id)))
    await context.sendActivity(authorizationResultCard('Status', statuses))
  }

  private async signOut (context: TurnContext, state: TurnState, ids: HandlerId[]): Promise<void> {
    const results: AuthorizationStatus[] = []
    for (const handlerId of ids) {
      this.signInObservations.delete(this.observationKey(context, handlerId))
      try {
        const token = await this.authorization.getToken(context, handlerId)
        if (token?.token) {
          await this.authorization.signOut(context, state, handlerId)
          results.push({ handlerId, signedIn: false, userInfo: 'Signed out' })
        } else {
          results.push({ handlerId, signedIn: false, userInfo: 'Already signed out' })
        }
      } catch {
        results.push({ handlerId, signedIn: undefined, userInfo: 'Sign-out could not be confirmed. Check status before retrying.' })
      }
    }
    await context.sendActivity(authorizationResultCard('Sign out', results))
  }

  private async getStatus (context: TurnContext, handlerId: HandlerId): Promise<AuthorizationStatus> {
    try {
      return { handlerId, ...await this.getUserStatus(context, handlerId) }
    } catch {
      return { handlerId, signedIn: undefined, graph: 'Not requested', userInfo: 'Token acquisition failed.' }
    }
  }

  private async getUserStatus (context: TurnContext, handlerId: HandlerId): Promise<UserStatus> {
    const token = await this.authorization.getToken(context, handlerId)
    if (handlerId !== 'sso' && handlerId !== 'obo_manual') {
      return this.getGraphUserStatus(handlerId, token?.token, 'Not signed in')
    }
    if (!token?.token) {
      return { signedIn: false, graph: 'Not requested', userInfo: 'Not signed in' }
    }
    try {
      const options = handlerId === 'obo_manual' ? { scopes: ['https://graph.microsoft.com/.default'] } : undefined
      const exchanged = await this.authorization.exchangeToken(context, handlerId, options)
      return this.getGraphUserStatus(handlerId, exchanged?.token, 'Token exchange failed.', true)
    } catch {
      return { signedIn: true, exchange: 'Failed', graph: 'Not requested', userInfo: 'Token exchange failed.' }
    }
  }

  // HandlerStorage scopes pending sign-in by channel and user, across conversations.
  // Read that SDK-owned record without changing or cancelling it.
  private async pendingSignIn (context: TurnContext) {
    const key = `auth/${context.activity.channelId?.trim()}/${context.activity.from?.id?.trim()}`
    return (await this.authStorage.read([key]))[key]
  }

  private userKey (context: TurnContext): string {
    return JSON.stringify([context.activity.channelId, context.activity.from?.id])
  }

  private markBusy (key: string, change: number): void {
    const count = (this.busy.get(key) ?? 0) + change
    if (count > 0) {
      this.busy.set(key, count)
    } else {
      this.busy.delete(key)
    }
  }

  public async canExit (context: TurnContext): Promise<boolean> {
    return !this.busy.has(this.userKey(context)) && !(await this.pendingSignIn(context))
  }

  public override async run (context: TurnContext): Promise<void> {
    const text = context.activity.text?.trim() ?? ''
    const pending = await this.pendingSignIn(context)
    if (pending && pending.activity?.conversation?.id !== context.activity.conversation?.id) {
      if (context.activity.type === 'invoke') {
        await context.sendActivity(Activity.fromObject({ type: 'invokeResponse', value: { status: 409 } }))
      } else {
        await context.sendActivity('Finish the pending sign-in in its original conversation before using authorization here.')
      }
      return
    }

    if (context.activity.type === 'message') {
      const value = context.activity.value as { samplesCommand?: unknown, scenarioId?: unknown, flow?: unknown, operation?: unknown } | undefined
      const selected = this.flows.get(this.flowKey(context))
      const typed = text.match(/^(?:--(?:login|status|logout)\s+|[+=-])(auth|sso|obo_auto|obo_manual)$/)
      const allCommand = ['--login', '--status', '--logout', '+', '=', '-'].includes(text)
      if (value?.samplesCommand === 'authorization') {
        const flow = authorizationFlows.find(entry => entry.id === value.flow)
        const validOperation = value.operation === 'flows' ||
          (flow && typeof value.operation === 'string' && ['select', 'login', 'status', 'logout'].includes(value.operation))
        const valid = value.scenarioId === authorizationScenarioId && validOperation
        if (!valid) {
          await this.showIntroduction(context)
          return
        }
        if (!(await this.canExit(context))) {
          await context.sendActivity('Sign-in or its continuation is pending. Complete it before using flow actions. See samples/SCENARIOS.md for setup.')
          return
        }
        if (value.operation === 'flows') {
          this.flows.delete(this.flowKey(context))
          await this.showIntroduction(context)
          return
        }
        if (!flow) {
          await this.showIntroduction(context)
          return
        }
        if (value.operation === 'select') {
          this.flows.set(this.flowKey(context), flow)
          await this.showIntroduction(context)
          return
        }
        if (flow.id !== selected?.id) {
          await context.sendActivity('This button belongs to an older card. Select the flow again.')
          await this.showIntroduction(context)
          return
        }
        context.activity.text = '--' + value.operation + ' ' + flow.id
        context.activity.value = undefined
      } else if (typed || allCommand) {
        if (!(await this.canExit(context))) {
          await context.sendActivity('Finish the pending sign-in before starting another operation. See samples/SCENARIOS.md for setup.')
          return
        }
        const flow = authorizationFlows.find(entry => entry.id === typed?.[1])
        if (flow) {
          this.flows.set(this.flowKey(context), flow)
        }
      }
    }

    if (context.activity.type === 'message' && /^(?:--(?:login|status|logout)|[+=-])/.test(context.activity.text ?? '')) {
      this.clearCallbackObservations(context)
    }
    this.addSignInInstructions(context)
    const key = this.userKey(context)
    this.markBusy(key, 1)
    try {
      await super.run(context)
    } finally {
      this.markBusy(key, -1)
    }
  }

  private addSignInInstructions (context: TurnContext): void {
    context.onSendActivities(async (_context, activities, next) => {
      for (const activity of activities) {
        for (const attachment of activity.attachments ?? []) {
          if (attachment.contentType === 'application/vnd.microsoft.card.oauth') {
            // Keep the OAuth metadata intact for channel sign-in and token exchange.
            // Playground adds its own Redeem code button; it is not in this payload.
            const content = attachment.content as { text?: string }
            attachment.content = {
              ...content,
              text: `${content?.text ?? ''}\n\nIf a verification code appears after signing in, paste it directly into this chat to complete sign-in.`
            }
          }
        }
      }
      return next()
    })
  }

  // tokenExchange can continue after run() returns. Keep exit blocked until the
  // actual continuation settles, including failures before its handler starts.
  protected override startLongRunningCall (context: TurnContext, handler: (context: TurnContext) => Promise<void>): void {
    const key = this.userKey(context)
    const activity = Activity.fromObject(context.activity)
    const adapter = context.adapter
    const identity = context.identity
    const reportFailure = async (errorContext: TurnContext) => {
      this.clearCallbackObservations(errorContext)
      const flow = this.flows.get(this.flowKey(errorContext))
      const failure: AuthorizationStatus = {
        handlerId: flow?.id ?? 'unknown',
        signedIn: undefined,
        userInfo: 'Authorization continuation failed. Check status before retrying; Graph success is unknown.'
      }
      await errorContext.sendActivity(authorizationResultCard('Continuation', [failure]))
    }
    this.markBusy(key, 1)
    this.continueConversationAsync(identity, activity.getConversationReference(), async continued => {
      Object.assign(continued.activity, activity)
      this.addResultNavigation(continued)
      this.addSignInInstructions(continued)
      try {
        await handler(continued)
      } catch {
        await reportFailure(continued)
      }
    }).catch(async () => {
      // The inbound context is revoked once its request finishes.
      const errorContext = new TurnContext(adapter, Activity.fromObject(activity), identity)
      this.addResultNavigation(errorContext)
      await reportFailure(errorContext)
    }).catch(() => {
      console.error('Could not deliver the authorization continuation failure message.')
    }).finally(() => {
      this.markBusy(key, -1)
    })
  }

  private async getGraphUserStatus (handlerId: string, token: string | undefined, missingTokenStatus: string, signedInWhenMissing = false): Promise<UserStatus> {
    if (!token) {
      return { signedIn: signedInWhenMissing, graph: 'Not requested', exchange: signedInWhenMissing ? 'Failed' : undefined, userInfo: missingTokenStatus }
    }

    try {
      const userInfo = await getUserInfo(token)
      const displayName = userInfo?.$root?.displayName as string | undefined
      const profileSummary = displayName
        ? `signed in as ${displayName}; Graph request succeeded`
        : 'signed in; Graph request succeeded, but no display name was returned'

      return {
        signedIn: true,
        displayName,
        graph: displayName ? 'Succeeded' : 'Succeeded; profile name unavailable',
        exchange: signedInWhenMissing ? 'Succeeded' : undefined,
        userInfo: profileSummary
      }
    } catch {
      return { signedIn: true, graph: 'Failed', exchange: signedInWhenMissing ? 'Succeeded' : undefined, userInfo: `${handlerId} token acquired; Graph request failed` }
    }
  }
}

export function createAuthorizationAgent (adapter: CloudAdapter, addResultNavigation: (context: TurnContext) => void, mode: Mode) {
  return new AuthorizationSample(adapter, addResultNavigation, mode)
}
