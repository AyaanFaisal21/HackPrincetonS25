import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { classify, recordSageSent, respond } from "./agent.js";
import { ingest, retrieve, type Message } from "./memory.js";

const SAGE_PREFIX = "[Sage]:";
const MENTION = /^\s*@sage\b[:,\s]*/i;
const HISTORY_LIMIT = 50;
const LONG_TERM_TOP_K = 4;

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

async function main() {
  const projectId = process.env.PHOTON_PROJECT_ID;
  const projectSecret = process.env.PHOTON_PROJECT_SECRET;
  if (!projectId || !projectSecret) {
    console.error("Set PHOTON_PROJECT_ID and PHOTON_PROJECT_SECRET in .env.");
    process.exit(1);
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

    const isSageMessage = text.startsWith(SAGE_PREFIX);
    const sender = isSageMessage ? "Sage" : message.sender?.id ?? "unknown";
    const storedText = isSageMessage ? text.slice(SAGE_PREFIX.length).trim() : text;
    const timestamp = new Date().toISOString();
    const msg: Message = { speaker: sender, content: storedText, timestamp };

    appendHistory(space.id, { speaker: sender, content: storedText, timestamp });

    // Long-term ingest: fire-and-forget so a slow embed doesn't block the loop.
    void (async () => {
      try {
        await ingest(space.id, [msg]);
      } catch (err) {
        console.warn("long-term ingest skipped:", (err as Error).message);
      }
    })();

    // Sage must not react to its own messages (would cause cascades).
    if (isSageMessage) continue;

    const match = text.match(MENTION);
    if (match) {
      await handleMention({
        space,
        sender,
        mentionedPrompt: text.slice(match[0].length).trim(),
        mentionModel,
      });
    } else {
      await handleAutonomous({ space, sender, msg });
    }
  }
}

async function handleMention(args: {
  space: { id: string; send: (s: string) => Promise<void>; type?: string };
  sender: string;
  mentionedPrompt: string;
  mentionModel: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>;
}): Promise<void> {
  const { space, sender, mentionedPrompt, mentionModel } = args;
  const spaceType = (space as { type?: string }).type ?? "?";
  console.log(
    `[${spaceType} ${space.id}] ${sender} @sage: ${mentionedPrompt || "(empty)"}`
  );

  if (!mentionedPrompt) {
    void space.send(`${SAGE_PREFIX} I'm here. Ask me something after @sage and I'll dig in.`);
    return;
  }

  void (async () => {
    try {
      const longTerm = await formatLongTerm(space.id, mentionedPrompt);
      const now = new Date().toISOString();
      const fullPrompt =
        `NOW: ${now}\n\n` +
        `GROUP MEMBERS in this chat:\n${formatMembers(space.id)}\n\n` +
        `RECENT MESSAGES (most recent last):\n${formatHistory(space.id)}\n\n` +
        `LONG-TERM MEMORY (retrieved summaries, most relevant first):\n${longTerm}\n\n` +
        `CURRENT ASK from ${sender}:\n${mentionedPrompt}\n\n` +
        `Respond as Sage. Use the context above when relevant. Refer to times relatively vs NOW.`;
      const result = await mentionModel.generateContent(fullPrompt);
      const reply = result.response.text().trim();
      if (!reply) return;
      await space.send(`${SAGE_PREFIX} ${reply}`);
      recordSageSent(space.id); // share cooldown so we don't autonomously speak right after
      console.log(`-> mention replied: ${reply}`);
    } catch (err) {
      console.error("mention gemini failed:", err);
      await space.send(`${SAGE_PREFIX} Something went wrong on my end — try again in a sec.`);
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

      const reply = await respond(space.id, decision.retrievedContext, msg);
      if (!reply) return;

      await space.send(`${SAGE_PREFIX} ${reply}`);
      recordSageSent(space.id);
      console.log(`-> autonomous replied to ${sender} in ${space.id}: ${reply}`);
    } catch (err) {
      console.warn("autonomous pipeline skipped:", (err as Error).message);
    }
  })();
}

main().catch(console.error);
