/**
 * Products Routes
 *
 * Thin REST wrapper around the Shopify Admin API for product operations.
 * Protected by BACKEND_API_KEY + Zod validation.
 */

import { Router } from 'express';
import {
  getProducts,
  getProductById,
  adjustInventory,
} from '../services/shopifyAdmin.js';
import { validateQuery, validateBody, validateParams } from '../middleware/validate.js';
import {
  productsListQuerySchema,
  adjustInventoryBodySchema,
  shopifyResourceIdParamSchema,
} from '../validation/schemas.js';

const router = Router();

/**
 * GET /api/products
 */
router.get(
  '/',
  validateQuery(productsListQuerySchema),
  async (req, res) => {
    try {
      const { first, after } = req.validatedQuery;
      const products = await getProducts(first, after || null);
      res.json(products);
    } catch (err) {
      console.error('GET /api/products error:', err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

/**
 * GET /api/products/:id
 */
router.get(
  '/:id',
  validateParams(shopifyResourceIdParamSchema),
  async (req, res) => {
    try {
      let { id } = req.validatedParams;
      if (!id.startsWith('gid://')) {
        id = `gid://shopify/Product/${id}`;
      }
      const product = await getProductById(id);
      if (!product) return res.status(404).json({ error: 'Product not found' });
      res.json(product);
    } catch (err) {
      console.error(`GET /api/products/${req.params.id} error:`, err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

/**
 * POST /api/products/:id/adjust-inventory
 */
router.post(
  '/:id/adjust-inventory',
  validateParams(shopifyResourceIdParamSchema),
  validateBody(adjustInventoryBodySchema),
  async (req, res) => {
    try {
      const { inventoryItemId, locationId, delta } = req.validatedBody;

      const result = await adjustInventory(inventoryItemId, locationId, delta);
      res.json(result);
    } catch (err) {
      console.error('POST /api/products/:id/adjust-inventory error:', err.message);
      res.status(500).json({ error: err.message });
    }
  },
);

export default router;
