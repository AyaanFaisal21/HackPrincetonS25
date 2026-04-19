import "dotenv/config";
import { startPhoton } from "./photon.js";

console.log("Starting Sage...");
console.log("Ingestion: Photon/Spectrum iMessage");
console.log("Memory: ChromaDB + VoyageAI");
console.log("Agent: Gemini 2.0 Flash");
console.log("Delivery: Photon/Spectrum iMessage");
console.log("---");

startPhoton().catch(e => {
  console.error("Fatal error:", e);
  process.exit(1);
});
