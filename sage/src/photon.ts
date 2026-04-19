import "dotenv/config";
import { fileURLToPath } from "node:url";
import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import { ingest } from "./memory.js";
import { classify, respond, recordSageSent } from "./agent.js";
import type { Message } from "./memory.js";

const SAGE_PREFIX = "[Sage]:";
const CHAT_ID = process.env.TWILIO_CONVERSATION_SID ?? "photon_chat";

const MEMBER_NAMES: Record<string, string> = {};

function likelyGroupChatFromSpaceId(spaceId: string): boolean {
  const g = spaceId.toLowerCase();
  if (g.includes(";+;")) return true;
  return /;(sms|imessage);[-+];chat/i.test(g);
}

function extractSpeakerName(sender: unknown): string {
  return JSON.stringify(sender);
}

let firstMessage = true;

export async function startPhoton(): Promise<void> {
  const projectId = process.env.PHOTON_PROJECT_ID;
  const projectSecret = process.env.PHOTON_PROJECT_SECRET;
  if (!projectId || !projectSecret) {
    console.error(
      "Set PHOTON_PROJECT_ID and PHOTON_PROJECT_SECRET in .env (Photon dashboard → Project settings)."
    );
    process.exit(1);
  }

  const app = await Spectrum({
    projectId,
    projectSecret,
    providers: [imessage.config()],
  });

  console.log("Sage is listening via Photon/Spectrum (iMessage). Ctrl+C to stop.");

  try {
    for await (const [space, message] of app.messages) {
      const derivedGroup = likelyGroupChatFromSpaceId(space.id);
      console.log(`[Photon] Incoming from ${derivedGroup ? "group chat" : "DM"} (space: ${space.id})`);

      if (message.content.type !== "text") continue;

      const text = message.content.text;

      if (text.startsWith(SAGE_PREFIX)) continue;

      const fromSelf = (message as { isFromMe?: boolean }).isFromMe === true;
      if (fromSelf) continue;

      if (firstMessage) {
        console.log("[Photon] First message — full sender shape:", JSON.stringify(message.sender, null, 2));
        firstMessage = false;
      }

      const speaker = extractSpeakerName(message.sender);
      const msg: Message = {
        speaker,
        content: text,
        timestamp: message.timestamp.toISOString(),
      };

      console.log(`[Twilio IN] ${speaker}: "${text}"`);

      try {
        await ingest(CHAT_ID, [msg]);
        console.log(`[Photon] Ingested message from ${speaker}`);

        console.log("[Photon] Classifying...");
        const result = await classify(CHAT_ID, msg);
        console.log(`[Photon] intervene: ${result.intervene}`);

        if (!result.intervene) {
          console.log("[Photon] Staying silent");
          continue;
        }

        console.log("[Photon] Generating response...");
        const reply = await respond(CHAT_ID, result.retrievedContext, msg);
        recordSageSent(CHAT_ID);
        console.log("[Photon] Intervention triggered");

        void (async () => {
          try {
            await space.send(`${SAGE_PREFIX} ${reply}`);
            console.log("[Photon] Delivered to chat:", reply);
          } catch (err) {
            console.error("[Photon] Send failed:", err);
          }
        })();
      } catch (err) {
        console.error("[Photon] Pipeline error:", err);
      }
    }
    console.warn("[Photon] Message stream ended cleanly.");
  } catch (err) {
    console.error("[Photon] Message stream errored:", err);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startPhoton().catch(console.error);
}
