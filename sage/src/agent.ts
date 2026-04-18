// ─── agent.ts ─────────────────────────────────────────────────────────────────
// Author: Bayo Bandele — 4/18/26
// The brain of Sage. Every incoming message passes through this file.
// It decides whether Sage should speak (classify) and what to say (respond).
// It never sends anything itself — that's spectrum.ts's job.
// ──────────────────────────────────────────────────────────────────────────────

import type { Message, MemoryResult } from "./memory.js";
import { retrieve } from "./memory.js";
import { getGeminiClient } from "./utils.js";

// Re-export so other files can import these types from agent.ts directly
export type { Message, MemoryResult };

// Shape of the answer classify() returns to the caller
export interface ClassifyResult {
  intervene: boolean;               // should Sage speak?
  retrievedContext: MemoryResult[]; // the past memories that triggered this
  anchorId: string | null;          // timestamp of the specific memory Sage is anchoring to
}

// ─── Policy Constants ─────────────────────────────────────────────────────────
// Author: Bayo Bandele — 4/18/26
// Tune these to make Sage more or less aggressive.

const SAGE_NAME = "Sage";        // must match the sender identity Spectrum sees
const COOLDOWN_MS = 3 * 60_000; // 3 minutes must pass before Sage speaks again per chat
const MIN_RELEVANCE = 0.75;     // memories scoring below this are ignored
const TOP_K = 3;                // how many memories to retrieve per incoming message

// ─── Persona ──────────────────────────────────────────────────────────────────
// Author: Bayo Bandele — 4/18/26
// Sage's voice and character. Injected into every response prompt.
// Change this to shift how Sage sounds — not what it decides.

const SAGE_PERSONA = `You are Sage, a longtime participant in this group chat.
You are not an assistant. You do not answer questions or offer help unless directly asked.
You are a neutral witness — you hold the group's shared history and surface it when it matters.
You never take sides, moralize, or lecture. You do not speculate or fill gaps with assumptions.
When you speak, you reference something real from the past — a specific message, a position someone took, a decision the group made.
You keep your responses to 1-2 plain sentences. No markdown. No filler phrases like "Great point" or "Just a reminder."
If you are not certain a past message is relevant, you stay silent.`;

// ─── Cooldown Timer ───────────────────────────────────────────────────────────
// Author: Bayo Bandele — 4/18/26
// One entry per chat. Stores the timestamp of when Sage last spoke.
// recordSageSent() is called by spectrum.ts after every successful send.

const lastSageSpoke = new Map<string, number>();

export function recordSageSent(chatId: string): void {
  lastSageSpoke.set(chatId, Date.now());
}

// ─── Trigger Classification ───────────────────────────────────────────────────
// Author: Bayo Bandele — 4/18/26
// Private helper. Takes the current message + high-confidence memories
// and asks Gemini to decide: contradiction, stuck, drift, or none.
// This is the only judgment call made by an LLM in the policy.

interface TriggerClassification {
  trigger: "contradiction" | "stuck" | "drift" | "none";
  anchorId: string | null;
}

async function classifyTrigger(
  currentMessage: Message,
  memories: MemoryResult[]
): Promise<TriggerClassification> {
  const model = getGeminiClient();

  const prompt = `You are evaluating whether a group chat agent called Sage should intervene.

CURRENT MESSAGE:
${currentMessage.speaker}: "${currentMessage.content}"

RELEVANT PAST CONTEXT (retrieved from chat history):
${memories
  .map(
    (m, i) =>
      `[${i}] [${m.startTime}] ${m.speakers.join(", ")}: "${m.content}" (relevance: ${m.relevanceScore.toFixed(2)})`
  )
  .join("\n")}

Classify whether Sage should intervene. Return valid JSON only, no markdown:
{
  "trigger": "contradiction" | "stuck" | "drift" | "none",
  "anchorIndex": number | null,
  "reason": "one sentence"
}

Rules:
- "contradiction": current message directly conflicts with a position in the retrieved context
- "stuck": group is going in circles and retrieved context shows a prior resolution or decision
- "drift": current message departs from a hard requirement stated in retrieved context
- "none": no clear intervention warranted
- When in doubt, return "none". Sage speaks rarely and only when grounded in retrieved context.`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text().trim();
  // Strip markdown code fences Gemini sometimes wraps around JSON
  const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    const parsed = JSON.parse(clean);
    const anchor = parsed.anchorIndex !== null ? memories[parsed.anchorIndex] : undefined;
    const anchorId = anchor ? anchor.startTime : null;
    return { trigger: parsed.trigger ?? "none", anchorId };
  } catch {
    // Unparseable response — fail safe, stay silent
    return { trigger: "none", anchorId: null };
  }
}

// ─── Intervention Gate ────────────────────────────────────────────────────────
// Author: Bayo Bandele — 4/18/26
// Main entry point. Called by spectrum.ts for every incoming message.
// Runs three layers in order — any failure returns silence immediately.
//
//   Layer 1 — Hard guards   (instant, no network calls)
//   Layer 2 — Memory check  (retrieve + confidence filter)
//   Layer 3 — Gemini        (trigger classification)

export async function classify(
  chatId: string,
  currentMessage: Message
): Promise<ClassifyResult> {
  const silence: ClassifyResult = { intervene: false, retrievedContext: [], anchorId: null };

  // Layer 1a — never react to Sage's own messages
  if (currentMessage.speaker === SAGE_NAME) return silence;

  // Layer 1b — enforce the 3-minute cooldown per chat
  const lastSpoke = lastSageSpoke.get(chatId);
  if (lastSpoke !== undefined && Date.now() - lastSpoke < COOLDOWN_MS) return silence;

  // Layer 2 — retrieve memories and discard anything below the confidence threshold
  const memories = await retrieve(chatId, currentMessage.content, TOP_K);
  const highConfidence = memories.filter((m) => m.relevanceScore >= MIN_RELEVANCE);
  if (highConfidence.length === 0) return silence;

  // Layer 3 — ask Gemini if the memories justify an intervention
  const { trigger, anchorId } = await classifyTrigger(currentMessage, highConfidence);
  if (trigger === "none") return silence;

  return { intervene: true, retrievedContext: highConfidence, anchorId };
}

// ─── Response Generation ──────────────────────────────────────────────────────
// Author: Bayo Bandele — 4/18/26
// Only called after classify() returns intervene: true.
// Gives Gemini the persona, the current message, and the retrieved context.
// Returns a plain-text string ready to send — spectrum.ts handles the actual send.

export async function respond(
  chatId: string,
  context: MemoryResult[],
  currentMessage: Message
): Promise<string> {
  void chatId;
  const model = getGeminiClient();

  const prompt = `${SAGE_PERSONA}

Ground your response in the retrieved past context below. Do not make up facts.

CURRENT MESSAGE:
${currentMessage.speaker}: "${currentMessage.content}"

RELEVANT PAST CONTEXT:
${context.map((m) => `[${m.startTime}] ${m.speakers.join(", ")}: "${m.content}"`).join("\n")}

Write Sage's response:`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
