import "dotenv/config";
import { fileURLToPath } from "node:url";
import express from "express";
import twilio from "twilio";
import { ingest } from "./memory.js";
import { classify, respond, recordSageSent } from "./agent.js";
import { send } from "./spectrum.js";
import type { Message } from "./memory.js";

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID!;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN!;
const CONVERSATION_SID = process.env.TWILIO_CONVERSATION_SID!;
const FROM_NUMBER = process.env.TWILIO_FROM_NUMBER!;
const PORT = parseInt(process.env.PORT ?? "3001", 10);
const GROUP_CHAT_MEMBERS: string[] = (process.env.GROUP_CHAT_MEMBERS ?? "").split(",").filter(Boolean);

const twilioClient = twilio(ACCOUNT_SID, AUTH_TOKEN);

// Fill phone numbers in before running setup
const MEMBER_NAMES: Record<string, string> = {
  "+16097219222": "Ayaan",
  "+19257910615": "Bayo",
  "+16092508572": "Krish",
};

function isSageAuthor(author: string): boolean {
  return author === "Sage" || author === FROM_NUMBER;
}

function resolveName(author: string): string {
  return MEMBER_NAMES[author] ?? author;
}

export function startServer(): void {
  const app = express();
  app.use(express.urlencoded({ extended: false }));

  app.get("/", (_req, res) => {
    res.status(200).send("Sage server is running");
  });

  app.post("/webhook", async (req, res) => {
    console.log("Webhook received", JSON.stringify(req.body, null, 2));

    // Always acknowledge Twilio immediately with 200.
    res.status(200).send("");

    const body: string = req.body.Body ?? "";
    const author: string = req.body.Author ?? "";

    if (isSageAuthor(author)) return;

    const speaker = resolveName(author);
    const message: Message = {
      speaker,
      content: body,
      timestamp: new Date().toISOString(),
    };

    console.log(`[Twilio IN] ${speaker}: "${body}"`);

    try {
      await ingest(CONVERSATION_SID, [message]);
      console.log(`[Memory] Ingested message from ${message.speaker}`);

      const result = await classify(CONVERSATION_SID, message);

      if (!result.intervene) {
        console.log("[Classify] intervene: false — continuing to listen");
        return;
      }

      console.log("[Classify] intervene: true — intervention triggered");

      if (result.retrievedContext.length > 0) {
        const top = result.retrievedContext[0]!;
        console.log(`[Retrieve] Top match: "${top.content.slice(0, 80)}"`);
      }

      const replyText = await respond(CONVERSATION_SID, result.retrievedContext, message);
      recordSageSent(CONVERSATION_SID);

      console.log(`[Sage → Spectrum]: ${replyText}`);

      // Send via Spectrum DM to each group member — primary delivery path.
      console.log(`[Spectrum] Sending via Spectrum DM to ${GROUP_CHAT_MEMBERS.length} members`);
      for (const member of GROUP_CHAT_MEMBERS) {
        await send(member, replyText);
      }

      // Fallback: also post into Twilio conversation directly
      // in case Spectrum DM delivery is unavailable.
      // Spectrum is the primary path; this is the patch.
      console.log("[Twilio fallback] Posting to conversation as Sage");
      await twilioClient.conversations.v1
        .conversations(CONVERSATION_SID)
        .messages.create({
          author: "Sage",
          body: `Sage: ${replyText}`,
          xTwilioWebhookEnabled: "true",
        });
    } catch (err) {
      console.error("[Error]", err);
    }
  });

  const server = app.listen(PORT, () => {
    console.log(`Webhook URL to paste into Twilio console: http://<your-host>:${PORT}/webhook`);
    console.log(`Listening on port ${PORT}`);
    console.log("Spectrum: primary delivery | Twilio: fallback delivery");
  });

  server.on("error", (err) => {
    console.error("[Server error]", err.message);
    process.exit(1);
  });

  process.on("SIGINT", () => { console.log("Shutting down..."); process.exit(0); });
  process.on("SIGTERM", () => { console.log("Shutting down..."); process.exit(0); });
}

export async function setupConversation(): Promise<void> {
  console.log("Creating Sage Demo conversation...");

  let conversationSid: string;
  try {
    const conversation = await twilioClient.conversations.v1.conversations.create({
      friendlyName: "Sage Demo",
    });
    conversationSid = conversation.sid;
    console.log("Conversation created:", conversationSid);
  } catch (err) {
    console.error("Failed to create conversation (already exists?):", err);
    return;
  }

  for (const memberNumber of GROUP_CHAT_MEMBERS) {
    try {
      await twilioClient.conversations.v1
        .conversations(conversationSid)
        .participants.create({
          "messagingBinding.address": memberNumber,
          "messagingBinding.proxyAddress": FROM_NUMBER,
        });
      console.log("Added participant:", memberNumber);
    } catch (err) {
      console.error("Failed to add participant", memberNumber, ":", err);
    }
  }

  console.log("\nDone. Paste this into your .env as TWILIO_CONVERSATION_SID:");
  console.log(`TWILIO_CONVERSATION_SID=${conversationSid}`);
}

export async function teardownConversation(): Promise<void> {
  try {
    await twilioClient.conversations.v1.conversations(CONVERSATION_SID).remove();
    console.log("Conversation deleted:", CONVERSATION_SID);
  } catch {
    // Ignore — conversation may not exist.
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const arg = process.argv[2];
  if (arg === "setup") setupConversation().then(() => process.exit(0));
  else if (arg === "teardown") teardownConversation().then(() => process.exit(0));
  else startServer();
}
