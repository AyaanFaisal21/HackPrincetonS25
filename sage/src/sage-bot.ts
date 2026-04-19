import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { checkSilence, classify, recordSageSent, respond } from "./agent.js";
import { ingest, retrieve, type Message } from "./memory.js";

const MENTION = /^\s*@sage\b[:,\s]*/i;
const INDIRECT_MENTION =
  /(?:^|[,.!?\s])(?:hey|hi|yo|ok|okay|thanks?|thank\s+you)[\s,]+sage\b|^\s*sage[\s,:!?]/i;
const VIBE_COMMAND = /^\s*(?:set\s+)?vibe\s*[:=-]?\s*(.+)$/i;
const VIBE_QUERY = /^\s*(?:current\s+)?vibe\s*\??\s*$/i;
const HISTORY_LIMIT = 50;
const LONG_TERM_TOP_K = 4;
const SILENCE_DELAY_MS = 20_000;
const VIBE_INFER_MIN_MESSAGES = 8;
const VIBE_INFER_REFRESH_EVERY = 20;

const VIBE_EXTRACTOR_PROMPT = `You read one message where a user explicitly tells Sage what vibe/tone this chat should have.
Output a single concise directive (under 20 words) describing the chat's desired tone, style, or rules.
Examples: "keep it casual and joke-heavy", "professional work channel, formal tone only",
"heavy on nerd references, dry humor welcome", "supportive space, no roasting".
If the message does NOT describe a vibe, output exactly: NONE
Output only the directive text or NONE. No quotes, no prefix, no explanation.`;

const VIBE_INFERENCE_PROMPT = `You read a sample of recent messages from a group chat and infer the chat's tone/vibe.
Output a single concise directive (under 20 words) Sage can use as a persistent behavior guideline.
Examples: "casual and joke-heavy, heavy slang", "professional work channel, formal and concise",
"supportive and warm, no roasting", "dry nerdy humor, niche references welcome".
Base it on how the humans actually talk — vocabulary, punctuation, emoji use, formality, humor.
If the sample is too thin or mixed to judge confidently, output exactly: NONE
Output only the directive or NONE. No quotes, no prefix, no explanation.`;

const INTRO_MESSAGE =
  "hey — i'm sage. feel free to rename this contact to Sage so it's obvious when i'm talking. " +
  "tag me with @sage to ask me anything; otherwise i'll just be around.";

const MENTION_SYSTEM_PROMPT = `You are Sage, a participant in an iMessage group chat.
You are only invoked when someone @-mentions you, so treat every prompt as a direct ask.
Answer like a knowledgeable friend who has already done the legwork — concise, plain-text, 1-4 short sentences.
No markdown, no lists, no headers. iMessage strips formatting anyway.

You have access to three kinds of context:
- RECENT MESSAGES: the last several messages in this chat.
- LONG-TERM MEMORY: summaries of older conversations in this chat, retrieved by relevance.
- GROUP MEMBERS: phone numbers that have spoken in this chat.

When someone asks about a person or references something said earlier, USE that context — quote or paraphrase
what people have actually said. If the context genuinely doesn't contain the answer, say so briefly.

Refer to times relatively, never by literal dates. The current date/time is provided in each prompt as NOW.
Compare message timestamps to NOW and say things like:
- "earlier today", "this morning", "a few minutes ago" (same day)
- "yesterday" (1 day ago)
- "a couple days ago", "earlier this week" (2-6 days)
- "last week", "a couple weeks ago" (7-20 days)
- "last month", "a while back" (> 20 days)
Never say "on April 17th" or any ISO date. Talk like a friend who was there.

For general-knowledge asks, ground your answer in the kinds of places a person would look:
Reddit threads, YouTube videos, blog posts, Wikipedia, National Geographic, academic papers,
official docs, newspaper reporting, Stack Overflow — mention source types casually, never invent URLs
or specific article titles. If the ask is conversational ("hey sage"), just answer naturally.`;

type BufferedMessage = { speaker: string; content: string; timestamp: string };

const historyBySpace = new Map<string, BufferedMessage[]>();
const introducedSpaces = new Set<string>();
const vibeBySpace = new Map<string, string>();
const nonSageCountBySpace = new Map<string, number>();
const lastVibeInferAt = new Map<string, number>();
const silenceTimers = new Map<string, NodeJS.Timeout>();
const lastTextBySpace = new Map<string, string>();

function appendHistory(spaceId: string, msg: BufferedMessage): void {
  const buf = historyBySpace.get(spaceId) ?? [];
  buf.push(msg);
  if (buf.length > HISTORY_LIMIT) buf.splice(0, buf.length - HISTORY_LIMIT);
  historyBySpace.set(spaceId, buf);
}

function formatHistory(spaceId: string): string {
  const buf = historyBySpace.get(spaceId) ?? [];
  if (buf.length === 0) return "(no recent messages yet)";
  return buf.map((m) => `[${m.timestamp}] ${m.speaker}: ${m.content}`).join("\n");
}

function formatMembers(spaceId: string): string {
  const buf = historyBySpace.get(spaceId) ?? [];
  const members = [...new Set(buf.map((m) => m.speaker))];
  return members.length === 0 ? "(unknown)" : members.join(", ");
}

