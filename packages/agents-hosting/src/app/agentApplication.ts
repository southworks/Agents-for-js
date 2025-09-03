/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { Activity, ActivityTypes, ConversationReference } from '@microsoft/agents-activity'
import { BaseAdapter } from '../baseAdapter'
import { ResourceResponse } from '../connector-client'
import { debug } from '@microsoft/agents-activity/logger'
import { TurnContext } from '../turnContext'
import { AdaptiveCardsActions } from './adaptiveCards'
import { AgentApplicationOptions } from './agentApplicationOptions'
import { ConversationUpdateEvents } from './conversationUpdateEvents'
import { AgentExtension } from './extensions'
import { RouteHandler } from './routeHandler'
import { RouteSelector } from './routeSelector'
import { TurnEvents } from './turnEvents'
import { TurnState } from './turnState'
import { RouteRank } from './routeRank'
import { RouteList } from './routeList'
import { TranscriptLoggerMiddleware } from '../transcript'
import { CloudAdapter } from '../cloudAdapter'
import { TokenExchangeRequest, TokenOrSinginResourceResponse, TokenResponse } from '../oauth'
import { Storage, StoreItem } from '../storage'
import { MessageFactory } from '../messageFactory'
import { CardFactory } from '../cards'
import { AppRoute } from './appRoute'

const logger = debug('agents:app')

const TYPING_TIMER_DELAY = 1000

/**
 * Event handler function type for application events.
 * @typeParam TState - The state type extending TurnState.
 * @param context - The turn context containing activity information.
 * @param state - The current turn state.
 * @returns A promise that resolves to a boolean indicating whether to continue execution.
 */
export type ApplicationEventHandler<TState extends TurnState> = (context: TurnContext, state: TState) => Promise<boolean>

/**
 * Main application class for handling agent conversations and routing.
 *
 * @typeParam TState - The state type extending TurnState.
 *
 * @remarks
 * The AgentApplication class provides a framework for building conversational agents.
 * It handles routing activities to appropriate handlers, manages conversation state,
 * supports authentication flows, and provides various event handling capabilities.
 *
 * Key features:
 * - Activity routing based on type, content, or custom selectors
 * - State management with automatic load/save
 * - OAuth authentication support
 * - Typing indicators and long-running message support
 * - Extensible architecture with custom extensions
 * - Event handlers for before/after turn processing
 *
 * @example
 * ```typescript
 * const app = new AgentApplication<MyState>({
 *   storage: new MemoryStorage(),
 *   adapter: myAdapter
 * });
 *
 * app.onMessage('hello', async (context, state) => {
 *   await context.sendActivity('Hello there!');
 * });
 *
 * await app.run(turnContext);
 * ```
 *
 */
export class AgentApplication<TState extends TurnState, TOptions extends Partial<AgentApplicationOptions<TState>> = Partial<AgentApplicationOptions<TState>>> {
  protected readonly _options: AgentApplicationOptions<TState>
  protected readonly _routes: RouteList<TState> = new RouteList<TState>()
  protected readonly _beforeTurn: ApplicationEventHandler<TState>[] = []
  protected readonly _afterTurn: ApplicationEventHandler<TState>[] = []
  private readonly _adapter?: CloudAdapter
  // private readonly _authorization: Record<string, Record<string, AuthorizationHandlerContext>> = {}
  private readonly _authManager: RouteGuardManager<TState>[] = []
  private _typingTimer: NodeJS.Timeout | undefined
  protected readonly _extensions: AgentExtension<TState>[] = []
  private readonly _adaptiveCards: AdaptiveCardsActions<TState>

  /**
   * Creates a new instance of AgentApplication.
   *
   * @param options - Optional configuration options for the application.
   *
   * @remarks
   * The constructor initializes the application with default settings and applies
   * any provided options. It sets up the adapter, authorization, and other core
   * components based on the configuration.
   *
   * Default options:
   * - startTypingTimer: false
   * - longRunningMessages: false
   * - removeRecipientMention: true
   * - turnStateFactory: Creates a new TurnState instance
   *
   * @example
   * ```typescript
   * const app = new AgentApplication({
   *   storage: new MemoryStorage(),
   *   adapter: myAdapter,
   *   startTypingTimer: true,
   *   authorization: { connectionName: 'oauth' },
   *   transcriptLogger: myTranscriptLogger,
   * });
   * ```
   */
  public constructor (options?: TOptions) {
    this._options = {
      ...options,
      turnStateFactory: options?.turnStateFactory || (() => new TurnState() as TState),
      startTypingTimer: options?.startTypingTimer !== undefined ? options.startTypingTimer : false,
      longRunningMessages: options?.longRunningMessages !== undefined ? options.longRunningMessages : false,
      removeRecipientMention: options?.removeRecipientMention !== undefined ? options.removeRecipientMention : true,
      transcriptLogger: options?.transcriptLogger || undefined,
    }

    this._adaptiveCards = new AdaptiveCardsActions<TState>(this)

    if (this._options.adapter) {
      this._adapter = this._options.adapter
    } else {
      this._adapter = new CloudAdapter()
    }

    // for (const [handlerId, handler] of Object.entries(options?.authorization ?? {})) {
    //   this._authManager.push(new AuthorizationHandlerManager(this.adapter.userTokenClient!, handlerId, handler))
    // }

    // if (this._options.authorization) {
    //   this._authorization = new Authorization(this._options.storage!, this._options.authorization, this._adapter?.userTokenClient!)
    // }

    if (this._options.longRunningMessages && !this._adapter && !this._options.agentAppId) {
      throw new Error('The Application.longRunningMessages property is unavailable because no adapter was configured in the app.')
    }

    if (this._options.transcriptLogger) {
      if (!this._options.adapter) {
        throw new Error('The Application.transcriptLogger property is unavailable because no adapter was configured in the app.')
      } else {
        this._adapter?.use(new TranscriptLoggerMiddleware(this._options.transcriptLogger))
      }
    }
    logger.debug('AgentApplication created with options:', this._options)
  }

  /**
   * Gets the authorization instance for the application.
   *
   * @returns The authorization instance.
   * @throws Error if no authentication options were configured.
   */
  public get authorization (): any {
    if (this._authManager.length === 0) {
      throw new Error('The Application.authorization property is unavailable because no authorization options were configured.')
    }

    return this._authManager.reduce((acc, manager) => {
      // acc[manager.id] = { context: manager.context.bind(manager) }
      return acc
    }, {} as any)
  }

  /**
   * Gets the options used to configure the application.
   *
   * @returns The application options.
   */
  public get options (): TOptions {
    return this._options as TOptions
  }

