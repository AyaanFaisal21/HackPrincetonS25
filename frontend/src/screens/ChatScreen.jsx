// ============================================================
//  ChatScreen.jsx — MAIN CHAT SCREEN
//
//  ✅ DONE:
//    - Sunrise gradient background (persists from welcome screen)
//    - Wires up all child components: AvatarZone, InputBar,
//      EmergencyPanel, MemorySidebar, EventSuggestions
//    - Sends messages to backend via api.js
//    - Plays ElevenLabs audio when audioUrl is returned
//    - Falls back to browser TTS when no audio
//    - Builds personalized opening message for returning users
//    - Memory sidebar only shown for returning users
//    - Event suggestions only shown for returning users with interests
//
//  🔲 TODO TONIGHT:
//    - [ ] Test full message send → backend → Gemini → response flow
//    - [ ] Confirm browser TTS fallback works while ElevenLabs isn't wired
//
//  🔲 TODO TOMORROW:
//    - [ ] Wire audioRef into AvatarZone so LiveAvatar can lip-sync
//    - [ ] After each Sage response, extract interests/names and update profile
//          (small Gemini call: "what interests/names did the user mention here?")
//    - [ ] Add daily check-in: if user hasn't chatted today, Sage opens with a
//          proactive message referencing their last conversation
//    - [ ] Add conversation summary save at end of session (for memory across days)
// ============================================================

import { useState, useRef, useEffect } from "react";
import { askSage }          from "../services/api";
import { SYSTEM_PROMPT, VOICE_SETTINGS } from "../config/sage.config";
import AvatarZone from "../components/AvatarZone";
// All four UI components live in one file — import them by name
import { InputBar, EmergencyPanel, MemorySidebar, EventSuggestions } from "../components/Components";

export default function ChatScreen({ userProfile, onProfileUpdate, onReset }) {
  const [messages,      setMessages]      = useState([]);
  const [caption,       setCaption]       = useState("");
  const [isSpeaking,    setIsSpeaking]    = useState(false);
  const [isThinking,    setIsThinking]    = useState(false);
  const [isListening,   setIsListening]   = useState(false);
  const [showEmergency, setShowEmergency] = useState(false);
  const [showMemory,    setShowMemory]    = useState(false);
  const [alertStatus,   setAlertStatus]   = useState(null);
  const [contacts,      setContacts]      = useState(userProfile?.emergencyContacts || []);

  const audioRef  = useRef(null);
  const recogRef  = useRef(null);

  // ── Send opening message when screen loads ──────────────────
  useEffect(() => {
    const opening = buildOpeningMessage(userProfile);
    sendMessage(opening, true); // true = this is the AI opening, skip user bubble
  }, []);

  // ── Build personalized opening message ──────────────────────
  // NEW USER:      "Hello! I'm so glad you're here..."
  // RETURNING:     "Welcome back, Margaret! How is your knee today?"
  function buildOpeningMessage(profile) {
    if (!profile || !profile.name) {
      return "Hello, I just opened the app for the first time.";
    }
    let msg = `Hello, I'm back. My name is ${profile.name}.`;
    const last = profile.conversations?.[0];
    if (last?.topicsDiscussed?.length) {
      msg += ` Last time we talked about ${last.topicsDiscussed[0]}.`;
    }
    if (profile.health?.conditions?.length) {
      msg += ` My ${profile.health.conditions[0]} has been bothering me.`;
    }
    return msg;
  }

  // ── Core send function ───────────────────────────────────────
  const sendMessage = async (text, isSystemOpen = false) => {
    if (!text.trim() || isThinking || isSpeaking) return;

    const userMsg    = { role: "user", content: text };
    const newHistory = isSystemOpen ? [userMsg] : [...messages, userMsg];

    if (!isSystemOpen) setMessages(newHistory);
    setIsThinking(true);
    setCaption("");

    try {
      const result = await askSage(newHistory, SYSTEM_PROMPT);

      const fullHistory = [...newHistory, { role: "assistant", content: result.text }];
      setMessages(fullHistory);
      setCaption(result.text);
      setIsThinking(false);

      if (result.audioUrl && audioRef.current) {
        audioRef.current.src = result.audioUrl;
        audioRef.current.play();
      } else {
        // Browser TTS fallback — remove once ElevenLabs is live
        const u   = new SpeechSynthesisUtterance(result.text);
        u.rate    = VOICE_SETTINGS.rate;
        u.pitch   = VOICE_SETTINGS.pitch;
        u.onstart = () => setIsSpeaking(true);
        u.onend   = () => setIsSpeaking(false);
        window.speechSynthesis.speak(u);
      }
    } catch (err) {
      console.error(err);
      setCaption("I'm sorry, I'm having a little trouble. Shall we try again?");
      setIsThinking(false);
    }
  };

  // ── Mic recording ────────────────────────────────────────────
  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice requires Chrome or Edge."); return; }
    const r = new SR();
    r.lang = "en-US";
    r.interimResults = false;
    r.onresult = (e) => sendMessage(e.results[0][0].transcript);
    r.onerror  = ()  => setIsListening(false);
    r.onend    = ()  => setIsListening(false);
    recogRef.current = r;
    r.start();
    setIsListening(true);
  };
  const stopListening = () => { recogRef.current?.stop(); setIsListening(false); };

  // ── Emergency alert ──────────────────────────────────────────
  const triggerAlert = async () => {
    const { sendAlertToAll } = await import("../services/photon");
    setAlertStatus("sending");
    const results = await sendAlertToAll(contacts, userProfile?.name || "your loved one");
    setAlertStatus(results.every(r => r.success) ? "sent" : "failed");
    setTimeout(() => setAlertStatus(null), 4000);
  };

  // ── Determine if this is a returning user ────────────────────
  const isReturning = !!(userProfile?.name && userProfile?.conversations?.length);

  return (
    <div style={S.page}>
      <Styles />

      {/* Hidden audio player for ElevenLabs mp3 */}
      <audio
        ref={audioRef}
        onPlay={()  => setIsSpeaking(true)}
        onEnded={() => setIsSpeaking(false)}
      />

      {/* ── TOP BAR ────────────────────────────────────────── */}
      <div style={S.topBar}>
        <span style={S.appName}>Sage</span>
        <div style={S.topActions}>
          {/* Memory button — only for returning users */}
          {isReturning && (
            <button
              style={{ ...S.topBtn, ...(showMemory ? S.topBtnActive : {}) }}
              onClick={() => setShowMemory(!showMemory)}
              title="What Sage remembers"
            >
              ✦ Memory
            </button>
          )}
          <button
            style={S.emergencyBtn}
            onClick={() => setShowEmergency(!showEmergency)}
          >
            {showEmergency ? "✕" : "🆘"}
          </button>
        </div>
      </div>

      {/* ── EMERGENCY PANEL (slides down when open) ─────────── */}
      {showEmergency && (
        <EmergencyPanel
          contacts={contacts}
          setContacts={setContacts}
          alertStatus={alertStatus}
          onSendAlert={triggerAlert}
        />
      )}

      {/* ── AVATAR ZONE — the rising sun, center screen ─────── */}
      <AvatarZone
        isSpeaking={isSpeaking}
        isThinking={isThinking}
        userName={userProfile?.name}
        isReturning={isReturning}
        audioRef={audioRef}       // pass to AvatarZone for LiveAvatar lip-sync
      />

      {/* ── CAPTION — what Sage just said ───────────────────── */}
      <div style={S.captionZone}>
        {isThinking && <p style={S.thinkingText}>Sage is thinking...</p>}
        {!isThinking && caption && <p style={S.captionText}>{caption}</p>}
        {!isThinking && !caption && (
          <p style={S.hintText}>
            {isListening ? "Listening..." : "Hold the mic to speak, or type below"}
          </p>
        )}
      </div>

      {/* ── EVENT SUGGESTIONS — returning users with interests ──*/}
      {isReturning && userProfile.interests?.length > 0 && (
        <EventSuggestions interests={userProfile.interests} />
      )}

      {/* ── INPUT BAR — always visible at the bottom ────────── */}
      <InputBar
        onSend={sendMessage}
        onMicStart={startListening}
        onMicEnd={stopListening}
        isListening={isListening}
        isDisabled={isThinking || isSpeaking}
        preferText={userProfile?.preferences?.preferVoice === false}
      />

      {/* ── MEMORY SIDEBAR — slides in from right ───────────── */}
      {showMemory && isReturning && (
        <MemorySidebar
          userProfile={userProfile}
          onClose={() => setShowMemory(false)}
        />
      )}
    </div>
  );
}

