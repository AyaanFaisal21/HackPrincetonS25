import { Router } from "express";
import { getRegistration, insertRegistration } from "../db/index.js";

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

  // TODO: replace with real iMessage send via Photon/Spectrum
  console.log(`[SEND] To: ${normalized} | "Hello"`);

  res.json({ success: true });
});

export default router;