  /**
   * Gets the adapter used by the application.
   *
   * @returns The adapter instance.
   */
  public get adapter (): BaseAdapter {
    return this._adapter!
  }

  /**
   * Gets the adaptive cards actions handler for the application.
   *
   * @returns The adaptive cards actions instance.
   *
   * @remarks
   * The adaptive cards actions handler provides functionality for handling
   * adaptive card interactions, such as submit actions and other card-based events.
   *
   * @example
   * ```typescript
   * app.adaptiveCards.actionSubmit('doStuff', async (context, state, data) => {
   *   await context.sendActivity(`Received data: ${JSON.stringify(data)}`);
   * });
   * ```
   */
  public get adaptiveCards (): AdaptiveCardsActions<TState> {
    return this._adaptiveCards
  }

  /**
   * Sets an error handler for the application.
   *
   * @param handler - The error handler function to be called when an error occurs.
   * @returns The current instance of the application.
   *
   * @remarks
   * This method allows you to handle any errors that occur during turn processing.
   * The handler will receive the turn context and the error that occurred.
   *
   * @example
   * ```typescript
   * app.onError(async (context, error) => {
   *   console.error(`An error occurred: ${error.message}`);
   *   await context.sendActivity('Sorry, something went wrong!');
   * });
   * ```
   *
   */
  public onError (handler: (context: TurnContext, error: Error) => Promise<void>): this {
    if (this._adapter) {
      this._adapter.onTurnError = handler
    }
    return this
  }

  /**
   * Adds a new route to the application for handling activities.
   *
   * @param selector - The selector function that determines if a route should handle the current activity.
   * @param handler - The handler function that will be called if the selector returns true.
   * @param isInvokeRoute - Whether this route is for invoke activities. Defaults to false.
   * @param rank - The rank of the route, used to determine the order of evaluation. Defaults to RouteRank.Unspecified.
   * @param guards - Array of authentication handler names for this route. Defaults to empty array.
   * @returns The current instance of the application.
   *
   * @remarks
   * Routes are evaluated by rank order (if provided), otherwise, in the order they are added.
   * Invoke-based activities receive special treatment and are matched separately as they typically
   * have shorter execution timeouts.
   *
   * @example
   * ```typescript
   * app.addRoute(
   *   async (context) => context.activity.type === ActivityTypes.Message,
   *   async (context, state) => {
   *     await context.sendActivity('I received your message');
   *   },
   *   false, // isInvokeRoute
   *   RouteRank.First // rank
   * );
   * ```
   *
   */
  public addRoute (selector: RouteSelector, handler: RouteHandler<TState>, isInvokeRoute: boolean = false, rank: number = RouteRank.Unspecified, guards: Guard[] = []): this {
    // const handlers = this._authManager.filter(e => authHandlers.includes(e.id))
    // new AuthorizationHandlerManager(this.adapter.userTokenClient!, handlerId, handler)
    this._routes.addRoute(selector, handler, isInvokeRoute, rank, guards)
    return this
  }

  /**
   * Adds a handler for specific activity types.
   *
   * @param type - The activity type(s) to handle. Can be a string, RegExp, RouteSelector, or array of these types.
   * @param handler - The handler function that will be called when the specified activity type is received.
   * @param guards - Array of authentication handler names for this activity. Defaults to empty array.
   * @param rank - The rank of the route, used to determine the order of evaluation. Defaults to RouteRank.Unspecified.
   * @returns The current instance of the application.
   *
   * @remarks
   * This method allows you to register handlers for specific activity types such as 'message', 'conversationUpdate', etc.
   * You can specify multiple activity types by passing an array.
   *
   * @example
   * ```typescript
   * app.onActivity(ActivityTypes.Message, async (context, state) => {
   *   await context.sendActivity('I received your message');
   * });
   * ```
   *
   */
  public onActivity (
    type: string | RegExp | RouteSelector | (string | RegExp | RouteSelector)[],
    handler: (context: TurnContext, state: TState) => Promise<void>,
    guards: Guard[] = [],
    rank: RouteRank = RouteRank.Unspecified
  ): this {
    (Array.isArray(type) ? type : [type]).forEach((t) => {
      const selector = this.createActivitySelector(t)
      this.addRoute(selector, handler, false, rank, guards)
    })
    return this
  }

  /**
   * Adds a handler for conversation update events.
   *
   * @param event - The conversation update event to handle (e.g., 'membersAdded', 'membersRemoved').
   * @param handler - The handler function that will be called when the specified event occurs.
   * @param guards - Array of authentication handler names for this event. Defaults to empty array.
   * @param rank - The rank of the route, used to determine the order of evaluation. Defaults to RouteRank.Unspecified.
   * @returns The current instance of the application.
   * @throws Error if the handler is not a function.
   *
   * @remarks
   * Conversation update events occur when the state of a conversation changes, such as when members join or leave.
   *
   * @example
   * ```typescript
   * app.onConversationUpdate('membersAdded', async (context, state) => {
   *   const membersAdded = context.activity.membersAdded;
   *   for (const member of membersAdded) {
   *     if (member.id !== context.activity.recipient.id) {
   *       await context.sendActivity('Hello and welcome!');
   *     }
   *   }
   * });
   * ```
   *
   */
  public onConversationUpdate (
    event: ConversationUpdateEvents,
    handler: (context: TurnContext, state: TState) => Promise<void>,
    guards: Guard[] = [],
    rank: RouteRank = RouteRank.Unspecified
  ): this {
    if (typeof handler !== 'function') {
      throw new Error(
                `ConversationUpdate 'handler' for ${event} is ${typeof handler}. Type of 'handler' must be a function.`
      )
    }

    const selector = this.createConversationUpdateSelector(event)
    this.addRoute(selector, handler, false, rank, guards)
    return this
  }

  /**
   * Continues a conversation asynchronously.
   *
   * @param conversationReferenceOrContext - The conversation reference or turn context.
   * @param logic - The logic to execute during the conversation.
   * @returns A promise that resolves when the conversation logic has completed.
   * @throws Error if the adapter is not configured.
   */
  protected async continueConversationAsync (
    conversationReferenceOrContext: ConversationReference | TurnContext,
    logic: (context: TurnContext) => Promise<void>
  ): Promise<void> {
    if (!this._adapter) {
      throw new Error(
        "You must configure the Application with an 'adapter' before calling Application.continueConversationAsync()"
      )
    }

    if (!this.options.agentAppId) {
      logger.warn("Calling Application.continueConversationAsync() without a configured 'agentAppId'. In production environments, a 'agentAppId' is required.")
    }

    let reference: ConversationReference

    if ('activity' in conversationReferenceOrContext) {
      reference = conversationReferenceOrContext.activity.getConversationReference()
    } else {
      reference = conversationReferenceOrContext
    }

    await this._adapter.continueConversation(reference, logic)
  }

