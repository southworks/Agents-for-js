// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Client as GraphClient, type AuthenticationProvider, type ClientOptions } from '@microsoft/microsoft-graph-client'
import { AgentApplication, AgentExtension, TurnContext, TurnState } from '@microsoft/agents-hosting'
import { Client as TeamsClient } from '@microsoft/teams.api'
import { parseTeamsChannelData } from './activity-extensions'
import { TeamsConfig } from './config/config'
import { FileConsent } from './fileConsents/fileConsent'
import { Meeting } from './meetings/meeting'
import { Message } from './messages/message'
import { MessageExtension } from './messageExtensions/messageExtension'
import { TaskModule } from './taskModules/taskModule'
import { TeamsChannel } from './channels/teamsChannel'
import { TeamsTeam } from './teams/teamsTeam'
import { setTeamsApiClient } from './teamsApiClientExtensions'
import { applyTeamsHeaderPropagation } from './teamsHeaderPropagation'
import { TeamsTurnContext } from './teamsTurnContext'

const DEFAULT_GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0'

class GraphAuthenticationProvider implements AuthenticationProvider {
  constructor (
    private readonly app: AgentApplication<any>,
    private readonly context: TurnContext,
    private readonly handlerName?: string
  ) {}

  async getAccessToken (): Promise<string> {
    const handlerName = this.handlerName ?? this.getDefaultHandlerName()
    const { token } = await this.app.authorization.getToken(this.context, handlerName)

    if (!token?.trim()) {
      throw new Error(`Unable to acquire a Graph access token using authorization handler '${handlerName}'.`)
    }

    return token
  }

  private getDefaultHandlerName (): string {
    const authorization = this.app.authorization as unknown as {
      manager?: { handlers?: Array<{ id: string }> }
    }
    const handlerIds = authorization.manager?.handlers?.map((handler) => handler.id) ?? Object.keys(this.app.options.authorization ?? {})

    if (handlerIds.length === 1) {
      return handlerIds[0]
    }

    if (handlerIds.length === 0) {
      throw new Error('A Graph client requires at least one configured authorization handler.')
    }

    throw new Error('A Graph client requires handlerName when multiple authorization handlers are configured.')
  }
}

function createGraphClientOptions (authProvider: AuthenticationProvider, graphBaseUrl: string): ClientOptions {
  const options: ClientOptions = {
    authProvider,
    baseUrl: graphBaseUrl,
    defaultVersion: ''
  }
  const graphHost = getHost(graphBaseUrl)

  if (graphHost) {
    options.customHosts = new Set([graphHost])
  }

  return options
}

function getHost (url: string): string | undefined {
  try {
    return new URL(url).hostname
  } catch {
    return undefined
  }
}

export class TeamsAgentExtension<TState extends TurnState = TurnState> extends AgentExtension<TState> {
  private _app: AgentApplication<TState>
  private _meetings: Meeting<TState>
  private _messageExtensions: MessageExtension<TState>
  private _taskModules: TaskModule<TState>
  private _channels: TeamsChannel<TState>
  private _teams: TeamsTeam<TState>
  private _messages: Message<TState>
  private _fileConsent: FileConsent<TState>
  private _config: TeamsConfig<TState>

  constructor (app: AgentApplication<TState>) {
    super('msteams')
    this._app = app
    this._meetings = new Meeting(app)
    this._messageExtensions = new MessageExtension(app)
    this._taskModules = new TaskModule(app)
    this._channels = new TeamsChannel(app)
    this._teams = new TeamsTeam(app)
    this._messages = new Message(app)
    this._fileConsent = new FileConsent(app)
    this._config = new TeamsConfig(app)

    const headerPropagation = this._app.options.headerPropagation
    this._app.options.headerPropagation = (headers) => {
      headerPropagation?.(headers)
      applyTeamsHeaderPropagation(headers)
    }

    this._app.onTurn('beforeTurn', async (context) => {
      if (context.activity.channelId === this.channelId) {
        setTeamsApiClient(context, this.channelId)
        try {
          context.activity.channelData = parseTeamsChannelData(context.activity.channelData)
        } catch {
          // ignore parse errors for non-Teams channel data
        }
      }
      return true
    })
  }

  public get meetings (): Meeting<TState> {
    return this._meetings
  }

  public get messageExtensions (): MessageExtension<TState> {
    return this._messageExtensions
  }

  public get taskModules (): TaskModule<TState> {
    return this._taskModules
  }

  public get channels (): TeamsChannel<TState> {
    return this._channels
  }

  public get teams (): TeamsTeam<TState> {
    return this._teams
  }

  public get messages (): Message<TState> {
    return this._messages
  }

  public get fileConsent (): FileConsent<TState> {
    return this._fileConsent
  }

  public get config (): TeamsConfig<TState> {
    return this._config
  }

  public getTeamsClient (context: TurnContext): TeamsClient {
    return new TeamsTurnContext(context).client
  }

  public getGraphClient (context: TurnContext, handlerName?: string, graphBaseUrl: string = DEFAULT_GRAPH_BASE_URL): GraphClient {
    return GraphClient.initWithMiddleware(createGraphClientOptions(
      new GraphAuthenticationProvider(this._app, context, handlerName),
      graphBaseUrl
    ))
  }
}
