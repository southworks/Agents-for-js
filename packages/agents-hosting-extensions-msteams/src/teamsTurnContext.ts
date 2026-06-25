// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Activity, ExceptionHelper } from '@microsoft/agents-activity'
import { ResourceResponse, TurnContext } from '@microsoft/agents-hosting'
import { Client as TeamsClient } from '@microsoft/teams.api'
import { Errors } from './errorHelper'
import { TeamsClientKey } from './teamsApiClientExtensions'

export class TeamsTurnContext extends TurnContext {
  get client (): TeamsClient {
    const teamsClient = this.turnState.get<TeamsClient>(TeamsClientKey)
    if (!teamsClient) {
      throw ExceptionHelper.generateException(Error, Errors.TeamsApiClientNotAvailable)
    }
    return teamsClient
  }

  async sendTargetedActivity (activity: Activity): Promise<ResourceResponse | undefined> {
    const targetedActivity = Activity.fromObject(activity)
    targetedActivity.makeTargetedActivity()
    return await this.sendActivity(targetedActivity)
  }

  async sendTargetedActivities (activities: Activity[]): Promise<ResourceResponse[]> {
    const targetedActivities = activities.map((activity) => {
      const targetedActivity = Activity.fromObject(activity)
      targetedActivity.makeTargetedActivity()
      return targetedActivity
    })
    return await this.sendActivities(targetedActivities)
  }
}
