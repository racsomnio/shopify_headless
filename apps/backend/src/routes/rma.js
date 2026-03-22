/**
 * RMA Routes
 *
 * Full CRUD + state machine endpoints for return merchandise authorizations.
 * Protected by BACKEND_API_KEY + Zod validation.
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
import { validateQuery, validateBody, validateParams } from '../middleware/validate.js';
import {
  rmaCreateBodySchema,
  rmaListQuerySchema,
  rmaRejectBodySchema,
  rmaNumericIdParamSchema,
} from '../validation/schemas.js';

const router = Router();

/**
 * POST /api/rma
 */
router.post(
  '/',
  validateBody(rmaCreateBodySchema),
  async (req, res) => {
    try {
      const { shopifyOrderId, customerEmail, reason, lineItems, notes } = req.validatedBody;

      const orderId = String(shopifyOrderId).startsWith('gid://')
        ? String(shopifyOrderId)
        : `gid://shopify/Order/${shopifyOrderId}`;

      const rma = await createRMA({ shopifyOrderId: orderId, customerEmail, reason, lineItems, notes });
      res.status(201).json(rma);
    } catch (err) {
      console.error('POST /api/rma error:', err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

/**
 * GET /api/rma
 */
router.get(
  '/',
  validateQuery(rmaListQuerySchema),
  (req, res) => {
    try {
      const { status, limit, offset } = req.validatedQuery;
      const rmas = listRMAs({ status, limit, offset });

      const parsed = rmas.map(r => ({
        ...r,
        line_items: JSON.parse(r.line_items),
      }));

      res.json({ rmas: parsed, total: parsed.length });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

/**
 * GET /api/rma/:id
 */
router.get(
  '/:id',
  validateParams(rmaNumericIdParamSchema),
  (req, res) => {
    const { id } = req.validatedParams;
    const rma = getRMAById(id);
    if (!rma) return res.status(404).json({ error: 'RMA not found' });
    res.json({ ...rma, line_items: JSON.parse(rma.line_items) });
  },
);

/**
 * POST /api/rma/:id/approve
 */
router.post(
  '/:id/approve',
  validateParams(rmaNumericIdParamSchema),
  async (req, res) => {
    try {
      const { id } = req.validatedParams;
      const rma = await approveRMA(id);
      res.json(rma);
    } catch (err) {
      console.error('POST /api/rma/:id/approve error:', err.message);
      const status = err.message.includes('not found') ? 404
        : err.message.includes('cannot approve') ? 409
          : 500;
      res.status(status).json({ error: err.message });
    }
  },
);

/**
 * POST /api/rma/:id/reject
 */
router.post(
  '/:id/reject',
  validateParams(rmaNumericIdParamSchema),
  validateBody(rmaRejectBodySchema),
  (req, res) => {
    try {
      const { id } = req.validatedParams;
      const { reason: rejectReason } = req.validatedBody;
      const rma = rejectRMA(id, rejectReason);
      res.json(rma);
    } catch (err) {
      const status = err.message.includes('not found') ? 404 : 409;
      res.status(status).json({ error: err.message });
    }
  },
);

/**
 * POST /api/rma/:id/refund
 */
router.post(
  '/:id/refund',
  validateParams(rmaNumericIdParamSchema),
  async (req, res) => {
    try {
      const { id } = req.validatedParams;
      const rma = await processRMARefund(id);
      res.json(rma);
    } catch (err) {
      console.error('POST /api/rma/:id/refund error:', err.message);
      const status = err.message.includes('not found') ? 404
        : err.message.includes('must be approved') ? 409
          : 500;
      res.status(status).json({ error: err.message });
    }
  },
);

/**
 * POST /api/rma/:id/close
 */
router.post(
  '/:id/close',
  validateParams(rmaNumericIdParamSchema),
  (req, res) => {
    try {
      const { id } = req.validatedParams;
      const rma = closeRMA(id);
      res.json(rma);
    } catch (err) {
      const status = err.message.includes('not found') ? 404 : 409;
      res.status(status).json({ error: err.message });
    }
  },
);

export default router;
