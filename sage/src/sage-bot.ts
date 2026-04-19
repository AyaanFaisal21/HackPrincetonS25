import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";

const SAGE_PREFIX = "[Sage]:";
const MENTION = /^\s*@sage\b[:,\s]*/i;

const SYSTEM_PROMPT = `You are Sage, a participant in an iMessage group chat.
You are only invoked when someone @-mentions you, so treat every prompt as a direct ask.
Answer like a knowledgeable friend who has already done the legwork — concise, plain-text, 1-4 short sentences.
No markdown, no lists, no headers. iMessage strips formatting anyway.

Ground your answer in the kinds of places a person would actually look:
Reddit threads, YouTube videos, blog posts, Wikipedia, National Geographic, academic papers,
official documentation, newspaper reporting, Stack Overflow — whichever fit the topic.
Mention sources casually and generically, not as URLs and not as footnotes.
Examples of the tone:
  "Reddit threads on r/AskHistorians keep coming back to..."
  "A few National Geographic pieces on this describe..."
  "Most of the YouTube explainers agree that..."
  "From what blogs and official docs say..."
Do not invent specific article titles, author names, or dates. Stay vague enough to be honest, specific
enough about *types* of sources to feel researched. Never claim to have visited a URL in this session.

If the ask is purely conversational ("hey sage", "who are you"), just answer naturally without forcing a
source reference.`;

async function main() {
  const projectId = process.env.PHOTON_PROJECT_ID;
  const projectSecret = process.env.PHOTON_PROJECT_SECRET;
  if (!projectId || !projectSecret) {
    console.error("Set PHOTON_PROJECT_ID and PHOTON_PROJECT_SECRET in .env.");
    process.exit(1);
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const gemini = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: SYSTEM_PROMPT,
  });

  const app = await Spectrum({
    projectId,
    projectSecret,
    providers: [imessage.config()],
  });

  console.log("Sage is online. Summon with `@sage <prompt>` in any chat.");

  for await (const [space, message] of app.messages) {
    if (message.content.type !== "text") continue;
    const text = message.content.text;
    if (text.startsWith(SAGE_PREFIX)) continue;

    const match = text.match(MENTION);
    if (!match) continue;

    const prompt = text.slice(match[0].length).trim();
    const sender = message.sender?.id ?? "someone";
    const spaceType = (space as { type?: string }).type ?? "?";
    console.log(`[${spaceType} ${space.id}] ${sender} @sage: ${prompt || "(empty)"}`);

    if (!prompt) {
      void space.send(
        `${SAGE_PREFIX} I'm here. Ask me something after @sage and I'll dig in.`
      );
      continue;
    }

    void (async () => {
      try {
        const result = await gemini.generateContent(prompt);
        const reply = result.response.text().trim();
        if (!reply) return;
        await space.send(`${SAGE_PREFIX} ${reply}`);
        console.log(`-> replied: ${reply}`);
      } catch (err) {
        console.error("gemini failed:", err);
        await space.send(`${SAGE_PREFIX} Something went wrong on my end — try again in a sec.`);
      }
    })();
  }
}

main().catch(console.error);
