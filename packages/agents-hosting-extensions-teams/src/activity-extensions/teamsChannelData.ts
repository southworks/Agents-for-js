/**
 * Copyright(c) Microsoft Corporation.All rights reserved.
 * Licensed under the MIT License.
 */

import { z } from 'zod'
import type { ChannelData } from '@microsoft/teams.api'

const channelInfoZodSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  type: z.enum(['standard', 'private', 'shared']).optional()
})

const teamInfoZodSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  aadGroupId: z.string().optional(),
  tenantId: z.string().optional()
})

const tenantInfoZodSchema = z.object({
  id: z.string()
})

const notificationInfoZodSchema = z.object({
  alert: z.boolean().optional(),
  alertInMeeting: z.boolean().optional(),
  externalResourceUrl: z.string().optional()
})

const onBehalfOfZodSchema = z.object({
  itemid: z.number(),
  mentionType: z.string(),
  mri: z.string(),
  displayName: z.string().optional()
})

const channelDataSettingsZodSchema = z.object({
  selectedChannel: channelInfoZodSchema
}).passthrough()

const meetingInfoZodSchema = z.object({
  id: z.string().optional()
}).passthrough()

const membershipSourceTypeZodSchema = z.enum(['channel', 'team'])
const membershipTypeZodSchema = z.enum(['direct', 'transitive'])
const membershipSourceZodSchema = z.object({
  sourceType: membershipSourceTypeZodSchema,
  id: z.string().min(1),
  name: z.string().optional(),
  membershipType: membershipTypeZodSchema,
  aadGroupId: z.string().min(1).optional(),
  tenantId: z.string().min(1).optional()
})

/**
 * Zod schema for validating Teams channel data objects.
 */
export const teamsChannelDataZodSchema = z.object({
  channel: channelInfoZodSchema.optional(),
  eventType: z.unknown().optional(),
  team: teamInfoZodSchema.optional(),
  notification: notificationInfoZodSchema.optional(),
  tenant: tenantInfoZodSchema.optional(),
  meeting: meetingInfoZodSchema.optional(),
  settings: channelDataSettingsZodSchema.optional(),
  onBehalfOf: z.array(onBehalfOfZodSchema).optional(),
  sharedWithTeams: z.array(teamInfoZodSchema).optional(),
  unsharedFromTeams: z.array(teamInfoZodSchema).optional(),
  membershipSource: membershipSourceZodSchema.optional()
})

/**
 * Parses the given object as Teams ChannelData.
 *
 * @param {object} o - The object to parse.
 * @returns {ChannelData} - The parsed ChannelData.
 */
export function parseTeamsChannelData (o: object): ChannelData {
  return teamsChannelDataZodSchema.passthrough().parse(o) as ChannelData
}
