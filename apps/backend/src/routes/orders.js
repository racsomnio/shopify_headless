/**
 * Orders Routes
 *
 * REST API around the Shopify Admin API for order management.
 * In a real app these would be protected by session/API key auth.
 *
 * Demonstrates:
 *   - Fetching orders via Admin GraphQL
 *   - Creating fulfillments
 *   - Syncing local DB with Shopify source of truth
 */

import { Router } from 'express';
import {
  getOrders,
  getOrderById,
  createFulfillment,
} from '../services/shopifyAdmin.js';
import db from '../db/client.js';

const router = Router();

/**
 * GET /api/orders
 * List orders (from Shopify Admin API, with local enrichment)
 *
 * Query params:
 *   ?first=20         - page size
 *   ?after=<cursor>   - pagination cursor
 *   ?query=status:open - Shopify order query filter
 */
router.get('/', async (req, res) => {
  try {
    const { first = '20', after, query = '' } = req.query;
    const orders = await getOrders(parseInt(first), query);
    res.json(orders);
  } catch (err) {
    console.error('GET /api/orders error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/orders/local
 * Orders from local DB (fast, no Shopify API call)
 */
router.get('/local', (req, res) => {
  try {
    const { status, limit = '50', offset = '0' } = req.query;
    let rows;
    if (status) {
      rows = db.prepare(`
        SELECT * FROM orders WHERE financial_status = ?
        ORDER BY created_at DESC LIMIT ? OFFSET ?
      `).all(status, parseInt(limit), parseInt(offset));
    } else {
      rows = db.prepare(`
        SELECT * FROM orders ORDER BY created_at DESC LIMIT ? OFFSET ?
      `).all(parseInt(limit), parseInt(offset));
    }

    // Parse JSON columns
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
});

/**
 * GET /api/orders/:id
 * Single order from Shopify Admin API (full detail)
 *
 * :id can be numeric Shopify ID or full GID
 */
router.get('/:id', async (req, res) => {
  try {
    let { id } = req.params;
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
});

/**
 * POST /api/orders/:id/fulfill
 * Create a fulfillment for an order
 *
 * Body:
 * {
 *   locationId: "gid://shopify/Location/123",
 *   lineItems: [{ id: "gid://shopify/LineItem/456", quantity: 1 }],
 *   tracking: { number: "1Z...", company: "UPS", url: "https://..." }
 * }
 */
router.post('/:id/fulfill', async (req, res) => {
  try {
    let { id } = req.params;
    if (!id.startsWith('gid://')) {
      id = `gid://shopify/Order/${id}`;
    }

    const { locationId, lineItems, tracking = {} } = req.body;
    if (!locationId) return res.status(400).json({ error: 'locationId is required' });

    const fulfillment = await createFulfillment(id, locationId, lineItems || [], tracking);
    res.json(fulfillment);
  } catch (err) {
    console.error('POST /api/orders/:id/fulfill error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/orders/:id/rmas
 * List RMAs associated with an order
 */
router.get('/:id/rmas', (req, res) => {
  try {
    let { id } = req.params;
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
});

export default router;
