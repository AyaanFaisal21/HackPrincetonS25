import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import "dotenv/config";

const SAGE_PREFIX = "[Sage echo]:";

async function main() {
  const app = await Spectrum({
    projectId: process.env.PHOTON_PROJECT_ID!,
    projectSecret: process.env.PHOTON_PROJECT_SECRET!,
    providers: [imessage.config()],
  });

  console.log("Sage is listening...");

  for await (const [space, message] of app.messages) {
    console.log("Incoming:", JSON.stringify(message, null, 2));

    if (message.content.type !== "text") continue;
    if (message.content.text.startsWith(SAGE_PREFIX)) continue;

    await space.send(`${SAGE_PREFIX} ${message.content.text}`);
  }
}

main().catch(console.error);
