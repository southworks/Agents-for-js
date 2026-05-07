// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { AgentApplication, AgentExtension, TurnState } from '@microsoft/agents-hosting'
import { parseTeamsChannelData } from './activity-extensions'
import { Configuration } from './configurations/configuration'
import { FileConsent } from './fileConsents/fileConsent'
import { Meeting } from './meetings/meeting'
import { Message } from './messages/message'
import { MessageExtension } from './messageExtensions/messageExtension'
import { TaskModule } from './taskModules/taskModule'
import { TeamsChannel } from './channels/teamsChannel'
import { TeamsTeam } from './teams/teamsTeam'
import { Client as TeamsClient } from '@microsoft/teams.api'
import { getTeamsClient, setTeamsApiClient, TeamsApiClientKey } from './teamsApiClient'

export class TeamsAgentExtension<TState extends TurnState = TurnState> extends AgentExtension<TState> {
  static readonly TeamsApiClientKey = TeamsApiClientKey

  private _app: AgentApplication<TState>
  private _meetings: Meeting<TState>
  private _messageExtensions: MessageExtension<TState>
  private _taskModules: TaskModule<TState>
  private _channels: TeamsChannel<TState>
  private _teams: TeamsTeam<TState>
  private _messages: Message<TState>
  private _fileConsents: FileConsent<TState>
  private _configurations: Configuration<TState>

  constructor (app: AgentApplication<TState>) {
    super('msteams')
    this._app = app
    this._meetings = new Meeting(app)
    this._messageExtensions = new MessageExtension(app)
    this._taskModules = new TaskModule(app)
    this._channels = new TeamsChannel(app)
    this._teams = new TeamsTeam(app)
    this._messages = new Message(app)
    this._fileConsents = new FileConsent(app)
    this._configurations = new Configuration(app)
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

  public get fileConsents (): FileConsent<TState> {
    return this._fileConsents
  }

  public get configurations (): Configuration<TState> {
    return this._configurations
  }

  public static getTeamsClient (context: import('@microsoft/agents-hosting').TurnContext): TeamsClient {
    return getTeamsClient(context)
  }
}
