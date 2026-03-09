/**
 * Shopify Customer Account API — Auth Client
 *
 * Implements the same OAuth 2.0 + PKCE flow that Hydrogen's
 * createCustomerAccountClient uses, adapted for a plain React SPA.
 *
 * Key 2026 pattern: use discovery endpoints (/.well-known/) to resolve
 * auth + API URLs dynamically instead of hardcoding shop IDs.
 *
 * Token storage: sessionStorage — cleared when the browser tab closes.
 * In production you'd proxy token exchange through your backend and use
 * httpOnly cookies, but sessionStorage is fine for a public (SPA) client.
 */

import { generateCodeVerifier, generateCodeChallenge, generateState } from './pkce.js';

const SHOP = import.meta.env.VITE_SHOPIFY_SHOP || 'oscarslab.myshopify.com';
const CLIENT_ID = import.meta.env.VITE_SHOPIFY_CUSTOMER_CLIENT_ID || '';

// In development, Shopify requires HTTPS — set this to your ngrok/tunnel URL.
// In production, leave it unset and window.location.origin is used automatically.
const REDIRECT_BASE = import.meta.env.VITE_SHOPIFY_REDIRECT_BASE || '';

const KEYS = {
  verifier:    'ca_pkce_verifier',
  state:       'ca_pkce_state',
  accessToken: 'ca_access_token',
  expiresAt:   'ca_expires_at',
};

function getRedirectUri() {
  const base = REDIRECT_BASE || window.location.origin;
  return `${base}/auth/callback`;
}

// ── Discovery ───────────────────────────────────────────────────────────────
// Cache responses for the lifetime of the page — endpoints don't change.
let _openidConfig = null;
let _customerApiConfig = null;

export async function getOpenidConfig() {
  if (_openidConfig) return _openidConfig;
  const res = await fetch(`https://${SHOP}/.well-known/openid-configuration`);
  if (!res.ok) throw new Error(`OpenID discovery failed (${res.status})`);
  _openidConfig = await res.json();
  return _openidConfig;
}

export async function getCustomerApiConfig() {
  if (_customerApiConfig) return _customerApiConfig;
  const res = await fetch(`https://${SHOP}/.well-known/customer-account-api`);
  if (!res.ok) throw new Error(`Customer API discovery failed (${res.status})`);
  _customerApiConfig = await res.json();
  return _customerApiConfig;
}

// ── Login ────────────────────────────────────────────────────────────────────

export async function login() {
  if (!CLIENT_ID) {
    throw new Error(
      'VITE_SHOPIFY_CUSTOMER_CLIENT_ID is not set. ' +
      'Get it from: Shopify Admin → Sales Channels → Headless → Customer Account API.'
    );
  }

  const verifier   = generateCodeVerifier();
  const challenge  = await generateCodeChallenge(verifier);
  const state      = generateState();

  // Persist PKCE material so the callback page can retrieve it after redirect
  sessionStorage.setItem(KEYS.verifier, verifier);
  sessionStorage.setItem(KEYS.state,    state);

  const { authorization_endpoint } = await getOpenidConfig();

  const url = new URL(authorization_endpoint);
  url.searchParams.set('client_id',             CLIENT_ID);
  url.searchParams.set('response_type',         'code');
  url.searchParams.set('redirect_uri',          getRedirectUri());
  url.searchParams.set('scope',                 'openid email customer-account-api:full');
  url.searchParams.set('state',                 state);
  url.searchParams.set('code_challenge',        challenge);
  url.searchParams.set('code_challenge_method', 'S256');

  window.location.assign(url.toString());
}

// ── Callback (exchange code → token) ────────────────────────────────────────

export async function handleCallback() {
  const params        = new URLSearchParams(window.location.search);
  const code          = params.get('code');
  const returnedState = params.get('state');

  if (!code || !returnedState) throw new Error('Missing code or state in callback URL');

  const savedState = sessionStorage.getItem(KEYS.state);
  const verifier   = sessionStorage.getItem(KEYS.verifier);

  if (returnedState !== savedState) throw new Error('State mismatch — possible CSRF attack');
  if (!verifier)                    throw new Error('Code verifier missing from session');

  const { token_endpoint } = await getOpenidConfig();

  const res = await fetch(token_endpoint, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type:    'authorization_code',
      client_id:     CLIENT_ID,
      redirect_uri:  getRedirectUri(),
      code,
      code_verifier: verifier,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  const { access_token, expires_in } = await res.json();

  sessionStorage.setItem(KEYS.accessToken, access_token);
  sessionStorage.setItem(KEYS.expiresAt,   String(Date.now() + expires_in * 1000));

  // Clean up temporary PKCE material
  sessionStorage.removeItem(KEYS.verifier);
  sessionStorage.removeItem(KEYS.state);

  return access_token;
}

// ── Token access ─────────────────────────────────────────────────────────────

export function getAccessToken() {
  const token     = sessionStorage.getItem(KEYS.accessToken);
  const expiresAt = Number(sessionStorage.getItem(KEYS.expiresAt) || 0);
  if (!token || Date.now() >= expiresAt) return null;
  return token;
}

export function isAuthenticated() {
  return Boolean(getAccessToken());
}

// ── Logout ───────────────────────────────────────────────────────────────────

export async function logout() {
  const token = getAccessToken();

  Object.values(KEYS).forEach(k => sessionStorage.removeItem(k));

  try {
    const { end_session_endpoint } = await getOpenidConfig();
    if (end_session_endpoint) {
      const url = new URL(end_session_endpoint);
      if (token) url.searchParams.set('id_token_hint', token);
      url.searchParams.set('post_logout_redirect_uri', window.location.origin);
      window.location.assign(url.toString());
      return;
    }
  } catch {
    // Discovery failed — fall through to local redirect
  }

  window.location.assign('/');
}

// ── Customer Account API GraphQL ─────────────────────────────────────────────

export async function customerFetch(query, variables = {}) {
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');

  // Discovery response uses `graphql_api` (already includes the versioned path)
  const { graphql_api } = await getCustomerApiConfig();

  const res = await fetch(graphql_api, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization:  token,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) throw new Error(`Customer Account API error (${res.status})`);
  return res.json();
}
