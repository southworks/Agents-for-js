/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 */

import { AgentHandler, INVOKE_RESPONSE_KEY } from './activityHandler'
import { BaseAdapter } from './baseAdapter'
import { TurnContext } from './turnContext'
import { Response } from 'express'
import { Request } from './auth/request'
import { ConnectorClient } from './connector-client/connectorClient'
import { AuthConfiguration, loadAuthConfigFromEnv } from './auth/authConfiguration'
import { AuthProvider } from './auth/authProvider'
import { ApxProductionScope } from './auth/authConstants'
import { MsalConnectionManager } from './auth/msalConnectionManager'
import { Activity, ActivityEventNames, ActivityTypes, Channels, ConversationReference, DeliveryModes, ConversationParameters, RoleTypes } from '@microsoft/agents-activity'
import { ResourceResponse } from './connector-client/resourceResponse'
import { MsalTokenProvider } from './auth/msalTokenProvider'
import * as uuid from 'uuid'
import { debug } from '@microsoft/agents-activity/logger'
import { StatusCodes } from './statusCodes'
import { InvokeResponse } from './invoke/invokeResponse'
import { AttachmentInfo } from './connector-client/attachmentInfo'
import { AttachmentData } from './connector-client/attachmentData'
import { normalizeIncomingActivity } from './activityWireCompat'
import { UserTokenClient } from './oauth'
import { HeaderPropagation, HeaderPropagationCollection, HeaderPropagationDefinition } from './headerPropagation'

const logger = debug('agents:cloud-adapter')

/**
 * Adapter for handling agent interactions with various channels through cloud-based services.
 *
 * @remarks
 * CloudAdapter processes incoming HTTP requests from Microsoft Bot Framework channels,
 * authenticates them, and generates outgoing responses. It manages the communication
 * flow between agents and users across different channels, handling activities, attachments,
 * and conversation continuations.
 */
export class CloudAdapter extends BaseAdapter {
  readonly ConnectorClientKey = Symbol('ConnectorClient')
  readonly UserTokenClientKey = Symbol('UserTokenClient')

  /**
   * Client for connecting to the Bot Framework Connector service
   */
  // BENBRO: we want to remove this top level connectorClient
  public connectorClient!: ConnectorClient
  authConfig: AuthConfiguration
  connectionManager: MsalConnectionManager
  /**
   * Creates an instance of CloudAdapter.
   * @param authConfig - The authentication configuration for securing communications
   * @param authProvider - Optional custom authentication provider. If not specified, a default MsalTokenProvider will be used
   */
  constructor (authConfig?: AuthConfiguration, authProvider?: AuthProvider, userTokenClient?: UserTokenClient) {
    super()
    this.authConfig = authConfig ?? loadAuthConfigFromEnv()
    // this.authProvider = authProvider ?? new MsalTokenProvider()
    // this.userTokenClient = userTokenClient ?? new UserTokenClient(this.authConfig.clientId!)
    this.connectionManager = new MsalConnectionManager(undefined, undefined, this.authConfig)
  }

  /**
   * Determines whether a connector client is needed based on the delivery mode and service URL of the given activity.
   *
   * @param activity - The activity to evaluate.
   * @returns true if a ConnectorClient is needed, false otherwise.
   *  A connector client is required if the activity's delivery mode is not "ExpectReplies"
   *  and the service URL is not null or empty.
   * @protected
   */
  protected resolveIfConnectorClientIsNeeded (activity: Activity): boolean {
    if (!activity) {
      throw new TypeError('`activity` parameter required')
    }

    switch (activity.deliveryMode) {
      case DeliveryModes.ExpectReplies:
        if (!activity.serviceUrl) {
          logger.debug('DeliveryMode = ExpectReplies, connector client is not needed')
          return false
        }
        break
      default:
        break
    }
    return true
  }

  /**
   * Creates a connector client for a specific service URL and scope.
   *
   * @param serviceUrl - The URL of the service to connect to
   * @param scope - The authentication scope to use
   * @param headers - Optional headers to propagate in the request
   * @returns A promise that resolves to a ConnectorClient instance
   * @protected
   */
  protected async createConnectorClient (
    serviceUrl: string,
    scope: string,
    audience: string | string[],
    headers?: HeaderPropagationCollection
  ): Promise<ConnectorClient> {
    // get the correct token provider
    const tokenProvider = this.connectionManager.getTokenProvider(audience, serviceUrl)

    return ConnectorClient.createClientWithAuth(
      serviceUrl,
      this.authConfig,
      tokenProvider,
      scope,
      headers
    )
  }

