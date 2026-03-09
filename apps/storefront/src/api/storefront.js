/**
 * Storefront API Client (browser-side)
 *
 * As of 2026, the Storefront API supports TOKENLESS access for core features:
 *   Products, Collections, Cart (read/write), Search, Pages, Blogs
 *
 * Token is only required for: Customer data, Metafields, Product Tags, Menu.
 *
 * Tokenless has a 1,000 query complexity limit — sufficient for most storefronts.
 * If VITE_SHOPIFY_STOREFRONT_TOKEN is set, it's sent for higher limits + customer features.
 *
 * Docs: https://shopify.dev/docs/api/storefront/latest
 */

const SHOP = import.meta.env.VITE_SHOPIFY_SHOP || 'oscarslab.myshopify.com';
const API_VERSION = import.meta.env.VITE_SHOPIFY_API_VERSION || '2026-01';
const STOREFRONT_TOKEN = import.meta.env.VITE_SHOPIFY_STOREFRONT_TOKEN || '';

const ENDPOINT = `https://${SHOP}/api/${API_VERSION}/graphql.json`;

/**
 * Core Storefront GraphQL fetch — tokenless by default (2026+)
 * Pass token in header only if available, for higher complexity limits.
 */
export async function storefrontFetch(query, variables = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (STOREFRONT_TOKEN) {
    headers['X-Shopify-Storefront-Access-Token'] = STOREFRONT_TOKEN;
  }

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Storefront API ${response.status}: ${await response.text()}`);
  }

  const json = await response.json();

  if (json.errors?.length) {
    throw new Error(json.errors.map(e => e.message).join(', '));
  }

  return json.data;
}

// ── Product Queries ───────────────────────────────────────────────────────────

export async function fetchProducts(first = 12, after = null) {
  return storefrontFetch(`
    query Products($first: Int!, $after: String) {
      products(first: $first, after: $after) {
        pageInfo { hasNextPage endCursor }
        edges {
          cursor
          node {
            id handle title availableForSale
            description
            priceRange { minVariantPrice { amount currencyCode } }
            featuredImage { url altText }
            variants(first: 10) {
              edges {
                node {
                  id title availableForSale
                  price { amount currencyCode }
                  selectedOptions { name value }
                }
              }
            }
          }
        }
      }
    }
  `, { first, after });
}

export async function fetchProductByHandle(handle) {
  return storefrontFetch(`
    query Product($handle: String!) {
      product(handle: $handle) {
        id title handle description availableForSale
        featuredImage { url altText }
        images(first: 6) { edges { node { url altText } } }
        options { id name values }
        variants(first: 250) {
          edges {
            node {
              id title availableForSale
              price { amount currencyCode }
              compareAtPrice { amount currencyCode }
              selectedOptions { name value }
            }
          }
        }
      }
    }
  `, { handle });
}

// ── Cart Mutations ────────────────────────────────────────────────────────────

export async function createCart(variantId, quantity = 1) {
  return storefrontFetch(`
    mutation CreateCart($variantId: ID!, $qty: Int!) {
      cartCreate(input: {
        lines: [{ merchandiseId: $variantId, quantity: $qty }]
      }) {
        cart {
          id checkoutUrl
          lines(first: 20) { edges { node { ...CartLine } } }
          cost { totalAmount { amount currencyCode } subtotalAmount { amount currencyCode } }
        }
        userErrors { field message code }
      }
    }

    fragment CartLine on CartLine {
      id quantity
      merchandise {
        ... on ProductVariant {
          id title price { amount currencyCode }
          product { title handle featuredImage { url altText } }
        }
      }
    }
  `, { variantId, qty: quantity });
}

export async function addToCart(cartId, variantId, quantity = 1) {
  return storefrontFetch(`
    mutation AddToCart($cartId: ID!, $variantId: ID!, $qty: Int!) {
      cartLinesAdd(cartId: $cartId, lines: [{ merchandiseId: $variantId, quantity: $qty }]) {
        cart {
          id checkoutUrl
          lines(first: 20) { edges { node { ...CartLine } } }
          cost { totalAmount { amount currencyCode } }
        }
        userErrors { field message }
      }
    }

    fragment CartLine on CartLine {
      id quantity
      merchandise {
        ... on ProductVariant {
          id title price { amount currencyCode }
          product { title handle featuredImage { url altText } }
        }
      }
    }
  `, { cartId, variantId, qty: quantity });
}

export async function removeFromCart(cartId, lineId) {
  return storefrontFetch(`
    mutation RemoveFromCart($cartId: ID!, $lineId: ID!) {
      cartLinesRemove(cartId: $cartId, lineIds: [$lineId]) {
        cart {
          id
          lines(first: 20) { edges { node { id quantity merchandise { ... on ProductVariant { id title } } } } }
          cost { totalAmount { amount currencyCode } }
        }
        userErrors { field message }
      }
    }
  `, { cartId, lineId });
}

export async function fetchCart(cartId) {
  return storefrontFetch(`
    query Cart($id: ID!) {
      cart(id: $id) {
        id checkoutUrl
        lines(first: 20) {
          edges {
            node {
              id quantity
              merchandise {
                ... on ProductVariant {
                  id title price { amount currencyCode }
                  product { title handle featuredImage { url altText } }
                }
              }
            }
          }
        }
        cost {
          subtotalAmount { amount currencyCode }
          totalAmount { amount currencyCode }
          totalTaxAmount { amount currencyCode }
        }
      }
    }
  `, { id: cartId });
}
