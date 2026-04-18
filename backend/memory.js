// ─────────────────────────────────────────────────────────────────────────────
// memory.js — Message storage, embedding, and semantic retrieval
//
// Responsibilities:
//   storeMessage()    → persist a raw message + generate its embedding
//   getRecent()       → last N messages (for intervention context window)
//   getMemories()     → active structured facts (positions, decisions, issues)
//   storeMemory()     → persist an extracted fact
//   searchRelevant()  → cosine similarity search over embedded messages/memories
//   markProcessed()   → flag a message as memory-extracted
// ─────────────────────────────────────────────────────────────────────────────

import OpenAI from 'openai';
import db from './db.js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── Embedding ─────────────────────────────────────────────────────────────────

async function embed(text) {
  try {
    const res = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text.slice(0, 8000), // API limit safety
    });
    return res.data[0].embedding; // float[]
  } catch (err) {
    console.warn('[memory] embed failed, skipping:', err.message);
    return null;
  }
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ── Messages ─────────────────────────────────────────────────────────────────

export async function storeMessage({ groupId, sender, content, timestamp }) {
  const ts = timestamp || new Date().toISOString();

  // Insert first so we have an ID while embedding runs (async)
  const { lastInsertRowid } = db
    .prepare('INSERT INTO messages (group_id, sender, content, timestamp) VALUES (?, ?, ?, ?)')
    .run(groupId, sender, content, ts);

  // Embed asynchronously — don't block the webhook response
  embed(`${sender}: ${content}`).then(vec => {
    if (vec) {
      db.prepare('UPDATE messages SET embedding = ? WHERE id = ?')
        .run(JSON.stringify(vec), lastInsertRowid);
    }
  });

  return lastInsertRowid;
}

export function getRecent(groupId, limit = 30) {
  return db
    .prepare(`
      SELECT id, sender, content, timestamp
      FROM messages
      WHERE group_id = ?
      ORDER BY timestamp DESC
      LIMIT ?
    `)
    .all(groupId, limit)
    .reverse(); // chronological order
}

export function markProcessed(messageId) {
  db.prepare('UPDATE messages SET processed = 1 WHERE id = ?').run(messageId);
}

// ── Memories ─────────────────────────────────────────────────────────────────

export async function storeMemory({ groupId, type, content, sender, timestamp, messageId }) {
  const ts = timestamp || new Date().toISOString();
  const { lastInsertRowid } = db
    .prepare(`
      INSERT INTO memories (group_id, type, content, sender, timestamp, message_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(groupId, type, content, sender || null, ts, messageId || null);

  embed(content).then(vec => {
    if (vec) {
      db.prepare('UPDATE memories SET embedding = ? WHERE id = ?')
        .run(JSON.stringify(vec), lastInsertRowid);
    }
  });

  return lastInsertRowid;
}

export function getMemories(groupId, type = null, limit = 50) {
  const query = type
    ? 'SELECT * FROM memories WHERE group_id = ? AND type = ? AND active = 1 ORDER BY timestamp DESC LIMIT ?'
    : 'SELECT * FROM memories WHERE group_id = ? AND active = 1 ORDER BY timestamp DESC LIMIT ?';
  const params = type ? [groupId, type, limit] : [groupId, limit];
  return db.prepare(query).all(...params);
}

export function deactivateMemory(memoryId) {
  db.prepare('UPDATE memories SET active = 0 WHERE id = ?').run(memoryId);
}

// ── Semantic search ───────────────────────────────────────────────────────────

// Search messages AND memories for context most relevant to `query`.
// Returns top-k results sorted by similarity, with their source type.
export async function searchRelevant(groupId, query, limit = 8) {
  const queryVec = await embed(query);
  if (!queryVec) return [];

  // Pull all rows that have embeddings
  const messages = db
    .prepare('SELECT id, sender, content, timestamp, embedding, "message" as source FROM messages WHERE group_id = ? AND embedding IS NOT NULL')
    .all(groupId);

  const memories = db
    .prepare('SELECT id, sender, content, timestamp, embedding, type as source FROM memories WHERE group_id = ? AND active = 1 AND embedding IS NOT NULL')
    .all(groupId);

  const candidates = [...messages, ...memories].map(row => ({
    ...row,
    score: cosineSimilarity(queryVec, JSON.parse(row.embedding)),
  }));

  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ embedding: _e, score: _s, ...rest }) => rest); // strip internal fields
}

// ── Intervention log ──────────────────────────────────────────────────────────

export function logIntervention({ groupId, triggerType, triggerDesc, responseText }) {
  db.prepare(`
    INSERT INTO interventions (group_id, trigger_type, trigger_desc, response_text)
    VALUES (?, ?, ?, ?)
  `).run(groupId, triggerType, triggerDesc, responseText);
}

export function getInterventions(groupId, limit = 20) {
  return db
    .prepare('SELECT * FROM interventions WHERE group_id = ? ORDER BY timestamp DESC LIMIT ?')
    .all(groupId, limit);
}