  /**
   * Adds a handler for message activities that match the specified keyword or pattern.
   *
   * @param keyword - The keyword, pattern, or selector function to match against message text.
   *                  Can be a string, RegExp, RouteSelector, or array of these types.
   * @param handler - The handler function that will be called when a matching message is received.
   * @param guards - Array of authentication handler names for this message handler. Defaults to empty array.
   * @param rank - The rank of the route, used to determine the order of evaluation. Defaults to RouteRank.Unspecified.
   * @returns The current instance of the application.
   *
   * @remarks
   * This method allows you to register handlers for specific message patterns.
   * If keyword is a string, it matches messages containing that string.
   * If keyword is a RegExp, it tests the message text against the regular expression.
   * If keyword is a function, it calls the function with the context to determine if the message matches.
   *
   * @example
   * ```typescript
   * app.onMessage('hello', async (context, state) => {
   *   await context.sendActivity('Hello there!');
   * });
   *
   * app.onMessage(/help/i, async (context, state) => {
   *   await context.sendActivity('How can I help you?');
   * });
   * ```
   *
   */
  public onMessage (
    keyword: string | RegExp | RouteSelector | (string | RegExp | RouteSelector)[],
    handler: (context: TurnContext, state: TState) => Promise<void>,
    guards: Guard[] = [],
    rank: RouteRank = RouteRank.Unspecified
  ): this {
    (Array.isArray(keyword) ? keyword : [keyword]).forEach((k) => {
      const selector = this.createMessageSelector(k)
      this.addRoute(selector, handler, false, rank, guards)
    })
    return this
  }

  /**
   * Sets a handler to be called when a user successfully signs in.
   *
   * @param handler - The handler function to be called after successful sign-in.
   * @returns The current instance of the application.
   * @throws Error if authentication options were not configured.
   *
   * @remarks
   * This method allows you to perform actions after a user has successfully authenticated.
   * The handler will receive the turn context and state.
   *
   * @example
   * ```typescript
   * app.onSignInSuccess(async (context, state) => {
   *   await context.sendActivity('You have successfully signed in!');
   * });
   * ```
   *
   */
  public onSignInSuccess (handler: (context: TurnContext, state: TurnState, id?: string) => Promise<void>): this {
    if (this.options.authorization) {
      // this.authorization.onSignInSuccess(handler)
    } else {
      throw new Error(
        'The Application.authorization property is unavailable because no authorization options were configured.'
      )
    }
    return this
  }

  /**
   * Sets a handler to be called when a sign-in attempt fails.
   *
   * @param handler - The handler function to be called after a failed sign-in attempt.
   * @returns The current instance of the application.
   * @throws Error if authentication options were not configured.
   *
   * @remarks
   * This method allows you to handle cases where a user fails to authenticate,
   * such as when they cancel the sign-in process or an error occurs.
   *
   * @example
   * ```typescript
   * app.onSignInFailure(async (context, state) => {
   *   await context.sendActivity('Sign-in failed. Please try again.');
   * });
   * ```
   *
   */
  public onSignInFailure (handler: (context: TurnContext, state: TurnState, id?: string) => Promise<void>): this {
    if (this.options.authorization) {
      // this.authorization.onSignInFailure(handler)
    } else {
      throw new Error(
        'The Application.authorization property is unavailable because no authorization options were configured.'
      )
    }
    return this
  }

  /**
   * Adds a handler for message reaction added events.
   *
   * @param handler - The handler function that will be called when a message reaction is added.
   * @param rank - The rank of the route, used to determine the order of evaluation. Defaults to RouteRank.Unspecified.
   * @returns The current instance of the application.
   *
   * @remarks
   * This method registers a handler that will be invoked when a user adds a reaction to a message,
   * such as a like, heart, or other emoji reaction.
   *
   * @example
   * ```typescript
   * app.onMessageReactionAdded(async (context, state) => {
   *   const reactionsAdded = context.activity.reactionsAdded;
   *   if (reactionsAdded && reactionsAdded.length > 0) {
   *     await context.sendActivity(`Thanks for your ${reactionsAdded[0].type} reaction!`);
   *   }
   * });
   * ```
   *
   */
  public onMessageReactionAdded (
    handler: (context: TurnContext, state: TState) => Promise<void>,
    rank: RouteRank = RouteRank.Unspecified): this {
    const selector = async (context: TurnContext): Promise<boolean> => {
      return context.activity.type === ActivityTypes.MessageReaction &&
             Array.isArray(context.activity.reactionsAdded) &&
             context.activity.reactionsAdded.length > 0
    }

    this.addRoute(selector, handler, false, rank)
    return this
  }

  /**
   * Adds a handler for message reaction removed events.
   *
   * @param handler - The handler function that will be called when a message reaction is removed.
   * @param rank - The rank of the route, used to determine the order of evaluation. Defaults to RouteRank.Unspecified.
   * @returns The current instance of the application.
   *
   * @remarks
   * This method registers a handler that will be invoked when a user removes a reaction from a message,
   * such as unliking or removing an emoji reaction.
   *
   * @example
   * ```typescript
   * app.onMessageReactionRemoved(async (context, state) => {
   *   const reactionsRemoved = context.activity.reactionsRemoved;
   *   if (reactionsRemoved && reactionsRemoved.length > 0) {
   *     await context.sendActivity(`You removed your ${reactionsRemoved[0].type} reaction.`);
   *   }
   * });
   * ```
   *
   */
  public onMessageReactionRemoved (
    handler: (context: TurnContext, state: TState) => Promise<void>,
    rank: RouteRank = RouteRank.Unspecified): this {
    const selector = async (context: TurnContext): Promise<boolean> => {
      return context.activity.type === ActivityTypes.MessageReaction &&
             Array.isArray(context.activity.reactionsRemoved) &&
             context.activity.reactionsRemoved.length > 0
    }

    this.addRoute(selector, handler, false, rank)
    return this
  }

  /**
   * Executes the application logic for a given turn context.
   *
   * @param turnContext - The context for the current turn of the conversation.
   * @returns A promise that resolves when the application logic has completed.
   *
   * @remarks
   * This method is the entry point for processing a turn in the conversation.
   * It delegates the actual processing to the `runInternal` method, which handles
   * the core logic for routing and executing handlers.
   *
   * @example
   * ```typescript
   * const app = new AgentApplication();
   * await app.run(turnContext);
   * ```
   *
   */
  public async run (turnContext:TurnContext): Promise<void> {
    await this.runInternal(turnContext)
  }

