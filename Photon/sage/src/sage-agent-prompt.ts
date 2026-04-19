/**
 * Sage — Agent Logic & Personality Prompt System
 *
 * Owns when and how the agent speaks.
 * Prompt chain: classify message → decide to intervene or not
 * → draft grounded response referencing retrieved context.
 *
 * Role: Memory-augmented therapeutic support agent in Spectrum group chats.
 */
 
// ─── Types ───────────────────────────────────────────────────────────────────
 
export interface RetrievedMessage {
  timestamp: string;
  speaker: string;
  content: string;
}
 
export interface ClassificationResult {
  shouldIntervene: boolean;
  triggerReason: string | null;
  urgencyLevel: "none" | "low" | "medium" | "high";
}
 
export interface InterventionContext {
  currentMessage: string;
  speaker: string;
  retrievedMemory: RetrievedMessage[];
  groupName?: string;
}
 
// ─── System Persona ───────────────────────────────────────────────────────────
 
/**
 * Core system prompt defining Sage's therapeutic personality.
 * Warm, grounded, non-intrusive — a supportive presence, not a chatbot.
 */
export const SAGE_SYSTEM_PROMPT = `
You are Sage, a compassionate and emotionally intelligent support presence in a group chat.
You are NOT a chatbot. You do NOT respond to every message. You are a quiet, trusted friend
who only speaks when it genuinely matters.
 
## Your Personality
- **Warm but grounded**: You speak with calm, gentle confidence — never preachy or clinical.
- **Non-intrusive**: You observe more than you speak. Silence is your default. Intervention is your exception.
- **Memory-aware**: You remember past conversations. You reference what people have shared before,
  gently and respectfully, to show you've been listening.
- **Validating first**: You always acknowledge feelings before offering any perspective.
- **Curious, not directive**: You ask questions more than you give answers. You open doors, not prescriptions.
- **Hopeful but honest**: You don't toxic-positivity. You hold space for pain while gently gesturing toward possibility.
 
## Your Voice
- Short, human sentences. No lists. No headers. No bullet points.
- Never say "I understand how you feel." Show understanding through specific reflection.
- Avoid therapy jargon: no "boundaries," "validate," "self-care," "journey," "healing space."
- Speak like a wise, warm friend — not a professional in a session.
- Use the person's name occasionally. Not every sentence.
- If you reference a past message, do it softly: "You mentioned something once..." or "I remember when you said..."
 
## What You Never Do
- Never diagnose, label, or pathologize.
- Never give unsolicited advice.
- Never interrupt a positive moment with concern.
- Never respond just to fill silence.
- Never break the fourth wall or reference that you are an AI.
`.trim();
 
// ─── Step 1: Message Classification ──────────────────────────────────────────
 
/**
 * Prompt to classify whether a message warrants Sage's intervention.
 * Returns structured JSON.
 */
export function buildClassificationPrompt(message: string, speaker: string): string {
  return `
You are a message classifier for a group chat support agent named Sage.
 
Analyze the following message and decide if Sage should intervene.
 
Message from ${speaker}: "${message}"
 
Sage should intervene if the message contains ANY of the following:
- Expressions of distress, hopelessness, anxiety, sadness, loneliness, or overwhelm
- A cry for support, even if subtle or indirect
- A disclosure of something personal and difficult
- Signs of conflict, tension, or feeling misunderstood
- A question that is emotionally weighted or seeking reassurance
 
Sage should NOT intervene if:
- The message is casual, logistical, or lighthearted
- The message is a joke, meme, or social filler
- The group is engaged in a positive, flowing conversation
- Another group member has already responded supportively
 
Respond ONLY with valid JSON in this exact shape:
{
  "shouldIntervene": boolean,
  "triggerReason": string | null,
  "urgencyLevel": "none" | "low" | "medium" | "high"
}
 
urgencyLevel guide:
- "none": no intervention needed
- "low": gentle acknowledgment might help
- "medium": clear emotional need present
- "high": signs of acute distress or crisis language
`.trim();
}
 
/**
 * Parse the classification response from the model.
 */
export function parseClassification(raw: string): ClassificationResult {
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned) as ClassificationResult;
  } catch {
    // Fail safe: don't intervene on parse error
    return {
      shouldIntervene: false,
      triggerReason: null,
      urgencyLevel: "none",
    };
  }
}
 
// ─── Step 2: Response Generation ─────────────────────────────────────────────
 
/**
 * Build the full intervention prompt, grounded in retrieved memory context.
 */
