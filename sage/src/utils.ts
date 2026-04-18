import "dotenv/config";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { VoyageAIClient } from "voyageai";

export function getGeminiClient() {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  return genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
}

export function getVoyageClient() {
  return new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY! });
}
