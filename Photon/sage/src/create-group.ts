import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import "dotenv/config";

async function main() {
  const phones = process.argv.slice(2);
  if (phones.length < 2) {
    console.error(
      "Usage: npx tsx src/create-group.ts +1XXXXXXXXXX +1YYYYYYYYYY [+1ZZZZZZZZZZ ...]"
    );
    console.error("Pass at least two E.164 phone numbers to form a group.");
    process.exit(1);
  }

  const app = await Spectrum({
    projectId: process.env.PHOTON_PROJECT_ID!,
    projectSecret: process.env.PHOTON_PROJECT_SECRET!,
    providers: [imessage.config()],
  });

  const users = await Promise.all(phones.map((p) => imessage(app).user(p)));
  const space = await imessage(app).space(...users);

  console.log("Created space:", { id: space.id, type: space.type });

  await space.send("Sage is here. Say something to test the echo loop.");
  console.log("Sent intro message. You can stop this script now.");

  process.exit(0);
}

main().catch((err) => {
  console.error("create-group failed:", err);
  process.exit(1);
});
