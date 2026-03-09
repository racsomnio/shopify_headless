/**
 * Database client
 *
 * Uses better-sqlite3 locally (synchronous, zero-config).
 * To switch to PostgreSQL in production:
 *   1. npm install pg
 *   2. Replace the Database import with `import { Pool } from 'pg'`
 *   3. Wrap queries in async/await — the API is intentionally compatible
 *
 * SQLite ↔ Postgres compatibility notes:
 *   - datetime('now') → NOW()
 *   - INTEGER PRIMARY KEY AUTOINCREMENT → SERIAL PRIMARY KEY
 *   - TEXT → VARCHAR / TEXT (same)
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync } from 'fs';
import config from '../config.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Ensure data directory exists
mkdirSync(dirname(config.db.url), { recursive: true });

const db = new Database(config.db.url, {
  verbose: config.server.nodeEnv === 'development' ? console.log : undefined,
});

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run schema migrations on startup
const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

console.log(`✅ Database connected: ${config.db.url}`);

export default db;
