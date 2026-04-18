// ─────────────────────────────────────────────────────────────────────────────
// intervention.js — THE CORE. Decides when Sage speaks.
//
// Two-stage pipeline (keeps costs low — most messages never hit Stage 2):
//
//   Stage 1 — fast heuristic (synchronous, free):
//     Counts topic repetition, open questions, recent intervention recency.
//     If nothing looks suspicious → SILENT. Done.
//
//   Stage 2 — Claude decision (async, ~$0.001/call):
//     Only runs when Stage 1 says "maybe."
//     Claude reads recent messages + stored memories → structured JSON verdict.
//     If Claude says intervene → semantic search → generate response.
//
// Entry point: runInterventionPipeline(groupId, newMessage)
// ─────────────────────────────────────────────────────────────────────────────

import { getRecent, getMemories, searchRelevant, logIntervention } from './memory.js';
import { checkIntervention, generateResponse } from './claude.js';
import { sendMessage } from './photon.js';

// ── Tuneable thresholds ───────────────────────────────────────────────────────

const RECENT_WINDOW        = 30;   // messages to load for heuristic
const MIN_MESSAGES_BEFORE_SAGE = 5; // don't intervene in tiny conversations
const COOLDOWN_MESSAGES    = 10;   // min messages between Sage interventions
const TOPIC_REPEAT_THRESH  = 3;    // same root word 3+ times → possibly stuck

// ── Stage 1: Heuristic filter ─────────────────────────────────────────────────

function heuristicShouldCheck(recentMessages, groupId) {
  if (recentMessages.length < MIN_MESSAGES_BEFORE_SAGE) {
    return { check: false, reason: 'too few messages' };
  }

  // Don't intervene too soon after last intervention
  // (tracked by counting messages since last one that includes "[Sage]")
  const sageMessages = recentMessages.filter(m => m.sender === 'Sage');
  if (sageMessages.length > 0) {
    const lastSageIdx = recentMessages.map(m => m.sender).lastIndexOf('Sage');
    const messagesSinceSage = recentMessages.length - 1 - lastSageIdx;
    if (messagesSinceSage < COOLDOWN_MESSAGES) {
      return { check: false, reason: `only ${messagesSinceSage} messages since last intervention` };
    }
  }

  // Count how often the same root words appear in the last 15 messages
  const recent15 = recentMessages.slice(-15);
  const words = recent15.flatMap(m => m.content.toLowerCase().match(/\b\w{4,}\b/g) || []);
  const freq  = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  const topRepeats = Object.entries(freq).filter(([, n]) => n >= TOPIC_REPEAT_THRESH);

  if (topRepeats.length > 0) {
    return { check: true, reason: `repeated topics detected: ${topRepeats.map(([w]) => w).join(', ')}` };
  }

  // Look for unresolved question marks in last 10 messages
  const openQuestions = recent15.filter(m => m.content.includes('?')).length;
  if (openQuestions >= 3) {
    return { check: true, reason: `${openQuestions} open questions in recent messages` };
  }

  // Look for contradiction signals: words like "actually", "but wait", "no —", "I thought"
  const contradictionWords = /\b(actually|but wait|i thought|didn't we|we agreed|wasn't it|no —|hold on)\b/i;
  const hasSignal = recent15.some(m => contradictionWords.test(m.content));
  if (hasSignal) {
    return { check: true, reason: 'contradiction signal word detected' };
  }

  return { check: false, reason: 'no heuristic triggers' };
}

// ── Main pipeline ─────────────────────────────────────────────────────────────

export async function runInterventionPipeline(groupId, newMessage) {
  const recentMessages = getRecent(groupId, RECENT_WINDOW);
  const { check, reason: heuristicReason } = heuristicShouldCheck(recentMessages, groupId);

  console.log(`[intervention] heuristic → ${check ? 'CHECK' : 'SILENT'} (${heuristicReason})`);

  if (!check) return { intervened: false };

  // ── Stage 2: Claude decides ───────────────────────────────────────────────

  const memories = getMemories(groupId, null, 30);
  const verdict  = await checkIntervention(recentMessages, memories);

  console.log(`[intervention] Claude verdict →`, verdict);

  if (!verdict.intervene) return { intervened: false };

  // ── Retrieve relevant past context ────────────────────────────────────────

  // Build a search query from the trigger description + current message
  const searchQuery = `${verdict.triggerDesc} ${newMessage.content}`;
  const relevantContext = await searchRelevant(groupId, searchQuery, 8);

  // ── Generate Sage's response ───────────────────────────────────────────────

  const responseText = await generateResponse(
    verdict.triggerDesc,
    relevantContext,
    recentMessages
  );

  const fullResponse = `Sage: ${responseText}`;

  // ── Post to Photon ─────────────────────────────────────────────────────────

  await sendMessage(groupId, fullResponse);

  // ── Log the intervention ───────────────────────────────────────────────────

  logIntervention({
    groupId,
    triggerType:  verdict.triggerType,
    triggerDesc:  verdict.triggerDesc,
    responseText: fullResponse,
  });

  console.log(`[intervention] INTERVENED — ${verdict.triggerType}`);
  console.log(`[intervention] Response: ${fullResponse}`);

  return {
    intervened:  true,
    triggerType: verdict.triggerType,
    triggerDesc: verdict.triggerDesc,
    response:    fullResponse,
  };
}
