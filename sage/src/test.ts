import { fileURLToPath } from "node:url";
import { ingest, retrieve, reset } from "./memory.js";
import { classify, respond } from "./agent.js";
import type { Message } from "./memory.js";

const CHAT_ID = "test_chat";

async function runTest(): Promise<void> {
  try {
    console.log("Resetting memory...");
    await reset(CHAT_ID);

    const twoDaysAgo = (offsetMinutes: number) =>
      new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + offsetMinutes * 60 * 1000).toISOString();
    const oneDayAgo = (offsetMinutes: number) =>
      new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + offsetMinutes * 60 * 1000).toISOString();
    const today = (offsetMinutes: number) =>
      new Date(Date.now() + offsetMinutes * 60 * 1000).toISOString();

    const batch1: Message[] = [
      { speaker: "Alex",   content: "okay so I think we should definitely use a REST API for the backend", timestamp: twoDaysAgo(0) },
      { speaker: "Jordan", content: "agreed, REST makes sense, we all know it",                             timestamp: twoDaysAgo(1) },
      { speaker: "Sam",    content: "yeah REST is fine, lets go with that",                                 timestamp: twoDaysAgo(2) },
      { speaker: "Alex",   content: "cool so that's decided, REST API it is",                               timestamp: twoDaysAgo(3) },
      { speaker: "Jordan", content: "great, I'll start building the endpoints tomorrow",                    timestamp: twoDaysAgo(4) },
      { speaker: "Sam",    content: "sounds good, I'll work on the frontend to match",                      timestamp: twoDaysAgo(5) },
    ];

    const batch2: Message[] = [
      { speaker: "Alex",   content: "hey so I was reading about GraphQL last night",         timestamp: oneDayAgo(0) },
      { speaker: "Jordan", content: "oh yeah? what about it",                                timestamp: oneDayAgo(1) },
      { speaker: "Alex",   content: "I think we should switch to GraphQL actually",          timestamp: oneDayAgo(2) },
      { speaker: "Jordan", content: "wait what, we already decided on REST",                 timestamp: oneDayAgo(3) },
      { speaker: "Sam",    content: "lol what is happening",                                 timestamp: oneDayAgo(4) },
      { speaker: "Alex",   content: "no GraphQL is just better for what we're building",    timestamp: oneDayAgo(5) },
    ];

    const batch3: Message[] = [
      { speaker: "Jordan", content: "I've already built half the REST endpoints",            timestamp: today(0) },
      { speaker: "Sam",    content: "same I built the frontend around REST",                 timestamp: today(1) },
      { speaker: "Alex",   content: "okay but hear me out GraphQL would save us time",      timestamp: today(2) },
      { speaker: "Jordan", content: "how would switching NOW save us time",                  timestamp: today(3) },
    ];

    console.log("Ingesting batch 1 (2 days ago)...");
    await ingest(CHAT_ID, batch1);
    console.log("Ingesting batch 2 (1 day ago)...");
    await ingest(CHAT_ID, batch2);
    console.log("Ingesting batch 3 (today)...");
    await ingest(CHAT_ID, batch3);
    console.log("Ingestion complete.\n");

    const finalMessage: Message = {
      speaker: "Sam",
      content: "I'm so confused, I thought we decided on REST two days ago?",
      timestamp: new Date().toISOString(),
    };

    console.log(`Running final message through pipeline:\n  ${finalMessage.speaker}: "${finalMessage.content}"\n`);

    const classifyResult = await classify(CHAT_ID, finalMessage);

    console.log("=== PIPELINE RESULT ===");
    console.log("Intervene:", classifyResult.intervene);
    console.log("Retrieved context:", JSON.stringify(classifyResult.retrievedContext, null, 2));

    if (classifyResult.intervene) {
      const reply = await respond(CHAT_ID, classifyResult.retrievedContext, finalMessage);
      console.log("\nSage says:", reply);
    } else {
      console.log("\nSage stayed silent (unexpected for this test)");
    }
  } catch (e) {
    console.error("Test failed:", e);
    throw e;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runTest().then(() => process.exit(0)).catch(e => {
    console.error(e);
    process.exit(1);
  });
}
