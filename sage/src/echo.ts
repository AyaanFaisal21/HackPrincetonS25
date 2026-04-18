import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import "dotenv/config";

/**
 * Echo loop (Sage phase1): prove iMessage → our code → iMessage, in DMs and group chats.
 * Uses Photon Spectrum with dashboard credentials (no separate iMessage server URL).
 * @see https://docs.photon.codes/spectrum-ts/getting-started.md
 *
 * Group chats: add your Photon/provisioned iMessage **phone number as a participant** in the
 * group (same as a normal contact). If you see no `Incoming` logs at all in a group, the
 * hosted line is not receiving that thread (membership / iMessage vs SMS).
 */
const SAGE_PREFIX = "[Sage echo]:";

/** Matches Spectrum patch: group GUIDs are not only `;+;` (many use `;-;chat…`). */
function likelyGroupChatFromSpaceId(spaceId: string): boolean {
  const g = spaceId.toLowerCase();
  if (g.includes(";+;")) return true;
  return /;(sms|imessage);[-+];chat/i.test(g);
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
      console.log("Incoming full:", JSON.stringify(message, null, 2));

      if (message.content.type !== "text") continue;

      const text = message.content.text;
      if (text.startsWith(SAGE_PREFIX)) continue;

      const fromSelf = (message as { isFromMe?: boolean }).isFromMe === true;
      if (fromSelf) continue;

      try {
        await space.send(`${SAGE_PREFIX} ${text}`);
        console.log("-> echo sent to", space.id);
      } catch (err) {
        console.error("-> echo send failed for", space.id, err);
      }
    }
    console.warn("Message stream ended cleanly (iterator completed).");
  } catch (err) {
    console.error("Message stream errored:", err);
  }
}

main().catch(console.error);
