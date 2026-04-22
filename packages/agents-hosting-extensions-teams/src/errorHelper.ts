// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import { AgentErrorDefinition } from '@microsoft/agents-activity'

/**
 * Error definitions for the Teams Extensions system.
 * This contains localized error codes for the Teams Extensions subsystem of the AgentSDK.
 *
 * Each error definition includes an error code (starting from -150000), a description, and a help link
 * pointing to an AKA link to get help for the given error.
 *
 * Usage example:
 * ```
 * throw ExceptionHelper.generateException(
 *   Error,
 *   Errors.ContextRequired
 * );
 * ```
 */
export const Errors: { [key: string]: AgentErrorDefinition } = {
  // TeamsInfo Errors (-150000 to -150006)
  /**
   * Error thrown when context is required but not provided.
   */
  ContextRequired: {
    code: -150000,
    description: 'context is required.'
  },

  /**
   * Error thrown when meetingId is required but not provided.
   */
  MeetingIdRequired: {
    code: -150001,
    description: 'meetingId is required.'
  },

  /**
   * Error thrown when participantId is required but not provided.
   */
  ParticipantIdRequired: {
    code: -150002,
    description: 'participantId is required.'
  },

  /**
   * Error thrown when teamId is required but not provided.
   */
  TeamIdRequired: {
    code: -150003,
    description: 'teamId is required.'
  },

  /**
   * Error thrown when TurnContext cannot be null.
   */
  TurnContextCannotBeNull: {
    code: -150004,
    description: 'TurnContext cannot be null'
  },

  /**
   * Error thrown when Activity cannot be null.
   */
  ActivityCannotBeNull: {
    code: -150005,
    description: 'Activity cannot be null'
  },

  /**
   * Error thrown when teamsChannelId cannot be null or empty.
   */
  TeamsChannelIdRequired: {
    code: -150006,
    description: 'The teamsChannelId cannot be null or empty'
  },

  // TaskModule Errors (-150007)
  /**
   * Error thrown when unexpected TaskModules.submit() is triggered.
   */
  UnexpectedTaskModuleSubmit: {
    code: -150007,
    description: 'Unexpected TaskModules.submit() triggered for activity type: {activityType}'
  },

  // TeamsActivityHandler Errors (-150008 to -150009)
  /**
   * Error thrown when method is not implemented.
   */
  NotImplemented: {
    code: -150008,
    description: 'NotImplemented'
  },

  /**
   * Error thrown for bad request.
   */
  BadRequest: {
    code: -150009,
    description: 'BadRequest'
  },

  // TeamsApiClient Errors (-150010)
  /**
   * Error thrown when the Teams SDK client is not available in the context.
   */
  TeamsApiClientNotAvailable: {
    code: -150010,
    description: 'Teams API client is not available in the context.'
  }
}
