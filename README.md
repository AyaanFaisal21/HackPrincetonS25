HackPrincetonS25/
│
├── frontend/                          ← React app — everything the user SEES
│   ├── public/
│   │   └── index.html                 ← HTML shell, don't touch
│   └── src/
│       ├── App.jsx                    ← ROOT: decides new user vs returning user
│       │
│       ├── config/
│       │   └── sage.config.js         ← Sage's personality prompt + voice settings
│       │                                 EDIT THIS to change how Sage behaves
│       │
│       ├── services/
│       │   └── api.js                 ← ALL backend calls live here
│       │                                 one function per API endpoint
│       │
│       ├── hooks/
│       │   └── useUserProfile.js      ← loads/saves user profile to localStorage
│       │                                 call this in App.jsx to get the profile
│       │
│       ├── screens/                   ← full-page screens (top-level views)
│       │   ├── WelcomeScreen.jsx      ← first screen, sunrise animation, onboarding
│       │   └── ChatScreen.jsx         ← main chat screen, shown after onboarding
│       │
│       └── components/               ← reusable pieces used inside screens
│           ├── AvatarZone.jsx         ← the rising sun avatar (LiveAvatar slot)
│           ├── InputBar.jsx           ← mic button + text input, always visible
│           ├── EmergencyPanel.jsx     ← contacts list + Photon alert button
│           ├── MemorySidebar.jsx      ← what Sage remembers (returning users)
│           └── EventSuggestions.jsx   ← matched events/users by interest
│
├── backend/                           ← Node server — holds API keys, calls AI
│   ├── server.js                      ← entry point, defines POST /api/chat
│   ├── gemini.js                      ← calls Google Gemini AI
│   ├── elevenlabs.js                  ← calls ElevenLabs text-to-speech
│   ├── photon.js                      ← sends SMS via Photon iMessage bridge
│   ├── package.json                   ← backend dependencies
│   ├── .env                           ← SECRET keys — never commit to GitHub
│   ├── .gitignore                     ← tells git to ignore .env + node_modules
│   └── audio_cache/                   ← mp3 files saved here (auto-created)
│
└── README.md

━━━ HOW THE DATA FLOWS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  User speaks or types
        ↓
  InputBar.jsx          captures voice (Web Speech API) or text
        ↓
  ChatScreen.jsx        adds to message history, calls api.js
        ↓
  api.js                POST /api/chat → your backend
        ↓
  server.js             receives request, calls gemini.js + elevenlabs.js
        ↓
  gemini.js             sends full history to Gemini → gets reply text
  elevenlabs.js         sends reply text to ElevenLabs → gets mp3 URL
        ↓
  server.js             returns { text, audioUrl } to frontend
        ↓
  ChatScreen.jsx        updates caption, plays audio
  AvatarZone.jsx        animates (speaking/thinking) based on state
  MemorySidebar.jsx     updates with new things Sage learned

━━━ TWO DEMO STATES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  STATE 1 — New User    userProfile = null
    App.jsx sees null → shows WelcomeScreen → onboarding → ChatScreen
    Sage: "Hello! I'm Sage. What's your name?"
    No memory sidebar. No event suggestions.

  STATE 2 — Returning   userProfile = { name, interests, conversations... }
    App.jsx sees profile → goes straight to ChatScreen
    Sage: "Welcome back, Margaret! How is your knee today?"
    Memory sidebar visible. Event suggestions shown.

  To switch states for judges: change one line in App.jsx
    const [profile] = useState(MOCK_NEW_USER)       ← state 1
    const [profile] = useState(MOCK_RETURNING_USER)  ← state 2
