/**
 * Shopify Practice Platform — Express Server Entry Point
 *
 * Start order:
 *  1. Load config + DB (sync)
 *  2. Register event bus handlers
 *  3. Mount routes
 *  4. Start listening
 */

import 'dotenv/config';
import express from 'express';
import { config } from './config.js';

// Side-effect: connects DB and runs schema migrations
import './db/client.js';

// Routes
import webhookRoutes  from './routes/webhooks.js';
import orderRoutes    from './routes/orders.js';
import rmaRoutes      from './routes/rma.js';
import productRoutes  from './routes/products.js';

// Services
import { eventBus }        from './services/eventBus.js';
import { OrderProcessor }  from './services/orderProcessor.js';
import { ensureAdminToken } from './services/shopifyAuth.js';

const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────────

// Parse raw body BEFORE json middleware for webhook HMAC verification
app.use('/webhooks', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic request logging in dev
if (config.server.nodeEnv === 'development') {
  app.use((req, _res, next) => {
    console.log(`→ ${req.method} ${req.path}`);
    next();
  });
}

// CORS for local storefront dev
app.use((_req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE');
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/webhooks', webhookRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/rma', rmaRoutes);
app.use('/api/products', productRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── Event Bus: register processors ────────────────────────────────────────────
OrderProcessor.registerHandlers(eventBus);

// ── Start server (warm Admin token if using client credentials) ────────────────
ensureAdminToken()
  .then(() => {
    app.listen(config.server.port, () => {
      console.log(`\n✅ Backend running → http://localhost:${config.server.port}`);
      console.log(`   Shop: ${config.shopify.shop}`);
      console.log(`   API version: ${config.shopify.apiVersion}`);
      console.log(`   Env: ${config.server.nodeEnv}\n`);
    });
  })
  .catch((err) => {
    console.error('Failed to obtain Admin API token:', err.message);
    process.exitCode = 1;
  });

export default app;
