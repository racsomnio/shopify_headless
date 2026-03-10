# Shopify Engineering Practice Project

A full-stack practice project covering every required skill: Shopify Admin/Storefront APIs, webhooks, event-driven architecture, RMA, and a headless React storefront.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Shopify Platform                           │
│                                                                 │
│  ┌─────────────┐     ┌──────────────────────────────────────┐  │
│  │  React      │────▶│  Shopify Storefront API (GraphQL)    │  │
│  │  Storefront │     │  Products · Cart · Customer Accounts  │  │
│  └─────────────┘     └──────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Node.js / Express Backend                  │   │
│  │                                                         │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │   │
│  │  │ Shopify      │  │  Event Bus   │  │  RMA        │  │   │
│  │  │ Admin API    │  │ (EventBridge │  │  Service    │  │   │
│  │  │ (GraphQL)    │  │  pattern)    │  │             │  │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘  │   │
│  │         │                 │                  │         │   │
│  │  ┌──────▼─────────────────▼──────────────────▼──────┐  │   │
│  │  │              SQLite / PostgreSQL DB               │  │   │
│  │  │    orders · rma_requests · events · fulfillments  │  │   │
│  │  └───────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Shopify Webhooks (→ Event Bus)              │   │
│  │  orders/create · orders/fulfilled · refunds/create      │   │
│  │  inventory_levels/update · customers/create             │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Skills Practised

| Area | What You'll Build |
|------|------------------|
| **Shopify Admin API** | GraphQL queries for orders, products, customers, fulfillments, refunds |
| **Shopify Storefront API** | Headless React storefront — product listing, cart, customer accounts |
| **Webhooks** | HMAC-verified handlers for 5 event types |
| **Event-Driven System** | Local EventBus mirroring AWS EventBridge: publish/subscribe with typed rules |
| **Order Processing** | Full pipeline: created → validated → fulfilled → closed |
| **RMA / Returns** | Create RMA, approve, process refund via Admin API, close loop |
| **Database** | Relational schema (SQLite locally, drop-in Postgres for prod) |
| **React Frontend** | Storefront API hooks: useProducts, useCart |

---

## Project Structure

```
project/
├── apps/
│   ├── backend/               # Node.js + Express
│   │   └── src/
│   │       ├── config.js          # Env + Shopify client config
│   │       ├── index.js           # Express server entry
│   │       ├── db/
│   │       │   ├── client.js      # DB connection (SQLite → Postgres swap)
│   │       │   └── schema.sql     # Full relational schema
│   │       ├── middleware/
│   │       │   └── verifyWebhook.js  # HMAC webhook verification
│   │       ├── routes/
│   │       │   ├── webhooks.js    # Webhook ingestion
│   │       │   ├── orders.js      # Order management REST API
│   │       │   ├── rma.js         # RMA REST API
│   │       │   └── products.js    # Product management
│   │       └── services/
│   │           ├── shopifyAdmin.js      # Admin API GraphQL wrapper
│   │           ├── shopifyStorefront.js # Storefront API wrapper
│   │           ├── eventBus.js          # EventBridge-pattern event bus
│   │           ├── orderProcessor.js    # Order state machine
│   │           └── rmaService.js        # RMA business logic
│   └── storefront/            # React + Vite
│       └── src/
│           ├── api/storefront.js  # Raw Storefront API client
│           ├── hooks/             # useProducts, useCart
│           └── components/        # ProductCard, Cart, Header
└── docs/
    ├── ARCHITECTURE.md
    ├── SHOPIFY_API_GUIDE.md
    ├── EVENT_DRIVEN_PATTERNS.md
    └── RMA_FLOW.md
```

---

## Quick Start

### 1. Clone & install

```bash
git clone <repo>
cd project
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in your Shopify credentials (see below)
```

### 3. Get Shopify credentials

**Admin API token:**
1. Go to `oscarslab.myshopify.com/admin`
2. Settings → Apps and sales channels → Develop apps
3. Create app → Configure Admin API scopes (orders, products, customers, inventory)
4. Install app → copy the `Admin API access token`

**Storefront API token:**
1. Store admin → Settings → Apps → Headless (or any Sales Channel)
2. Or create a public app and enable Storefront API access

### 4. Run

```bash
# Both backend + storefront in parallel
npm run dev

# Or individually
npm run dev:backend      # http://localhost:3000
npm run dev:storefront   # http://localhost:5173
```

### 5. Expose webhooks locally (ngrok)

```bash
npx ngrok http 3000
# Then register webhooks in Shopify admin with your ngrok URL + /webhooks/<topic>
```

---

## Key Exercises

### Exercise 1 — Admin API CRUD
`GET /api/products` → calls Admin GraphQL → returns product list  
Try: add pagination, filtering by tag, bulk price update

### Exercise 2 — Webhook Processing
Trigger an order in your test store → webhook fires → event bus processes it  
Extend: add inventory reservation logic on `orders/create`

### Exercise 3 — RMA Flow
`POST /api/rma` → creates RMA → `POST /api/rma/:id/approve` → triggers Shopify refund  
Extend: add email notification on approval

### Exercise 4 — Headless Storefront
React app fetches products via Storefront API → add to cart → checkout redirect  
Extend: implement customer login with Customer Account API

### Exercise 5 — Event-Driven Patterns
Study `eventBus.js` — convert one handler to a real AWS SQS consumer  
Reference: `docs/EVENT_DRIVEN_PATTERNS.md`

---

## API Reference

```
POST /webhooks/orders/create
POST /webhooks/orders/fulfilled
POST /webhooks/refunds/create
POST /webhooks/inventory_levels/update
POST /webhooks/customers/create

GET  /api/orders
GET  /api/orders/:id
POST /api/orders/:id/fulfill
POST /api/orders/:id/cancel

POST /api/rma
GET  /api/rma
GET  /api/rma/:id
POST /api/rma/:id/approve
POST /api/rma/:id/refund
POST /api/rma/:id/close

GET  /api/products
GET  /api/products/:id
POST /api/products/:id/adjust-inventory
```