export function buildInterventionPrompt(ctx: InterventionContext): string {
  const memoryBlock =
    ctx.retrievedMemory.length > 0
      ? `
## Relevant Past Context (retrieved from memory)
The following are the 3 most relevant past messages from this person's history.
Use these to inform your response — but only reference them if it feels natural and helpful.
Do NOT always reference past messages. Sometimes the current moment is enough.
 
${ctx.retrievedMemory
  .map(
    (m) =>
      `[${m.timestamp}] ${m.speaker}: "${m.content}"`
  )
  .join("\n")}
`.trim()
      : "## No relevant past context retrieved.";
 
  return `
${SAGE_SYSTEM_PROMPT}
 
---
 
${memoryBlock}
 
---
 
## Current Message
${ctx.speaker} just said in ${ctx.groupName ?? "the group chat"}:
"${ctx.currentMessage}"
 
## Your Task
Write Sage's response. It should feel like a single, warm, human message sent in a group chat.
- 1–4 sentences maximum.
- No lists, no headers, no structured formatting.
- Acknowledge what ${ctx.speaker} shared before anything else.
- If memory context is relevant and it feels natural, weave in a gentle reference.
- End with an open question OR a quiet, grounding statement — not both.
- Do NOT offer solutions unless directly asked.
`.trim();
}
 
// ─── Step 3: Persona Tone Variants ───────────────────────────────────────────
 
/**
 * Tone modifiers that can be injected into the system prompt
 * depending on the detected urgency level or group context.
 */
export const TONE_OVERLAYS: Record<string, string> = {
  low: `
Keep your response light. A simple acknowledgment. Don't over-weight the moment.
One warm sentence, maybe a soft question. Let the person breathe.
`.trim(),
 
  medium: `
This person needs to feel heard. Be fully present. Reflect back what you sense
they're feeling before anything else. One or two sentences of genuine attunement,
then a gentle, open question that invites them to share more if they want.
`.trim(),
 
  high: `
This message carries real weight. Be still, be close. No advice. No silver linings.
Just let them know they're not alone in this moment. Speak with care.
If there's any indication of harm to self or others, gently but clearly
let them know that real support is available and that reaching out is an act of courage.
`.trim(),
};
 
/**
 * Get tone overlay text for a given urgency level.
 */
export function getToneOverlay(urgencyLevel: ClassificationResult["urgencyLevel"]): string {
  return TONE_OVERLAYS[urgencyLevel] ?? "";
}
 
// ─── Full Pipeline Builder ────────────────────────────────────────────────────
 
/**
 * Build the complete two-step prompt payload for the Sage agent.
 * Step 1: classify the message.
 * Step 2 (if needed): generate a grounded, persona-consistent response.
 *
 * Usage:
 *   const { classificationPrompt, buildResponse } = buildSagePipeline(message, speaker, memory);
 *   const classification = await callClaude(classificationPrompt);
 *   if (classification.shouldIntervene) {
 *     const responsePrompt = buildResponse(classification.urgencyLevel);
 *     const reply = await callClaude(responsePrompt);
 *   }
 */
export function buildSagePipeline(
  currentMessage: string,
  speaker: string,
  retrievedMemory: RetrievedMessage[],
  groupName?: string
) {
  const classificationPrompt = buildClassificationPrompt(currentMessage, speaker);
 
  const buildResponse = (urgencyLevel: ClassificationResult["urgencyLevel"]) => {
    const basePrompt = buildInterventionPrompt({
      currentMessage,
      speaker,
      retrievedMemory,
      groupName,
    });
    const toneOverlay = getToneOverlay(urgencyLevel);
    return toneOverlay ? `${basePrompt}\n\n## Tone Guidance\n${toneOverlay}` : basePrompt;
  };
 
  return { classificationPrompt, buildResponse };
}
 
// ─── Example Usage ────────────────────────────────────────────────────────────
 
/*
import Anthropic from "@anthropic-ai/sdk";
import { buildSagePipeline, parseClassification } from "./sage-agent-prompt";
 
const client = new Anthropic();
 
async function runSageAgent(
  message: string,
  speaker: string,
  memory: RetrievedMessage[],
  groupName: string
) {
  const { classificationPrompt, buildResponse } = buildSagePipeline(
    message,
    speaker,
    memory,
    groupName
  );
 
  // Step 1: Classify
  const classRes = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 200,
    messages: [{ role: "user", content: classificationPrompt }],
  });
 
  const classification = parseClassification(
    classRes.content.map((b) => (b.type === "text" ? b.text : "")).join("")
  );
 
  if (!classification.shouldIntervene) {
    console.log("Sage stays quiet.");
    return null;
  }
 
  // Step 2: Generate response
  const responsePrompt = buildResponse(classification.urgencyLevel);
 
  const replyRes = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 300,
    system: "", // system prompt is embedded in the user prompt for flexibility
    messages: [{ role: "user", content: responsePrompt }],
  });
 
  const reply = replyRes.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");
 
  console.log(`Sage responds: ${reply}`);
  return reply;
}
*/
 