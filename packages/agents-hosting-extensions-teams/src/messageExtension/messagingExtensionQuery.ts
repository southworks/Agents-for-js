/**
 * Copyright(c) Microsoft Corporation.All rights reserved.
 * Licensed under the MIT License.
 */

import { z } from 'zod'
import type { MessagingExtensionQuery } from '@microsoft/teams.api'

/**
 * Zod schema for validating MessagingExtensionParameter.
 */
export const messagingExtensionParameterZodSchema = z.object({
  name: z.string().min(1).optional(),
  value: z.any().optional()
})

/**
 * Zod schema for validating MessagingExtensionQueryOptions.
 */
export const messagingExtensionQueryOptionsZodSchema = z.object({
  skip: z.number().optional(),
  count: z.number().optional()
})

/**
 * Zod schema for validating MessagingExtensionQuery.
 * @ignore
 */
export const messagingExtensionQueryZodSchema = z.object({
  commandId: z.string().min(1).optional(),
  parameters: z.array(messagingExtensionParameterZodSchema).optional(),
  queryOptions: messagingExtensionQueryOptionsZodSchema.optional(),
  state: z.string().min(1).optional()
})

/**
 * Parses the given value as a messaging extension query.
 *
 * @param {unknown} value - The value to parse.
 * @returns {MessagingExtensionQuery} - The parsed messaging extension query.
 */
export function parseValueMessagingExtensionQuery (value: unknown): MessagingExtensionQuery {
  messagingExtensionQueryZodSchema.passthrough().parse(value)
  return value as MessagingExtensionQuery
}
