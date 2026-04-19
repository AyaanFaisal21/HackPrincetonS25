import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import "dotenv/config";

/**
 * Echo loop (Sage phase1): prove iMessage → our code → iMessage, in DMs and group chats.
 * Uses Photon Spectrum with dashboard credentials (no separate iMessage server URL).
 * @see https://docs.photon.codes/spectrum-ts/getting-started.md
 *
 * **DMs:** Events only arrive for the phone line(s) registered to your Photon project. You must
 * open Messages with **that** number (see startup log), not a random contact. Texting +1 555…
 * when your line is +1 609… will show “Delivered” in Apple’s UI but produce **no** `Incoming`
 * logs — Photon never sees that thread.
 *
 * Group chats: add the **same** provisioned number as a participant. If there are no `Incoming`
 * logs for a group, the hosted line is not in that thread (or it’s SMS-only).
 */
const SAGE_PREFIX = "[Sage echo]:";

/** Matches Spectrum patch: group GUIDs are not only `;+;` (many use `;-;chat…`). */
function likelyGroupChatFromSpaceId(spaceId: string): boolean {
  const g = spaceId.toLowerCase();
  if (g.includes(";+;")) return true;
  return /;(sms|imessage);[-+];chat/i.test(g);
}

/** Loggable snapshot (avoids functions on `message` / circular refs breaking JSON.stringify). */
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

/** Lists iMessage lines for this project so you DM the correct number (Spectrum Cloud API). */
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
      console.warn(
        "Could not list Photon iMessage lines (check project / network). Status:",
        res.status
      );
      return;
    }
    const numbers = body.data.lines
      .filter((l) => l.platform === "imessage" && l.phoneNumber)
      .map((l) => l.phoneNumber as string);
    if (numbers.length === 0) {
      console.warn("No iMessage phone lines found for this project.");
      return;
    }
    console.log(
      "\n>>> Your Photon iMessage line(s) — send test DMs **to this number** (from another phone):\n   ",
      numbers.join("\n    "),
      "\n"
    );
  } catch (e) {
    console.warn("Could not fetch project lines (optional):", e);
  }
}

async function main() {
  const projectId = process.env.PHOTON_PROJECT_ID;
  const projectSecret = process.env.PHOTON_PROJECT_SECRET;
  if (!projectId || !projectSecret) {
    console.error(
      "Set PHOTON_PROJECT_ID and PHOTON_PROJECT_SECRET in .env (Photon dashboard → Project settings)."
    );
    process.exit(1);
  }

  await logPhotonImessageLines(projectId, projectSecret);

  const app = await Spectrum({
    projectId,
    projectSecret,
    providers: [imessage.config()],
  });

  console.log(
    "Sage is listening via Spectrum (iMessage: DMs and group chats). Ctrl+C to stop."
  );

  try {
    for await (const [space, message] of app.messages) {
      const spaceMeta = space as { id: string; type?: "dm" | "group" };
      const derivedGroup = likelyGroupChatFromSpaceId(space.id);
      console.log(
        "Incoming summary:",
        JSON.stringify({
          platform: message.platform,
          spaceType: spaceMeta.type,
          spaceId: space.id,
          derivedLikelyGroup: derivedGroup,
          contentType: message.content.type,
        })
      );
      console.log("Incoming full:", JSON.stringify(messageForLog(message), null, 2));

      if (message.content.type !== "text") continue;

      const text = message.content.text;
      if (text.startsWith(SAGE_PREFIX)) continue;

      const fromSelf = (message as { isFromMe?: boolean }).isFromMe === true;
      if (fromSelf) continue;

      // Do not await send on the hot path: a slow/hanging send would block the iterator and
      // stop all further incoming messages from being handled.
      const out = `${SAGE_PREFIX} ${text}`;
      void (async () => {
        try {
          await space.send(out);
          console.log("-> echo sent to", space.id);
        } catch (err) {
          console.error("-> echo send failed for", space.id, err);
        }
      })();
    }
    console.warn("Message stream ended cleanly (iterator completed).");
  } catch (err) {
    console.error("Message stream errored:", err);
  }
}

main().catch(console.error);
