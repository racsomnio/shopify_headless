/**
 * PKCE (Proof Key for Code Exchange) utilities
 *
 * Uses the browser-native Web Crypto API — zero dependencies.
 * This is the same approach used by Hydrogen's createCustomerAccountClient.
 */

function base64UrlEncode(buffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/** Random 32-byte base64url string used as the code verifier */
export function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array.buffer);
}

/** SHA-256 hash of the verifier, base64url-encoded — sent to Shopify */
export async function generateCodeChallenge(verifier) {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(digest);
}

/** Random 16-byte state for CSRF protection */
export function generateState() {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return base64UrlEncode(array.buffer);
}
