-- ALSO Platform — Database Schema
-- Compatible with SQLite (dev) and PostgreSQL (prod)
-- Swap TEXT for UUID in Postgres; INTEGER PRIMARY KEY for SERIAL

-- ── Synced Shopify Orders ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  shopify_order_id   TEXT    NOT NULL UNIQUE,   -- Shopify GID e.g. gid://shopify/Order/123
  shopify_order_name TEXT    NOT NULL,           -- #1001
  email              TEXT,
  total_price        REAL    NOT NULL,
  currency           TEXT    NOT NULL DEFAULT 'USD',
  financial_status   TEXT    NOT NULL,           -- pending | paid | refunded | partially_refunded
  fulfillment_status TEXT,                       -- null | partial | fulfilled
  tags               TEXT,                       -- JSON array string
  line_items         TEXT    NOT NULL,           -- JSON array string
  shipping_address   TEXT,                       -- JSON object string
  created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Return Merchandise Authorizations ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rma_requests (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  rma_number         TEXT    NOT NULL UNIQUE,    -- RMA-2024-0001
  shopify_order_id   TEXT    NOT NULL,
  order_name         TEXT    NOT NULL,           -- #1001
  customer_email     TEXT,
  status             TEXT    NOT NULL DEFAULT 'pending',
  -- pending | approved | refunded | closed | rejected
  reason             TEXT    NOT NULL,
  -- defective | wrong_item | not_as_described | changed_mind | damaged_shipping
  line_items         TEXT    NOT NULL,           -- JSON: [{variant_id, quantity, reason}]
  refund_amount      REAL,
  shopify_refund_id  TEXT,                       -- populated after Shopify refund created
  notes              TEXT,
  approved_at        TEXT,
  refunded_at        TEXT,
  closed_at          TEXT,
  created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Fulfillments (local tracking) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS fulfillments (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  shopify_order_id       TEXT    NOT NULL,
  shopify_fulfillment_id TEXT    UNIQUE,
  tracking_number        TEXT,
  tracking_company       TEXT,
  tracking_url           TEXT,
  status                 TEXT    NOT NULL DEFAULT 'pending',
  -- pending | success | cancelled | error
  line_items             TEXT    NOT NULL,       -- JSON
  created_at             TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at             TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Event Log (audit trail, mirrors EventBridge event store) ──────────────────
CREATE TABLE IF NOT EXISTS events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  source      TEXT    NOT NULL,   -- e.g. "shopify.webhook" | "also.rma"
  detail_type TEXT    NOT NULL,   -- e.g. "orders/create" | "rma.approved"
  detail      TEXT    NOT NULL,   -- JSON payload
  processed   INTEGER NOT NULL DEFAULT 0,
  error       TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ── Inventory Snapshots ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS inventory_snapshots (
  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
  shopify_inventory_item_id TEXT NOT NULL,
  shopify_location_id     TEXT NOT NULL,
  available               INTEGER NOT NULL,
  snapshot_at             TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(shopify_inventory_item_id, shopify_location_id, snapshot_at)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_shopify_id ON orders(shopify_order_id);
CREATE INDEX IF NOT EXISTS idx_rma_order_id      ON rma_requests(shopify_order_id);
CREATE INDEX IF NOT EXISTS idx_rma_status        ON rma_requests(status);
CREATE INDEX IF NOT EXISTS idx_events_source     ON events(source, detail_type);
CREATE INDEX IF NOT EXISTS idx_fulfillments_order ON fulfillments(shopify_order_id);