  // private async registerGuards (context: TurnContext) {
  //   const activity = context.activity
  //   const storageKey = `${activity.channelId}/${activity.from?.id!}`
  //   let selectedRoute
  //   for (const route of this._routes) {
  //     if (await route.selector(context)) {
  //       selectedRoute = route
  //       break
  //     }
  //   }

  //   let authenticated = !selectedRoute?.guards?.length
  //   for (const guard of selectedRoute?.guards ?? []) {
  //     if (guard instanceof AuthorizationGuard) {
  //       const manager = new AuthorizationGuardManager(guard, this.adapter, this.options.storage!, storageKey)
  //       const handler = await manager.handler(context)
  //       authenticated = handler.authenticated
  //       if (!authenticated) {
  //         break
  //       }
  //       if (authenticated && handler.activity) {
  //         // selectedRoute = await [...this._routes].find(route => route.selector(new TurnContext(context.adapter, handler.activity!)))
  //       }
  //     }
  //   }

  //   return selectedRoute
  // }

  /**
   * Executes the application logic for a given turn context.
   *
   * @param turnContext - The context for the current turn of the conversation.
   * @returns A promise that resolves to true if a handler was executed, false otherwise.
   *
   * @remarks
   * This is the core internal method that processes a turn in the conversation.
   * It handles routing and executing handlers based on the activity type and content.
   * While this method is public, it's typically called internally by the `run` method.
   *
   * The method performs the following operations:
   * 1. Starts typing timer if configured
   * 2. Processes mentions if configured
   * 3. Loads turn state
   * 4. Handles authentication flows
   * 5. Executes before-turn event handlers
   * 6. Downloads files if file downloaders are configured
   * 7. Routes to appropriate handlers
   * 8. Executes after-turn event handlers
   * 9. Saves turn state
   *
   * @example
   * ```typescript
   * const handled = await app.runInternal(turnContext);
   * if (!handled) {
   *   console.log('No handler matched the activity');
   * }
   * ```
   *
   */
  public async runInternal (turnContext: TurnContext): Promise<boolean> {
    logger.info('Running application with activity:', turnContext.activity.id!)
    return await this.startLongRunningCall(turnContext, async (context) => {
      try {
        if (context.activity.type === ActivityTypes.Typing) {
          return false
        }

        if (this._options.startTypingTimer) {
          this.startTypingTimer(context)
        }

        if (this._options.removeRecipientMention && context.activity.type === ActivityTypes.Message) {
          context.activity.removeRecipientMention()
        }

        if (this._options.normalizeMentions && context.activity.type === ActivityTypes.Message) {
          context.activity.normalizeMentions()
        }

        const { storage, turnStateFactory } = this._options
        const state = turnStateFactory()
        await state.load(context, storage)

        // continue: flow started flag + magic code (retry)
        // begin: no token from service
        // continue: signin/verifyState activity
        // exchange: signing/tokenExchange activity

        // TODO: this could be a function that returns the cleanup, authenticated, and route.

        // let selectedRoute = null
        // for (const route of this._routes) {
        //   if (await route.selector(context)) {
        //     selectedRoute = route
        //     break
        //   }
        // }

        const manager = new RouteGuardManager(this._routes, this.adapter, this.options.storage!)
        const route = await manager.register(context)
        if (!route) {
          return false
        }

        // for (const manager of selectedRoute?.authHandlers ?? []) {
        //   const handler = await manager.handler(context)
        //   if (!handler.authenticated) {
        //     return false
        //   }
        //   if (handler.activity) {
        //     selectedRoute = await [...this._routes].find(route => route.selector(new TurnContext(context.adapter, handler.activity)))
        //   }
        // }
        // const manager = await selectedRoute?.authHandlers?.find(handler => handler.selector(context))

        // if (manager) {
        //   const handler = await manager.handler(context)
        //   if (!handler.authenticated) {
        //     return false
        //   }
        //   if (handler.activity) {
        //     selectedRoute = await [...this._routes].find(route => route.selector(new TurnContext(context.adapter, handler.activity)))
        //   }
        // }

        // for (const handler of selectedRoute?.authHandlers ?? []) {
        //   const flow = await handler.decide(context)
        //   if (!flow?.authenticated) {
        //     return false
        //   }
        //   if (flow?.activity) {
        //     selectedRoute = await [...this._routes].find(route => route.selector(new TurnContext(context.adapter, flow.activity)))
        //   }
        //   this._authorization[handler.id] = flow.handler
        // }

        if (!(await this.callEventHandlers(context, state, this._beforeTurn))) {
          await state.save(context, storage)
          return false
        }

        if (Array.isArray(this._options.fileDownloaders) && this._options.fileDownloaders.length > 0) {
          const inputFiles = state.temp.inputFiles ?? []
          for (let i = 0; i < this._options.fileDownloaders.length; i++) {
            const files = await this._options.fileDownloaders[i].downloadFiles(context, state)
            inputFiles.push(...files)
          }
          state.temp.inputFiles = inputFiles
        }

        // Use await to ensure async handlers are executed correctly.
        await route?.handler.bind(this, context, state)()

        if (await this.callEventHandlers(context, state, this._afterTurn)) {
          await state.save(context, storage)
        }

        // TODO: do cleanup of handlers
        // manager?.cleanup(context)

        // const signInState : SignInState = state.getValue('user.__SIGNIN_STATE_')
        // logger.debug('SignIn State:', signInState)
        // if (this._authorization && signInState && signInState.completed === false) {
        //   const flowState = await this._authorization.authHandlers[signInState.handlerId!]?.flow?.getFlowState(context)
        //   logger.debug('Flow State:', flowState)
        //   if (flowState && flowState.flowStarted === true) {
        //     const tokenResponse = await this._authorization.beginOrContinueFlow(turnContext, state, signInState?.handlerId!)
        //     const savedAct = Activity.fromObject(signInState?.continuationActivity!)
        //     if (tokenResponse?.token && tokenResponse.token.length > 0) {
        //       logger.info('resending continuation activity:', savedAct.text)
        //       await this.run(new TurnContext(context.adapter, savedAct))
        //       await state.deleteValue('user.__SIGNIN_STATE_')
        //       return true
        //     }
        //   }

        //   // return true
        // }

        // if (!(await this.callEventHandlers(context, state, this._beforeTurn))) {
        //   await state.save(context, storage)
        //   return false
        // }

        // if (Array.isArray(this._options.fileDownloaders) && this._options.fileDownloaders.length > 0) {
        //   const inputFiles = state.temp.inputFiles ?? []
        //   for (let i = 0; i < this._options.fileDownloaders.length; i++) {
        //     const files = await this._options.fileDownloaders[i].downloadFiles(context, state)
        //     inputFiles.push(...files)
        //   }
        //   state.temp.inputFiles = inputFiles
        // }

        // for (const route of this._routes) {
        //   if (await route.selector(context)) {
        //     if (route.authHandlers === undefined || route.authHandlers.length === 0) {
        //       await route.handler(context, state)
        //     } else {
        //       let signInComplete = false
        //       for (const authHandlerId of route.authHandlers) {
        //         logger.info(`Executing route handler for authHandlerId: ${authHandlerId}`)
        //         const tokenResponse = await this._authorization?.beginOrContinueFlow(turnContext, state, authHandlerId)
        //         signInComplete = (tokenResponse?.token !== undefined && tokenResponse?.token.length > 0)
        //         if (!signInComplete) {
        //           break
        //         }
        //       }
        //       if (signInComplete) {
        //         await route.handler(context, state)
        //       }
        //     }

        //     if (await this.callEventHandlers(context, state, this._afterTurn)) {
        //       await state.save(context, storage)
        //     }

        //     return true
        //   }
        // }

        // if (await this.callEventHandlers(context, state, this._afterTurn)) {
        //   await state.save(context, storage)
        // }

        return false
      } catch (err: any) {
        logger.error(err)
        throw err
      } finally {
        this.stopTypingTimer()
      }
    })
  }