  /**
   * Sets the connector client on the turn context.
   *
   * @param context - The current turn context
   * @protected
   */
  protected setConnectorClient (
    context: TurnContext,
    connectorClient?: ConnectorClient
  ) {
    context.turnState.set(this.ConnectorClientKey, connectorClient)
  }

  /**
   * Creates a user token client for a specific service URL and scope.
   *
   * @param serviceUrl - The URL of the service to connect to
   * @param scope - The authentication scope to use
   * @param headers - Optional headers to propagate in the request
   * @returns A promise that resolves to a ConnectorClient instance
   * @protected
   */
  protected async createUserTokenClient (
    serviceUrl: string,
    scope: string,
    audience: string | string[],
    headers?: HeaderPropagationCollection
  ): Promise<UserTokenClient> {
    // get the correct token provider
    const tokenProvider = this.connectionManager.getTokenProvider(audience, serviceUrl)

    return UserTokenClient.createClientWithScope(
      serviceUrl,
      tokenProvider,
      scope,
      headers
    )
  }

  /**
   * Sets the user token client on the turn context.
   *
   * @param context - The current turn context
   * @protected
   */
  protected setUserTokenClient (
    context: TurnContext,
    userTokenClient?: UserTokenClient
  ) {
    context.turnState.set(this.UserTokenClientKey, userTokenClient)
  }

  /**
   * Creates a TurnContext for the given activity and logic.
   * @param activity - The activity to process.
   * @param logic - The logic to execute.
   * @returns The created TurnContext.
   */
  createTurnContext (activity: Activity, logic: AgentHandler): TurnContext {
    return new TurnContext(this, activity)
  }

  async createTurnContextWithScope (activity: Activity, logic: AgentHandler, scope: string): Promise<TurnContext> {
    // BENBRO staging this change butn ot 100% sure ...
    const tokenProvider = this.connectionManager.getTokenProviderFromActivity('undefined benbro temp value', activity);

    const connectorClient = await ConnectorClient.createClientWithAuth(activity.serviceUrl!, this.authConfig!, this.authProvider, scope)
    const context = new TurnContext(this, activity)
    this.setConnectorClient(context, connectorClient)

    return new TurnContext(this, activity)
  }

  /**
   * Sends multiple activities to the conversation.
   * @param context - The TurnContext for the current turn.
   * @param activities - The activities to send.
   * @returns A promise representing the array of ResourceResponses for the sent activities.
   */
  async sendActivities (context: TurnContext, activities: Activity[]): Promise<ResourceResponse[]> {
    if (!context) {
      throw new TypeError('`context` parameter required')
    }

    if (!activities) {
      throw new TypeError('`activities` parameter required')
    }

    if (activities.length === 0) {
      throw new Error('Expecting one or more activities, but the array was empty.')
    }

    const responses: ResourceResponse[] = []
    for (const activity of activities) {
      delete activity.id
      let response: ResourceResponse = { id: '' }

      if (activity.type === ActivityTypes.Delay) {
        await setTimeout(() => { }, typeof activity.value === 'number' ? activity.value : 1000)
      } else if (activity.type === ActivityTypes.InvokeResponse) {
        context.turnState.set(INVOKE_RESPONSE_KEY, activity)
      } else if (activity.type === ActivityTypes.Trace && activity.channelId !== Channels.Emulator) {
        // no-op
      } else {
        if (!activity.serviceUrl || (activity.conversation == null) || !activity.conversation.id) {
          throw new Error('Invalid activity object')
        }

        // BENBRO: removed this as it happens in the process method.
        // this.connectorClient = await this.createConnectorClient(activity.serviceUrl, 'https://api.botframework.com', )

        if (activity.replyToId) {
          response = await context.turnState.get(this.ConnectorClientKey).replyToActivity(activity.conversation.id, activity.replyToId, activity)
        } else {
          response = await context.turnState.get(this.ConnectorClientKey).sendToConversation(activity.conversation.id, activity)
        }
      }

      if (!response) {
        response = { id: activity.id ?? '' }
      }

      responses.push(response)
    }

    return responses
  }

