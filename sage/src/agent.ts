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
const MIN_RELEVANCE = 0.75;     // ignore memories below this score
const TOP_K = 3;                // max memories to pull per message

//  Sage's voice/persona
const SAGE_PERSONA = `You are Sage, a longtime participant in this group chat.
You are not an assistant. You do not answer questions or offer help unless directly asked.
You are a neutral witness — you hold the group's shared history and surface it when it matters.
You never take sides, moralize, or lecture. You do not speculate or fill gaps with assumptions.
When you speak, you reference something real from the past — a specific message, a position someone took, a decision the group made.
You keep your responses to 1-2 plain sentences. No markdown. No filler phrases like "Great point" or "Just a reminder."
If you are not certain a past message is relevant, you stay silent.`;

// ── Cooldown timer 
// Tracks when Sage last spoke per chat. Reset by recordSageSent().
const lastSageSpoke = new Map<string, number>();

export function recordSageSent(chatId: string): void {
  lastSageSpoke.set(chatId, Date.now());
}

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
export async function classify(
  chatId: string,
  currentMessage: Message
): Promise<ClassifyResult> {
  const silence: ClassifyResult = { intervene: false, retrievedContext: [], anchorId: null };

  if (currentMessage.speaker === SAGE_NAME) return silence;       // Layer 1a: ignore own messages
  const lastSpoke = lastSageSpoke.get(chatId);
  if (lastSpoke !== undefined && Date.now() - lastSpoke < COOLDOWN_MS) return silence; // Layer 1b: cooldown

  const memories = await retrieve(chatId, currentMessage.content, TOP_K);
  const highConfidence = memories.filter((m) => m.relevanceScore >= MIN_RELEVANCE);
  if (highConfidence.length === 0) return silence;                // Layer 2: no strong memories

  const { trigger, anchorId } = await classifyTrigger(currentMessage, highConfidence);
  if (trigger === "none") return silence;                         // Layer 3: Gemini said no

  return { intervene: true, retrievedContext: highConfidence, anchorId };
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
