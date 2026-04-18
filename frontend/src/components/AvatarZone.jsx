// ============================================================
//  AvatarZone.jsx — THE RISING SUN AVATAR
//
//  ✅ DONE:
//    - Sun-style avatar positioned at the "horizon" of the screen
//    - Warm gold/amber glow radiates outward
//    - Rotating glow rings around the sun
//    - isThinking: sun glow pulses slowly
//    - isSpeaking: sun bounces rhythmically (like Talking Tom)
//    - "Welcome back, [name]" badge for returning users
//    - Clear slot comment for LiveAvatar swap
//
//  🔲 TODO TONIGHT:
//    - Nothing blocking
//
//  🔲 TODO TOMORROW:
//    - [ ] MAIN TASK: swap <PlaceholderSun> with <LiveAvatar>
//          LiveAvatar from ElevenLabs takes an audioUrl prop
//          and handles all lip-sync and facial animation
//    - [ ] Pass audioRef.current.src to LiveAvatar so it lip-syncs
//    - [ ] Optionally: add sunrays that spread when speaking
//    - [ ] If LiveAvatar has its own container size, wrap it to match
//          the current 200px circle footprint
// ============================================================

import { useEffect, useState } from "react";

export default function AvatarZone({ isSpeaking, isThinking, userName, isReturning, audioRef }) {
  const [mounted, setMounted] = useState(false);

  // Trigger entrance animation after mount
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div style={S.zone}>
      <Styles />

      {/* ── RETURNING USER BADGE ─────────────────────────── */}
      {isReturning && userName && (
        <div style={{ ...S.badge, ...(mounted ? S.badgeVisible : S.badgeHidden) }}>
          Welcome back, {userName} ♡
        </div>
      )}

      {/* ── GLOW RINGS — rotate slowly around the sun ─────── */}
      <div style={S.ringsWrap}>
        <div className={`ring ${isSpeaking ? "ring-speak" : isThinking ? "ring-think" : "ring-idle"}`}
             style={{ ...S.ring, width: 260, height: 260 }} />
        <div className={`ring ${isSpeaking ? "ring-speak" : isThinking ? "ring-think" : "ring-idle"}`}
             style={{ ...S.ring, width: 310, height: 310, animationDelay: "0.4s" }} />
      </div>

      {/*
        ══════════════════════════════════════════════
        LIVEAVATAR SWAP POINT
        ══════════════════════════════════════════════
        Replace <PlaceholderSun> below with:

          <LiveAvatar
            audioUrl={audioRef?.current?.src}
            isActive={isSpeaking}
          />

        Everything else in this file stays the same.
        The rings, badge, and glow effects will still work.
        ══════════════════════════════════════════════
      */}
      <div className={
        isSpeaking ? "sun-speak" : isThinking ? "sun-think" : mounted ? "sun-idle" : ""
      }>
        <PlaceholderSun />
      </div>

    </div>
  );
}

// ── Placeholder — the golden sun circle ──────────────────────
// This entire component gets replaced by <LiveAvatar />
function PlaceholderSun() {
  return (
    <div style={S.sunCircle}>
      <span style={S.sunLetter}>S</span>
      <span style={S.sunLabel}>SAGE</span>
    </div>
  );
}

const S = {
  zone: {
    flex: 1, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    position: "relative", width: "100%", zIndex: 5,
  },
  badge: {
    position: "absolute", top: 12, zIndex: 10,
    background: "rgba(253,228,192,0.2)", color: "#FDE4C0",
    border: "1px solid rgba(240,192,96,0.3)", borderRadius: 20,
    padding: "5px 16px", fontSize: 14, fontFamily: "Georgia, serif",
    fontStyle: "italic", transition: "opacity 0.8s ease 0.5s",
  },
  badgeHidden:  { opacity: 0 },
  badgeVisible: { opacity: 1 },

  ringsWrap: { position: "absolute", display: "flex", alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute", borderRadius: "50%",
    border: "1px solid rgba(240,160,60,0.2)",
    top: "50%", left: "50%",
    transform: "translate(-50%, -50%)",
  },
  sunCircle: {
    width: 200, height: 200, borderRadius: "50%", position: "relative", zIndex: 3,
    background: "linear-gradient(135deg, #F5C842 0%, #E8845A 55%, #8DB89A 100%)",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    boxShadow: "0 0 80px rgba(240,160,60,0.7), 0 0 160px rgba(240,130,30,0.35)",
  },
  sunLetter: { fontSize: 88, color: "#fff", fontWeight: 700, lineHeight: 1 },
  sunLabel:  { fontSize: 14, color: "rgba(255,255,255,0.75)", letterSpacing: 3 },
};

function Styles() {
  return (
    <style>{`
      /* Idle: sun floats gently */
      @keyframes float    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
      .sun-idle { animation: float 5s ease-in-out infinite; }

      /* Thinking: glow pulses */
      @keyframes glowPulse { 0%,100%{box-shadow:0 0 60px rgba(240,160,60,0.5)} 50%{box-shadow:0 0 120px rgba(240,160,60,0.85)} }
      .sun-think > div { animation: glowPulse 1.8s ease-in-out infinite; }

      /* Speaking: sun bounces (Talking Tom style) */
      @keyframes bounce { 0%,100%{transform:scale(1)} 30%{transform:scale(1.07)} 70%{transform:scale(0.95)} }
      .sun-speak > div { animation: bounce 0.4s ease-in-out infinite; }

      /* Rings */
      @keyframes ringSpin   { from{transform:translate(-50%,-50%) rotate(0deg)}   to{transform:translate(-50%,-50%) rotate(360deg)} }
      @keyframes ringPulse  { 0%,100%{opacity:0.2;transform:translate(-50%,-50%) scale(1)} 50%{opacity:0.5;transform:translate(-50%,-50%) scale(1.05)} }
      @keyframes ringExpand { 0%{transform:translate(-50%,-50%) scale(1);opacity:0.4} 100%{transform:translate(-50%,-50%) scale(1.35);opacity:0} }

      .ring-idle  { animation: ringSpin  14s linear      infinite; }
      .ring-think { animation: ringPulse 2s  ease-in-out  infinite; }
      .ring-speak { animation: ringExpand 1s ease-out     infinite; }
    `}</style>
  );
}
