import { SDK } from "@photon-ai/advanced-imessage-kit";
import "dotenv/config";

const SAGE_PREFIX = "[Sage echo]:";

async function main() {
  const sdk = SDK({
    serverUrl: process.env.IMESSAGE_SERVER_URL!,
    apiKey: process.env.IMESSAGE_API_KEY!,
    logLevel: "debug",
  });

  await sdk.connect();
  console.log("Sage is listening...");

  sdk.on("new-message", async (message) => {
    console.log("Incoming:", JSON.stringify(message, null, 2));

    if (message.isFromMe) return;

    if (message.text?.startsWith(SAGE_PREFIX)) return;

    const chatGuid = message.chats?.[0]?.guid;
    if (!chatGuid) return;

    await sdk.messages.sendMessage({
      chatGuid,
      message: `${SAGE_PREFIX} ${message.text}`,
    });
  });

  process.on("SIGINT", async () => {
    await sdk.close();
    process.exit(0);
  });
}

main().catch(console.error);
