import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import "dotenv/config";
import { classify, recordSageSent, respond } from "./agent.js";
import { ingest, type Message } from "./memory.js";

const SAGE_PREFIX = "[Sage]:";

async function main() {
  const projectId = process.env.PHOTON_PROJECT_ID;
  const projectSecret = process.env.PHOTON_PROJECT_SECRET;
  if (!projectId || !projectSecret) {
    console.error("Set PHOTON_PROJECT_ID and PHOTON_PROJECT_SECRET in .env.");
    process.exit(1);
  }

  const app = await Spectrum({
    projectId,
    projectSecret,
    providers: [imessage.config()],
  });

  console.log("Sage agent online. Listening for messages.");

  for await (const [space, message] of app.messages) {
    if (message.content.type !== "text") continue;

    const text = message.content.text;
    if (text.startsWith(SAGE_PREFIX)) continue;

    const sender = message.sender?.id ?? "unknown";
    const msg: Message = {
      speaker: sender,
      content: text,
      timestamp: new Date().toISOString(),
    };

    console.log(`[${space.id}] ${sender}: ${text}`);

    void (async () => {
      try {
        await ingest(space.id, [msg]);
      } catch (err) {
        console.error("ingest failed:", err);
      }

      try {
        const result = await classify(space.id, msg);
        if (!result.intervene) return;

        const reply = await respond(space.id, result.retrievedContext, msg);
        if (!reply) return;

        await space.send(`${SAGE_PREFIX} ${reply}`);
        recordSageSent(space.id);
        console.log(`-> Sage replied in ${space.id}: ${reply}`);
      } catch (err) {
        console.error("agent pipeline failed:", err);
      }
    })();
  }
}

main().catch(console.error);
