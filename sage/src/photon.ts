import "dotenv/config";
import { fileURLToPath } from "node:url";
import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import { ingest, retrieve } from "./memory.js";
import { classify, respond, recordSageSent, recordMessageReceived, checkSilence, isMentioned } from "./agent.js";
import type { Message } from "./memory.js";

const SAGE_PREFIX = "[Sage]:";
const CHAT_ID = process.env.TWILIO_CONVERSATION_SID ?? "photon_chat";

const MEMBER_NAMES: Record<string, string> = {};
void MEMBER_NAMES;

function likelyGroupChatFromSpaceId(spaceId: string): boolean {
  const g = spaceId.toLowerCase();
  if (g.includes(";+;")) return true;
  return /;(sms|imessage);[-+];chat/i.test(g);
}

function extractSpeakerName(sender: unknown): string {
  return JSON.stringify(sender);
}

let firstMessage = true;

// Conflict timers — one per space. Reset on every new message.
const conflictTimers = new Map<string, ReturnType<typeof setTimeout>>();

// Active spaces — for proactive sends.
const activeSpaces = new Map<string, { send: (text: string) => Promise<void> }>();

function scheduleConflictCheck(
  spaceId: string,
  lastMessageContent: string,
  space: { send: (text: string) => Promise<void> }
): void {
  // Clear any pending timer for this space.
  const existing = conflictTimers.get(spaceId);
  if (existing !== undefined) clearTimeout(existing);

  // Random 15–30 second delay.
  const delay = 15_000 + Math.floor(Math.random() * 15_001);

  const timer = setTimeout(() => {
    conflictTimers.delete(spaceId);
    void (async () => {
      try {
        const proactive = await checkSilence(spaceId, lastMessageContent);
        if (proactive) {
          console.log("[Agent] Proactive conflict intervention after silence");
          await space.send(`${SAGE_PREFIX} ${proactive}`);
          console.log("[Photon] Proactive message delivered:", proactive);
        }
      } catch (err) {
        console.error("[Photon] Proactive send failed:", err);
      }
    })();
  }, delay);

  conflictTimers.set(spaceId, timer);
}

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
      activeSpaces.set(space.id, space);

      const derivedGroup = likelyGroupChatFromSpaceId(space.id);
      console.log(`[Photon] Incoming from ${derivedGroup ? "group chat" : "DM"} (space: ${space.id})`);

      if (message.content.type !== "text") continue;

      const text = message.content.text;

      if (text.startsWith(SAGE_PREFIX)) continue;

      const fromSelf = (message as { isFromMe?: boolean }).isFromMe === true;
      if (fromSelf) continue;

      // New message arrived — cancel any pending conflict check.
      const existing = conflictTimers.get(space.id);
      if (existing !== undefined) {
        clearTimeout(existing);
        conflictTimers.delete(space.id);
      }

      recordMessageReceived(space.id);

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

      console.log(`[Photon IN] ${speaker}: "${text}"`);

      const mentioned = isMentioned(text);
      if (mentioned) console.log("[Photon] @sage mentioned — bypassing chunk minimum");

      try {
        await ingest(CHAT_ID, [msg]);
        console.log(`[Photon] Ingested message from ${speaker}`);

        // @sage mention: always respond if there's any memory at all.
        if (mentioned) {
          const chunks = await retrieve(CHAT_ID, text, 3);
          if (chunks.length > 0) {
            console.log("[Photon] Generating mention response...");
            const reply = await respond(CHAT_ID, chunks, msg);
            recordSageSent(CHAT_ID);
            void (async () => {
              try {
                await space.send(`${SAGE_PREFIX} ${reply}`);
                console.log("[Photon] Mention response delivered:", reply);
              } catch (err) {
                console.error("[Photon] Mention send failed:", err);
              }
            })();
          } else {
            console.log("[Photon] Mentioned but no memory yet — staying silent");
          }
          // Schedule conflict check for the next silence window.
          scheduleConflictCheck(space.id, text, space);
          continue;
        }

        console.log("[Photon] Classifying...");
        const result = await classify(CHAT_ID, msg);
        console.log(`[Photon] intervene: ${result.intervene}`);

        if (!result.intervene) {
          console.log("[Photon] Staying silent");
          // Still schedule a conflict check — maybe the silence after this message is telling.
          scheduleConflictCheck(space.id, text, space);
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
