/**
 * RMA Routes
 *
 * Full CRUD + state machine endpoints for return merchandise authorizations.
 *
 * Flow:
 *   POST   /api/rma              → create (customer-facing or ops-facing)
 *   GET    /api/rma              → list all RMAs
 *   GET    /api/rma/:id          → single RMA detail
 *   POST   /api/rma/:id/approve  → ops approves the return
 *   POST   /api/rma/:id/reject   → ops rejects the return
 *   POST   /api/rma/:id/refund   → process Shopify refund (item received)
 *   POST   /api/rma/:id/close    → close the case
 */

import { Router } from 'express';
import {
  createRMA,
  approveRMA,
  rejectRMA,
  processRMARefund,
  closeRMA,
  getRMAById,
  listRMAs,
} from '../services/rmaService.js';

const router = Router();

/**
 * POST /api/rma
 * Create a new return request
 *
 * Body:
 * {
 *   "shopifyOrderId": "gid://shopify/Order/6789",   // or numeric "6789"
 *   "customerEmail": "rider@example.com",
 *   "reason": "defective",
 *   "lineItems": [
 *     {
 *       "lineItemId": "gid://shopify/LineItem/111",
 *       "quantity": 1,
 *       "reason": "Battery doesn't hold charge"
 *     }
 *   ],
 *   "notes": "Customer says item arrived with a cracked casing"
 * }
 */
router.post('/', async (req, res) => {
  try {
    const { shopifyOrderId, customerEmail, reason, lineItems, notes } = req.body;

    if (!shopifyOrderId || !reason || !lineItems?.length) {
      return res.status(400).json({
        error: 'shopifyOrderId, reason, and lineItems are required',
        validReasons: ['defective', 'wrong_item', 'not_as_described', 'changed_mind', 'damaged_shipping'],
      });
    }

    // Normalize to GID format
    const orderId = shopifyOrderId.startsWith('gid://')
      ? shopifyOrderId
      : `gid://shopify/Order/${shopifyOrderId}`;

    const rma = await createRMA({ shopifyOrderId: orderId, customerEmail, reason, lineItems, notes });
    res.status(201).json(rma);
  } catch (err) {
    console.error('POST /api/rma error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/rma
 * List all RMAs with optional status filter
 * ?status=pending|approved|refunded|closed|rejected
 */
router.get('/', (req, res) => {
  try {
    const { status, limit = '50', offset = '0' } = req.query;
    const rmas = listRMAs({ status, limit: parseInt(limit), offset: parseInt(offset) });

    const parsed = rmas.map(r => ({
      ...r,
      line_items: JSON.parse(r.line_items),
    }));

    res.json({ rmas: parsed, total: parsed.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/rma/:id
 */
router.get('/:id', (req, res) => {
  const rma = getRMAById(parseInt(req.params.id));
  if (!rma) return res.status(404).json({ error: 'RMA not found' });
  res.json({ ...rma, line_items: JSON.parse(rma.line_items) });
});

/**
 * POST /api/rma/:id/approve
 * Approve the return — calculates estimated refund from Shopify
 */
router.post('/:id/approve', async (req, res) => {
  try {
    const rma = await approveRMA(parseInt(req.params.id));
    res.json(rma);
  } catch (err) {
    console.error('POST /api/rma/:id/approve error:', err.message);
    const status = err.message.includes('not found') ? 404
                 : err.message.includes('cannot approve') ? 409
                 : 500;
    res.status(status).json({ error: err.message });
  }
});

/**
 * POST /api/rma/:id/reject
 * Body: { "reason": "Return window has passed" }
 */
router.post('/:id/reject', (req, res) => {
  try {
    const { reason = '' } = req.body;
    const rma = rejectRMA(parseInt(req.params.id), reason);
    res.json(rma);
  } catch (err) {
    const status = err.message.includes('not found') ? 404 : 409;
    res.status(status).json({ error: err.message });
  }
});

/**
 * POST /api/rma/:id/refund
 * Process the actual Shopify refund (call after item physically received)
 */
router.post('/:id/refund', async (req, res) => {
  try {
    const rma = await processRMARefund(parseInt(req.params.id));
    res.json(rma);
  } catch (err) {
    console.error('POST /api/rma/:id/refund error:', err.message);
    const status = err.message.includes('not found') ? 404
                 : err.message.includes('must be approved') ? 409
                 : 500;
    res.status(status).json({ error: err.message });
  }
});

/**
 * POST /api/rma/:id/close
 */
router.post('/:id/close', (req, res) => {
  try {
    const rma = closeRMA(parseInt(req.params.id));
    res.json(rma);
  } catch (err) {
    const status = err.message.includes('not found') ? 404 : 409;
    res.status(status).json({ error: err.message });
  }
});

export default router;