const S = {
  page: {
    height: "100vh", width: "100vw",
    display: "flex", flexDirection: "column", alignItems: "center",
    fontFamily: "'Georgia', serif", overflow: "hidden", position: "relative",
    // Sunrise background — deep indigo at bottom, warm dawn at top
    background: "linear-gradient(to top, #1A0F2E 0%, #7B2D0F 18%, #D4621A 38%, #F0A060 58%, #FDE4C0 100%)",
  },
  topBar: {
    width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "12px 20px", zIndex: 10,
    background: "rgba(26, 15, 46, 0.45)", backdropFilter: "blur(8px)",
  },
  appName:    { color: "#F0C060", fontSize: 20, fontWeight: 700, letterSpacing: 1 },
  topActions: { display: "flex", gap: 10, alignItems: "center" },
  topBtn: {
    background: "rgba(240,192,96,0.12)", color: "rgba(240,192,96,0.75)",
    border: "1px solid rgba(240,192,96,0.25)", borderRadius: 20,
    padding: "6px 14px", fontSize: 13, cursor: "pointer", fontFamily: "Georgia, serif",
  },
  topBtnActive: { background: "rgba(240,192,96,0.25)", color: "#F0C060", border: "1px solid rgba(240,192,96,0.5)" },
  emergencyBtn: {
    background: "rgba(200,60,60,0.15)", color: "#F08080",
    border: "1px solid rgba(200,60,60,0.3)", borderRadius: 20,
    padding: "6px 14px", fontSize: 13, cursor: "pointer",
  },
  captionZone: {
    width: "88%", maxWidth: 480, minHeight: 72, zIndex: 5,
    display: "flex", alignItems: "center", justifyContent: "center",
    padding: "0 0 4px",
  },
  captionText: {
    color: "#1A0F2E", fontSize: 19, textAlign: "center", lineHeight: 1.65, margin: 0,
    background: "rgba(253,228,192,0.85)", borderRadius: 14, padding: "12px 18px",
    border: "1px solid rgba(240,160,60,0.3)",
  },
  thinkingText: { color: "rgba(253,228,192,0.6)", fontSize: 15, fontStyle: "italic", margin: 0 },
  hintText:     { color: "rgba(253,228,192,0.4)", fontSize: 14, fontStyle: "italic", margin: 0 },
};

function Styles() {
  return <style>{`body { margin: 0; } * { box-sizing: border-box; }`}</style>;
}