  /**
   * Sends a proactive message to a conversation.
   *
   * @param context - The turn context or conversation reference to use.
   * @param activityOrText - The activity or text to send.
   * @param speak - Optional text to be spoken by the bot on a speech-enabled channel.
   * @param inputHint - Optional input hint for the activity.
   * @returns A promise that resolves to the resource response from sending the activity.
   *
   * @remarks
   * This method allows you to send messages proactively to a conversation, outside the normal turn flow.
   *
   * @example
   * ```typescript
   * // With conversation reference
   * await app.sendProactiveActivity(conversationReference, 'Important notification!');
   *
   * // From an existing context
   * await app.sendProactiveActivity(turnContext, 'Important notification!');
   * ```
   *
   */
  public async sendProactiveActivity (
    context: TurnContext | ConversationReference,
    activityOrText: string | Activity,
    speak?: string,
    inputHint?: string
  ): Promise<ResourceResponse | undefined> {
    let response: ResourceResponse | undefined
    await this.continueConversationAsync(context, async (ctx) => {
      response = await ctx.sendActivity(activityOrText, speak, inputHint)
    })

    return response
  }

  /**
   * Starts a typing indicator timer for the current turn context.
   *
   * @param context - The turn context for the current conversation.
   * @returns void
   *
   * @remarks
   * This method starts a timer that sends typing activity indicators to the user
   * at regular intervals. The typing indicator continues until a message is sent
   * or the timer is explicitly stopped.
   *
   * The typing indicator helps provide feedback to users that the agent is processing
   * their message, especially when responses might take time to generate.
   *
   * @example
   * ```typescript
   * app.startTypingTimer(turnContext);
   * // Do some processing...
   * await turnContext.sendActivity('Response after processing');
   * // Typing timer automatically stops when sending a message
   * ```
   *
   */
  public startTypingTimer (context: TurnContext): void {
    if (context.activity.type === ActivityTypes.Message && !this._typingTimer) {
      let timerRunning = true
      context.onSendActivities(async (context, activities, next) => {
        if (timerRunning) {
          for (let i = 0; i < activities.length; i++) {
            if (activities[i].type === ActivityTypes.Message || activities[i].channelData?.streamType) {
              this.stopTypingTimer()
              timerRunning = false
              await lastSend
              break
            }
          }
        }

        return next()
      })

      let lastSend: Promise<any> = Promise.resolve()
      const onTimeout = async () => {
        try {
          lastSend = context.sendActivity(Activity.fromObject({ type: ActivityTypes.Typing }))
          await lastSend
        } catch (err: any) {
          logger.error(err)
          this._typingTimer = undefined
          timerRunning = false
          lastSend = Promise.resolve()
        }

        if (timerRunning) {
          this._typingTimer = setTimeout(onTimeout, TYPING_TIMER_DELAY)
        }
      }
      this._typingTimer = setTimeout(onTimeout, TYPING_TIMER_DELAY)
    }
  }

  /**
   * Registers an extension with the application.
   *
   * @typeParam T - The extension type extending AgentExtension.
   * @param extension - The extension instance to register.
   * @param regcb - Callback function called after successful registration.
   * @throws Error if the extension is already registered.
   *
   * @remarks
   * Extensions provide a way to add custom functionality to the application.
   * Each extension can only be registered once to prevent conflicts.
   *
   * @example
   * ```typescript
   * const myExtension = new MyCustomExtension();
   * app.registerExtension(myExtension, (ext) => {
   *   console.log('Extension registered:', ext.name);
   * });
   * ```
   *
   */
  public registerExtension<T extends AgentExtension<TState>> (extension: T, regcb : (ext:T) => void): void {
    if (this._extensions.includes(extension)) {
      throw new Error('Extension already registered')
    }
    this._extensions.push(extension)
    regcb(extension)
  }

  /**
   * Stops the typing indicator timer if it's currently running.
   *
   * @returns void
   *
   * @remarks
   * This method clears the typing indicator timer to prevent further typing indicators
   * from being sent. It's typically called automatically when a message is sent, but
   * can also be called manually to stop the typing indicator.
   *
   * @example
   * ```typescript
   * app.startTypingTimer(turnContext);
   * // Do some processing...
   * app.stopTypingTimer(); // Manually stop the typing indicator
   * ```
   *
   */
  public stopTypingTimer (): void {
    if (this._typingTimer) {
      clearTimeout(this._typingTimer)
      this._typingTimer = undefined
    }
  }

  /**
   * Adds an event handler for specified turn events.
   *
   * @param event - The turn event(s) to handle. Can be 'beforeTurn', 'afterTurn', or other custom events.
   * @param handler - The handler function that will be called when the event occurs.
   * @returns The current instance of the application.
   *
   * @remarks
   * Turn events allow you to execute logic before or after the main turn processing.
   * Handlers added for 'beforeTurn' are executed before routing logic.
   * Handlers added for 'afterTurn' are executed after routing logic.
   *
   * @example
   * ```typescript
   * app.onTurn('beforeTurn', async (context, state) => {
   *   console.log('Processing before turn');
   *   return true; // Continue execution
   * });
   * ```
   *
   */
  public onTurn (
    event: TurnEvents | TurnEvents[],
    handler: (context: TurnContext, state: TState) => Promise<boolean>
  ): this {
    (Array.isArray(event) ? event : [event]).forEach((e) => {
      switch (e) {
        case 'beforeTurn':
          this._beforeTurn.push(handler)
          break
        case 'afterTurn':
          this._afterTurn.push(handler)
          break
        default:
          this._beforeTurn.push(handler)
          break
      }
    })
    return this
  }

