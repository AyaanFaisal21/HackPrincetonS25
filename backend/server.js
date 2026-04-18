// THE ENTRY POINT. Run this with: node server.js
// Creates the web server on port 3001.
// Routes:
//   POST /api/chat  — frontend sends a message, gets back Sage's reply
//   POST /api/alert — frontend triggers an SMS alert to emergency contacts

import express  from "express";
import cors     from "cors";
import dotenv   from "dotenv";

dotenv.config(); // loads GEMINI_API_KEY etc. from .env

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());         // lets the frontend (localhost:5173) talk to this server
app.use(express.json()); // parses incoming JSON bodies


// ── POST /api/chat ─────────────────────────────────────────────
//
// What the frontend sends:
//   { messages: [{role, content}, ...], systemPrompt: string }
//
// What this returns:
//   { text: string, audioUrl: string | null }
//
// Flow: frontend → here → Gemini → here → frontend
//       (audioUrl is null until elevenlabs.js is wired up)
// ──────────────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { messages, systemPrompt } = req.body;

  try {
    // Gemini expects "model" for assistant turns, "user" for user turns
    const contents = messages.map(m => ({
      role:  m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // systemPrompt goes here — Gemini reads it before every reply
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
        }),
      }
    );

    if (!geminiRes.ok) {
      const err = await geminiRes.json().catch(() => ({}));
      console.error("Gemini error:", err);
      return res.status(500).json({ error: "Gemini returned an error" });
    }

    const data = await geminiRes.json();
    const text = data.candidates[0].content.parts[0].text;

    // TODO: pass `text` to elevenlabs.js to get a real audioUrl
    // For now: return null so ChatScreen falls back to browser TTS
    res.json({ text, audioUrl: null });

  } catch (err) {
    console.error("Chat route error:", err);
    res.status(500).json({ error: err.message });
  }
});


// ── POST /api/alert ────────────────────────────────────────────
//
// What the frontend sends:
//   { contacts: [{id, name, phone}], userName: string }
//
// What this returns:
//   [{ id, success: true|false }]
//
// TODO: wire this into photon.js once Photon API key is ready
// For now: returns mock success so the UI flow can be demoed
// ──────────────────────────────────────────────────────────────
app.post("/api/alert", async (req, res) => {
  const { contacts, userName } = req.body;
  console.log(`Alert triggered for ${userName} → ${contacts.length} contact(s)`);

  // TODO: replace with real Photon SMS calls from photon.js
  const results = contacts.map(c => ({ id: c.id, success: true }));
  res.json(results);
});


app.listen(PORT, () => {
  console.log(`Sage backend running → http://localhost:${PORT}`);
});
