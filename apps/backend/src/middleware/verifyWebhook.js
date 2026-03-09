/**
 * Shopify Webhook HMAC Verification Middleware
 *
 * Shopify signs every webhook with HMAC-SHA256 using your webhook secret.
 * We MUST verify this before processing any payload — prevents spoofed requests.
 *
 * How it works:
 *  1. Shopify sends: X-Shopify-Hmac-Sha256 header (base64-encoded HMAC)
 *  2. We compute HMAC of the raw body using the shared secret
 *  3. Compare with timing-safe comparison (prevents timing attacks)
 *
 * IMPORTANT: Express must receive the raw body buffer, not parsed JSON.
 *   That's why `/webhooks` routes use `express.raw()` in index.js.
 */

import crypto from 'crypto';
import { config } from '../config.js';

export function verifyShopifyWebhook(req, res, next) {
  const hmacHeader = req.headers['x-shopify-hmac-sha256'];

  if (!hmacHeader) {
    console.warn('🚨 Webhook received without HMAC header');
    return res.status(401).json({ error: 'Missing HMAC header' });
  }

  const rawBody = req.body; // Buffer (because of express.raw middleware)

  if (!Buffer.isBuffer(rawBody)) {
    console.error('🚨 Webhook body is not a Buffer — check express.raw() is mounted before express.json()');
    return res.status(500).json({ error: 'Internal configuration error' });
  }

  const secret = config.shopify.webhookSecret;

  if (!secret) {
    // In dev without a secret configured, log and pass through
    console.warn('⚠️  SHOPIFY_WEBHOOK_SECRET not set — skipping HMAC verification');
    req.webhookBody = JSON.parse(rawBody.toString('utf-8'));
    return next();
  }

  const digest = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('base64');

  // Timing-safe comparison prevents timing attacks
  const digestBuf = Buffer.from(digest);
  const hmacBuf   = Buffer.from(hmacHeader);

  if (digestBuf.length !== hmacBuf.length || !crypto.timingSafeEqual(digestBuf, hmacBuf)) {
    console.warn(`🚨 Webhook HMAC mismatch — possible spoofed request from ${req.ip}`);
    return res.status(401).json({ error: 'HMAC verification failed' });
  }

  // Parse body and attach for downstream route handlers
  req.webhookBody = JSON.parse(rawBody.toString('utf-8'));
  next();
}