  /**
   * Processes an incoming request and sends the response.
   * @param request - The incoming request.
   * @param res - The response to send.
   * @param logic - The logic to execute.
   * @param headerPropagation - Optional function to handle header propagation.
   */
  public async process (
    request: Request,
    res: Response,
    logic: (context: TurnContext) => Promise<void>,
    headerPropagation?: HeaderPropagationDefinition): Promise<void> {
    const headers = new HeaderPropagation(request.headers)
    if (headerPropagation && typeof headerPropagation === 'function') {
      headerPropagation(headers)
      logger.debug('Headers to propagate: ', headers)
    }

    const end = (status: StatusCodes, body?: unknown, isInvokeResponseOrExpectReplies: boolean = false) => {
      res.status(status)
      if (isInvokeResponseOrExpectReplies) {
        res.setHeader('content-type', 'application/json')
      }
      if (body) {
        res.send(body)
      }
      res.end()
    }
    if (!request.body) {
      throw new TypeError('`request.body` parameter required, make sure express.json() is used as middleware')
    }
    const incoming = normalizeIncomingActivity(request.body!)
    const activity = Activity.fromObject(incoming)
    logger.info(`--> Processing incoming activity, type:${activity.type} channel:${activity.channelId}`)

    if (!this.isValidChannelActivity(activity)) {
      return end(StatusCodes.BAD_REQUEST)
    }

    logger.debug('Received activity: ', activity)
    const context = this.createTurnContext(activity, logic)
    const scope = request.user?.azp ?? request.user?.appid ?? 'https://api.botframework.com'

    // if Delivery Mode == ExpectReplies, we don't need a connector client.
    if (this.resolveIfConnectorClientIsNeeded(activity)) {
      logger.debug('Creating connector client with scope: ', scope)

      let connectorClient

      console.log('GOT USER DETAILS FROM TOKEN', request.user)

      if (activity.isAgenticRequest()) {
        logger.debug('Activity is from an agentic source, using special scope', activity.recipient)

        const tokenProvider = this.connectionManager.getTokenProvider(request.user?.aud, activity.serviceUrl ?? '')

        if (activity.recipient?.role === RoleTypes.AgenticIdentity && activity.getAgenticInstanceId()) {
          // get agentic instance token
          const token = await tokenProvider.getAgenticInstanceToken(activity.getAgenticInstanceId() ?? '')
          connectorClient = await ConnectorClient.createClientWithToken(
            activity.serviceUrl!,
            token,
            scope,
            headers
          )
        } else if (activity.recipient?.role === RoleTypes.AgenticUser && activity.getAgenticInstanceId() && activity.getAgenticUser()) {
          const token = await tokenProvider.getAgenticUserToken(activity.getAgenticInstanceId() ?? '', activity.getAgenticUser() ?? '', [ApxProductionScope])

          connectorClient = await ConnectorClient.createClientWithToken(
            activity.serviceUrl!,
            token,
            scope,
            headers
          )
        } else {
          throw new Error('Could not create connector client for agentic user')
        }
      } else {
        connectorClient = await this.createConnectorClient(activity.serviceUrl!, scope, request.user?.aud ?? '', headers)
      }

      const userTokenClient = await this.createUserTokenClient(activity.serviceUrl!, scope, request.user?.aud ?? '', headers)

      // Add connector client and user token client to turn state
      this.setConnectorClient(context, connectorClient)
      this.setUserTokenClient(context, userTokenClient)
    }

    if (
      activity?.type === ActivityTypes.InvokeResponse ||
      activity?.type === ActivityTypes.Invoke ||
      activity?.deliveryMode === DeliveryModes.ExpectReplies
    ) {
      await this.runMiddleware(context, logic)
      const invokeResponse = this.processTurnResults(context)
      logger.debug('Activity Response (invoke/expect replies): ', invokeResponse)
      return end(invokeResponse?.status ?? StatusCodes.OK, JSON.stringify(invokeResponse?.body), true)
    }

    await this.runMiddleware(context, logic)
    const invokeResponse = this.processTurnResults(context)

    return end(invokeResponse?.status ?? StatusCodes.OK, invokeResponse?.body)
  }

  private isValidChannelActivity (activity: Activity): Boolean {
    if (activity == null) {
      logger.warn('BadRequest: Missing activity')
      return false
    }

    if (activity.type == null || activity.type === '') {
      logger.warn('BadRequest: Missing activity type')
      return false
    }

    if (activity.conversation?.id == null || activity.conversation?.id === '') {
      logger.warn('BadRequest: Missing conversation.Id')
      return false
    }

    return true
  }

