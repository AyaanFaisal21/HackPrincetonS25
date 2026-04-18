// ─────────────────────────────────────────────────────────────────────────────
// server.js — Entry point
//
// Run with:  node server.js   (or npm run dev for auto-reload)
//
// Endpoints:
//   POST /webhook/photon     ← Photon sends all group messages here
//   GET  /api/messages       ← admin: recent messages
//   GET  /api/memories       ← admin: stored facts
//   GET  /api/interventions  ← admin: Sage's intervention history
//   POST /api/simulate       ← dev: inject a fake message without Photon
// ─────────────────────────────────────────────────────────────────────────────

import express  from 'express';
import cors     from 'cors';
import dotenv   from 'dotenv';
import { verifyWebhookSignature, parseWebhookPayload } from './photon.js';
import { storeMessage, storeMemory, getRecent, getMemories, getInterventions } from './memory.js';
import { extractMemoryItems } from './claude.js';
import { runInterventionPipeline } from './intervention.js';

dotenv.config();

const app      = express();
const PORT     = process.env.PORT || 3001;
const GROUP_ID = process.env.GROUP_ID || 'hackathon-team';

app.use(cors());

// Keep raw body available for webhook signature verification
app.use('/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());

// ── POST /webhook/photon ──────────────────────────────────────────────────────
// Photon POSTs here for every message sent in the iMessage group.
// This is the hot path — must complete quickly (Photon may have a timeout).

app.post('/webhook/photon', async (req, res) => {
  // Verify Photon's HMAC signature
  const signature = req.headers['x-photon-signature'] || req.headers['x-signature'];
  if (!verifyWebhookSignature(req.body, signature)) {
    console.warn('[webhook] invalid signature — rejected');
    return res.status(401).json({ error: 'invalid signature' });
  }

  let payload;
  try {
    payload = parseWebhookPayload(JSON.parse(req.body.toString()));
  } catch {
    return res.status(400).json({ error: 'invalid JSON' });
  }

  const { groupId, sender, content, timestamp } = payload;

  // Ignore empty messages and Sage's own messages (avoid feedback loop)
  if (!content.trim() || sender === 'Sage') {
    return res.json({ ok: true, action: 'ignored' });
  }

  console.log(`[webhook] ${sender}: ${content.slice(0, 80)}`);

  // ── Acknowledge Photon immediately (respond fast) ─────────────────────────
  res.json({ ok: true });

  // ── Process asynchronously ────────────────────────────────────────────────
  setImmediate(async () => {
    try {
      // 1. Store raw message
      const messageId = await storeMessage({ groupId, sender, content, timestamp });

      // 2. Extract memories (positions, decisions, issues)
      const recentContext = getRecent(groupId, 10);
      const memoryItems   = await extractMemoryItems(sender, content, recentContext);

      for (const item of memoryItems) {
        await storeMemory({
          groupId,
          type:      item.type,
          content:   item.content,
          sender:    item.sender,
          timestamp: timestamp || new Date().toISOString(),
          messageId,
        });
        console.log(`[memory] stored ${item.type}: ${item.content.slice(0, 60)}`);
      }

      // 3. Run intervention check
      await runInterventionPipeline(groupId, { sender, content });

    } catch (err) {
      console.error('[webhook] async processing error:', err);
    }
  });
});

// ── Admin / debug endpoints ───────────────────────────────────────────────────

app.get('/api/messages', (req, res) => {
  const messages = getRecent(req.query.groupId || GROUP_ID, parseInt(req.query.limit) || 50);
  res.json(messages);
});

app.get('/api/memories', (req, res) => {
  const memories = getMemories(req.query.groupId || GROUP_ID, req.query.type || null);
  res.json(memories);
});

app.get('/api/interventions', (req, res) => {
  const interventions = getInterventions(req.query.groupId || GROUP_ID);
  res.json(interventions);
});

// Dev endpoint: inject a fake message (no Photon needed for local testing)
app.post('/api/simulate', async (req, res) => {
  const { sender, content, groupId } = req.body;
  if (!sender || !content) {
    return res.status(400).json({ error: 'sender and content required' });
  }

  const gid       = groupId || GROUP_ID;
  const timestamp = new Date().toISOString();
  const messageId = await storeMessage({ groupId: gid, sender, content, timestamp });

  const recentContext = getRecent(gid, 10);
  const memoryItems   = await extractMemoryItems(sender, content, recentContext);
  for (const item of memoryItems) {
    await storeMemory({ groupId: gid, type: item.type, content: item.content, sender: item.sender, timestamp, messageId });
  }

  const result = await runInterventionPipeline(gid, { sender, content });
  res.json({ messageId, memoriesExtracted: memoryItems.length, ...result });
});

// ── Start ──────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Sage backend running → http://localhost:${PORT}`);
  console.log(`Photon webhook URL   → POST http://localhost:${PORT}/webhook/photon`);
  console.log(`Admin dashboard      → http://localhost:${PORT}/api/messages`);
});
