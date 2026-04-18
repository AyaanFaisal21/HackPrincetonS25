// ============================================================
//  WelcomeScreen.jsx — FIRST SCREEN / ONBOARDING
//
//  ✅ DONE:
//    - Sunrise animation: sun rises from bottom of screen to center
//    - Background shifts from deep night → warm dawn as sun rises
//    - Step 1: Welcome + "Start Talking" button
//    - Step 2: Name collection (text input)
//    - Step 3: Emergency contact setup (add/skip)
//    - Passes completed profile up to App.jsx via onComplete()
//
//  🔲 TODO TONIGHT:
//    - [ ] Test the sunrise animation on mobile (check timing feels right)
//    - [ ] Make sure "Skip for now" on step 3 still creates a valid profile
//
//  🔲 TODO TOMORROW:
//    - [ ] Add LiveAvatar component to the avatar slot in step 1
//    - [ ] Replace the S placeholder with an actual face/character image
//    - [ ] Add a voice greeting on step 1 load (ElevenLabs: "Hello, I'm Sage")
//    - [ ] Animate step transitions (slide instead of instant swap)
//    - [ ] Add age field to profile collection (optional)
// ============================================================

import { useState, useEffect } from "react";

export default function WelcomeScreen({ onComplete }) {
  const [step,       setStep]      = useState(0);          // 0=welcome, 1=name, 2=contacts
  const [sunRisen,   setSunRisen]  = useState(false);      // triggers rise animation
  const [name,       setName]      = useState("");
  const [contacts,   setContacts]  = useState([]);
  const [newName,    setNewName]   = useState("");
  const [newPhone,   setNewPhone]  = useState("");

  // Trigger the sun rise animation shortly after mount
  useEffect(() => {
    const t = setTimeout(() => setSunRisen(true), 200);
    return () => clearTimeout(t);
  }, []);

  // ── Build profile and pass up to App.jsx ────────────────────
  const finish = () => {
    onComplete({
      name:              name.trim() || "Friend",
      joinedAt:          new Date().toISOString(),
      health:            { conditions: [], medications: [] },
      interests:         [],
      family:            [],
      emergencyContacts: contacts,
      conversations:     [],
      preferences:       { voiceSpeed: "slow", textSize: "large", preferVoice: true },
    });
  };

  const addContact = () => {
    if (!newName.trim() || !newPhone.trim()) return;
    setContacts([...contacts, { id: Date.now(), name: newName.trim(), phone: newPhone.trim(), relationship: "Contact" }]);
    setNewName("");
    setNewPhone("");
  };

  return (
    <div style={S.page}>
      <Styles />

      {/* ── BACKGROUND — shifts from night to dawn as sun rises ── */}
      <div style={{ ...S.bgLayer, ...(sunRisen ? S.bgDawn : S.bgNight) }} />

      {/* ── HORIZON GLOW — warm light band behind the sun ─────── */}
      <div style={{ ...S.horizonGlow, ...(sunRisen ? S.horizonGlowVisible : {}) }} />

      {/* ── SUN / AVATAR — rises from below the screen ────────── */}
      {/*
        TEAMMATE: Replace the inner div with <LiveAvatar />
        The sun circle is just a placeholder. LiveAvatar will
        handle the animated face. Keep the outer sunWrap div
        so the rise animation still works.
      */}
      <div style={{ ...S.sunWrap, ...(sunRisen ? S.sunWrapRisen : S.sunWrapHidden) }}>
        {/* Outer glow rings that pulse around the sun */}
        <div className="sun-ring sun-ring-1" style={S.sunRing} />
        <div className="sun-ring sun-ring-2" style={{ ...S.sunRing, width: 280, height: 280 }} />
        {/* The sun itself */}
        <div style={S.sunCircle}>
          {/* ← SWAP THIS with <LiveAvatar /> */}
          <span style={S.sunLetter}>S</span>
          <span style={S.sunLabel}>SAGE</span>
        </div>
      </div>

      {/* ── STEP CONTENT — fades in after sun rises ──────────── */}
      <div style={{ ...S.content, ...(sunRisen ? S.contentVisible : S.contentHidden) }}>

        {/* STEP 0 — WELCOME */}
        {step === 0 && (
          <div style={S.stepWrap}>
            <h1 style={S.title}>Meet Sage</h1>
            <p style={S.subtitle}>
              Your personal companion — always here to listen, chat, and keep you company.
            </p>
            <button style={S.primaryBtn} onClick={() => setStep(1)}>
              Get Started
            </button>
          </div>
        )}

        {/* STEP 1 — NAME COLLECTION */}
        {step === 1 && (
          <div style={S.stepWrap}>
            <p style={S.question}>What should I call you?</p>
            <input
              style={S.input}
              type="text"
              placeholder="Your first name..."
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && name.trim() && setStep(2)}
              autoFocus
            />
            <button
              style={{ ...S.primaryBtn, ...(name.trim() ? {} : S.btnDisabled) }}
              onClick={() => name.trim() && setStep(2)}
              disabled={!name.trim()}
            >
              That's my name
            </button>
          </div>
        )}

        {/* STEP 2 — EMERGENCY CONTACTS */}
        {step === 2 && (
          <div style={S.stepWrap}>
            <p style={S.question}>
              {name ? `One last thing, ${name}.` : "One last thing."} Who should we contact if you ever need help?
            </p>

            {/* Contacts already added */}
            {contacts.map(c => (
              <div key={c.id} style={S.contactChip}>
                <span style={S.chipName}>{c.name}</span>
                <span style={S.chipPhone}>{c.phone}</span>
                <button style={S.chipRemove} onClick={() => setContacts(contacts.filter(x => x.id !== c.id))}>✕</button>
              </div>
            ))}

            {/* Add new contact */}
            <div style={S.addRow}>
              <input style={S.inputSmall} placeholder="Name"       value={newName}  onChange={e => setNewName(e.target.value)}  />
              <input style={S.inputSmall} placeholder="Phone"      value={newPhone} onChange={e => setNewPhone(e.target.value)} type="tel" />
              <button style={{ ...S.addBtn, ...(!newName.trim() || !newPhone.trim() ? S.btnDisabled : {}) }} onClick={addContact}>Add</button>
            </div>

            <button style={S.primaryBtn} onClick={finish}>
              {contacts.length > 0 ? "All set — meet Sage!" : "Skip for now"}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

// ── STYLES ────────────────────────────────────────────────────
const S = {
  page: {
    height: "100vh", width: "100vw",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "flex-end",
    fontFamily: "'Georgia', serif",
    overflow: "hidden", position: "relative",
    paddingBottom: 48,
  },

  // Background shifts from deep night to warm dawn
  bgLayer: {
    position: "absolute", inset: 0, zIndex: 0,
    transition: "background 3s ease",
  },
  bgNight: {
    background: "linear-gradient(to top, #0F0B1F 0%, #1A1040 40%, #0D1A10 100%)",
  },
  bgDawn: {
    background: "linear-gradient(to top, #1A0F2E 0%, #7B2D0F 25%, #D4621A 45%, #F0A060 65%, #FDE4C0 100%)",
  },

  // Warm glow band at the horizon
  horizonGlow: {
    position: "absolute", left: 0, right: 0,
    height: 300, bottom: "25%", zIndex: 1,
    background: "radial-gradient(ellipse 80% 100% at 50% 100%, rgba(240,130,30,0.55) 0%, transparent 70%)",
    opacity: 0, transition: "opacity 2.5s ease 0.8s",
    pointerEvents: "none",
  },
  horizonGlowVisible: { opacity: 1 },

  // Sun wrapper — animates the whole avatar from below screen to center
  sunWrap: {
    position: "absolute", zIndex: 2,
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "transform 2s cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 1.5s ease",
  },
  sunWrapHidden: { transform: "translateY(340px)", opacity: 0, bottom: "30%" },
  sunWrapRisen:  { transform: "translateY(0)",     opacity: 1, bottom: "32%" },

  // Glow ring behind the sun
  sunRing: {
    position: "absolute", width: 240, height: 240, borderRadius: "50%",
    border: "1.5px solid rgba(240,160,60,0.3)", pointerEvents: "none",
  },

  // The sun circle itself
  sunCircle: {
    width: 180, height: 180, borderRadius: "50%",
    background: "linear-gradient(135deg, #F0C060 0%, #E8845A 50%, #8DB89A 100%)",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    boxShadow: "0 0 80px rgba(240,160,60,0.6), 0 0 160px rgba(240,130,30,0.3)",
    position: "relative", zIndex: 3,
  },
  sunLetter: { fontSize: 78, color: "#fff", fontWeight: 700, lineHeight: 1 },
  sunLabel:  { fontSize: 13, color: "rgba(255,255,255,0.8)", letterSpacing: 3, marginTop: 2 },

  // Step content area
  content: {
    position: "relative", zIndex: 4, width: "90%", maxWidth: 420,
    display: "flex", flexDirection: "column", alignItems: "center",
    textAlign: "center", transition: "opacity 1s ease 2s",
  },
  contentHidden:  { opacity: 0, pointerEvents: "none" },
  contentVisible: { opacity: 1 },

  stepWrap: { display: "flex", flexDirection: "column", alignItems: "center", gap: 16, width: "100%" },

  title:    { color: "#FDE4C0", fontSize: 42, fontWeight: 700, margin: 0, letterSpacing: "-0.5px" },
  subtitle: { color: "rgba(253,228,192,0.75)", fontSize: 19, lineHeight: 1.6, margin: 0, fontStyle: "italic" },
  question: { color: "#FDE4C0", fontSize: 24, margin: 0, lineHeight: 1.5 },

  primaryBtn: {
    background: "linear-gradient(135deg, #F0C060, #E8845A)",
    color: "#1A0F2E", border: "none", borderRadius: 50,
    padding: "16px 48px", fontSize: 20, fontWeight: 700,
    cursor: "pointer", fontFamily: "Georgia, serif",
    boxShadow: "0 4px 24px rgba(240,160,60,0.45)",
    width: "100%", marginTop: 8,
  },
  btnDisabled: { opacity: 0.4, cursor: "not-allowed" },

  input: {
    width: "100%", boxSizing: "border-box",
    background: "rgba(255,255,255,0.1)", border: "1.5px solid rgba(240,160,60,0.4)",
    borderRadius: 14, padding: "14px 18px", fontSize: 20,
    color: "#FDE4C0", fontFamily: "Georgia, serif", outline: "none",
    textAlign: "center",
  },
  inputSmall: {
    flex: 1, background: "rgba(255,255,255,0.08)", border: "1px solid rgba(240,160,60,0.3)",
    borderRadius: 10, padding: "10px 12px", fontSize: 16,
    color: "#FDE4C0", fontFamily: "Georgia, serif", outline: "none",
  },
  addRow: { display: "flex", gap: 8, width: "100%", alignItems: "center" },
  addBtn: {
    background: "rgba(240,160,60,0.25)", color: "#F0C060",
    border: "1px solid rgba(240,160,60,0.4)", borderRadius: 10,
    padding: "10px 16px", fontSize: 15, cursor: "pointer", fontFamily: "Georgia, serif",
    whiteSpace: "nowrap",
  },

  contactChip: {
    display: "flex", alignItems: "center", gap: 10, width: "100%",
    background: "rgba(255,255,255,0.07)", borderRadius: 10,
    padding: "10px 14px", border: "1px solid rgba(240,160,60,0.2)",
  },
  chipName:   { color: "#FDE4C0", fontSize: 15, fontWeight: 600, flex: 1 },
  chipPhone:  { color: "rgba(253,228,192,0.55)", fontSize: 13 },
  chipRemove: { background: "transparent", border: "none", color: "rgba(240,160,60,0.5)", fontSize: 18, cursor: "pointer" },
};

function Styles() {
  return (
    <style>{`
      /* Glow rings rotate slowly around the sun */
      @keyframes spinRing {
        from { transform: rotate(0deg) scale(1); }
        to   { transform: rotate(360deg) scale(1.04); }
      }
      .sun-ring-1 { animation: spinRing 12s linear infinite; }
      .sun-ring-2 { animation: spinRing 20s linear infinite reverse; }

      input:focus { border-color: rgba(240,160,60,0.75) !important; }
    `}</style>
  );
}
