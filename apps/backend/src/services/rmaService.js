/**
 * RMA (Return Merchandise Authorization) Service
 *
 * Full return flow for an e-commerce business:
 *   1. Customer requests return → createRMA()
 *   2. Ops team reviews      → approveRMA() or rejectRMA()
 *   3. Item received back    → processRefund() — calls Shopify Admin API
 *   4. Case closed           → closeRMA()
 *
 * RMA states: pending → approved → refunded → closed
 *                    ↘ rejected
 *
 * Each state change publishes an event to the bus for downstream
 * processing (e.g. email notifications, NetSuite journal entries).
 */

import db from '../db/client.js';
import { createRefund, calculateRefund, getOrderById } from './shopifyAdmin.js';
import { eventBus } from './eventBus.js';

/**
 * Generate a human-readable RMA number
 * Format: RMA-YYYY-NNNN (sequential within year)
 */
function generateRMANumber() {
  const year = new Date().getFullYear();
  const count = db.prepare(`
    SELECT COUNT(*) as n FROM rma_requests
    WHERE rma_number LIKE 'RMA-${year}-%'
  `).get().n;

  return `RMA-${year}-${String(count + 1).padStart(4, '0')}`;
}

/**
 * Create a new RMA request
 *
 * @param {object} params
 * @param {string} params.shopifyOrderId  - Shopify GID e.g. gid://shopify/Order/123
 * @param {string} params.customerEmail
 * @param {string} params.reason          - defective | wrong_item | not_as_described | changed_mind | damaged_shipping
 * @param {Array}  params.lineItems       - [{ lineItemId, variantId, quantity, reason }]
 * @param {string} [params.notes]
 */
export async function createRMA({ shopifyOrderId, customerEmail, reason, lineItems, notes = '' }) {
  // Verify the order exists in Shopify before creating an RMA
  const order = await getOrderById(shopifyOrderId);
  if (!order) throw new Error(`Order not found: ${shopifyOrderId}`);

  const rmaNumber = generateRMANumber();

  const result = db.prepare(`
    INSERT INTO rma_requests (
      rma_number, shopify_order_id, order_name,
      customer_email, reason, line_items, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    rmaNumber,
    shopifyOrderId,
    order.name,
    customerEmail,
    reason,
    JSON.stringify(lineItems),
    notes,
  );

  const rma = getRMAById(result.lastInsertRowid);

  eventBus.publish('also.rma', 'rma.created', {
    rmaId: rma.id,
    rmaNumber,
    orderId: shopifyOrderId,
    orderName: order.name,
    reason,
  });

  console.log(`📋 RMA created: ${rmaNumber}`);
  return rma;
}

/**
 * Approve an RMA — ops team confirms the return is legitimate
 */
export async function approveRMA(rmaId) {
  const rma = getRMAById(rmaId);
  if (!rma) throw new Error(`RMA ${rmaId} not found`);
  if (rma.status !== 'pending') throw new Error(`RMA ${rma.rma_number} is ${rma.status}, cannot approve`);

  // Pre-calculate refund amount from Shopify
  const lineItems = JSON.parse(rma.line_items);
  let suggestion;
  try {
    suggestion = await calculateRefund(
      rma.shopify_order_id,
      lineItems.map(li => ({ lineItemId: li.lineItemId, quantity: li.quantity })),
    );
  } catch (err) {
    console.warn('Could not calculate refund preview:', err.message);
  }

  const refundAmount = suggestion?.subtotalSet?.shopMoney?.amount
    ? parseFloat(suggestion.subtotalSet.shopMoney.amount)
    : null;

  db.prepare(`
    UPDATE rma_requests
    SET status = 'approved', refund_amount = ?, approved_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(refundAmount, rmaId);

  const updated = getRMAById(rmaId);

  eventBus.publish('also.rma', 'rma.approved', {
    rmaId,
    rmaNumber: rma.rma_number,
    orderId: rma.shopify_order_id,
    refundAmount,
  });

  console.log(`✅ RMA approved: ${rma.rma_number} — estimated refund: $${refundAmount}`);
  return updated;
}

/**
 * Reject an RMA
 */
export function rejectRMA(rmaId, reason) {
  const rma = getRMAById(rmaId);
  if (!rma) throw new Error(`RMA ${rmaId} not found`);
  if (rma.status !== 'pending') throw new Error(`RMA ${rma.rma_number} is ${rma.status}`);

  db.prepare(`
    UPDATE rma_requests
    SET status = 'rejected', notes = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(`${rma.notes || ''}\nRejection reason: ${reason}`, rmaId);

  eventBus.publish('also.rma', 'rma.rejected', { rmaId, rmaNumber: rma.rma_number });
  return getRMAById(rmaId);
}

/**
 * Process refund — creates actual Shopify refund after item is received
 * Only callable after approval
 */
export async function processRMARefund(rmaId) {
  const rma = getRMAById(rmaId);
  if (!rma) throw new Error(`RMA ${rmaId} not found`);
  if (rma.status !== 'approved') throw new Error(`RMA ${rma.rma_number} must be approved before refunding`);

  const lineItems = JSON.parse(rma.line_items);

  // Create the actual refund in Shopify
  const refund = await createRefund(
    rma.shopify_order_id,
    lineItems.map(li => ({
      lineItemId: li.lineItemId,
      quantity: li.quantity,
      restockType: 'RETURN',
    })),
    `RMA ${rma.rma_number} — ${rma.reason}`,
  );

  const refundAmount = parseFloat(refund.totalRefundedSet?.shopMoney?.amount || 0);

  db.prepare(`
    UPDATE rma_requests
    SET status = 'refunded',
        shopify_refund_id = ?,
        refund_amount = ?,
        refunded_at = datetime('now'),
        updated_at = datetime('now')
    WHERE id = ?
  `).run(refund.id, refundAmount, rmaId);

  eventBus.publish('also.rma', 'rma.refunded', {
    rmaId,
    rmaNumber: rma.rma_number,
    shopifyRefundId: refund.id,
    refundAmount,
  });

  console.log(`💰 Refund processed for ${rma.rma_number}: $${refundAmount} (Shopify: ${refund.id})`);
  return getRMAById(rmaId);
}

/**
 * Close a completed RMA (after refunded)
 */
export function closeRMA(rmaId) {
  const rma = getRMAById(rmaId);
  if (!rma) throw new Error(`RMA ${rmaId} not found`);
  if (rma.status !== 'refunded') throw new Error(`RMA must be in refunded state before closing`);

  db.prepare(`
    UPDATE rma_requests
    SET status = 'closed', closed_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(rmaId);

  eventBus.publish('also.rma', 'rma.closed', { rmaId, rmaNumber: rma.rma_number });
  return getRMAById(rmaId);
}

// ── Query helpers ─────────────────────────────────────────────────────────────

export function getRMAById(id) {
  return db.prepare('SELECT * FROM rma_requests WHERE id = ?').get(id);
}

export function listRMAs({ status, limit = 50, offset = 0 } = {}) {
  if (status) {
    return db.prepare(`
      SELECT * FROM rma_requests WHERE status = ?
      ORDER BY created_at DESC LIMIT ? OFFSET ?
    `).all(status, limit, offset);
  }
  return db.prepare(`
    SELECT * FROM rma_requests
    ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(limit, offset);
}
