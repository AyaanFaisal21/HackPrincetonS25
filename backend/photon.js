// ─────────────────────────────────────────────────────────────────────────────
// photon.js — Photon Spectrum iMessage bridge
//
// Photon Spectrum is the hackathon sponsor's iMessage integration layer.
// It provides:
//   - A webhook endpoint: Photon POSTs here when a group message arrives
//   - A send API:         We POST here to push a message into the group chat
//
// Webhook payload shape (what Photon sends us):
//   {
//     "sender":      "+16095550101",
//     "senderName":  "Alex",
//     "groupId":     "iMessage;+;chatXXXXX",
//     "text":        "I think we should pivot to idea B",
//     "timestamp":   "2025-04-18T10:30:00Z",
//     "signature":   "hmac_sha256_hex"   ← for webhook verification
//   }
//
// Send API (what we POST to Photon):
//   POST /v1/messages
//   Body: { "groupId": "...", "text": "Sage: ..." }
//
// ⚠️  Adjust field names below once you have the Photon docs in-hand.
//     The rest of the codebase uses these helpers — only this file changes.
// ─────────────────────────────────────────────────────────────────────────────

import crypto from 'crypto';

const PHOTON_API_URL    = process.env.PHOTON_API_URL    || 'https://api.photonspectrum.com/v1';
const PHOTON_API_KEY    = process.env.PHOTON_API_KEY;
const PHOTON_GROUP_ID   = process.env.PHOTON_GROUP_ID;  // default group
const WEBHOOK_SECRET    = process.env.PHOTON_WEBHOOK_SECRET;

// ── Verify webhook signature from Photon ─────────────────────────────────────
// Call this in your webhook handler before processing the payload.
// Returns true if the signature is valid (or if no secret is configured).

export function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!WEBHOOK_SECRET) return true; // skip verification if secret not set yet
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(expected),
    Buffer.from(signatureHeader || '')
  );
}

// ── Normalize a raw Photon webhook payload ────────────────────────────────────
// Returns a consistent internal shape regardless of Photon's exact field names.

export function parseWebhookPayload(raw) {
  return {
    groupId:   raw.groupId   || raw.group_id   || PHOTON_GROUP_ID,
    sender:    raw.senderName || raw.sender_name || raw.sender || 'Unknown',
    content:   raw.text      || raw.message     || raw.body   || '',
    timestamp: raw.timestamp || new Date().toISOString(),
  };
}

// ── Send a message into the iMessage group ────────────────────────────────────
// groupId defaults to PHOTON_GROUP_ID env var if not specified.

export async function sendMessage(groupIdOrNull, text) {
  const groupId = groupIdOrNull || PHOTON_GROUP_ID;

  if (!PHOTON_API_KEY) {
    // Dev mode: just log instead of erroring
    console.log(`[photon][dev] Would send to ${groupId}: ${text}`);
    return { ok: true, dev: true };
  }

  const res = await fetch(`${PHOTON_API_URL}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${PHOTON_API_KEY}`,
    },
    body: JSON.stringify({ groupId, text }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Photon send failed (${res.status}): ${JSON.stringify(err)}`);
  }

  return res.json();
}