async function formatLongTerm(spaceId: string, query: string): Promise<string> {
  try {
    const hits = await retrieve(spaceId, query, LONG_TERM_TOP_K);
    if (hits.length === 0) return "(none retrieved)";
    return hits
      .map(
        (h) =>
          `[${h.startTime} → ${h.endTime}] speakers=${h.speakers.join(", ")} ` +
          `(relevance ${h.relevanceScore.toFixed(2)}): ${h.content}`
      )
      .join("\n");
  } catch (err) {
    console.warn("long-term retrieve skipped:", (err as Error).message);
    return "(long-term memory unavailable)";
  }
}

function normalizePhone(raw: string | undefined | null): string {
  if (!raw) return "";
  return raw.replace(/[^\d+]/g, "");
}

async function extractVibe(
  text: string,
  genAI: GoogleGenerativeAI
): Promise<string | null> {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: VIBE_EXTRACTOR_PROMPT,
    });
    const result = await model.generateContent(text);
    const out = result.response.text().trim();
    if (!out || /^none$/i.test(out)) return null;
    return out.replace(/^["']|["']$/g, "").slice(0, 200);
  } catch (err) {
    console.warn("vibe extraction failed:", (err as Error).message);
    return null;
  }
}

function maybeInferVibe(
  spaceId: string,
  nonSageCount: number,
  genAI: GoogleGenerativeAI
): void {
  if (nonSageCount < VIBE_INFER_MIN_MESSAGES) return;
  const last = lastVibeInferAt.get(spaceId) ?? 0;
  if (nonSageCount - last < VIBE_INFER_REFRESH_EVERY && last !== 0) return;
  if (last === 0 && nonSageCount !== VIBE_INFER_MIN_MESSAGES) {
    // only fire at the exact threshold for the first inference
    if (nonSageCount < VIBE_INFER_MIN_MESSAGES) return;
  }
  lastVibeInferAt.set(spaceId, nonSageCount);
  void (async () => {
    try {
      const buf = historyBySpace.get(spaceId) ?? [];
      const sample = buf
        .filter((m) => m.speaker !== "Sage")
        .slice(-30)
        .map((m) => `${m.speaker}: ${m.content}`)
        .join("\n");
      if (!sample) return;
      const model = genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        systemInstruction: VIBE_INFERENCE_PROMPT,
      });
      const result = await model.generateContent(sample);
      const out = result.response.text().trim();
      if (!out || /^none$/i.test(out)) return;
      const vibe = out.replace(/^["']|["']$/g, "").slice(0, 200);
      const prior = vibeBySpace.get(spaceId);
      if (prior === vibe) return;
      vibeBySpace.set(spaceId, vibe);
      console.log(`-> vibe inferred for ${spaceId}: ${vibe}`);
    } catch (err) {
      console.warn("vibe inference skipped:", (err as Error).message);
    }
  })();
}

function scheduleSilenceCheck(space: {
  id: string;
  send: (s: string) => Promise<void>;
}): void {
  const existing = silenceTimers.get(space.id);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(async () => {
    silenceTimers.delete(space.id);
    const lastText = lastTextBySpace.get(space.id);
    if (!lastText) return;
    try {
      const reply = await checkSilence(space.id, lastText);
      if (!reply) return;
      await space.send(reply);
      recordSageSent(space.id);
      console.log(`-> silence-break replied in ${space.id}: ${reply}`);
    } catch (err) {
      console.warn("silence check skipped:", (err as Error).message);
    }
  }, SILENCE_DELAY_MS);
  silenceTimers.set(space.id, timer);
}

async function main() {
  const projectId = process.env.PHOTON_PROJECT_ID;
  const projectSecret = process.env.PHOTON_PROJECT_SECRET;
  const sagePhone = normalizePhone(process.env.SAGE_PHONE);
  if (!projectId || !projectSecret) {
    console.error("Set PHOTON_PROJECT_ID and PHOTON_PROJECT_SECRET in .env.");
    process.exit(1);
  }
  if (!sagePhone) {
    console.warn(
      "SAGE_PHONE is not set in .env. Set it to the Photon line's E.164 number " +
        "(e.g. SAGE_PHONE=+14156035536) so Sage recognizes its own messages."
    );
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const mentionModel = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: MENTION_SYSTEM_PROMPT,
  });

  const app = await Spectrum({
    projectId,
    projectSecret,
    providers: [imessage.config()],
  });

  console.log(
    "Sage is online. Mention mode (@sage) + autonomous mode both active on the same context."
  );

  for await (const [space, message] of app.messages) {
    if (message.content.type !== "text") continue;
    const text = message.content.text;

    const rawSenderId = normalizePhone(message.sender?.id);
    const isSageMessage = sagePhone !== "" && rawSenderId === sagePhone;
    const sender = isSageMessage ? "Sage" : message.sender?.id ?? "unknown";
    const timestamp = new Date().toISOString();
    const msg: Message = { speaker: sender, content: text, timestamp };

    appendHistory(space.id, { speaker: sender, content: text, timestamp });

    void (async () => {
      try {
        await ingest(space.id, [msg]);
      } catch (err) {
        console.warn("long-term ingest skipped:", (err as Error).message);
      }
    })();

    // Sage must not react to its own messages.
    if (isSageMessage) continue;

    // First time seeing a group, drop a chill intro.
    const spaceType = (space as { type?: string }).type;
    if (spaceType === "group" && !introducedSpaces.has(space.id)) {
      introducedSpaces.add(space.id);
      void (async () => {
        try {
          await space.send(INTRO_MESSAGE);
          recordSageSent(space.id);
          console.log(`-> introduced self in ${space.id}`);
        } catch (err) {
          console.error("intro send failed:", err);
        }
      })();
    }

    lastTextBySpace.set(space.id, text);
    scheduleSilenceCheck(space);

    const match = text.match(MENTION);
    if (match) {
      await handleMention({
        space,
        sender,
        mentionedPrompt: text.slice(match[0].length).trim(),
        mentionModel,
        genAI,
      });
    } else if (INDIRECT_MENTION.test(text)) {
      await handleMention({
        space,
        sender,
        mentionedPrompt: text.trim(),
        mentionModel,
        genAI,
      });
    } else {
      const count = (nonSageCountBySpace.get(space.id) ?? 0) + 1;
      nonSageCountBySpace.set(space.id, count);
      maybeInferVibe(space.id, count, genAI);
      await handleAutonomous({ space, sender, msg });
    }
  }
}

