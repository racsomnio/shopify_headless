/**
 * Shopify Admin API Service
 *
 * Wraps Admin GraphQL API calls with typed helpers.
 * All queries use the 2024-10 API version.
 *
 * Pattern: every method builds a GraphQL query/mutation, sends it,
 * handles errors, and returns the unwrapped data.
 *
 * Authentication: Private app access token in X-Shopify-Access-Token header.
 * For public apps, use OAuth token stored per-shop in the DB.
 */

import { config } from '../config.js';
import { getAdminAccessToken } from './shopifyAuth.js';

const { shop, apiVersion } = config.shopify;

const ADMIN_API_URL = `https://${shop}/admin/api/${apiVersion}/graphql.json`;

/**
 * Core fetch wrapper for Admin GraphQL API
 * Uses static token or client-credentials token from shopifyAuth.
 * @param {string} query - GraphQL query or mutation
 * @param {object} variables
 * @returns {Promise<object>} - { data, errors }
 */
async function adminGraphQL(query, variables = {}) {
  const token = await getAdminAccessToken();
  const response = await fetch(ADMIN_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': token,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`Admin API HTTP ${response.status}: ${await response.text()}`);
  }

  const json = await response.json();

  if (json.errors?.length) {
    throw new Error(`Admin API GraphQL errors: ${JSON.stringify(json.errors)}`);
  }

  return json.data;
}

// ── PRODUCTS ──────────────────────────────────────────────────────────────────

/**
 * Fetch paginated products with variants and inventory
 * @param {number} first - page size (max 250)
 * @param {string|null} after - cursor for pagination
 */
export async function getProducts(first = 10, after = null) {
  const query = `
    query GetProducts($first: Int!, $after: String) {
      products(first: $first, after: $after) {
        pageInfo { hasNextPage hasPreviousPage startCursor endCursor }
        edges {
          cursor
          node {
            id
            title
            handle
            status
            tags
            priceRangeV2 {
              minVariantPrice { amount currencyCode }
              maxVariantPrice { amount currencyCode }
            }
            featuredImage { url altText }
            variants(first: 10) {
              edges {
                node {
                  id
                  title
                  sku
                  price
                  availableForSale
                  inventoryQuantity
                  selectedOptions { name value }
                }
              }
            }
          }
        }
      }
    }
  `;

  const data = await adminGraphQL(query, { first, after });
  return data.products;
}

/**
 * Get a single product by GID
 */
export async function getProductById(gid) {
  const query = `
    query GetProduct($id: ID!) {
      product(id: $id) {
        id title handle status tags description
        variants(first: 250) {
          edges {
            node {
              id title sku price
              inventoryItem { id }
              inventoryQuantity
            }
          }
        }
      }
    }
  `;
  const data = await adminGraphQL(query, { id: gid });
  return data.product;
}

/**
 * Adjust inventory level for a variant at a location
 * @param {string} inventoryItemId - gid://shopify/InventoryItem/...
 * @param {string} locationId      - gid://shopify/Location/...
 * @param {number} delta           - positive to add, negative to subtract
 */
export async function adjustInventory(inventoryItemId, locationId, delta) {
  const mutation = `
    mutation AdjustInventory($input: InventoryAdjustQuantityInput!) {
      inventoryAdjustQuantity(input: $input) {
        inventoryLevel {
          id
          available
        }
        userErrors { field message }
      }
    }
  `;
  const data = await adminGraphQL(mutation, {
    input: { inventoryItemId, locationId, availableDelta: delta },
  });

  const { userErrors, inventoryLevel } = data.inventoryAdjustQuantity;
  if (userErrors.length) throw new Error(userErrors.map(e => e.message).join(', '));
  return inventoryLevel;
}

// ── ORDERS ────────────────────────────────────────────────────────────────────

/**
 * Fetch recent orders
 */
export async function getOrders(first = 20, query = '') {
  const gql = `
    query GetOrders($first: Int!, $query: String) {
      orders(first: $first, query: $query, sortKey: CREATED_AT, reverse: true) {
        pageInfo { hasNextPage endCursor }
        edges {
          node {
            id
            name
            email
            createdAt
            displayFinancialStatus
            displayFulfillmentStatus
            totalPriceSet { shopMoney { amount currencyCode } }
            lineItems(first: 50) {
              edges {
                node {
                  id
                  title
                  quantity
                  sku
                  variant { id price }
                  originalUnitPriceSet { shopMoney { amount currencyCode } }
                }
              }
            }
            shippingAddress {
              firstName lastName address1 city province country zip
            }
            fulfillments(first: 5) {
              id
              status
              trackingInfo { number url company }
            }
          }
        }
      }
    }
  `;
  const data = await adminGraphQL(gql, { first, query });
  return data.orders;
}

/**
 * Get a single order by GID
 */
