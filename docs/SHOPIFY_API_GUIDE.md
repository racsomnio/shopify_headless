# Shopify API Quick Reference

## Admin API vs Storefront API

| | Admin API | Storefront API |
|---|---|---|
| **Auth** | `X-Shopify-Access-Token` (secret) | `X-Shopify-Storefront-Access-Token` (public) |
| **Called from** | Server only | Browser or server |
| **Access** | Full store data | Customer-facing data only |
| **Rate limit** | 40 req/s (leaky bucket) + cost-based | 60 req/s |
| **Use for** | Orders, inventory, fulfillments, refunds | Products, cart, checkout, customer auth |

---

## Admin API — Key Queries to Know

### Get products with pagination (API version 2026-01)
```graphql
query GetProducts($first: Int!, $after: String) {
  products(first: $first, after: $after) {
    pageInfo { hasNextPage endCursor }
    edges {
      cursor
      node {
        id title handle status
        variants(first: 10) {
          edges { node { id sku price inventoryQuantity } }
        }
      }
    }
  }
}
```

### Get orders with filter
```graphql
query GetOrders($query: String!) {
  orders(first: 50, query: $query) {
    edges {
      node {
        id name email
        displayFinancialStatus displayFulfillmentStatus
        totalPriceSet { shopMoney { amount currencyCode } }
        lineItems(first: 20) {
          edges { node { id title quantity sku } }
        }
      }
    }
  }
}
# Example query strings:
# "financial_status:paid fulfillment_status:unfulfilled"
# "created_at:>=2024-01-01"
# "tag:featured"
```

### Create a refund
```graphql
mutation CreateRefund($input: RefundInput!) {
  refundCreate(input: $input) {
    refund {
      id
      totalRefundedSet { shopMoney { amount currencyCode } }
    }
    userErrors { field message }
  }
}
```
Variables:
```json
{
  "input": {
    "orderId": "gid://shopify/Order/6789",
    "note": "RMA-2024-0001 defective product",
    "notify": true,
    "refundLineItems": [
      { "lineItemId": "gid://shopify/LineItem/111", "quantity": 1, "restockType": "RETURN" }
    ]
  }
}
```

### Create a fulfillment
```graphql
mutation CreateFulfillment($fulfillment: FulfillmentInput!) {
  fulfillmentCreate(fulfillment: $fulfillment) {
    fulfillment { id status trackingInfo { number url } }
    userErrors { field message }
  }
}
```

---

## Storefront API — Key Patterns

### Cart create → add → checkout redirect
```
1. cartCreate(lines: [...]) → { cart.id, cart.checkoutUrl }
2. localStorage.setItem('cart_id', cart.id)     ← persist cart
3. cartLinesAdd(cartId, lines)                   ← add more items
4. window.location.href = cart.checkoutUrl       ← Shopify handles payment
```

### Customer authentication (new: Customer Account API)
- Old way: Storefront API `customerAccessTokenCreate` → `customerAccessToken`
- New way (2024+): Customer Account API OAuth flow (separate token, separate domain)
- For practice: Storefront API approach is still valid for most use cases

---

## Webhook Registration via Admin API

```graphql
mutation RegisterWebhook {
  webhookSubscriptionCreate(
    topic: ORDERS_CREATE
    webhookSubscription: {
      format: JSON
      callbackUrl: "https://your-ngrok-url.ngrok.io/webhooks/orders/create"
    }
  ) {
    webhookSubscription { id topic }
    userErrors { field message }
  }
}
```

Topics to register:
- `ORDERS_CREATE`, `ORDERS_PAID`, `ORDERS_FULFILLED`, `ORDERS_CANCELLED`
- `REFUNDS_CREATE`
- `INVENTORY_LEVELS_UPDATE`
- `CUSTOMERS_CREATE`, `CUSTOMERS_UPDATE`
- `APP_UNINSTALLED` (required for all apps)

---

## Rate Limiting — Admin API

Shopify uses a **leaky bucket** algorithm:
- Bucket size: 40 requests
- Leak rate: 2 requests/second (fills 1 req every 500ms)
- GraphQL: also has a **query cost** system (each field costs points)

```javascript
// Check cost in response extensions
const { data, extensions } = await adminGraphQL(query);
const cost = extensions?.cost;
// { requestedQueryCost: 12, actualQueryCost: 10, throttleStatus: {...} }
```

**Best practice**: Batch requests, use pagination (never fetch all at once), handle 429 with exponential backoff.

---

## Common GID Formats

```
gid://shopify/Order/6789012345
gid://shopify/LineItem/1234567890
gid://shopify/Product/9876543210
gid://shopify/ProductVariant/1234567890
gid://shopify/InventoryItem/1234567890
gid://shopify/Location/1234567890
gid://shopify/Customer/1234567890
gid://shopify/Refund/1234567890
gid://shopify/Fulfillment/1234567890
```

To get numeric ID from GID: `gid.split('/').pop()`
To make GID from numeric ID: `` `gid://shopify/Order/${numericId}` ``

---

## Shopify Functions (Bonus)

Functions let you run custom logic on Shopify's infrastructure (not your server):
- **Discount Functions** — custom discount logic
- **Cart Transform** — modify cart line items
- **Payment Customization** — show/hide payment methods
- **Delivery Customization** — custom shipping rules

```bash
# Scaffold a discount function
shopify app generate extension --template discount
```

Functions are written in JavaScript (compiled to Wasm) or Rust, and take a GraphQL input/output schema. Study the `functions_discount` schema in the Shopify docs for the input query shape.
