/**
 * Products Routes
 *
 * Thin REST wrapper around the Shopify Admin API for product operations.
 * Demonstrates GraphQL pagination, inventory management, and filtering.
 */

import { Router } from 'express';
import {
  getProducts,
  getProductById,
  adjustInventory,
} from '../services/shopifyAdmin.js';

const router = Router();

/**
 * GET /api/products
 * List products from Shopify Admin API
 * ?first=10&after=<cursor>
 */
router.get('/', async (req, res) => {
  try {
    const { first = '12', after } = req.query;
    const products = await getProducts(parseInt(first), after || null);
    res.json(products);
  } catch (err) {
    console.error('GET /api/products error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/products/:id
 * Single product by GID or numeric ID
 */
router.get('/:id', async (req, res) => {
  try {
    let { id } = req.params;
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
});

/**
 * POST /api/products/:id/adjust-inventory
 * Adjust inventory level for a variant
 *
 * Body:
 * {
 *   "inventoryItemId": "gid://shopify/InventoryItem/...",
 *   "locationId": "gid://shopify/Location/...",
 *   "delta": -1
 * }
 */
router.post('/:id/adjust-inventory', async (req, res) => {
  try {
    const { inventoryItemId, locationId, delta } = req.body;

    if (!inventoryItemId || !locationId || delta === undefined) {
      return res.status(400).json({ error: 'inventoryItemId, locationId, and delta are required' });
    }

    const result = await adjustInventory(inventoryItemId, locationId, parseInt(delta));
    res.json(result);
  } catch (err) {
    console.error('POST /api/products/:id/adjust-inventory error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
