// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { Activity, ExceptionHelper } from '@microsoft/agents-activity'
import { ResourceResponse, TurnContext } from '@microsoft/agents-hosting'
import { Client as TeamsClient } from '@microsoft/teams.api'
import { Errors } from './errorHelper'
import { TeamsClientKey } from './teamsApiClientExtensions'

/**
 * Turn context wrapper that exposes Teams-specific helpers for a Teams activity turn.
 */
export class TeamsTurnContext extends TurnContext {
  /**
   * Gets the Teams API client for the current turn.
   *
   * @returns The Teams API client configured for the activity's service URL.
   * @throws If the Teams API client is not available in turn state.
   */
  get client (): TeamsClient {
    const teamsClient = this.turnState.get<TeamsClient>(TeamsClientKey)
    if (!teamsClient) {
      throw ExceptionHelper.generateException(Error, Errors.TeamsApiClientNotAvailable)
    }
    return teamsClient
  }

  /**
   * Sends a cloned copy of an activity as a Teams targeted activity.
   *
   * @param activity - The activity to send to the targeted recipient.
   * @returns The resource response for the sent activity, if provided by the adapter.
   */
  async sendTargetedActivity (activity: Activity): Promise<ResourceResponse | undefined> {
    const targetedActivity = Activity.fromObject(activity)
    targetedActivity.makeTargetedActivity()
    return await this.sendActivity(targetedActivity)
  }

  /**
   * Sends cloned copies of activities as Teams targeted activities.
   *
   * @param activities - The activities to send to targeted recipients.
   * @returns Resource responses for the sent activities.
   */
  async sendTargetedActivities (activities: Activity[]): Promise<ResourceResponse[]> {
    const targetedActivities = activities.map((activity) => {
      const targetedActivity = Activity.fromObject(activity)
      targetedActivity.makeTargetedActivity()
      return targetedActivity
    })
    return await this.sendActivities(targetedActivities)
  }
}
