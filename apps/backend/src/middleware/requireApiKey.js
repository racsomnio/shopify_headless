/**
 * Require a shared secret for all /api/* routes (not webhooks).
 *
 * Clients send: Authorization: Bearer <BACKEND_API_KEY>  OR  X-API-Key: <BACKEND_API_KEY>
 *
 * Development: if BACKEND_API_KEY is unset, requests are allowed (warning once).
 * Production: BACKEND_API_KEY must be set or the server refuses to start.
 */

import crypto from 'crypto';
import { config } from '../config.js';

let warnedDevOpen = false;

function timingSafeEqualString(a, b) {
  const bufA = Buffer.from(String(a ?? ''), 'utf8');
  const bufB = Buffer.from(String(b ?? ''), 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function requireApiKey(req, res, next) {
  // CORS preflight — no auth header yet
  if (req.method === 'OPTIONS') {
    return next();
  }

  const expected = config.server.apiKey;

  if (!expected) {
    if (config.server.nodeEnv === 'production') {
      return res.status(503).json({ error: 'Server misconfigured: BACKEND_API_KEY is required' });
    }
    if (!warnedDevOpen) {
      console.warn(
        '⚠️  BACKEND_API_KEY not set — /api/* is open to any client (dev only). Set BACKEND_API_KEY for production-like auth.',
      );
      warnedDevOpen = true;
    }
    return next();
  }

  const auth = req.headers.authorization;
  const bearer = auth?.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  const headerKey = req.headers['x-api-key'];
  const provided = bearer || (typeof headerKey === 'string' ? headerKey : null);

  if (!provided || !timingSafeEqualString(provided, expected)) {
    return res.status(401).json({ error: 'Unauthorized', hint: 'Send Authorization: Bearer <key> or X-API-Key' });
  }

  next();
}
