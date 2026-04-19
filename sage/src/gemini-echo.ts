import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

const SAGE_PREFIX = "[Sage]:";

async function main() {
  const projectId = process.env.PHOTON_PROJECT_ID;
  const projectSecret = process.env.PHOTON_PROJECT_SECRET;
  if (!projectId || !projectSecret) {
    console.error("Set PHOTON_PROJECT_ID and PHOTON_PROJECT_SECRET in .env.");
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const gemini = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const app = await Spectrum({
    projectId,
    projectSecret,
    providers: [imessage.config()],
  });

  console.log("Gemini test bot online. Every message gets a Gemini reply.");

  for await (const [space, message] of app.messages) {
    if (message.content.type !== "text") continue;
    const text = message.content.text;
    if (text.startsWith(SAGE_PREFIX)) continue;

    const sender = message.sender?.id ?? "unknown";
    const spaceType = (space as { type?: string }).type ?? "?";
    console.log(`[${spaceType} ${space.id}] ${sender}: ${text}`);

    void (async () => {
      try {
        const prompt =
          "You are Sage, a warm participant in a group chat. " +
          "Reply in 1-2 short, human sentences. No lists, no markdown.\n\n" +
          `${sender} said: "${text}"\n\nYour reply:`;
        const result = await gemini.generateContent(prompt);
        const reply = result.response.text().trim();
        if (!reply) return;

        await space.send(`${SAGE_PREFIX} ${reply}`);
        console.log(`-> sent to ${space.id}: ${reply}`);
      } catch (err) {
        console.error("pipeline failed:", err);
      }
    })();
  }
}

main().catch(console.error);
