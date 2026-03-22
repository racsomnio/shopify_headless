/**
 * Orders Routes
 *
 * REST API around the Shopify Admin API for order management.
 * Protected by BACKEND_API_KEY (see index.js) + Zod validation.
 */

import { Router } from 'express';
import {
  getOrders,
  getOrderById,
  createFulfillment,
} from '../services/shopifyAdmin.js';
import db from '../db/client.js';
import { validateQuery, validateBody, validateParams } from '../middleware/validate.js';
import {
  ordersListQuerySchema,
  ordersLocalQuerySchema,
  orderFulfillBodySchema,
  shopifyResourceIdParamSchema,
} from '../validation/schemas.js';

const router = Router();

/**
 * GET /api/orders
 */
router.get(
  '/',
  validateQuery(ordersListQuerySchema),
  async (req, res) => {
    try {
      const { first, after, query } = req.validatedQuery;
      const orders = await getOrders(first, query);
      res.json(orders);
    } catch (err) {
      console.error('GET /api/orders error:', err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

/**
 * GET /api/orders/local
 */
router.get(
  '/local',
  validateQuery(ordersLocalQuerySchema),
  (req, res) => {
    try {
      const { status, limit, offset } = req.validatedQuery;
      let rows;
      if (status) {
        rows = db.prepare(`
        SELECT * FROM orders WHERE financial_status = ?
        ORDER BY created_at DESC LIMIT ? OFFSET ?
      `).all(status, limit, offset);
      } else {
        rows = db.prepare(`
        SELECT * FROM orders ORDER BY created_at DESC LIMIT ? OFFSET ?
      `).all(limit, offset);
      }

      const orders = rows.map(o => ({
        ...o,
        line_items: JSON.parse(o.line_items),
        shipping_address: JSON.parse(o.shipping_address),
        tags: JSON.parse(o.tags || '[]'),
      }));

      res.json({ orders, total: orders.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

/**
 * GET /api/orders/:id
 */
router.get(
  '/:id',
  validateParams(shopifyResourceIdParamSchema),
  async (req, res) => {
    try {
      let { id } = req.validatedParams;
      if (!id.startsWith('gid://')) {
        id = `gid://shopify/Order/${id}`;
      }
      const order = await getOrderById(id);
      if (!order) return res.status(404).json({ error: 'Order not found' });
      res.json(order);
    } catch (err) {
      console.error(`GET /api/orders/${req.params.id} error:`, err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

/**
 * POST /api/orders/:id/fulfill
 */
router.post(
  '/:id/fulfill',
  validateParams(shopifyResourceIdParamSchema),
  validateBody(orderFulfillBodySchema),
  async (req, res) => {
    try {
      let { id } = req.validatedParams;
      if (!id.startsWith('gid://')) {
        id = `gid://shopify/Order/${id}`;
      }

      const { locationId, lineItems, tracking } = req.validatedBody;

      const fulfillment = await createFulfillment(id, locationId, lineItems || [], tracking);
      res.json(fulfillment);
    } catch (err) {
      console.error('POST /api/orders/:id/fulfill error:', err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

/**
 * GET /api/orders/:id/rmas
 */
router.get(
  '/:id/rmas',
  validateParams(shopifyResourceIdParamSchema),
  (req, res) => {
    try {
      let { id } = req.validatedParams;
      if (!id.startsWith('gid://')) {
        id = `gid://shopify/Order/${id}`;
      }

      const rmas = db.prepare(`
      SELECT * FROM rma_requests WHERE shopify_order_id = ?
      ORDER BY created_at DESC
    `).all(id);

      res.json(rmas.map(r => ({ ...r, line_items: JSON.parse(r.line_items) })));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

export default router;
