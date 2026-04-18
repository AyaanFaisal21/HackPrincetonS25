// ============================================================
//  App.jsx — ROOT COMPONENT
//
//  ✅ DONE:
//    - Loads user profile from localStorage on startup
//    - Routes to WelcomeScreen (new user) or ChatScreen (returning)
//    - Mock data for both demo states ready to swap
//    - saveProfile / clearProfile helpers wired up
//
//  🔲 TODO TONIGHT:
//    - Nothing blocking — this file is complete for the base demo
//
//  🔲 TODO TOMORROW:
//    - [ ] Replace localStorage with Firebase so data persists across devices
//    - [ ] Add a settings icon that opens ProfileModal from anywhere
//    - [ ] Wire up interest extraction: after each Sage response, parse for
//          hobbies/health/names and update profile automatically
// ============================================================

import { useState, useCallback } from "react";
import WelcomeScreen from "./screens/WelcomeScreen";
import ChatScreen    from "./screens/ChatScreen";

// ── MOCK DATA — swap these to demo both states to judges ─────
//
//  HOW TO USE:
//    Line ~40: change MOCK_NEW_USER ↔ MOCK_RETURNING_USER
//    Refresh the browser — instantly see both states
// ─────────────────────────────────────────────────────────────
const MOCK_NEW_USER = null; // null = no profile = new user

const MOCK_RETURNING_USER = {
  name:     "Margaret",
  age:      78,
  joinedAt: "2025-03-01",

  health: {
    conditions:  ["knee pain", "mild hypertension"],
    medications: ["lisinopril"],
  },

  interests: ["gardening", "jazz music", "knitting", "grandchildren"],

  family: [
    { name: "Sarah",  relationship: "daughter" },
    { name: "Tommy",  relationship: "grandson"  },
  ],

  emergencyContacts: [
    { id: 1, name: "Sarah (Daughter)", phone: "+16095550101", relationship: "Family"  },
    { id: 2, name: "Dr. Patel",        phone: "+16095550102", relationship: "Doctor"  },
  ],

  conversations: [
    {
      date:            "2025-04-16",
      summary:         "Margaret talked about her garden and mentioned her knee hurting",
      mood:            "content",
      topicsDiscussed: ["garden", "knee pain", "daughter Sarah"],
    },
    {
      date:            "2025-04-15",
      summary:         "Margaret shared a story about learning to knit as a child",
      mood:            "nostalgic and happy",
      topicsDiscussed: ["knitting", "childhood", "grandmother"],
    },
  ],

  preferences: {
    voiceSpeed:  "slow",
    textSize:    "xlarge",
    preferVoice: false,
  },
};

// ── ROOT COMPONENT ────────────────────────────────────────────
export default function App() {

  // ── Load profile from localStorage on first render ─────────
  // localStorage.getItem returns null if nothing saved yet.
  // JSON.parse converts the saved string back into an object.
  //
  // FOR DEMO: replace the useState initializer with a mock:
  //   useState(MOCK_NEW_USER)       ← shows new user experience
  //   useState(MOCK_RETURNING_USER) ← shows returning user experience
  // ────────────────────────────────────────────────────────────
  const [userProfile, setUserProfile] = useState(() => {
    try {
      const saved = localStorage.getItem("sage_profile");
      return saved ? JSON.parse(saved) : null;
      // FOR DEMO SWAP → return MOCK_RETURNING_USER;
    } catch {
      return null;
    }
  });

  // ── Save profile whenever it changes ────────────────────────
  const saveProfile = useCallback((profile) => {
    setUserProfile(profile);
    localStorage.setItem("sage_profile", JSON.stringify(profile));
  }, []);

  // ── Clear profile (reset to new user) ───────────────────────
  // Useful for testing or if user wants to start fresh
  const clearProfile = useCallback(() => {
    setUserProfile(null);
    localStorage.removeItem("sage_profile");
  }, []);

  // ── Route based on whether we have a profile ────────────────
  // No profile → show WelcomeScreen (onboarding)
  // Has profile → show ChatScreen directly
  if (!userProfile) {
    return (
      <WelcomeScreen
        onComplete={(newProfile) => saveProfile(newProfile)}
      />
    );
  }

  return (
    <ChatScreen
      userProfile={userProfile}
      onProfileUpdate={(updated) => saveProfile(updated)}
      onReset={clearProfile}
    />
  );
}