  /**
   * Calls a series of event handlers in sequence.
   *
   * @param context - The turn context for the current conversation.
   * @param state - The current turn state.
   * @param handlers - Array of event handlers to call.
   * @returns A promise that resolves to true if all handlers returned true, false otherwise.
   */
  protected async callEventHandlers (
    context: TurnContext,
    state: TState,
    handlers: ApplicationEventHandler<TState>[]
  ): Promise<boolean> {
    for (let i = 0; i < handlers.length; i++) {
      const continueExecution = await handlers[i](context, state)
      if (!continueExecution) {
        return false
      }
    }

    return true
  }

  /**
   * Starts a long-running call, potentially in a new conversation context.
   *
   * @param context - The turn context for the current conversation.
   * @param handler - The handler function to execute.
   * @returns A promise that resolves to the result of the handler.
   */
  protected startLongRunningCall (
    context: TurnContext,
    handler: (context: TurnContext) => Promise<boolean>
  ): Promise<boolean> {
    if (context.activity.type === ActivityTypes.Message && this._options.longRunningMessages) {
      return new Promise<boolean>((resolve, reject) => {
        this.continueConversationAsync(context, async (ctx) => {
          try {
            for (const key in context.activity) {
              (ctx.activity as any)[key] = (context.activity as any)[key]
            }

            const result = await handler(ctx)
            resolve(result)
          } catch (err: any) {
            logger.error(err)
            reject(err)
          }
        })
      })
    } else {
      return handler(context)
    }
  }

  /**
   * Creates a selector function for activity types.
   *
   * @param type - The activity type to match. Can be a string, RegExp, or RouteSelector function.
   * @returns A RouteSelector function that matches the specified activity type.
   */
  private createActivitySelector (type: string | RegExp | RouteSelector): RouteSelector {
    if (typeof type === 'function') {
      return type
    } else if (type instanceof RegExp) {
      return (context: TurnContext) => {
        return Promise.resolve(context?.activity?.type ? type.test(context.activity.type) : false)
      }
    } else {
      const typeName = type.toString().toLocaleLowerCase()
      return (context: TurnContext) => {
        return Promise.resolve(
          context?.activity?.type ? context.activity.type.toLocaleLowerCase() === typeName : false
        )
      }
    }
  }

  /**
   * Creates a selector function for conversation update events.
   *
   * @param event - The conversation update event to match.
   * @returns A RouteSelector function that matches the specified conversation update event.
   */
  private createConversationUpdateSelector (event: ConversationUpdateEvents): RouteSelector {
    switch (event) {
      case 'membersAdded':
        return (context: TurnContext): Promise<boolean> => {
          return Promise.resolve(
            context?.activity?.type === ActivityTypes.ConversationUpdate &&
                          Array.isArray(context?.activity?.membersAdded) &&
                          context.activity.membersAdded.length > 0
          )
        }
      case 'membersRemoved':
        return (context: TurnContext): Promise<boolean> => {
          return Promise.resolve(
            context?.activity?.type === ActivityTypes.ConversationUpdate &&
                          Array.isArray(context?.activity?.membersRemoved) &&
                          context.activity.membersRemoved.length > 0
          )
        }
      default:
        return (context: TurnContext): Promise<boolean> => {
          return Promise.resolve(
            context?.activity?.type === ActivityTypes.ConversationUpdate &&
                          context?.activity?.channelData?.eventType === event
          )
        }
    }
  }

  /**
   * Creates a selector function for message content matching.
   *
   * @param keyword - The keyword, pattern, or selector function to match against message text.
   * @returns A RouteSelector function that matches messages based on the specified keyword.
   */
  private createMessageSelector (keyword: string | RegExp | RouteSelector): RouteSelector {
    if (typeof keyword === 'function') {
      return keyword
    } else if (keyword instanceof RegExp) {
      return (context: TurnContext) => {
        if (context?.activity?.type === ActivityTypes.Message && context.activity.text) {
          return Promise.resolve(keyword.test(context.activity.text))
        } else {
          return Promise.resolve(false)
        }
      }
    } else {
      const k = keyword.toString().toLocaleLowerCase()
      return (context: TurnContext) => {
        if (context?.activity?.type === ActivityTypes.Message && context.activity.text) {
          return Promise.resolve(context.activity.text.toLocaleLowerCase() === k)
        } else {
          return Promise.resolve(false)
        }
      }
    }
  }
}

// TODO: add attempts?
export interface AuthorizationGuardContext {
  token: string;
}

export interface Guard {
  // the first param could be anything, a specific guard decides what to pass
  register(context: TurnContext, data: unknown): void | Promise<void>
}

export class AuthorizationGuard<TState extends TurnState> implements Guard {
  private adapter: BaseAdapter

  constructor (public id: string, public properties: AuthHandler, app: AgentApplication<TState>) {
    this.adapter = app.adapter
  }

  private get key () {
    return `__${AuthorizationGuard.name}/${this.id}`
  }

  register (context: TurnContext, data: AuthorizationGuardContext) {
    context.turnState.set(this.key, () => data)
  }

  context (context: TurnContext): AuthorizationGuardContext {
    const registered = context.turnState.get(this.key)
    if (!registered) {
      const msg = `${AuthorizationGuard.name} '${this.id}' is not registered in the current route handler.`
      logger.error(msg, context.activity)
      throw new Error(msg)
    }
    return registered()
  }

  // TODO: add a reset auth flow
  logout (context: TurnContext): Promise<void> {
    return this.adapter.userTokenClient!.signOut(context.activity.from?.id!, this.properties.name!, context.activity.channelId!)
  }
}

interface TokenVerifyState {
  state: string
}

interface Ongoing<TState extends TurnState> extends StoreItem {
  activity: Activity
  attempts: number
  guard: AuthorizationGuard<TState>
}

interface AppRouteWithAuthorization<TState extends TurnState> extends AppRoute<TState> {
  guards: AuthorizationGuard<TState>[] | undefined
}

