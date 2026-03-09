# Architecture — Shopify Platform

## System Design

### Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Backend** | Node.js + Express | Job requirement; non-blocking I/O for webhook handling |
| **Admin API** | Shopify GraphQL Admin API 2024-10 | Full store management |
| **Storefront API** | Shopify GraphQL Storefront API | Headless commerce |
| **Database** | SQLite (dev) / PostgreSQL (prod) | Relational, ACID-compliant |
| **Event Bus** | Node EventEmitter → AWS EventBridge | Decoupled, auditable |
| **Frontend** | React + Vite | Job requirement bonus |
| **Hosting** | AWS Lambda + API Gateway | Job requirement |

---

## Data Flow — Order Placement to Fulfillment

```
1. Customer adds product to cart (Storefront API cartCreate)
2. Redirected to Shopify checkout (cart.checkoutUrl)
3. Shopify processes payment
4. Shopify fires `orders/create` webhook → POST /webhooks/orders/create
5. verifyWebhook middleware validates HMAC
6. eventBus.publish('shopify.webhook', 'orders/create', payload)
7. OrderProcessor.handleOrderCreated() → upsert to local DB
8. eventBus.publish('shopify.webhook', 'orders/paid', ...)
9. OrderProcessor.handleOrderPaid() → trigger fulfillment
10. 3PL ships → Shopify fires `orders/fulfilled` webhook
11. Local DB updated with tracking info
```

---

## Database Design Rationale

### Why sync orders locally?
- Shopify API has rate limits — local queries are instant
- Custom reporting without API calls
- Cross-reference with RMAs, fulfillments, inventory
- Offline resilience

### Why JSON columns for line_items?
- Shopify's line item structure is complex and can change
- For a startup (0→1), flexibility > strict normalization
- **In production**: migrate to a proper `order_line_items` table once the schema stabilizes

---

## Shopify-Specific Patterns

### Webhook idempotency
Shopify may deliver a webhook more than once. The `shopify_order_id` has a UNIQUE constraint — `INSERT OR IGNORE` / `ON CONFLICT DO UPDATE` handles duplicates gracefully.

### Cursor-based pagination
Shopify uses cursors (not offsets) for pagination. Never try to skip to page 5 — always walk forward from the last cursor.

```javascript
// Page 1
const { edges, pageInfo } = await getProducts(10, null);
const cursor = pageInfo.endCursor;

// Page 2
const page2 = await getProducts(10, cursor);
```

### GID (Global ID) format
Every Shopify object has a GID: `gid://shopify/Order/6789012345`
- Always store GIDs, not numeric IDs — they're stable across API versions
- Numeric ID: `gid.split('/').pop()`

---

## Production Checklist

- [ ] Move `adminAccessToken` to AWS Secrets Manager (not env vars)
- [ ] Add auth middleware to all `/api/*` routes (JWT or session)
- [ ] Replace SQLite with PostgreSQL (change DB client only)
- [ ] Replace EventBus with AWS EventBridge + SQS
- [ ] Deploy Express app as Lambda + API Gateway (or ECS)
- [ ] Set up CloudWatch for event log monitoring
- [ ] Register webhooks programmatically with Admin API (not manually)
- [ ] Add webhook deduplication check (X-Shopify-Webhook-Id header)
- [ ] GDPR: implement customer data deletion endpoint (required for apps)
- [ ] Add health check Lambda for DB connectivity

---

## AWS Architecture (Production)

```
                    ┌─────────────────────────────────────┐
                    │          API Gateway                 │
                    └─────────────────────────────────────┘
                                    │
              ┌─────────────────────┼───────────────────────┐
              │                     │                       │
         ┌────▼────┐          ┌─────▼─────┐          ┌─────▼─────┐
         │Webhooks │          │Orders API │          │  RMA API  │
         │ Lambda  │          │  Lambda   │          │  Lambda   │
         └────┬────┘          └─────┬─────┘          └─────┬─────┘
              │                     │                       │
              └───────────┬─────────┘                       │
                          │                                 │
                  ┌───────▼────────┐                        │
                  │  EventBridge   │                        │
                  │  Custom Bus    │                        │
                  └───────┬────────┘                        │
           ┌──────────────┼──────────────┐                  │
           │              │              │                  │
     ┌─────▼─────┐ ┌──────▼──────┐ ┌────▼──────┐           │
     │  SQS      │ │  SQS        │ │  SQS      │           │
     │ Orders Q  │ │ Inventory Q │ │  Email Q  │           │
     └─────┬─────┘ └──────┬──────┘ └────┬──────┘           │
           │              │              │                  │
     ┌─────▼─────┐ ┌──────▼──────┐ ┌────▼──────┐           │
     │  Order    │ │  Inventory  │ │  Email    │           │
     │ Processor │ │  Watcher   │ │  Service  │           │
     │  Lambda  │ │   Lambda    │ │  Lambda   │           │
     └─────┬─────┘ └──────┬──────┘ └───────────┘           │
           │              │                                 │
           └──────────────┴──────────────────────┬──────────┘
                                                 │
                                         ┌───────▼────────┐
                                         │   PostgreSQL   │
                                         │ (RDS/Aurora)   │
                                         └────────────────┘
```
