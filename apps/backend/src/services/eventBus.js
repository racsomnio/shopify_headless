/**
 * Event Bus — AWS EventBridge Pattern (local implementation)
 *
 * Models the EventBridge publish/subscribe model:
 *   - Events have: source, detail-type, detail (payload)
 *   - Rules match events by source + detail-type pattern
 *   - Multiple handlers can subscribe to the same event pattern
 *
 * To migrate to real AWS EventBridge:
 *   1. Replace publish() with EventBridgeClient.putEvents()
 *   2. Replace subscribe() with Lambda triggers on EventBridge rules
 *   3. For SQS: publish to SQS queue, Lambda polls the queue
 *
 * EventBridge event structure (mirrored here):
 * {
 *   source:      "shopify.webhook" | "also.rma" | "also.fulfillment"
 *   detail-type: "orders/create"   | "rma.approved" | etc.
 *   detail:      { ...payload }
 *   time:        ISO string
 *   id:          uuid
 * }
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import db from '../db/client.js';

class EventBus extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(50);
  }

  /**
   * Publish an event to the bus
   * Mirrors: EventBridgeClient.putEvents()
   *
   * @param {string} source     - e.g. "shopify.webhook"
   * @param {string} detailType - e.g. "orders/create"
   * @param {object} detail     - arbitrary payload
   */
  publish(source, detailType, detail) {
    const event = {
      id: crypto.randomUUID(),
      source,
      'detail-type': detailType,
      detail,
      time: new Date().toISOString(),
    };

    // Persist to event log for audit/replay
    try {
      db.prepare(`
        INSERT INTO events (source, detail_type, detail)
        VALUES (?, ?, ?)
      `).run(source, detailType, JSON.stringify(detail));
    } catch (err) {
      console.error('Failed to persist event:', err.message);
    }

    console.log(`📨 Event: [${source}] ${detailType}`);

    // Emit on combined key so subscribers can be specific
    this.emit(`${source}::${detailType}`, event);

    // Also emit wildcard for catch-all subscribers
    this.emit('*', event);

    return event;
  }

  /**
   * Subscribe to events matching source + detailType
   * Mirrors: EventBridge Rule + Lambda Target
   *
   * @param {string}   source     - exact match e.g. "shopify.webhook"
   * @param {string}   detailType - exact match e.g. "orders/create"
   * @param {Function} handler    - async (event) => void
   */
  subscribe(source, detailType, handler) {
    const key = `${source}::${detailType}`;

    this.on(key, async (event) => {
      try {
        await handler(event);

        // Mark event as processed in the log
        db.prepare(`
          UPDATE events SET processed = 1
          WHERE source = ? AND detail_type = ? AND id = (
            SELECT MAX(id) FROM events WHERE source = ? AND detail_type = ?
          )
        `).run(source, detailType, source, detailType);
      } catch (err) {
        console.error(`❌ Handler error for [${source}] ${detailType}:`, err.message);

        db.prepare(`
          UPDATE events SET error = ?
          WHERE source = ? AND detail_type = ? AND id = (
            SELECT MAX(id) FROM events WHERE source = ? AND detail_type = ?
          )
        `).run(err.message, source, detailType, source, detailType);
      }
    });

    console.log(`🔔 Subscribed: [${source}] ${detailType}`);
  }

  /**
   * Subscribe to ALL events (catch-all, good for logging/debugging)
   */
  subscribeAll(handler) {
    this.on('*', handler);
  }

  /**
   * Replay unprocessed events from the DB (useful after restart)
   * Mirrors: SQS dead-letter queue reprocessing
   */
  replayUnprocessed() {
    const unprocessed = db.prepare(`
      SELECT * FROM events WHERE processed = 0 AND error IS NULL
      ORDER BY created_at ASC LIMIT 100
    `).all();

    console.log(`🔄 Replaying ${unprocessed.length} unprocessed events...`);

    for (const row of unprocessed) {
      const event = {
        id: row.id.toString(),
        source: row.source,
        'detail-type': row.detail_type,
        detail: JSON.parse(row.detail),
        time: row.created_at,
      };
      this.emit(`${row.source}::${row.detail_type}`, event);
    }
  }
}

// Singleton — one bus for the entire process
export const eventBus = new EventBus();
