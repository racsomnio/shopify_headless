/**
 * Order Processor — Event-Driven Order State Machine
 *
 * Subscribes to order events from the event bus and processes them
 * through a pipeline. This mirrors an AWS Lambda function triggered
 * by EventBridge rules.
 *
 * Order lifecycle:
 *   orders/create → validate → store locally → reserve inventory
 *   orders/paid   → trigger fulfillment workflow
 *   orders/fulfilled → update local records, notify downstream
 *   orders/cancelled → release inventory, update DB
 *   refunds/create → log refund, update order status
 */

import db from '../db/client.js';
import { adjustInventory } from './shopifyAdmin.js';

export const OrderProcessor = {
  /**
   * Register all event handlers on the bus
   * Called once at server startup in index.js
   */
  registerHandlers(bus) {
    bus.subscribe('shopify.webhook', 'orders/create',     handleOrderCreated);
    bus.subscribe('shopify.webhook', 'orders/paid',       handleOrderPaid);
    bus.subscribe('shopify.webhook', 'orders/fulfilled',  handleOrderFulfilled);
    bus.subscribe('shopify.webhook', 'orders/cancelled',  handleOrderCancelled);
    bus.subscribe('shopify.webhook', 'refunds/create',    handleRefundCreated);
    bus.subscribe('shopify.webhook', 'inventory_levels/update', handleInventoryUpdate);
  },
};

// ── Handlers ──────────────────────────────────────────────────────────────────

async function handleOrderCreated(event) {
  const order = event.detail;

  console.log(`📦 Processing new order: ${order.name} (${order.id})`);

  const lineItemsJson = JSON.stringify(
    order.line_items?.map(li => ({
      id: li.id,
      title: li.title,
      quantity: li.quantity,
      sku: li.sku,
      price: li.price,
      variant_id: li.variant_id,
    })) || []
  );

  const shippingJson = JSON.stringify(order.shipping_address || {});

  // Upsert order into local DB
  db.prepare(`
    INSERT INTO orders (
      shopify_order_id, shopify_order_name, email,
      total_price, currency, financial_status, fulfillment_status,
      tags, line_items, shipping_address
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(shopify_order_id) DO UPDATE SET
      financial_status   = excluded.financial_status,
      fulfillment_status = excluded.fulfillment_status,
      updated_at         = datetime('now')
  `).run(
    `gid://shopify/Order/${order.id}`,
    order.name,
    order.email,
    parseFloat(order.total_price),
    order.currency,
    order.financial_status,
    order.fulfillment_status || null,
    JSON.stringify(order.tags || []),
    lineItemsJson,
    shippingJson,
  );

  console.log(`✅ Order ${order.name} stored in local DB`);

  // Tag high-value orders for priority handling
  if (parseFloat(order.total_price) > 3000) {
    console.log(`⭐ High-value order detected: ${order.name} — ${order.currency} ${order.total_price}`);
    // In production: push to priority queue / notify ops team
  }
}

async function handleOrderPaid(event) {
  const order = event.detail;
  console.log(`💳 Order paid: ${order.name}`);

  db.prepare(`
    UPDATE orders SET financial_status = 'paid', updated_at = datetime('now')
    WHERE shopify_order_id = ?
  `).run(`gid://shopify/Order/${order.id}`);

  // In production: trigger fulfillment workflow via 3PL webhook / SQS message
  console.log(`→ Would trigger fulfillment for ${order.name}`);
}

async function handleOrderFulfilled(event) {
  const order = event.detail;
  console.log(`🚚 Order fulfilled: ${order.name}`);

  const tracking = order.fulfillments?.[0]?.tracking_info?.[0];

  db.prepare(`
    UPDATE orders
    SET fulfillment_status = 'fulfilled', updated_at = datetime('now')
    WHERE shopify_order_id = ?
  `).run(`gid://shopify/Order/${order.id}`);

  // Store fulfillment record
  if (order.fulfillments?.length) {
    const f = order.fulfillments[0];
    db.prepare(`
      INSERT OR IGNORE INTO fulfillments (
        shopify_order_id, shopify_fulfillment_id,
        tracking_number, tracking_company, tracking_url,
        status, line_items
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      `gid://shopify/Order/${order.id}`,
      `gid://shopify/Fulfillment/${f.id}`,
      tracking?.number || null,
      tracking?.company || null,
      tracking?.url || null,
      'success',
      JSON.stringify(f.line_items || []),
    );
  }
}

async function handleOrderCancelled(event) {
  const order = event.detail;
  console.log(`❌ Order cancelled: ${order.name}`);

  db.prepare(`
    UPDATE orders
    SET financial_status = 'cancelled', updated_at = datetime('now')
    WHERE shopify_order_id = ?
  `).run(`gid://shopify/Order/${order.id}`);
}

async function handleRefundCreated(event) {
  const refund = event.detail;
  console.log(`💰 Refund created for order: ${refund.order_id}`);

  db.prepare(`
    UPDATE orders
    SET financial_status = 'refunded', updated_at = datetime('now')
    WHERE shopify_order_id = ?
  `).run(`gid://shopify/Order/${refund.order_id}`);
}

async function handleInventoryUpdate(event) {
  const level = event.detail;

  db.prepare(`
    INSERT OR IGNORE INTO inventory_snapshots
      (shopify_inventory_item_id, shopify_location_id, available)
    VALUES (?, ?, ?)
  `).run(
    `gid://shopify/InventoryItem/${level.inventory_item_id}`,
    `gid://shopify/Location/${level.location_id}`,
    level.available,
  );

  if (level.available <= 5) {
    console.warn(`⚠️  Low inventory: item ${level.inventory_item_id} has ${level.available} units`);
    // In production: publish an "also.inventory::low_stock" event → Slack/PagerDuty
  }
}
