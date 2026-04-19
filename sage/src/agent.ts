// agent.ts — Author: Bayo Bandele, 4/18/26
// Decides if Sage should speak, and what to say if yes.

import type { Message, MemoryResult } from "./memory.js";
import { retrieve } from "./memory.js";
import { getGeminiClient } from "./utils.js";

export type { Message, MemoryResult };

// What classify() hands back to the caller
export interface ClassifyResult {
  intervene: boolean;
  retrievedContext: MemoryResult[];
  anchorId: string | null;
}

// ── Tuning knobs
const SAGE_NAME = "Sage";
const COOLDOWN_MS = 3 * 60_000; // 3 min between interventions
const TOP_K = 3;

//  Sage's voice/persona
const SAGE_PERSONA = `You are Sage, a longtime participant in this group chat.
You are not an assistant. You do not answer questions or offer help unless directly asked.
You are a neutral witness — you hold the group's shared history and surface it when it matters.
You never take sides, moralize, or lecture. You do not speculate or fill gaps with assumptions.
When you speak, you reference something real from the past — a specific message, a position someone took, a decision the group made.
You keep your responses to 1-2 plain sentences. No markdown. No filler phrases like "Great point" or "Just a reminder."
If you are not certain a past message is relevant, you stay silent.`;

<<<<<<< HEAD
// ── Cooldown timer ────────────────────────────────────────────────────────────
=======
// ── Cooldown timer 
// Tracks when Sage last spoke per chat. Reset by recordSageSent().
>>>>>>> 5a6fb48 (Add landing page, registration flow, and auth backend)
const lastSageSpoke = new Map<string, number>();
const lastMessageTime = new Map<string, number>();

export function recordSageSent(chatId: string): void {
  lastSageSpoke.set(chatId, Date.now());
}

<<<<<<< HEAD
export function recordMessageReceived(chatId: string): void {
  lastMessageTime.set(chatId, Date.now());
}

// ── Intervention gate ─────────────────────────────────────────────────────────
=======
// ── Trigger detection (Gemini)
// Asks Gemini: does this message + past context warrant speaking?
// Returns one of: contradiction | stuck | drift | none
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
  const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  try {
    const parsed = JSON.parse(clean);
    const anchor = parsed.anchorIndex !== null ? memories[parsed.anchorIndex] : undefined;
    const anchorId = anchor ? anchor.startTime : null;
    return { trigger: parsed.trigger ?? "none", anchorId };
  } catch {
    return { trigger: "none", anchorId: null }; // bad response → stay silent
  }
}

// ── Intervention gate 
// Called for every incoming message. Three layers — fail any, Sage stays silent.
>>>>>>> 5a6fb48 (Add landing page, registration flow, and auth backend)
export async function classify(
  chatId: string,
  currentMessage: Message
): Promise<ClassifyResult> {
  const silence: ClassifyResult = { intervene: false, retrievedContext: [], anchorId: null };

  if (currentMessage.speaker === SAGE_NAME) return silence;
  const lastSpoke = lastSageSpoke.get(chatId);
  if (lastSpoke !== undefined && Date.now() - lastSpoke < COOLDOWN_MS) return silence;

  const retrievedContext = await retrieve(chatId, currentMessage.content, TOP_K);
  if (retrievedContext.length === 0) return silence;

  const prompt = `You are Sage, an AI mediator in a group chat.

Current message:
"${currentMessage.speaker}: ${currentMessage.content}"

Relevant past context from this conversation:
${retrievedContext.map((r, i) => `[${i + 1}] ${r.content}`).join("\n")}

Based on the current message and past context, should Sage intervene?
Intervene if:
- Someone is contradicting a past decision
- The group is relitigating something already resolved
- There is confusion about what was previously agreed

Do NOT intervene if:
- The message is casual banter
- The message is a simple question with no tension
- There is no relevant past context

Respond with ONLY valid JSON, no markdown, no backticks:
{"intervene": true, "reason": "brief reason"}
or
{"intervene": false, "reason": "brief reason"}`;

  try {
    const model = getGeminiClient();
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    console.log(`[Agent] Gemini response: ${raw}`);

    const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(clean) as { intervene: boolean; reason: string };
    console.log(`[Agent] Parsed: intervene=${parsed.intervene} reason=${parsed.reason}`);

    return {
      intervene: parsed.intervene,
      retrievedContext,
      anchorId: retrievedContext[0]?.startTime ?? null,
    };
  } catch (e) {
    console.error("[Agent] classify() error:", e);
    return { intervene: false, retrievedContext, anchorId: null };
  }
}

// ── Response generation
// Only runs if classify() said yes. Writes what Sage actually sends.
export async function respond(
  chatId: string,
  context: MemoryResult[],
  currentMessage: Message
): Promise<string> {
  void chatId;
  const model = getGeminiClient();

  const prompt = `You are Sage, a thoughtful AI participant in a group chat.
Your role is to surface relevant past context when the group
is confused or contradicting itself. You are warm, concise,
and non-authoritative — you never make decisions, you only
reframe.

Current message:
"${currentMessage.speaker}: ${currentMessage.content}"

Relevant past context:
${context.map((r, i) => `[${i + 1}] ${r.content} (${new Date(r.startTime).toLocaleDateString()})`).join("\n")}

Write a single short response (2-3 sentences max) that:
- Acknowledges the confusion
- References the specific past context by date and who said what
- Does not take sides or make a decision
- Sounds like a helpful participant, not a bot

Example tone: "Looks like there's some tension here — on April 17th the group agreed on REST, with Jordan and Sam already building around it. Worth aligning before going further."`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

// ── Mention detection ─────────────────────────────────────────────────────────
export function isMentioned(text: string): boolean {
  return /@sage/i.test(text);
}

// ── Silence + conflict detection ──────────────────────────────────────────────
// Called 15-30s after the last message. Returns a proactive message if the
// conversation appears stuck/conflicted, or null if it resolved naturally.
export async function checkSilence(
  chatId: string,
  lastMessageContent: string
): Promise<string | null> {
  const lastSpoke = lastSageSpoke.get(chatId);
  if (lastSpoke !== undefined && Date.now() - lastSpoke < COOLDOWN_MS) return null;

  const recentChunks = await retrieve(chatId, lastMessageContent, TOP_K);
  if (recentChunks.length === 0) return null;

  const model = getGeminiClient();

  const prompt = `You are Sage, a thoughtful AI participant in a group chat. The conversation has gone quiet.

Last message sent:
"${lastMessageContent}"

Recent conversation context:
${recentChunks.map((r, i) => `[${i + 1}] ${r.content}`).join("\n")}

Classify this silence:
- CONFLICT: the last message showed tension, contradiction, confusion, or an unresolved decision — the group may be stuck or unsure how to respond
- RESOLVED: the conversation reached a natural conclusion, agreement, or simply wound down

If CONFLICT: write a short, warm message (2 sentences max) that Sage could send to break the tension or surface the unresolved context. Do not take sides.
If RESOLVED: stay silent.

Respond with ONLY valid JSON:
{"type": "conflict", "message": "what Sage says"}
or
{"type": "resolved"}`;

  try {
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim();
    const clean = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(clean) as { type: "conflict" | "resolved"; message?: string };

    console.log(`[Agent] Silence type: ${parsed.type}`);

    if (parsed.type === "conflict" && parsed.message) {
      recordSageSent(chatId);
      return parsed.message;
    }
    return null;
  } catch (e) {
    console.error("[Agent] checkSilence() error:", e);
    return null;
  }
}
