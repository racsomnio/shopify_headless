import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Load .env from project root (monorepo) when cwd is apps/backend
const __dirname = dirname(fileURLToPath(import.meta.url));
const rootEnv = resolve(__dirname, '../../../.env');
loadEnv({ path: rootEnv });
loadEnv(); // also try cwd, for standalone usage

export const config = {
  shopify: {
    shop: process.env.SHOPIFY_SHOP || 'oscarslab.myshopify.com',
    adminAccessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN,
    clientId: process.env.SHOPIFY_CLIENT_ID,
    clientSecret: process.env.SHOPIFY_CLIENT_SECRET,
    storefrontToken: process.env.SHOPIFY_STOREFRONT_TOKEN,
    apiVersion: process.env.SHOPIFY_API_VERSION || '2026-01',
    webhookSecret: process.env.SHOPIFY_WEBHOOK_SECRET,
  },
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    /** Behind ngrok, ALB, nginx — required for correct client IP in rate limiting */
    trustProxy: process.env.TRUST_PROXY === 'true' || process.env.TRUST_PROXY === '1',
    /** Max JSON / raw body size (webhooks + REST) */
    bodyLimit: process.env.BODY_LIMIT || '1mb',
    /** Per-IP rate limit for /api/* only (webhooks excluded — Shopify retries) */
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 min
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    /**
     * Required in production — send as Authorization: Bearer <key> or X-API-Key: <key>
     * In development, if unset, /api/* is open (warning logged).
     */
    apiKey: process.env.BACKEND_API_KEY || '',
    /** Comma-separated allowed browser origins — e.g. dev + https://oscarslab.dev (production storefront) */
    corsOrigins: (process.env.CORS_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  },
  db: {
    url: process.env.DATABASE_URL || './data/also.db',
  },
};

// Validate: need either static Admin token or client credentials; always need Storefront for headless
const hasAdminAuth =
  process.env.SHOPIFY_ADMIN_ACCESS_TOKEN ||
  (process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET);
if (!hasAdminAuth) {
  console.warn('⚠️  Set SHOPIFY_ADMIN_ACCESS_TOKEN or both SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET.');
}
if (!process.env.SHOPIFY_STOREFRONT_TOKEN) {
  console.warn('⚠️  Missing SHOPIFY_STOREFRONT_TOKEN — storefront features will not work.');
}

export default config;