export async function getOrderById(gid) {
  const query = `
    query GetOrder($id: ID!) {
      order(id: $id) {
        id name email createdAt note
        displayFinancialStatus displayFulfillmentStatus
        totalPriceSet { shopMoney { amount currencyCode } }
        subtotalPriceSet { shopMoney { amount currencyCode } }
        totalTaxSet { shopMoney { amount currencyCode } }
        lineItems(first: 50) {
          edges {
            node {
              id title quantity sku
              variant {
                id
                inventoryItem { id }
              }
              originalUnitPriceSet { shopMoney { amount currencyCode } }
              refundableQuantity
            }
          }
        }
        refunds {
          id createdAt
          totalRefundedSet { shopMoney { amount currencyCode } }
          refundLineItems(first: 20) {
            edges {
              node {
                quantity
                lineItem { id title }
                priceSet { shopMoney { amount currencyCode } }
              }
            }
          }
        }
        fulfillments(first: 5) {
          id status
          trackingInfo { number url company }
        }
      }
    }
  `;
  const data = await adminGraphQL(query, { id: gid });
  return data.order;
}

/**
 * Create a fulfillment for an order
 * @param {string} orderId    - Shopify order GID
 * @param {string} locationId - Shopify location GID
 * @param {Array}  lineItems  - [{ id: lineItemId, quantity }]
 * @param {object} tracking   - { number, url, company }
 */
export async function createFulfillment(orderId, locationId, lineItems, tracking = {}) {
  const mutation = `
    mutation CreateFulfillment($fulfillment: FulfillmentInput!) {
      fulfillmentCreate(fulfillment: $fulfillment) {
        fulfillment {
          id
          status
          trackingInfo { number url company }
        }
        userErrors { field message }
      }
    }
  `;

  const data = await adminGraphQL(mutation, {
    fulfillment: {
      orderId,
      locationId,
      lineItemsByFulfillmentOrder: [{ fulfillmentOrderId: orderId, fulfillmentOrderLineItems: lineItems }],
      trackingInfo: tracking.number ? {
        number: tracking.number,
        url: tracking.url,
        company: tracking.company,
      } : undefined,
      notifyCustomer: true,
    },
  });

  const { userErrors, fulfillment } = data.fulfillmentCreate;
  if (userErrors.length) throw new Error(userErrors.map(e => e.message).join(', '));
  return fulfillment;
}

// ── REFUNDS ───────────────────────────────────────────────────────────────────

/**
 * Calculate a refund (dry-run) — always call before createRefund
 * @param {string} orderId
 * @param {Array}  refundLineItems - [{ lineItemId, quantity, restockType }]
 */
export async function calculateRefund(orderId, refundLineItems) {
  const mutation = `
    mutation CalculateRefund($input: RefundInput!) {
      refundCreate(input: $input) {
        refund {
          refundLineItems(first: 20) {
            edges {
              node {
                quantity
                lineItem { id title }
                priceSet { shopMoney { amount currencyCode } }
              }
            }
          }
          totalRefundedSet { shopMoney { amount currencyCode } }
        }
        userErrors { field message }
      }
    }
  `;

  // Use suggest mutation for actual calculation
  const suggestQuery = `
    query SuggestRefund($orderId: ID!, $refundLineItems: [RefundLineItemInput!]!) {
      suggestedRefund(orderId: $orderId, refundLineItems: $refundLineItems) {
        subtotalSet { shopMoney { amount currencyCode } }
        totalTaxSet { shopMoney { amount currencyCode } }
        maximumRefundableSet { shopMoney { amount currencyCode } }
        refundLineItems {
          quantity
          lineItem { id title sku }
          priceSet { shopMoney { amount currencyCode } }
        }
      }
    }
  `;

  const data = await adminGraphQL(suggestQuery, { orderId, refundLineItems });
  return data.suggestedRefund;
}

/**
 * Create an actual refund on an order
 * @param {string} orderId
 * @param {Array}  refundLineItems - [{ lineItemId, quantity, restockType: 'RETURN' | 'CANCEL' }]
 * @param {string} note
 */
export async function createRefund(orderId, refundLineItems, note = '') {
  const mutation = `
    mutation CreateRefund($input: RefundInput!) {
      refundCreate(input: $input) {
        refund {
          id
          totalRefundedSet { shopMoney { amount currencyCode } }
          createdAt
        }
        userErrors { field message }
      }
    }
  `;

  const data = await adminGraphQL(mutation, {
    input: {
      orderId,
      note,
      notify: true,
      refundLineItems: refundLineItems.map(item => ({
        lineItemId: item.lineItemId,
        quantity: item.quantity,
        restockType: item.restockType || 'RETURN',
      })),
    },
  });

  const { userErrors, refund } = data.refundCreate;
  if (userErrors.length) throw new Error(userErrors.map(e => e.message).join(', '));
  return refund;
}

// ── CUSTOMERS ─────────────────────────────────────────────────────────────────

export async function getCustomerByEmail(email) {
  const query = `
    query GetCustomer($query: String!) {
      customers(first: 1, query: $query) {
        edges {
          node {
            id
            firstName lastName email phone
            numberOfOrders
            totalSpentV2 { amount currencyCode }
            createdAt
            tags
          }
        }
      }
    }
  `;
  const data = await adminGraphQL(query, { query: `email:${email}` });
  return data.customers.edges[0]?.node ?? null;
}

export { adminGraphQL };