// TODO: maybe this could be inside the AuthorizationGuard class and share a config through the register.
// continue: flow started flag + magic code (retry)
// begin: no token from service
// continue: signin/verifyState activity
// exchange: signing/tokenExchange activity\
export class RouteGuardManager<TState extends TurnState> {
  constructor (private routes: RouteList<TState>, private adapter: BaseAdapter, private storage: Storage) { }

  private async ongoing (context: TurnContext): Promise<any | undefined> {
    const activity = context.activity

    // TODO these are invoke only
    if (activity.name === 'signin/failure') {
      logger.error('Sign-in failed.', activity.value, activity)
      await context.sendActivity(MessageFactory.text('Sign-in failed. Please try again.'))
      await this.storage.delete([`${activity.channelId}/${activity.from?.id!}`])
      return { status: 'waiting' }
    }

    // TODO: see if the storage saves a guard with a type, so it is easier to identify later.
    let ongoing = await this.storage.read([`${activity.channelId}/${activity.from?.id!}`]) as Ongoing<TState> | undefined
    ongoing = ongoing?.[`${activity.channelId}/${activity.from?.id!}`]

    // TODO: do this after !ongoing because it will always enter here even if outgoing is null
    if (ongoing?.activity.conversation?.id !== activity.conversation?.id) {
      // Conversation restarted == new auth flow
      await this.storage.delete([`${activity.channelId}/${activity.from?.id!}`])
      ongoing = undefined
    }
    if (!ongoing) {
      return
    }

    const origin = await this.getRoute(context)
    if (origin) {
      const handlerStr = origin.handler.toString()
      // Matches logout/reset called as a function, with optional property access or chaining
      const logoutOrResetRegex = /\b(?:\w+\.)?(logout|reset)\??(?:\.\w+)?\s*\(/g

      if (logoutOrResetRegex.test(handlerStr)) {
        return
      }
    }

    const route:AppRouteWithAuthorization<TState> | undefined = await this.getRoute(new TurnContext(this.adapter, Activity.fromObject(ongoing.activity)))
    const guard = route?.guards?.find(e => e.id === ongoing.guard.id)!

    // Token exchange
    if (activity.name === 'signin/tokenExchange') {
      const { token } = await this.adapter.userTokenClient!.exchangeTokenAsync(activity.from?.id!, guard.properties.name!, activity.channelId!, activity.value as TokenExchangeRequest)
      return { guard, route, token, activity: ongoing.activity }
    }

    // Magic code verification
    if (ongoing.attempts <= 0) {
      // reset
      await context.sendActivity(MessageFactory.text('Too many invalid attempts. Please sign-in again to continue.'))
      await this.storage.delete([`${activity.channelId}/${activity.from?.id!}`])
      return { guard, route, activity: ongoing.activity }
    }

    let state: string | undefined = activity.text
    if (activity.name === 'signin/verifyState') {
      const { state: teamsState } = activity.value as TokenVerifyState
      state = teamsState
    }

    if (state === 'CancelledByUser') {
      logger.warn('Sign-in process was cancelled by the user.')
      await context.sendActivity(MessageFactory.text('Sign-in process was cancelled.'))
      await this.storage.delete([`${activity.channelId}/${activity.from?.id!}`])
      return { status: 'waiting' }
    }

    if (!state?.match(/^\d{6}$/)) {
      logger.warn(`Invalid magic code entered. Attempts left: ${ongoing.attempts - 1}`, activity)
      await context.sendActivity(MessageFactory.text(`Please enter a valid 6-digit code format (_e.g. 123456_).\r\n${ongoing.attempts} attempt(s) left...`))
      await this.storage.write({ [`${activity.channelId}/${activity.from?.id!}`]: { ...ongoing, attempts: ongoing.attempts - 1 } })
      return { status: 'waiting' }
    }

    const { tokenResponse, signInResource } = await this.adapter.userTokenClient!.getTokenOrSignInResource(activity.from?.id!, guard.properties.name!, activity.channelId!, activity.getConversationReference(), activity.relatesTo!, state ?? '')

    if (!tokenResponse) {
      logger.warn('Invalid magic code entered. Restarting sign-in flow.', activity)
      await context.sendActivity(MessageFactory.text('The code entered is invalid or has expired. Please sign-in again to continue.'))
      const oCard = CardFactory.oauthCard(guard.properties.name!, guard.properties.title!, guard.properties.text!, signInResource)
      await context.sendActivity(MessageFactory.attachment(oCard))
      await this.storage.write({ [`${activity.channelId}/${activity.from?.id!}`]: { ...ongoing, attempts: 3 } })
      return { status: 'waiting' }
    }

    return { guard, route, token: tokenResponse.token, code: state, activity: ongoing.activity }
  }

  private async getRoute <T extends AppRoute<TState>>(context: TurnContext): Promise<T | undefined> {
    for (const route of this.routes) {
      if (await route.selector(context)) {
        return route as T
      }
    }
  }

  // THIS class could be GuardManager
  async register (context: TurnContext): Promise<AppRoute<TState> | undefined> {
    let activity = context.activity
    // See where this should go, so it it executed once
    const accessToken = await this.adapter.authProvider.getAccessToken(this.adapter.authConfig, 'https://api.botframework.com')
    this.adapter.userTokenClient!.updateAuthToken(accessToken)

    const ongoing = await this.ongoing(context)

    if (ongoing?.status === 'waiting') {
      return
    }

    if (ongoing?.activity) {
      activity = Activity.fromObject(ongoing.activity)
    }

    const route = ongoing?.route ?? await this.getRoute(context)

    if (!route) {
      return
    }

    for (const guard of route.guards ?? []) {
      if (guard instanceof AuthorizationGuard) {
        const { signInResource, tokenResponse } = await this.adapter.userTokenClient!.getTokenOrSignInResource(activity.from?.id!, guard.properties.name!, activity.channelId!, activity.getConversationReference(), activity.relatesTo!, '')
        if (signInResource) {
          const oCard = CardFactory.oauthCard(guard.properties.name!, guard.properties.title!, guard.properties.text!, signInResource)
          await context.sendActivity(MessageFactory.attachment(oCard))
          await this.storage.write({ [`${activity.channelId}/${activity.from?.id!}`]: { guard, activity, attempts: 3 } })
          return
        }

        guard.register(context, { token: tokenResponse.token! })
      }
    }

    if (route.guards?.length) {
      await this.storage.delete([`${activity.channelId}/${activity.from?.id!}`])
    }

    return route
  }
}
// // TODO: maybe this could be inside the AuthorizationGuard class and share a config through the register.
// export class AuthorizationGuardManager {
//   constructor (public guard: AuthorizationGuard, private adapter: BaseAdapter, private storage: Storage) { }

//   private async manager (context: TurnContext): Promise<Manager> {
//     const activity = context.activity
//     // continue: flow started flag + magic code (retry)
//     // begin: no token from service
//     // continue: signin/verifyState activity
//     // exchange: signing/tokenExchange activity

//     if (activity.name === 'signin/tokenExchange') {
//       return this.adapter.userTokenClient!.exchangeTokenAsync(activity.from?.id!, this.guard.properties.name!, activity.channelId!, activity.value as TokenExchangeRequest)
//     }

//     let magiccode = ''

//     if (activity.name === 'signin/verifyState') {
//       magiccode = (activity.value as TokenVerifyState).state
//     }

//     if (activity.text?.match(/^\d{6}$/)) {
//       magiccode = activity.text
//     }

//     const { activity: storageActivity, attempts } = await this.storage.read([`${activity.channelId}/${activity.from?.id!}/${this.guard.id}`])

//     if (magiccode && !storageActivity) {
//       magiccode = ''
//     }

//     if (!magiccode && storageActivity) {
//       if (attempts > 0) {
//         await context.sendActivity(MessageFactory.text(`Please enter a valid 6-digit code format (_e.g. 123456_).\n${attempts} attempt(s) left...`))
//         await this.storage.write({ [`${activity.channelId}/${activity.from?.id!}/${this.guard.id}`]: { activity: storageActivity, attempts: attempts - 1 } })
//         return { token: undefined }
//       }
//       await this.storage.delete([`${activity.channelId}/${activity.from?.id!}/${this.guard.id}`])
//     }

//     const { signInResource, tokenResponse } = await this.adapter.userTokenClient!.getTokenOrSignInResource(activity.from?.id!, this.guard.properties.name!, activity.channelId!, activity.getConversationReference(), activity.relatesTo!, magiccode)

//     if (tokenResponse) {
//       return tokenResponse
//     }

//     const oCard = CardFactory.oauthCard(this.guard.properties.name!, this.guard.properties.title!, this.guard.properties.text!, signInResource)
//     await context.sendActivity(MessageFactory.attachment(oCard))
//     await this.storage.write({ [`${activity.channelId}/${activity.from?.id!}/${this.guard.id}`]: { activity: context.activity, attempts: 3 } })
//     return { token: undefined }
//   }

//   async handler (context: TurnContext) {
//     // TODO: see how to improve this
//     const accessToken = await this.adapter.authProvider.getAccessToken(this.adapter.authConfig, 'https://api.botframework.com')
//     this.adapter.userTokenClient!.updateAuthToken(accessToken)

//     const { token, activity } = await this.manager(context)
//     const authenticated = !!token?.trim().length
//     if (authenticated) {
//       const data = new AuthorizationGuardContext({ token }, this.guard, context, this.adapter.userTokenClient!)
//       this.guard.register(context, data)
//     }

//     return { authenticated, activity }
//   }
// }

/**
 * Interface defining an authorization handler for OAuth flows.
 * @interface AuthHandler
 */
export interface AuthHandler {
  /** Connection name for the auth provider. */
  name?: string,
  /** Title to display on auth cards/UI. */
  title?: string,
  /** Text to display on auth cards/UI. */
  text?: string,

