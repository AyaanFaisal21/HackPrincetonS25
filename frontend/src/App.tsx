import { useState, useEffect, useRef } from "react";
import imessageImg  from "../images/IMessage.svg";
import whatsappImg  from "../images/whatsapp.svg";
import telegramImg  from "../images/telegram.svg";
import instagramImg from "../images/instagram.svg";
import discordImg   from "../images/discord.svg";
import messengerImg from "../images/messenger.svg";

type Phase     = "intro" | "main";
type ReqStatus = "idle" | "loading" | "error";

const TAGLINES = [
  "Your know-it-all friend.",
  "The groupchat never asked for — but always needed.",
  "Always listening. Never annoying. (mostly.)",
  "Memory like an elephant. Tact of a sage.",
  "The one who actually reads the chat.",
  "Less drama. More clarity.",
  "Wiser than the group chat deserves.",
  "The friend who actually pays attention.",
  "The Diplomat.",
  " The Missing Link",
];

const PLATFORMS = [
  { name: "iMessage",  bg: "#007AFF", emoji: "💬", img: imessageImg,  available: true  },
  { name: "WhatsApp",  bg: "#25D366", emoji: "📱", img: whatsappImg,  available: false },
  { name: "Telegram",  bg: "#2AABEE", emoji: "✈️", img: telegramImg,  available: false },
  { name: "Instagram", bg: "#E1306C", emoji: "📷", img: instagramImg, available: false },
  { name: "Discord",   bg: "#7289DA", emoji: "🎮", img: discordImg,   available: false },
  { name: "Messenger", bg: "#0084FF", emoji: "⚡", img: messengerImg, available: false },
];

const SCATTER = [
  { p: 0, left:  5, top: 62 },
  { p: 1, left: 20, top: 10 },
  { p: 2, left: 36, top: 62 },
  { p: 3, left: 52, top: 10 },
  { p: 4, left: 67, top: 62 },
  { p: 5, left: 82, top: 10 },
];

// ── Register modal ────────────────────────────────────────────────────────────

function RegisterModal({ onClose }: { onClose: () => void }) {
  const [done, setDone]       = useState(false);
  const [phone, setPhone]     = useState("");
  const [status, setStatus]   = useState<ReqStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  function normalizePhone(raw: string): string | null {
    const d = raw.replace(/\D/g, "");
    if (d.length === 10) return `+1${d}`;
    if (d.length === 11 && d.startsWith("1")) return `+${d}`;
    return null;
  }

  const isValid = normalizePhone(phone) !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizePhone(phone);
    if (!normalized) return;
    setStatus("loading");
    setErrorMsg("");
    try {
      const res  = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: normalized }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setErrorMsg(data.error ?? "Something went wrong."); setStatus("error"); return; }
      setDone(true);
    } catch {
      setErrorMsg("Could not reach the server. Try again.");
      setStatus("error");
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>

        {done ? (
          <div className="modal-done">
            <img src={imessageImg} alt="iMessage" className="modal-done-imessage" />
            <h2>You are IN!</h2>
            <p>Check your messages.</p>
            <button className="submit-btn" onClick={onClose}>Close</button>
          </div>
        ) : (
          <>
            <h2 className="modal-title">Register for <span className="sage-word">Sage</span></h2>
            <p className="modal-sub">Enter your phone number and we'll reach out via iMessage.</p>
            <form onSubmit={handleSubmit} className="modal-form">
              <input
                className="phone-input"
                type="tel"
                placeholder="(555) 555-5555"
                autoFocus
                value={phone}
                onChange={(e) => { setPhone(e.target.value); setErrorMsg(""); }}
              />
              {errorMsg && <p className="error-msg">{errorMsg}</p>}
              <button className="submit-btn" type="submit" disabled={!isValid || status === "loading"}>
                {status === "loading" ? "…" : "Join Sage"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [phase, setPhase]         = useState<Phase>("intro");
  const [showModal, setShowModal] = useState(false);
  const tagline = useRef(TAGLINES[Math.floor(Math.random() * TAGLINES.length)]);

  useEffect(() => {
    const t = setTimeout(() => setPhase("main"), 3000);
    return () => clearTimeout(t);
  }, []);

  // Close modal on Escape
  useEffect(() => {
    if (!showModal) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setShowModal(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showModal]);

  return (
    <div className="container">

      {showModal && <RegisterModal onClose={() => setShowModal(false)} />}

      {phase === "intro" && (
        <div key="intro" className="intro-group">
          <p className="say-hello-line">Say Hello To</p>
          <p className="sage-intro-line">Sage</p>
        </div>
      )}

      {phase === "main" && (
        <div key="main" className="landing">

          {/* ── Hero ── */}
          <section className="hero-section">
            <header className="landing-header">
              <h1 className="landing-title">
                {tagline.current.trim().split(" ").slice(0, -1).join(" ")}{" "}
                <span className="sage-word">{tagline.current.trim().split(" ").slice(-1)[0]}</span>
              </h1>
            </header>

            <div className="scatter-outer">
              <div className="scatter-track">
                {SCATTER.map((pos, i) => (
                  <div key={`a${i}`} className="scatter-item" style={{ left: `${pos.left}vw`, top: `${pos.top}%` }}>
                    <div className="icon-logo" style={{ animationDelay: `${i * 0.065}s` }}>
                      {PLATFORMS[pos.p]!.img
                        ? <img src={PLATFORMS[pos.p]!.img} alt={PLATFORMS[pos.p]!.name} className="icon-img" />
                        : <span className="icon-emoji">{PLATFORMS[pos.p]!.emoji}</span>}
                    </div>
                  </div>
                ))}
                {SCATTER.map((pos, i) => (
                  <div key={`b${i}`} className="scatter-item" style={{ left: `${pos.left + 100}vw`, top: `${pos.top}%` }}>
                    <div className="icon-logo no-popin">
                      {PLATFORMS[pos.p]!.img
                        ? <img src={PLATFORMS[pos.p]!.img} alt={PLATFORMS[pos.p]!.name} className="icon-img" />
                        : <span className="icon-emoji">{PLATFORMS[pos.p]!.emoji}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="scroll-prompt">
              <span className="scroll-arrow">↓</span>
              <span className="scroll-label">Scroll to try <span className="sage-word">Sage</span></span>
            </div>
          </section>

          {/* ── Platform list ── */}
          <section className="platforms-section">
            <h2 className="platforms-heading">Sage goes where you talk.<br/>Low effort. Low friction.</h2>
            <div className="platform-list">
              {PLATFORMS.map((p) => (
                <div key={p.name} className={`platform-row ${p.available ? "active" : ""}`}>
                  <div className="platform-row-icon">
                    {p.img
                      ? <img src={p.img} alt={p.name} className="icon-img" />
                      : <span>{p.emoji}</span>}
                  </div>
                  <span className="platform-row-name">{p.name}</span>
                  {p.available
                    ? <button className="try-btn" onClick={() => setShowModal(true)}>Try for free</button>
                    : <span className="coming-pill">Coming soon</span>}
                </div>
              ))}
            </div>
          </section>

        </div>
      )}
    </div>
  );
}
