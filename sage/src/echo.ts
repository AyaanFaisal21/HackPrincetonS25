// echo.ts — Author: Bayo Bandele, 4/18/26
// Connects to iMessage via Spectrum. Routes every message through the agent pipeline.

import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import "dotenv/config";
import { classify, respond, recordSageSent } from "./agent.js";
import type { Message } from "./agent.js";
import { ingest } from "./memory.js";

const SAGE_PREFIX = "[Sage]:";

// Detects group chats from the space ID format Spectrum uses
function likelyGroupChatFromSpaceId(spaceId: string): boolean {
  const g = spaceId.toLowerCase();
  if (g.includes(";+;")) return true;
  return /;(sms|imessage);[-+];chat/i.test(g);
}

// Safe snapshot for logging (avoids circular refs)
function messageForLog(message: {
  id: string;
  platform: string;
  content: unknown;
  sender: unknown;
  space: { id: string };
  timestamp: Date;
}) {
  const space = message.space as { id: string; type?: string };
  return {
    id: message.id,
    platform: message.platform,
    content: message.content,
    sender: message.sender,
    space: { id: space.id, type: space.type },
    timestamp: message.timestamp,
  };
}

// Prints your Photon iMessage line(s) on startup so you know which number to text
async function logPhotonImessageLines(projectId: string, projectSecret: string): Promise<void> {
  const host = process.env.SPECTRUM_CLOUD_URL ?? "spectrum.photon.codes";
  const base = host.startsWith("http") ? host : `https://${host}`;
  const url = `${base.replace(/\/$/, "")}/projects/${projectId}/lines/?platform=imessage`;
  const auth = Buffer.from(`${projectId}:${projectSecret}`, "utf8").toString("base64");
  try {
    const res = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });
    const body = (await res.json()) as {
      succeed?: boolean;
      data?: { lines?: Array<{ platform: string; phoneNumber?: string }> };
    };
    if (!res.ok || !body.succeed || !body.data?.lines?.length) {
      console.warn("Could not list Photon iMessage lines. Status:", res.status);
      return;
    }
    const numbers = body.data.lines
      .filter((l) => l.platform === "imessage" && l.phoneNumber)
      .map((l) => l.phoneNumber as string);
    if (numbers.length === 0) {
      console.warn("No iMessage phone lines found for this project.");
      return;
    }
    console.log("\n>>> Your Photon iMessage line(s):\n   ", numbers.join("\n    "), "\n");
  } catch (e) {
    console.warn("Could not fetch project lines (optional):", e);
  }
}

async function main() {
  const projectId = process.env.PHOTON_PROJECT_ID;
  const projectSecret = process.env.PHOTON_PROJECT_SECRET;
  if (!projectId || !projectSecret) {
    console.error("Set PHOTON_PROJECT_ID and PHOTON_PROJECT_SECRET in .env");
    process.exit(1);
  }

  await logPhotonImessageLines(projectId, projectSecret);

  const app = await Spectrum({
    projectId,
    projectSecret,
    providers: [imessage.config()],
  });

  console.log("Sage is listening (iMessage: DMs and group chats). Ctrl+C to stop.");

  try {
    for await (const [space, message] of app.messages) {
      const spaceMeta = space as { id: string; type?: "dm" | "group" };
      const derivedGroup = likelyGroupChatFromSpaceId(space.id);
      console.log("Incoming:", JSON.stringify({
        spaceType: spaceMeta.type,
        spaceId: space.id,
        derivedLikelyGroup: derivedGroup,
        contentType: message.content.type,
      }));
      console.log("Full:", JSON.stringify(messageForLog(message), null, 2));

      // Only handle text messages
      if (message.content.type !== "text") continue;
      const text = message.content.text;

      // Guard: ignore Sage's own sent messages
      if (text.startsWith(SAGE_PREFIX)) continue;
      const fromSelf = (message as { isFromMe?: boolean }).isFromMe === true;
      if (fromSelf) continue;

      // Map Spectrum message → agent Message shape
      const senderRaw = message.sender as { name?: string; handle?: string } | string | null;
      const speaker =
        typeof senderRaw === "string"
          ? senderRaw
          : (senderRaw?.name ?? senderRaw?.handle ?? "unknown");

      const msg: Message = {
        speaker,
        content: text,
        timestamp: message.timestamp.toISOString(),
      };

      // Ingest into memory regardless of whether Sage intervenes
      void ingest(space.id, [msg]);

      // Run the intervention pipeline off the hot path so incoming messages never block
      void (async () => {
        try {
          const decision = await classify(space.id, msg);
          if (!decision.intervene) return;

          const reply = await respond(space.id, decision.retrievedContext, msg);
          if (!reply) return;

          await space.send(`${SAGE_PREFIX} ${reply}`);
          recordSageSent(space.id);
          console.log("-> Sage intervened in", space.id, "| anchor:", decision.anchorId);
        } catch (err) {
          console.error("-> Agent pipeline failed for", space.id, err);
        }
      })();
    }
    console.warn("Message stream ended cleanly.");
  } catch (err) {
    console.error("Message stream errored:", err);
  }
}

main().catch(console.error);
