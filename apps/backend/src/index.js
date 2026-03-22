/**
 * Shopify Practice Platform — Express Server Entry Point
 *
 * Security:
 *  - helmet: security headers; HSTS in production (HTTPS assumed)
 *  - cors: allowlisted origins (CORS_ORIGINS); include production storefront origin, e.g. https://oscarslab.dev
 *  - express-rate-limit: /api/* only
 *  - requireApiKey: BACKEND_API_KEY (required in production)
 *  - Body size limits; TRUST_PROXY for accurate rate-limit IP
 */

import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { requireApiKey } from './middleware/requireApiKey.js';

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

// ── Production guard ──────────────────────────────────────────────────────────
if (config.server.nodeEnv === 'production') {
  if (!config.server.apiKey) {
    console.error('FATAL: BACKEND_API_KEY is required when NODE_ENV=production');
    process.exit(1);
  }
  if (config.server.corsOrigins.length === 0) {
    console.warn(
      '⚠️  CORS_ORIGINS is empty in production. Set CORS_ORIGINS to include your storefront origin (e.g. https://oscarslab.dev). curl/Postman still work.',
    );
  }
}

const app = express();

// ── Trust proxy (ngrok, ALB, nginx) — must be early for rate-limit IP ─────────
if (config.server.trustProxy) {
  app.set('trust proxy', 1);
}

const isProd = config.server.nodeEnv === 'production';

// ── Security headers ───────────────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    ...(isProd
      ? {
          strictTransportSecurity: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
          },
        }
      : {}),
  }),
);

// ── CORS: allowlist in production; permissive in dev if CORS_ORIGINS unset ─────
app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }
      const allowed = config.server.corsOrigins;
      if (allowed.length === 0 && !isProd) {
        return callback(null, true);
      }
      if (allowed.includes(origin)) {
        return callback(null, true);
      }
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
    maxAge: 86400,
  }),
);

// ── Rate limit: REST API only ─────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: config.server.rateLimitWindowMs,
  max: config.server.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again later.' },
});
app.use('/api', apiLimiter);

// ── API authentication (Bearer or X-API-Key) ──────────────────────────────────
app.use('/api', requireApiKey);

const bodyLimit = config.server.bodyLimit;

// Webhooks: raw body for HMAC — must not go through express.json()
app.use(
  '/webhooks',
  express.raw({ type: 'application/json', limit: bodyLimit }),
);

const jsonParser = express.json({ limit: bodyLimit });
const urlencodedParser = express.urlencoded({ extended: true, limit: bodyLimit });

app.use((req, res, next) => {
  if (req.path.startsWith('/webhooks')) return next();
  return jsonParser(req, res, next);
});
app.use((req, res, next) => {
  if (req.path.startsWith('/webhooks')) return next();
  return urlencodedParser(req, res, next);
});

// Basic request logging in dev
if (config.server.nodeEnv === 'development') {
  app.use((req, _res, next) => {
    console.log(`→ ${req.method} ${req.path}`);
    next();
  });
}

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
      console.log(`   Env: ${config.server.nodeEnv}`);
      console.log(
        `   Rate limit: ${config.server.rateLimitMax} req / ${config.server.rateLimitWindowMs}ms per IP on /api/*`,
      );
      console.log(`   Trust proxy: ${config.server.trustProxy}`);
      console.log(`   API key: ${config.server.apiKey ? 'enabled (set BACKEND_API_KEY)' : 'disabled (dev — set BACKEND_API_KEY for auth)'}`);
      console.log(
        `   CORS: ${config.server.corsOrigins.length ? config.server.corsOrigins.join(', ') : isProd ? 'none (non-browser only)' : 'all origins (dev)'}\n`,
      );
    });
  })
  .catch((err) => {
    console.error('Failed to obtain Admin API token:', err.message);
    process.exitCode = 1;
  });

export default app;