  /**
   * Updates an activity.
   * @param context - The TurnContext for the current turn.
   * @param activity - The activity to update.
   * @returns A promise representing the ResourceResponse for the updated activity.
   */
  async updateActivity (context: TurnContext, activity: Activity): Promise<ResourceResponse | void> {
    if (!context) {
      throw new TypeError('`context` parameter required')
    }

    if (!activity) {
      throw new TypeError('`activity` parameter required')
    }

    if (!activity.serviceUrl || (activity.conversation == null) || !activity.conversation.id || !activity.id) {
      throw new Error('Invalid activity object')
    }

    const response = await context.turnState.get(this.ConnectorClientKey).updateActivity(
      activity.conversation.id,
      activity.id,
      activity
    )

    return response.id ? { id: response.id } : undefined
  }

  /**
   * Deletes an activity.
   * @param context - The TurnContext for the current turn.
   * @param reference - The conversation reference of the activity to delete.
   * @returns A promise representing the completion of the delete operation.
   */
  async deleteActivity (context: TurnContext, reference: Partial<ConversationReference>): Promise<void> {
    if (!context) {
      throw new TypeError('`context` parameter required')
    }

    if (!reference || !reference.serviceUrl || (reference.conversation == null) || !reference.conversation.id || !reference.activityId) {
      throw new Error('Invalid conversation reference object')
    }

    await context.turnState.get(this.ConnectorClientKey).deleteActivity(reference.conversation.id, reference.activityId)
  }

  /**
   * Continues a conversation.
   * @param reference - The conversation reference to continue.
   * @param logic - The logic to execute.
   * @returns A promise representing the completion of the continue operation.
   */
  async continueConversation (reference: ConversationReference, logic: (revocableContext: TurnContext) => Promise<void>, isResponse: Boolean = false): Promise<void> {
    if (!reference || !reference.serviceUrl || (reference.conversation == null) || !reference.conversation.id) {
      throw new Error('Invalid conversation reference object')
    }

    let context
    if (isResponse) {
      context = await this.createTurnContextWithScope(Activity.getContinuationActivity(reference), logic, 'https://api.botframework.com')
    } else {
      context = this.createTurnContext(Activity.getContinuationActivity(reference), logic)
    }
    await this.runMiddleware(context, logic)
  }

  /**
 * Processes the turn results and returns an InvokeResponse if applicable.
 * @param context - The TurnContext for the current turn.
 * @returns The InvokeResponse if applicable, otherwise undefined.
 */
  protected processTurnResults (context: TurnContext): InvokeResponse | undefined {
    logger.info('<--Sending back turn results')
    // Handle ExpectedReplies scenarios where all activities have been buffered and sent back at once in an invoke response.
    if (context.activity.deliveryMode === DeliveryModes.ExpectReplies) {
      return {
        status: StatusCodes.OK,
        body: {
          activities: context.bufferedReplyActivities
        }
      }
    }

    // Handle Invoke scenarios where the agent will return a specific body and return code.
    if (context.activity.type === ActivityTypes.Invoke) {
      const activityInvokeResponse = context.turnState.get<Activity>(INVOKE_RESPONSE_KEY)
      if (!activityInvokeResponse) {
        return { status: StatusCodes.NOT_IMPLEMENTED }
      }

      return activityInvokeResponse.value as InvokeResponse
    }

    // No body to return.
    return undefined
  }

  /**
   * Creates an activity to represent the result of creating a conversation.
   * @param createdConversationId - The ID of the created conversation.
   * @param channelId - The channel ID.
   * @param serviceUrl - The service URL.
   * @param conversationParameters - The conversation parameters.
   * @returns The created activity.
   */
  protected createCreateActivity (
    createdConversationId: string | undefined,
    channelId: string,
    serviceUrl: string,
    conversationParameters: ConversationParameters
  ): Activity {
    // Create a conversation update activity to represent the result.
    const activity = new Activity(ActivityTypes.Event)

    activity.name = ActivityEventNames.CreateConversation
    activity.channelId = channelId
    activity.serviceUrl = serviceUrl
    activity.id = createdConversationId ?? uuid.v4()
    activity.conversation = {
      conversationType: undefined,
      id: createdConversationId!,
      isGroup: conversationParameters.isGroup,
      name: undefined,
      tenantId: conversationParameters.tenantId,
    }
    activity.channelData = conversationParameters.channelData
    activity.recipient = conversationParameters.agent

    return activity
  }