  cnxPrefix?: string
}

// TODO improve interface
export class Authorization<TState extends TurnState, T extends string> {
  public guards: AuthorizationGuard<TState>[] = []
  constructor (private app: AgentApplication<TState>) {}

  create <T2 extends T>(options: Record<T2, AuthHandler>): Record<T2, AuthorizationGuard<TState>> {
    const result = {} as Record<string, AuthorizationGuard<TState>>
    for (const [key, value] of Object.entries<AuthHandler>(options)) {
      value.name = value.name ?? process.env[key + '_connectionName'] as string
      value.title = value.title ?? process.env[key + '_connectionTitle'] as string
      value.text = value.text ?? process.env[key + '_connectionText'] as string
      value.cnxPrefix = value.cnxPrefix ?? process.env[key + '_cnxPrefix'] as string
      result[key] = new AuthorizationGuard(key, value, this.app)
      this.guards.push(result[key])
    }
    return result
  }

  async logout (context: TurnContext) {
    for (const guard of this.guards) {
      await guard.logout(context)
    }
  }
}

const app = new AgentApplication()
const authorization = new Authorization(app).create({
  graph: { text: 'Sign in with Microsoft Graph', title: 'Graph Sign In', },
  github: { text: 'Sign in with GitHub', title: 'GitHub Sign In', },
})

app.onMessage('/me', (context) => {
  const s = authorization.graph.context(context)
  console.log(s.token)
  return Promise.resolve()
}, [authorization.graph])

// class App extends AgentApplication<TurnState> {
//   constructor () {
//     super({
//       authorization: { graph: { asd: '' } as any }
//     })
//   }
// }

// const s = new AgentApplication<TurnState>({
//   authorization: { graph: { asd: '' } as any }
// })

// s.authorization
// // // const s = new App().authorization.graph.context(new TurnContext({} as any, {} as any))

// // s.authorization.graph.context(new TurnContext({} as any, {} as any))

// // // const s2 = new App({
// // // }).authorization.getToken

// interface AOptions {
//   text?: string
//   authorization?: AuthorizationHandlers
// }

// class App<TState extends TurnState, TOptions extends AOptions = AOptions> {
//   // protected readonly _options: AgentApplicationOptions<TState>

//   constructor (options?: TOptions) {
//     // this._options = options as any
//     console.log('A constructor', options)
//   }

//   get authorization (): AuthMap<TOptions> {
//     return {} as AuthMap<TOptions>
//   }

//   get authorization2 (): AuthMap<TState> {
//     return {} as AuthMap<TState>
//   }

//   // public get options (): TOptions {
//   //   return this._options as TOptions
//   // }
// }

// const s3 = new App<TurnState>({
//   authorization: { graph: { asd: '' } as any }
// })

// s3.authorization.graph.context(new TurnContext({} as any, {} as any))

// // class App extends A {
// //   constructor () {
// //     super({
// //       authorization: { graph: { asd: '' } as any }
// //     })
// //   }
// // }

// // // const s = new A({
// // //   authorization: { graph: { asd: '' } as any }
// // // }).authorization.graph.context(new TurnContext({} as any, {} as any))
// // const s = new App().authorization.graph.context(new TurnContext({} as any, {} as any))

// type AuthMap<T> = T extends { authorization: infer U }
//   ? {
//       [K in keyof U]: AuthorizationHandler
//     }
//   // : Record<string, AuthorizationHandler>
//   : never
