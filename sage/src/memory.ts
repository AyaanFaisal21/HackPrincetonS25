import "dotenv/config";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { getGeminiClient, getVoyageClient } from "./utils.js";

export interface Message {
  speaker: string;
  content: string;
  timestamp: string; // ISO string
}

export interface MemoryResult {
  content: string;
  speakers: string[];
  startTime: string;
  endTime: string;
  relevanceScore: number;
}

const CHUNK_SIZE = 6;
const MAX_CHUNKS = 50;

// ── In-memory store ───────────────────────────────────────────────────────────

interface Chunk {
  id: string;
  embedding: number[];
  document: string;
  speakers: string[];
  startTime: string;
  endTime: string;
}

interface ChatStore {
  chunks: Chunk[];
  buffer: Message[];
}

const store = new Map<string, ChatStore>();

function getStore(chatId: string): ChatStore {
  let s = store.get(chatId);
  if (s === undefined) {
    s = { chunks: [], buffer: [] };
    store.set(chatId, s);
  }
  return s;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function embed(texts: string[]): Promise<number[][]> {
  const voyage = getVoyageClient();
  const resp = await voyage.embed({ input: texts, model: "voyage-3" });
  return (resp.data ?? []).map((d) => d.embedding ?? []);
}

async function summarize(messages: Message[]): Promise<string> {
  const gemini = getGeminiClient();
  const lines = messages.map((m) => `${m.speaker}: ${m.content}`).join("\n");
  const prompt =
    "Summarize the following conversation in 2-3 sentences, capturing " +
    "key positions, concerns, and decisions:\n\n" +
    lines;
  const result = await gemini.generateContent(prompt);
  return result.response.text();
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function ingest(
  chatId: string,
  messages: Message[]
): Promise<void> {
  try {
    const s = getStore(chatId);
    s.buffer = [...s.buffer, ...messages];
    console.log(`[Memory] Buffer: ${s.buffer.length}/${CHUNK_SIZE} messages`);

    while (s.buffer.length >= CHUNK_SIZE) {
      const chunk = s.buffer.splice(0, CHUNK_SIZE);

      if (s.chunks.length >= MAX_CHUNKS) {
        s.chunks.sort((a, b) => a.startTime.localeCompare(b.startTime));
        s.chunks.shift();
      }

      const speakers = [...new Set(chunk.map((m) => m.speaker))];
      const startTime = chunk[0]?.timestamp ?? "";
      const endTime = chunk[chunk.length - 1]?.timestamp ?? "";

      console.log(`[Memory] Summarizing chunk of ${chunk.length} messages...`);
      const summary = await summarize(chunk);
      console.log(`[Memory] Summary: ${summary}`);

      console.log("[Memory] Embedding summary...");
      const embedResult = await embed([summary]);
      const embedding = embedResult[0];
      if (embedding === undefined) throw new Error("embed() returned no results");

      const chunkId = randomUUID();
      s.chunks.push({ id: chunkId, embedding, document: summary, speakers, startTime, endTime });
      console.log(`[Memory] Stored chunk ${chunkId}`);
    }
  } catch (e) {
    console.error("[Memory] Error in ingest():", e);
    throw e;
  }
}

export async function retrieve(
  chatId: string,
  query: string,
  topK: number = 3
): Promise<MemoryResult[]> {
  console.log(`[Memory] Retrieving for query: ${query}`);
  const s = getStore(chatId);

  if (s.chunks.length === 0) {
    console.log("[Memory] No chunks in store — collection is empty");
    return [];
  }

  const embedResult = await embed([query]);
  const queryEmbedding = embedResult[0];
  if (queryEmbedding === undefined) throw new Error("embed() returned no results");

  const results = s.chunks
    .map((c) => ({
      content: c.document,
      speakers: c.speakers,
      startTime: c.startTime,
      endTime: c.endTime,
      relevanceScore: Math.round(cosine(queryEmbedding, c.embedding) * 1000) / 1000,
    }))
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, topK);

  console.log(`[Memory] Found ${results.length} results`);
  results.forEach((r, i) => {
    console.log(`[Memory] Result ${i}: score=${r.relevanceScore} content=${r.content}`);
  });

  return results;
}

export async function reset(chatId: string): Promise<void> {
  store.delete(chatId);
}

// ── Smoke test ────────────────────────────────────────────────────────────────
// Run with:  npx tsx src/memory.ts
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const CHAT_ID = "smoke-test";

  const LINES = [
    "We should use React for the frontend.",
    "I think Vue is a better choice here.",
    "The deadline is Friday — we need to decide today.",
    "Alice, you mentioned React has better ecosystem support?",
    "Yes, and we already have React expertise on the team.",
    "Bob, what's your strongest objection to React?",
    "Learning curve isn't the issue — it's bundle size.",
    "Carol, can you run bundle size benchmarks by tomorrow?",
    "Sure. I'll compare both with tree-shaking enabled.",
    "If bundle size is within 20% we go React, agreed?",
    "Agreed. React it is unless Carol's numbers say otherwise.",
    "I'll have results by 10am. Let's regroup then.",
  ];

  const fakeMessages: Message[] = LINES.map((content, k) => ({
    speaker: k % 3 === 0 ? "Alice" : k % 3 === 1 ? "Bob" : "Carol",
    content,
    timestamp: new Date(Date.now() - (LINES.length - k) * 60_000).toISOString(),
  }));

  console.log(`\nIngesting ${fakeMessages.length} messages into chat "${CHAT_ID}"...`);
  await ingest(CHAT_ID, fakeMessages);
  console.log("Ingest complete.\n");

  const query = "What did the team decide about the frontend framework?";
  console.log(`Retrieving top 3 results for:\n  "${query}"\n`);
  const results = await retrieve(CHAT_ID, query, 3);

  if (results.length === 0) {
    console.log("No results returned.");
  } else {
    for (const r of results) {
      console.log(`score=${r.relevanceScore}  speakers=[${r.speakers.join(", ")}]`);
      console.log(`  ${r.startTime} → ${r.endTime}`);
      console.log(`  ${r.content}\n`);
    }
  }

  await reset(CHAT_ID);
  console.log("Store reset. Smoke test complete.");
}