  /**
   * Creates a conversation.
   * @param agentAppId - The agent application ID.
   * @param channelId - The channel ID.
   * @param serviceUrl - The service URL.
   * @param audience - The audience.
   * @param conversationParameters - The conversation parameters.
   * @param logic - The logic to execute.
   * @returns A promise representing the completion of the create operation.
   */
  async createConversationAsync (
    agentAppId: string,
    channelId: string,
    serviceUrl: string,
    audience: string,
    conversationParameters: ConversationParameters,
    logic: (context: TurnContext) => Promise<void>
  ): Promise<void> {
    if (typeof serviceUrl !== 'string' || !serviceUrl) {
      throw new TypeError('`serviceUrl` must be a non-empty string')
    }
    if (!conversationParameters) throw new TypeError('`conversationParameters` must be defined')
    if (!logic) throw new TypeError('`logic` must be defined')

    // BENBRO - is this correct?  I know that audience and scope are diferent,
    //     const restClient = await this.createConnectorClient(serviceUrl, audience)
    // previously ^ we were passing in audience to the _scope_ parameter??
    const restClient = await this.createConnectorClient(serviceUrl, audience, audience)
    const userTokenClient = await this.createUserTokenClient(serviceUrl, audience, audience)
    const createConversationResult = await restClient.createConversation(conversationParameters)
    const createActivity = this.createCreateActivity(
      createConversationResult.id,
      channelId,
      serviceUrl,
      conversationParameters
    )
    const context = new TurnContext(this, createActivity)
    this.setConnectorClient(context, restClient)
    this.setUserTokenClient(context, userTokenClient)
    await this.runMiddleware(context, logic)
  }

  /**
   * @deprecated This function will not be supported in future versions.  Use TurnContext.turnState.get<ConnectorClient>(CloudAdapter.ConnectorClientKey).
   * Uploads an attachment.
   * @param conversationId - The conversation ID.
   * @param attachmentData - The attachment data.
   * @returns A promise representing the ResourceResponse for the uploaded attachment.
   */
  async uploadAttachment (context: TurnContext, conversationId: string, attachmentData: AttachmentData): Promise<ResourceResponse> {
    if (context === undefined) {
      throw new Error('context is required')
    }

    if (conversationId === undefined) {
      throw new Error('conversationId is required')
    }

    if (attachmentData === undefined) {
      throw new Error('attachmentData is required')
    }

    // BENBRO: this will require a breaking change to fix
    // as connectorClient will now bein turnContext
    return await context.turnState.get<ConnectorClient>(this.ConnectorClientKey).uploadAttachment(conversationId, attachmentData)
  }

  /**
   * @deprecated This function will not be supported in future versions.  Use TurnContext.turnState.get<ConnectorClient>(CloudAdapter.ConnectorClientKey).
   * Gets attachment information.
   * @param attachmentId - The attachment ID.
   * @returns A promise representing the AttachmentInfo for the requested attachment.
   */
  async getAttachmentInfo (context: TurnContext, attachmentId: string): Promise<AttachmentInfo> {
    if (context === undefined) {
      throw new Error('context is required')
    }

    if (attachmentId === undefined) {
      throw new Error('attachmentId is required')
    }

    // BENBRO: this will require a breaking change to fix
    // as connectorClient will now bein turnContext
    return await context.turnState.get<ConnectorClient>(this.ConnectorClientKey).getAttachmentInfo(attachmentId)
  }

  /**
   * @deprecated This function will not be supported in future versions.  Use TurnContext.turnState.get<ConnectorClient>(CloudAdapter.ConnectorClientKey).
   * Gets an attachment.
   * @param attachmentId - The attachment ID.
   * @param viewId - The view ID.
   * @returns A promise representing the NodeJS.ReadableStream for the requested attachment.
   */
  async getAttachment (context: TurnContext, attachmentId: string, viewId: string): Promise<NodeJS.ReadableStream> {
    if (context === undefined) {
      throw new Error('context is required')
    }

    if (attachmentId === undefined) {
      throw new Error('attachmentId is required')
    }

    if (viewId === undefined) {
      throw new Error('viewId is required')
    }

    // BENBRO: this will require a breaking change to fix
    // as connectorClient will now bein turnContext
    return await context.turnState.get<ConnectorClient>(this.ConnectorClientKey).getAttachment(attachmentId, viewId)
  }
}
