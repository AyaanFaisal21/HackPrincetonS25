import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";

let app = null;

export async function getApp() {
  if (app) return app;
  app = await Spectrum({
    projectId:     process.env.PHOTON_PROJECT_ID,
    projectSecret: process.env.PHOTON_PROJECT_SECRET,
    providers: [imessage.config()],
  });
  return app;
}

export async function sendImessage(phoneNumber, text) {
  const client = await getApp();
  const user  = await imessage(client).user(phoneNumber);
  const space = await imessage(client).space(user);
  await space.send(text);
}
