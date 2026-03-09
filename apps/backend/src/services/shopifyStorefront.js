/**
 * Shopify Storefront API Service
 *
 * The Storefront API is PUBLIC (uses a Storefront token, not an admin token).
 * It's designed to be called from the browser or a server rendering layer.
 *
 * Used for:
 *   - Fetching products/collections for the headless storefront
 *   - Cart creation, line item management
 *   - Customer authentication (via Customer Account API in newer versions)
 *   - Checkout creation and redirect
 *
 * Auth: `X-Shopify-Storefront-Access-Token` header (not the Admin token!)
 */

import { config } from '../config.js';

const { shop, storefrontToken, apiVersion } = config.shopify;

const STOREFRONT_API_URL = `https://${shop}/api/${apiVersion}/graphql.json`;

async function storefrontGraphQL(query, variables = {}) {
  const response = await fetch(STOREFRONT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': storefrontToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Storefront API HTTP ${response.status}: ${await response.text()}`);
  }

  const json = await response.json();
  if (json.errors?.length) {
    throw new Error(`Storefront API errors: ${JSON.stringify(json.errors)}`);
  }

  return json.data;
}

// ── PRODUCTS ──────────────────────────────────────────────────────────────────

/**
 * Fetch products for the storefront — optimized for display
 * Note: Storefront API uses different fields than Admin API (no cost data)
 */
export async function storefrontGetProducts(first = 12, after = null) {
  const query = `
    query StorefrontProducts($first: Int!, $after: String) {
      products(first: $first, after: $after) {
        pageInfo { hasNextPage endCursor }
        edges {
          cursor
          node {
            id
            title
            handle
            description
            availableForSale
            priceRange {
              minVariantPrice { amount currencyCode }
            }
            featuredImage { url altText width height }
            images(first: 5) {
              edges { node { url altText width height } }
            }
            variants(first: 10) {
              edges {
                node {
                  id
                  title
                  availableForSale
                  price { amount currencyCode }
                  selectedOptions { name value }
                }
              }
            }
          }
        }
      }
    }
  `;

  const data = await storefrontGraphQL(query, { first, after });
  return data.products;
}

export async function storefrontGetProductByHandle(handle) {
  const query = `
    query GetProductByHandle($handle: String!) {
      product(handle: $handle) {
        id title handle description availableForSale
        priceRange { minVariantPrice { amount currencyCode } }
        featuredImage { url altText }
        images(first: 10) { edges { node { url altText } } }
        options { id name values }
        variants(first: 250) {
          edges {
            node {
              id
              title
              availableForSale
              price { amount currencyCode }
              compareAtPrice { amount currencyCode }
              selectedOptions { name value }
            }
          }
        }
      }
    }
  `;
  const data = await storefrontGraphQL(query, { handle });
  return data.product;
}

// ── CART ──────────────────────────────────────────────────────────────────────

/**
 * Create a new cart — returns cartId stored in localStorage on the client
 */
export async function cartCreate(lines = []) {
  const mutation = `
    mutation CartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart {
          id
          checkoutUrl
          lines(first: 20) {
            edges {
              node {
                id quantity
                merchandise {
                  ... on ProductVariant {
                    id title price { amount currencyCode }
                    product { title featuredImage { url } }
                  }
                }
              }
            }
          }
          cost {
            totalAmount { amount currencyCode }
            subtotalAmount { amount currencyCode }
            totalTaxAmount { amount currencyCode }
          }
        }
        userErrors { field message code }
      }
    }
  `;

  const data = await storefrontGraphQL(mutation, {
    input: {
      lines: lines.map(l => ({ merchandiseId: l.variantId, quantity: l.quantity })),
    },
  });

  const { userErrors, cart } = data.cartCreate;
  if (userErrors.length) throw new Error(userErrors.map(e => e.message).join(', '));
  return cart;
}

/**
 * Add lines to an existing cart
 */
export async function cartLinesAdd(cartId, lines) {
  const mutation = `
    mutation CartLinesAdd($cartId: ID!, $lines: [CartLineInput!]!) {
      cartLinesAdd(cartId: $cartId, lines: $lines) {
        cart {
          id
          lines(first: 20) {
            edges {
              node {
                id quantity
                merchandise {
                  ... on ProductVariant {
                    id title price { amount currencyCode }
                    product { title featuredImage { url } }
                  }
                }
              }
            }
          }
          cost { totalAmount { amount currencyCode } }
        }
        userErrors { field message }
      }
    }
  `;

  const data = await storefrontGraphQL(mutation, {
    cartId,
    lines: lines.map(l => ({ merchandiseId: l.variantId, quantity: l.quantity })),
  });

  const { userErrors, cart } = data.cartLinesAdd;
  if (userErrors.length) throw new Error(userErrors.map(e => e.message).join(', '));
  return cart;
}

/**
 * Remove lines from a cart
 */
export async function cartLinesRemove(cartId, lineIds) {
  const mutation = `
    mutation CartLinesRemove($cartId: ID!, $lineIds: [ID!]!) {
      cartLinesRemove(cartId: $cartId, lineIds: $lineIds) {
        cart {
          id
          lines(first: 20) {
            edges {
              node { id quantity merchandise { ... on ProductVariant { id title } } }
            }
          }
          cost { totalAmount { amount currencyCode } }
        }
        userErrors { field message }
      }
    }
  `;

  const data = await storefrontGraphQL(mutation, { cartId, lineIds });
  return data.cartLinesRemove.cart;
}

/**
 * Get an existing cart by ID
 */
export async function getCart(cartId) {
  const query = `
    query GetCart($id: ID!) {
      cart(id: $id) {
        id checkoutUrl
        lines(first: 20) {
          edges {
            node {
              id quantity
              merchandise {
                ... on ProductVariant {
                  id title price { amount currencyCode }
                  product { title handle featuredImage { url } }
                }
              }
            }
          }
        }
        cost {
          totalAmount { amount currencyCode }
          subtotalAmount { amount currencyCode }
        }
      }
    }
  `;
  const data = await storefrontGraphQL(query, { id: cartId });
  return data.cart;
}

export { storefrontGraphQL };
