// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { ExceptionHelper } from '@microsoft/agents-activity'
import { ConnectorClient, TurnContext } from '@microsoft/agents-hosting'
import { Client as TeamsClient } from '@microsoft/teams.api'
import { Errors } from './errorHelper'

export const TeamsClientKey = Symbol('TeamsClient')

export function setTeamsApiClient (context: TurnContext, channelId: string = 'msteams'): void {
  if (context.activity.channelId !== channelId || context.turnState.has(TeamsClientKey)) {
    return
  }

  const connectorClient = context.turnState.get<ConnectorClient>(context.adapter.ConnectorClientKey)
  const serviceUrl = context.activity.serviceUrl ?? connectorClient?.httpClient.baseURL

  if (!connectorClient) {
    throw ExceptionHelper.generateException(Error, Errors.TeamsApiClientSetupFailed, undefined, { missing: 'ConnectorClient in turnState' })
  }

  if (!serviceUrl) {
    throw ExceptionHelper.generateException(Error, Errors.TeamsApiClientSetupFailed, undefined, { missing: 'activity.serviceUrl and ConnectorClient baseURL' })
  }

  context.turnState.set(
    TeamsClientKey,
    new TeamsClient(serviceUrl, {
      headers: getClientHeaders(connectorClient)
    })
  )
}

function getClientHeaders (connectorClient: ConnectorClient): Record<string, string> {
  return { ...connectorClient.httpClient.defaultHeaders }
}
