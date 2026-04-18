// ============================================================
//  services/api.js — ALL BACKEND CALLS
//
//  ✅ DONE:
//    - askSage(): sends conversation to backend, gets text + audioUrl
//    - Handles errors gracefully (never crashes the UI)
//
//  🔲 TODO TONIGHT:
//    - [ ] Confirm BACKEND_URL matches your running server
//
//  🔲 TODO TOMORROW:
//    - [ ] Add extractInterests(messages): small Gemini call that
//          parses a conversation and returns a list of interests/names
//          found, so App.jsx can update userProfile automatically
//    - [ ] Add saveConversationSummary(messages): end-of-session call
//          that summarizes the chat and saves it to the user profile
//    - [ ] Add fetchMatchedEvents(interests): calls your backend
//          to get real community events matched to user interests
// ============================================================

// ── CONFIG ────────────────────────────────────────────────────
// Change this URL when you deploy the backend
// Local:    http://localhost:3001
// Deployed: https://your-app.onrender.com
const BACKEND_URL = "http://localhost:3001";


// ── askSage ───────────────────────────────────────────────────
//
//  Sends the full conversation to the backend and gets Sage's reply.
//
//  PARAMETERS:
//    messages     — array of { role, content } — full history
//    systemPrompt — string — Sage's personality from sage.config.js
//
//  RETURNS:
//    { text: string, audioUrl: string | null }
//
//  EXAMPLE:
//    const result = await askSage(messages, SYSTEM_PROMPT);
//    console.log(result.text);     // "What a lovely story, Margaret!"
//    console.log(result.audioUrl); // "http://localhost:3001/audio/xyz.mp3"
// ─────────────────────────────────────────────────────────────
export async function askSage(messages, systemPrompt) {
  const response = await fetch(`${BACKEND_URL}/api/chat`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ messages, systemPrompt }),
  });

  if (!response.ok) {
    throw new Error(`Backend responded with status ${response.status}`);
  }

  return await response.json();
  // Returns: { text: string, audioUrl: string | null }
}


// ── extractInterests ──────────────────────────────────────────
// TODO TOMORROW: implement this
//
//  After each Sage response, call this to silently extract any
//  new interests, names, or health mentions from the conversation.
//  Merge results into userProfile.interests, userProfile.family, etc.
//
//  export async function extractInterests(messages) {
//    const response = await fetch(`${BACKEND_URL}/api/extract`, {
//      method: "POST",
//      headers: { "Content-Type": "application/json" },
//      body: JSON.stringify({ messages }),
//    });
//    return await response.json();
//    // Returns: { interests: [], names: [], healthMentions: [] }
//  }


// ── fetchMatchedEvents ────────────────────────────────────────
// TODO TOMORROW: implement this
//
//  Fetches community events or matched users based on interests.
//  Called by EventSuggestions.jsx.
//
//  export async function fetchMatchedEvents(interests) {
//    const response = await fetch(`${BACKEND_URL}/api/events?interests=${interests.join(",")}`)
//    return await response.json();
//    // Returns: [{ id, title, time, location, tag, icon }]
//  }
