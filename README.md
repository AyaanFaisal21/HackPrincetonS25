# HackPrincetonS25
### IN progress: "UpLift"

---

## Stack
- **Frontend** — React (JavaScript), Vite
- **Backend** — Node.js, Express
- **AI** — Google Gemini
- **Voice** — ElevenLabs TTS + Web Speech API (mic)
- **Alerts** — Photon SMS / iMessage

---

## Structure

**frontend/**
- `App.jsx` — root, routes new vs returning user
- `screens/WelcomeScreen.jsx` — onboarding + sunrise animation
- `screens/ChatScreen.jsx` — main chat UI
- `components/AvatarZone.jsx` — animated sun avatar
- `components/Components.jsx` — InputBar, EmergencyPanel, MemorySidebar, EventSuggestions
- `config/sage.config.js` — Sage's personality prompt ← edit this to change her behavior
- `services/api.js` — all calls to the backend

**backend/**
- `server.js` — Express server, `POST /api/chat` + `POST /api/alert`
- `gemini.js` — Google Gemini AI calls
- `elevenlabs.js` — text → mp3 audio
- `photon.js` — SMS alerts to emergency contacts
- `.env` — API keys ⚠️ never commit this

---

## Running locally

```bash
# Backend (terminal 1)
cd backend && npm install && npm start

# Frontend (terminal 2)
cd frontend && npm install && npm run dev
```

Open → `http://localhost:5173`

---

## Demo states

| State | How | What you see |
|---|---|---|
| **New user** | `useState(MOCK_NEW_USER)` in App.jsx | Onboarding flow, Sage asks for your name |
| **Returning** | `useState(MOCK_RETURNING_USER)` in App.jsx | "Welcome back, Margaret" + memory sidebar |
