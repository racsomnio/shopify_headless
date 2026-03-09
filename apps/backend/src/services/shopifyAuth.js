/**
 * Shopify Admin API token — supports both static token and client credentials grant
 *
 * - If SHOPIFY_ADMIN_ACCESS_TOKEN is set: use it (legacy custom app / manual token).
 * - If SHOPIFY_CLIENT_ID + SHOPIFY_CLIENT_SECRET are set: exchange for a token
 *   at startup and refresh automatically before expiry (Dev Dashboard apps).
 *
 * Token endpoint: POST https://{shop}/admin/oauth/access_token
 * Response: { access_token, scope, expires_in } — expires_in is 86399 (24h).
 * Refresh when within 60 seconds of expiry.
 */

import { URLSearchParams } from 'node:url';
import { config } from '../config.js';

let cachedToken = null;
let tokenExpiresAt = 0;

/**
 * Request a new access token using client credentials grant
 */
async function fetchTokenWithClientCredentials() {
  const { shop, clientId, clientSecret } = config.shopify;

  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Token request failed: ${response.status} — ${text}`);
  }

  const { access_token, expires_in } = await response.json();
  return { access_token, expires_in: expires_in ?? 86399 };
}

/**
 * Returns a valid Admin API access token. Uses static token if configured,
 * otherwise fetches and caches a token via client credentials (refresh before expiry).
 * @returns {Promise<string>}
 */
export async function getAdminAccessToken() {
  const { adminAccessToken, clientId, clientSecret } = config.shopify;

  if (adminAccessToken) {
    return adminAccessToken;
  }

  if (!clientId || !clientSecret) {
    throw new Error(
      'Set either SHOPIFY_ADMIN_ACCESS_TOKEN or both SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET.'
    );
  }

  const refreshThresholdMs = 60_000;
  if (cachedToken && Date.now() < tokenExpiresAt - refreshThresholdMs) {
    return cachedToken;
  }

  const { access_token, expires_in } = await fetchTokenWithClientCredentials();
  cachedToken = access_token;
  tokenExpiresAt = Date.now() + expires_in * 1000;
  return cachedToken;
}

/**
 * Call at startup to warm the token cache and fail fast if credentials are wrong
 */
export async function ensureAdminToken() {
  const token = await getAdminAccessToken();
  if (token) {
    const mode = config.shopify.adminAccessToken ? 'static' : 'client credentials';
    console.log(`✅ Admin API token ready (${mode})`);
  }
  return token;
}
