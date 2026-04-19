import "dotenv/config";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { ChromaClient } from "chromadb";
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

// Lazily created singleton — ChromaClient connects to localhost:8000 by default.
// For production, set CHROMA_URL in .env and pass { host, port } here.
let _chroma: ChromaClient | undefined;
function getChroma(): ChromaClient {
  if (_chroma === undefined) _chroma = new ChromaClient();
  return _chroma;
}

// Returns one embedding vector per input string.
async function embed(texts: string[]): Promise<number[][]> {
  const voyage = getVoyageClient();
  const resp = await voyage.embed({ input: texts, model: "voyage-3" });
  return (resp.data ?? []).map((d) => d.embedding ?? []);
}

// Summarises a chunk of messages into 2-3 sentences.
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

// One ChromaDB collection per chat, embedding function disabled (we embed manually).
async function getCollection(chatId: string) {
  return getChroma().getOrCreateCollection({
    name: `chat_${chatId}`,
    embeddingFunction: null,
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function ingest(
  chatId: string,
  messages: Message[]
): Promise<void> {
  const col = await getCollection(chatId);
  const bufferId = `__buffer__${chatId}`;

  // Load the existing buffer (stored as a JSON document with no embedding).
  const existing = await col.get({ ids: [bufferId], include: ["documents"] });
  let buffer: Message[] = [];
  const existingDoc = existing.documents[0];
  if (existingDoc != null) {
    buffer = JSON.parse(existingDoc) as Message[];
  }

  buffer = [...buffer, ...messages];

  // Flush full chunks of CHUNK_SIZE.
  while (buffer.length >= CHUNK_SIZE) {
    const chunk = buffer.splice(0, CHUNK_SIZE);

    // Enforce MAX_CHUNKS: remove the chronologically oldest chunk if at limit.
    const snapshot = await col.get({ include: ["metadatas"] });
    const realChunks = snapshot.ids
      .map((id, i) => ({ id, meta: snapshot.metadatas[i] }))
      .filter((e) => !e.id.startsWith("__buffer__"));

    if (realChunks.length >= MAX_CHUNKS) {
      realChunks.sort((a, b) => {
        const at = String(a.meta?.startTime ?? "");
        const bt = String(b.meta?.startTime ?? "");
        return at.localeCompare(bt);
      });
      const oldest = realChunks[0];
      if (oldest !== undefined) {
        await col.delete({ ids: [oldest.id] });
      }
    }

    // Summarise, embed, and store the chunk.
    const speakers = [...new Set(chunk.map((m) => m.speaker))];
    const startTime = chunk[0]?.timestamp ?? "";
    const endTime = chunk[chunk.length - 1]?.timestamp ?? "";
    const summary = await summarize(chunk);

    const embedResult = await embed([summary]);
    const embedding = embedResult[0];
    if (embedding === undefined) throw new Error("embed() returned no results");

    await col.add({
      ids: [randomUUID()],
      embeddings: [embedding],
      documents: [summary],
      metadatas: [{ speakers: JSON.stringify(speakers), startTime, endTime }],
    });
  }

  // Persist the leftover buffer (< CHUNK_SIZE messages) as a plain document.
  await col.upsert({
    ids: [bufferId],
    documents: [JSON.stringify(buffer)],
  });
}

export async function retrieve(
  chatId: string,
  query: string,
  topK: number = 3
): Promise<MemoryResult[]> {
  const col = await getCollection(chatId);

  const embedResult = await embed([query]);
  const queryEmbedding = embedResult[0];
  if (queryEmbedding === undefined) throw new Error("embed() returned no results");

  const raw = await col.query({
    queryEmbeddings: [queryEmbedding],
    nResults: topK + 1, // +1 in case the buffer entry appears in results
    include: ["documents", "metadatas", "distances"],
  });

  const bufferId = `__buffer__${chatId}`;
  const ids = raw.ids[0] ?? [];
  const docs = raw.documents[0] ?? [];
  const metas = raw.metadatas[0] ?? [];
  const dists = raw.distances[0] ?? [];

  const results: MemoryResult[] = [];
  for (let i = 0; i < ids.length && results.length < topK; i++) {
    const id = ids[i];
    if (id === undefined || id === bufferId) continue;

    const doc = docs[i] ?? "";
    const meta = metas[i] ?? null;
    const dist = dists[i] ?? 1;

    results.push({
      content: typeof doc === "string" ? doc : "",
      speakers: JSON.parse(String(meta?.speakers ?? "[]")) as string[],
      startTime: String(meta?.startTime ?? ""),
      endTime: String(meta?.endTime ?? ""),
      relevanceScore: Math.round((1 - (typeof dist === "number" ? dist : 1)) * 1000) / 1000,
    });
  }

  return results;
}

export async function reset(chatId: string): Promise<void> {
  try {
    await getChroma().deleteCollection({ name: `chat_${chatId}` });
  } catch {
    // Ignore — collection may not exist yet.
  }
}

// ── Smoke test ────────────────────────────────────────────────────────────────
// Run with:  npx tsx src/memory.ts
// Requires a local ChromaDB server:  npx chroma run --path /tmp/chroma-test
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const CHAT_ID = "smoke-test";

  // 12 fake messages from three speakers arguing about a tech choice.
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
  console.log("Ingest complete (2 chunks flushed, 0 messages buffered).\n");

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
  console.log("Collection reset. Smoke test complete.");
}
