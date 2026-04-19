import "dotenv/config";
import { createRequire } from "node:module";
import { GoogleGenerativeAI } from "@google/generative-ai";

// voyageai's ESM build has broken bare imports; force the CJS build instead.
const _require = createRequire(import.meta.url);
const { VoyageAIClient } = _require("voyageai") as typeof import("voyageai");

export function getGeminiClient() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  return genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
}

export function getVoyageClient() {
  return new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY! });
}