async function handleMention(args: {
  space: { id: string; send: (s: string) => Promise<void>; type?: string };
  sender: string;
  mentionedPrompt: string;
  mentionModel: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>;
  genAI: GoogleGenerativeAI;
}): Promise<void> {
  const { space, sender, mentionedPrompt, mentionModel, genAI } = args;
  const spaceType = (space as { type?: string }).type ?? "?";
  console.log(
    `[${spaceType} ${space.id}] ${sender} @sage: ${mentionedPrompt || "(empty)"}`
  );

  if (!mentionedPrompt) {
    void space.send("i'm here. ask me something after @sage and i'll dig in.");
    return;
  }

  const queryMatch = mentionedPrompt.match(VIBE_QUERY);
  if (queryMatch) {
    const current = vibeBySpace.get(space.id);
    void space.send(
      current
        ? `current vibe: ${current}.`
        : "no vibe set yet — tell me what tone you want and i'll lock it in."
    );
    return;
  }

  const commandMatch = mentionedPrompt.match(VIBE_COMMAND);
  if (commandMatch) {
    const stated = (commandMatch[1] ?? "").trim();
    const vibe = await extractVibe(stated, genAI);
    if (vibe) {
      vibeBySpace.set(space.id, vibe);
      awaitingVibe.delete(space.id);
      console.log(`-> vibe set for ${space.id}: ${vibe}`);
      void space.send(`got it — keeping it ${vibe} from here on.`);
      recordSageSent(space.id);
    } else {
      void space.send(
        "couldn't pin down a vibe from that — try something like 'vibe: casual and joke-heavy'."
      );
    }
    return;
  }

  void (async () => {
    try {
      const longTerm = await formatLongTerm(space.id, mentionedPrompt);
      const now = new Date().toISOString();
      const vibe = vibeBySpace.get(space.id);
      const vibeLine = vibe
        ? `VIBE DIRECTIVE (honor this in tone and style): ${vibe}\n\n`
        : "";
      const fullPrompt =
        `NOW: ${now}\n\n` +
        vibeLine +
        `GROUP MEMBERS in this chat:\n${formatMembers(space.id)}\n\n` +
        `RECENT MESSAGES (most recent last):\n${formatHistory(space.id)}\n\n` +
        `LONG-TERM MEMORY (retrieved summaries, most relevant first):\n${longTerm}\n\n` +
        `CURRENT ASK from ${sender}:\n${mentionedPrompt}\n\n` +
        `Respond as Sage. Use the context above when relevant. Refer to times relatively vs NOW.`;
      const result = await mentionModel.generateContent(fullPrompt);
      const reply = result.response.text().trim();
      if (!reply) return;
      await space.send(reply);
      recordSageSent(space.id);
      console.log(`-> mention replied: ${reply}`);
    } catch (err) {
      console.error("mention gemini failed:", err);
      await space.send("something went wrong on my end — try again in a sec.");
    }
  })();
}

async function handleAutonomous(args: {
  space: { id: string; send: (s: string) => Promise<void> };
  sender: string;
  msg: Message;
}): Promise<void> {
  const { space, sender, msg } = args;

  void (async () => {
    try {
      const decision = await classify(space.id, msg);
      if (!decision.intervene) return;

      const reply = await respond(
        space.id,
        decision.retrievedContext,
        msg,
        vibeBySpace.get(space.id)
      );
      if (!reply) return;

      await space.send(reply);
      recordSageSent(space.id);
      console.log(`-> autonomous replied to ${sender} in ${space.id}: ${reply}`);
    } catch (err) {
      console.warn("autonomous pipeline skipped:", (err as Error).message);
    }
  })();
}

main().catch(console.error);
