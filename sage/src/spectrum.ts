import twilio from "twilio";
import dotenv from "dotenv";
dotenv.config();

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
);

export async function send(chatId: string, content: string): Promise<void> {
  void chatId;
  console.log("[Spectrum] Receiving intervention from agent...");
  console.log("[Spectrum] Routing to Twilio for delivery...");

  try {
    const message = await twilioClient.conversations.v1
      .conversations(process.env.TWILIO_CONVERSATION_SID!)
      .messages.create({
        body: `[Sage] ${content}`,
      });

    console.log("[Spectrum] Twilio message SID:", message.sid);
    console.log("[Spectrum] Twilio message index:", message.index);
    console.log("[Spectrum] Delivered to group chat:", content);
  } catch (e: unknown) {
    const err = e as { status?: number; message?: string; errorDetails?: unknown };
    console.error("[Spectrum] DELIVERY FAILED");
    console.error("[Spectrum] Error status:", err?.status);
    console.error("[Spectrum] Error message:", err?.message);
    console.error("[Spectrum] Error details:", JSON.stringify(err?.errorDetails));
    throw e;
  }
}
