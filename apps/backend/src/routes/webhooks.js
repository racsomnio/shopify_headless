/**
 * Webhook Routes
 *
 * Shopify sends webhooks as POST requests with:
 *   - X-Shopify-Topic:           orders/create
 *   - X-Shopify-Hmac-Sha256:     base64 HMAC
 *   - X-Shopify-Shop-Domain:     oscarslab.myshopify.com
 *   - Content-Type:              application/json
 *
 * Each handler:
 *  1. Verifies HMAC (via middleware)
 *  2. Publishes event to the bus
 *  3. Returns 200 immediately (Shopify expects < 5s response)
 *
 * Shopify will retry failed webhooks for 48 hours.
 * Return 200 ASAP — do the heavy work asynchronously via the event bus.
 *
 * Register webhooks in Shopify Admin:
 *   Settings → Notifications → Webhooks
 *   Or via Admin API: webhookSubscriptionCreate mutation
 */

import { Router } from 'express';
import { verifyShopifyWebhook } from '../middleware/verifyWebhook.js';
import { eventBus } from '../services/eventBus.js';

const router = Router();

// All webhook routes verify HMAC first
router.use(verifyShopifyWebhook);

/**
 * Helper: handle any webhook by publishing to the event bus
 * Returns 200 immediately, bus handles processing async
 */
function webhookHandler(source, detailType) {
  return (req, res) => {
    const shop = req.headers['x-shopify-shop-domain'];
    const topic = req.headers['x-shopify-topic'];

    console.log(`🔔 Webhook received: ${topic} from ${shop}`);

    // Fire and forget — never await in a webhook handler
    setImmediate(() => {
      eventBus.publish(source, detailType, req.webhookBody);
    });

    // Always respond 200 fast
    res.status(200).json({ received: true });
  };
}

// ── Order Events ──────────────────────────────────────────────────────────────
router.post('/orders/create',    webhookHandler('shopify.webhook', 'orders/create'));
router.post('/orders/updated',   webhookHandler('shopify.webhook', 'orders/updated'));
router.post('/orders/paid',      webhookHandler('shopify.webhook', 'orders/paid'));
router.post('/orders/cancelled', webhookHandler('shopify.webhook', 'orders/cancelled'));
router.post('/orders/fulfilled', webhookHandler('shopify.webhook', 'orders/fulfilled'));

// ── Fulfillment Events ────────────────────────────────────────────────────────
router.post('/fulfillments/create', webhookHandler('shopify.webhook', 'fulfillments/create'));
router.post('/fulfillments/update', webhookHandler('shopify.webhook', 'fulfillments/update'));

// ── Refund Events ─────────────────────────────────────────────────────────────
router.post('/refunds/create', webhookHandler('shopify.webhook', 'refunds/create'));

// ── Inventory Events ──────────────────────────────────────────────────────────
router.post('/inventory_levels/update', webhookHandler('shopify.webhook', 'inventory_levels/update'));

// ── Customer Events ───────────────────────────────────────────────────────────
router.post('/customers/create', webhookHandler('shopify.webhook', 'customers/create'));
router.post('/customers/update', webhookHandler('shopify.webhook', 'customers/update'));

// ── App Uninstall (must always handle) ───────────────────────────────────────
router.post('/app/uninstalled', (req, res) => {
  const shop = req.headers['x-shopify-shop-domain'];
  console.warn(`⚠️  App uninstalled from: ${shop}`);
  // In production: revoke access token, clean up shop data (GDPR compliance)
  eventBus.publish('shopify.webhook', 'app/uninstalled', { shop });
  res.status(200).json({ received: true });
});

export default router;
