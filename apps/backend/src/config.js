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
