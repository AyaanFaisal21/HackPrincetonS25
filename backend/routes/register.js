import { Router } from "express";
import { getRegistration, insertRegistration } from "../db/index.js";
import { sendImessage } from "../lib/imessage.js";

const router = Router();

function normalizePhone(raw) {
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

// POST /api/register
router.post("/", async (req, res) => {
  const normalized = normalizePhone(req.body.phoneNumber ?? "");
  if (!normalized) return res.status(400).json({ error: "Please enter a valid US phone number." });

  if (getRegistration.get(normalized)) {
    return res.status(409).json({ error: "This phone number has already been registered." });
  }

  insertRegistration.run(normalized);
  console.log("New registration:", normalized);

  // Fire and forget — don't block the response on iMessage delivery
  sendImessage(normalized, "Hi I'm Sage, add my number to any group chat to get started.")
    .then(() => console.log("iMessage sent to", normalized))
    .catch((err) => console.error("iMessage send failed:", err.message));

  res.json({ success: true });
});

export default router;
