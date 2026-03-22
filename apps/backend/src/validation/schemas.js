/**
 * Zod schemas for REST API input validation
 */

import { z } from 'zod';

const RMA_REASONS = z.enum([
  'defective',
  'wrong_item',
  'not_as_described',
  'changed_mind',
  'damaged_shipping',
]);

export const ordersListQuerySchema = z.object({
  first: z.coerce.number().int().min(1).max(250).optional().default(20),
  after: z.string().max(4096).optional(),
  query: z.string().max(2000).optional().default(''),
});

export const ordersLocalQuerySchema = z.object({
  status: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(50),
  offset: z.coerce.number().int().min(0).max(1_000_000).optional().default(0),
});

export const orderFulfillBodySchema = z.object({
  locationId: z.string().min(1).max(512),
  lineItems: z
    .array(
      z.object({
        id: z.string().min(1).max(512),
        quantity: z.number().int().positive().max(1_000_000),
      }),
    )
    .optional()
    .default([]),
  tracking: z
    .object({
      number: z.string().max(256).optional(),
      company: z.string().max(128).optional(),
      url: z.string().max(2048).optional(),
    })
    .optional()
    .default({}),
});

export const productsListQuerySchema = z.object({
  first: z.coerce.number().int().min(1).max(250).optional().default(12),
  after: z.string().max(4096).optional(),
});

export const adjustInventoryBodySchema = z.object({
  inventoryItemId: z.string().min(1).max(512),
  locationId: z.string().min(1).max(512),
  delta: z.coerce.number().int().min(-1_000_000).max(1_000_000),
});

export const rmaCreateBodySchema = z.object({
  shopifyOrderId: z.union([z.string().max(512), z.number()]),
  customerEmail: z.string().email().max(320).optional(),
  reason: RMA_REASONS,
  lineItems: z
    .array(
      z.object({
        lineItemId: z.string().min(1).max(512),
        quantity: z.number().int().positive().max(1_000_000),
        reason: z.string().max(2000).optional(),
      }),
    )
    .min(1),
  notes: z.string().max(10000).optional(),
});

export const rmaListQuerySchema = z.object({
  status: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(50),
  offset: z.coerce.number().int().min(0).max(1_000_000).optional().default(0),
});

export const rmaRejectBodySchema = z.object({
  reason: z.string().max(5000).optional().default(''),
});

/** Order / product path segments — numeric or full GID */
export const shopifyResourceIdParamSchema = z.object({
  id: z.string().min(1).max(512),
});

export const rmaNumericIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});
