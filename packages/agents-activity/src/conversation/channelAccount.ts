/**
 * Copyright(c) Microsoft Corporation.All rights reserved.
 * Licensed under the MIT License.
 */

import { z } from 'zod'
import { roleTypeZodSchema, RoleTypes } from './roleTypes'

/**
 * Represents a channel account.
 */
export interface ChannelAccount {
  /**
   * The unique identifier of the channel account.
   */
  id?: string

  /**
   * The name of the channel account.
   */
  name?: string

  /**
   * The Azure Active Directory object ID of the channel account.
   */
  aadObjectId?: string

  /**
   * The role of the channel account.
   */
  role?: RoleTypes | string

  /**
   * Additional properties of the channel account.
   */
  properties?: unknown
}

/**
 * Zod schema for validating a channel account.
 */
export const channelAccountZodSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().optional(),
  aadObjectId: z.string().min(1).optional(),
  role: z.union([roleTypeZodSchema, z.string().min(1)]).optional(),
  properties: z.unknown().optional()
})
