// ─────────────────────────────────────────────────────────────────────────────
// db.js — SQLite connection + schema bootstrap
//
// Uses better-sqlite3 (synchronous API — keeps code simple for hackathon).
// Database file lives at database/sage.db (auto-created on first run).
// ─────────────────────────────────────────────────────────────────────────────

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_DIR    = join(__dirname, '../database');
const DB_PATH   = join(DB_DIR, 'sage.db');

mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL'); // better concurrent reads
db.pragma('foreign_keys = ON');

// ── Bootstrap schema ─────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id    TEXT    NOT NULL,
    sender      TEXT    NOT NULL,
    content     TEXT    NOT NULL,
    timestamp   TEXT    NOT NULL DEFAULT (datetime('now')),
    embedding   TEXT,
    processed   INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS memories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id    TEXT    NOT NULL,
    type        TEXT    NOT NULL,
    content     TEXT    NOT NULL,
    sender      TEXT,
    timestamp   TEXT    NOT NULL,
    message_id  INTEGER REFERENCES messages(id),
    embedding   TEXT,
    active      INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS interventions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id      TEXT NOT NULL,
    trigger_type  TEXT NOT NULL,
    trigger_desc  TEXT NOT NULL,
    response_text TEXT NOT NULL,
    timestamp     TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_messages_group ON messages(group_id, timestamp);
  CREATE INDEX IF NOT EXISTS idx_memories_group ON memories(group_id, active, type);
  CREATE INDEX IF NOT EXISTS idx_interventions  ON interventions(group_id, timestamp);
`);

export default db;
