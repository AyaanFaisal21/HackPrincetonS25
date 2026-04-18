// ============================================================
//  components/index.jsx — ALL SMALLER COMPONENTS
//
//  This file contains 4 components. Each is exported separately.
//  Import them individually:
//    import InputBar        from "./components/InputBar"
//    import EmergencyPanel  from "./components/EmergencyPanel"
//    import MemorySidebar   from "./components/MemorySidebar"
//    import EventSuggestions from "./components/EventSuggestions"
//
//  ✅ DONE:
//    - InputBar: mic (hold to speak) + text input, always visible
//    - EmergencyPanel: add/remove contacts, send alert via Photon
//    - MemorySidebar: shows what Sage remembers about the user
//    - EventSuggestions: matched events/users by interest
//
//  🔲 TODO TOMORROW:
//    - [ ] InputBar: add visual waveform animation while mic is recording
//    - [ ] EmergencyPanel: pull contacts from userProfile (currently local state)
//    - [ ] MemorySidebar: animate entry (slide from right)
//    - [ ] MemorySidebar: add an "edit" mode so user can correct Sage's memory
//    - [ ] EventSuggestions: replace mock events with real API fetch from backend
//    - [ ] EventSuggestions: add "Connect" button that opens Photon message thread
// ============================================================

import { useState } from "react";

// ─────────────────────────────────────────────────────────────
//  InputBar
//  Always visible at the bottom. Mic on left, text on right.
// ─────────────────────────────────────────────────────────────
export function InputBar({ onSend, onMicStart, onMicEnd, isListening, isDisabled, preferText }) {
  const [text, setText] = useState("");

  const submit = () => {
    if (!text.trim() || isDisabled) return;
    onSend(text);
    setText("");
  };

  return (
    <div style={IB.bar}>
      {/* Mic button — hold to speak */}
      <div style={IB.micCol}>
        <button
          style={{
            ...IB.mic,
            ...(isListening ? IB.micOn  : {}),
            ...(isDisabled  ? IB.micOff : {}),
          }}
          onMouseDown={onMicStart}
          onMouseUp={onMicEnd}
          onTouchStart={onMicStart}
          onTouchEnd={onMicEnd}
          disabled={isDisabled}
          title="Hold to speak"
        >
          {isListening ? "🎙" : "🎤"}
        </button>
        <span style={IB.micLabel}>{isListening ? "Listening" : "Hold"}</span>
      </div>

      {/* Text input */}
      <div style={IB.textCol}>
        <textarea
          style={{ ...IB.textarea, ...(isDisabled ? IB.textOff : {}), ...(preferText ? IB.textPreferred : {}) }}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder={preferText ? "Type your message..." : "Or type here..."}
          rows={2}
          disabled={isDisabled}
          autoFocus={preferText}
        />
        <button
          style={{ ...IB.send, ...(!text.trim() || isDisabled ? IB.sendOff : {}) }}
          onClick={submit}
          disabled={!text.trim() || isDisabled}
        >
          Send
        </button>
      </div>
    </div>
  );
}

const IB = {
  bar: {
    width: "92%", maxWidth: 540, display: "flex", alignItems: "flex-end", gap: 12,
    padding: "10px 0 28px", zIndex: 10,
    borderTop: "1px solid rgba(240,160,60,0.15)",
  },
  micCol:   { display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 },
  mic: {
    width: 60, height: 60, borderRadius: "50%",
    border: "2px solid rgba(240,160,60,0.5)", background: "rgba(240,160,60,0.1)",
    fontSize: 24, cursor: "pointer", display: "flex", alignItems: "center",
    justifyContent: "center", transition: "all 0.15s",
  },
  micOn:    { background: "rgba(240,160,60,0.35)", border: "2px solid #F0C060", transform: "scale(1.08)" },
  micOff:   { opacity: 0.35, cursor: "not-allowed" },
  micLabel: { color: "rgba(253,228,192,0.45)", fontSize: 11, fontStyle: "italic" },
  textCol:  { flex: 1, display: "flex", flexDirection: "column", gap: 6 },
  textarea: {
    width: "100%", border: "1.5px solid rgba(240,160,60,0.3)", borderRadius: 12,
    padding: "10px 14px", fontSize: 18, fontFamily: "Georgia, serif",
    background: "rgba(26,15,46,0.55)", color: "#FDE4C0",
    resize: "none", outline: "none", boxSizing: "border-box",
  },
  textPreferred: { border: "1.5px solid rgba(240,160,60,0.6)", background: "rgba(26,15,46,0.75)" },
  textOff:  { opacity: 0.35 },
  send:     { background: "linear-gradient(135deg,#F0C060,#E8845A)", color: "#1A0F2E", border: "none", borderRadius: 50, padding: "10px 20px", fontSize: 16, fontWeight: 700, cursor: "pointer", fontFamily: "Georgia, serif" },
  sendOff:  { background: "rgba(240,160,60,0.2)", color: "rgba(253,228,192,0.4)", cursor: "not-allowed" },
};


// ─────────────────────────────────────────────────────────────
//  EmergencyPanel
//  Slides down from top. Add/remove contacts. Send Photon alert.
// ─────────────────────────────────────────────────────────────
export function EmergencyPanel({ contacts, setContacts, alertStatus, onSendAlert }) {
  const [newName,  setNewName]  = useState("");
  const [newPhone, setNewPhone] = useState("");

  const add = () => {
    if (!newName.trim() || !newPhone.trim()) return;
    setContacts([...contacts, { id: Date.now(), name: newName.trim(), phone: newPhone.trim(), relationship: "Contact" }]);
    setNewName(""); setNewPhone("");
  };

  const alertLabel = { null: "🚨  Send Alert to All", sending: "Sending...", sent: "✓  Alerts Sent!", failed: "⚠  Some Failed" }[alertStatus] ?? "🚨  Send Alert";

  return (
    <div style={EP.panel}>
      <button
        style={{ ...EP.alertBtn, ...(alertStatus === "sent" ? EP.sent : alertStatus === "sending" ? EP.sending : alertStatus === "failed" ? EP.failed : {}) }}
        onClick={onSendAlert} disabled={alertStatus === "sending"}
      >
        {alertLabel}
      </button>

      <div style={EP.list}>
        {contacts.length === 0 && <p style={EP.empty}>No contacts yet — add one below</p>}
        {contacts.map(c => (
          <div key={c.id} style={EP.row}>
            <div>
              <div style={EP.name}>{c.name}</div>
              <div style={EP.phone}>{c.phone}</div>
            </div>
            <button style={EP.remove} onClick={() => setContacts(contacts.filter(x => x.id !== c.id))}>✕</button>
          </div>
        ))}
      </div>

      <div style={EP.addRow}>
        <input style={EP.input} placeholder="Name"  value={newName}  onChange={e => setNewName(e.target.value)}  />
        <input style={EP.input} placeholder="Phone" value={newPhone} onChange={e => setNewPhone(e.target.value)} type="tel" />
        <button style={{ ...EP.addBtn, ...(!newName.trim() || !newPhone.trim() ? EP.addOff : {}) }} onClick={add}>Add</button>
      </div>
    </div>
  );
}

const EP = {
  panel: {
    width: "92%", maxWidth: 520, zIndex: 10,
    background: "rgba(26,15,46,0.9)", backdropFilter: "blur(10px)",
    border: "1px solid rgba(200,60,60,0.25)", borderRadius: 16,
    padding: 16, display: "flex", flexDirection: "column", gap: 10, marginBottom: 8,
  },
  alertBtn: { background: "#C0392B", color: "#fff", border: "none", borderRadius: 10, padding: "13px 20px", fontSize: 17, fontWeight: 700, cursor: "pointer", fontFamily: "Georgia, serif" },
  sent:     { background: "#27AE60" },
  sending:  { background: "#666", cursor: "wait" },
  failed:   { background: "#E67E22" },
  list:     { display: "flex", flexDirection: "column", gap: 8 },
  empty:    { color: "rgba(253,228,192,0.4)", fontSize: 14, fontStyle: "italic", margin: 0, textAlign: "center" },
  row:      { display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: "9px 13px" },
  name:     { color: "#FDE4C0", fontSize: 15, fontWeight: 600 },
  phone:    { color: "rgba(253,228,192,0.5)", fontSize: 12, marginTop: 1 },
  remove:   { background: "transparent", border: "none", color: "rgba(240,128,128,0.6)", fontSize: 18, cursor: "pointer" },
  addRow:   { display: "flex", gap: 8, alignItems: "center" },
  input:    { flex: 1, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(240,160,60,0.25)", borderRadius: 8, padding: "8px 11px", color: "#FDE4C0", fontSize: 14, fontFamily: "Georgia, serif", outline: "none" },
  addBtn:   { background: "rgba(240,160,60,0.2)", color: "#F0C060", border: "1px solid rgba(240,160,60,0.4)", borderRadius: 8, padding: "8px 14px", fontSize: 14, cursor: "pointer", fontFamily: "Georgia, serif", whiteSpace: "nowrap" },
  addOff:   { opacity: 0.4, cursor: "not-allowed" },
};


// ─────────────────────────────────────────────────────────────
//  MemorySidebar
//  Slides in from right. Shows what Sage knows about the user.
//  ONLY shown for returning users. This is the demo "wow moment."
// ─────────────────────────────────────────────────────────────
export function MemorySidebar({ userProfile, onClose }) {
  return (
    <div style={MS.overlay} onClick={onClose}>
      <div style={MS.panel} onClick={e => e.stopPropagation()}>
        <div style={MS.header}>
          <span style={MS.title}>What Sage Remembers</span>
          <button style={MS.close} onClick={onClose}>✕</button>
        </div>

        {/* Name + member since */}
        <Section label={`About ${userProfile.name}`}>
          {userProfile.age && <Detail label="Age" value={userProfile.age} />}
          {userProfile.joinedAt && <Detail label="Member since" value={new Date(userProfile.joinedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })} />}
        </Section>

        {/* Interests */}
        {userProfile.interests?.length > 0 && (
          <Section label="Loves & Interests">
            <div style={MS.chips}>
              {userProfile.interests.map(i => (
                <span key={i} style={MS.chip}>♡ {i}</span>
              ))}
            </div>
          </Section>
        )}

        {/* Health */}
        {userProfile.health?.conditions?.length > 0 && (
          <Section label="Health Notes">
            {userProfile.health.conditions.map(c => <Detail key={c} value={`• ${c}`} />)}
            {userProfile.health.medications?.map(m => <Detail key={m} value={`• Takes ${m}`} />)}
          </Section>
        )}

        {/* Family */}
        {userProfile.family?.length > 0 && (
          <Section label="Family">
            {userProfile.family.map(f => <Detail key={f.name} value={`${f.name} (${f.relationship})`} />)}
          </Section>
        )}

        {/* Recent conversations */}
        {userProfile.conversations?.length > 0 && (
          <Section label="Recent Conversations">
            {userProfile.conversations.slice(0, 3).map((c, i) => (
              <div key={i} style={MS.convoRow}>
                <span style={MS.convoDate}>{new Date(c.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                <span style={MS.convoText}>{c.summary}</span>
              </div>
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ label, children }) {
  return (
    <div style={MS.section}>
      <div style={MS.sectionLabel}>{label}</div>
      {children}
    </div>
  );
}
function Detail({ label, value }) {
  return (
    <div style={MS.detail}>
      {label && <span style={MS.detailLabel}>{label}: </span>}
      <span style={MS.detailValue}>{value}</span>
    </div>
  );
}

const MS = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", justifyContent: "flex-end" },
  panel: {
    width: 300, height: "100%", overflowY: "auto",
    background: "linear-gradient(to bottom, #2A1A06, #1A0F2E)",
    borderLeft: "1px solid rgba(240,160,60,0.25)", padding: 20,
    display: "flex", flexDirection: "column", gap: 16,
  },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  title:  { color: "#F0C060", fontSize: 17, fontWeight: 700, fontFamily: "Georgia, serif" },
  close:  { background: "transparent", border: "none", color: "rgba(240,160,60,0.5)", fontSize: 20, cursor: "pointer" },
  section:      { display: "flex", flexDirection: "column", gap: 8 },
  sectionLabel: { color: "rgba(240,160,60,0.7)", fontSize: 12, textTransform: "uppercase", letterSpacing: 1.5, fontFamily: "Georgia, serif" },
  chips:  { display: "flex", flexWrap: "wrap", gap: 6 },
  chip:   { background: "rgba(240,160,60,0.15)", color: "#FDE4C0", border: "1px solid rgba(240,160,60,0.25)", borderRadius: 20, padding: "4px 12px", fontSize: 13, fontFamily: "Georgia, serif" },
  detail:      { display: "flex", gap: 6 },
  detailLabel: { color: "rgba(253,228,192,0.5)", fontSize: 14, fontFamily: "Georgia, serif" },
  detailValue: { color: "#FDE4C0", fontSize: 14, fontFamily: "Georgia, serif" },
  convoRow:  { display: "flex", gap: 8, alignItems: "flex-start" },
  convoDate: { color: "rgba(240,160,60,0.6)", fontSize: 12, whiteSpace: "nowrap", marginTop: 2, fontFamily: "Georgia, serif" },
  convoText: { color: "rgba(253,228,192,0.75)", fontSize: 13, lineHeight: 1.5, fontFamily: "Georgia, serif" },
};


// ─────────────────────────────────────────────────────────────
//  EventSuggestions
//  Cards shown below chat for returning users with known interests.
//  Right now uses mock data. Replace with real API call tomorrow.
// ─────────────────────────────────────────────────────────────

// TODO TOMORROW: replace with a real fetch from your backend
// backend should match userProfile.interests against an events database
const MOCK_EVENTS = [
  { id: 1, title: "Garden Club",    time: "Sat 10am",  location: "Princeton YMCA",  tag: "gardening",    icon: "🌱" },
  { id: 2, title: "Jazz Afternoon", time: "Sun 2pm",   location: "McCarter Theatre", tag: "jazz music",   icon: "🎵" },
  { id: 3, title: "Meet Dorothy, 74", time: "Mutual interests", location: "Jazz & Knitting", tag: "knitting", icon: "🧶" },
];

export function EventSuggestions({ interests }) {
  // Only show events that match at least one of the user's interests
  const matched = MOCK_EVENTS.filter(e =>
    interests.some(i => i.toLowerCase().includes(e.tag) || e.tag.includes(i.toLowerCase()))
  ).slice(0, 2);

  if (!matched.length) return null;

  return (
    <div style={EV.strip}>
      <div style={EV.label}>Suggested for you</div>
      <div style={EV.row}>
        {matched.map(e => (
          <div key={e.id} style={EV.card}>
            <span style={EV.icon}>{e.icon}</span>
            <div>
              <div style={EV.cardTitle}>{e.title}</div>
              <div style={EV.cardSub}>{e.time} · {e.location}</div>
            </div>
            {/* TODO: wire this button to open a Photon message thread */}
            <button style={EV.btn}>Join</button>
          </div>
        ))}
      </div>
    </div>
  );
}

const EV = {
  strip: { width: "92%", maxWidth: 540, zIndex: 5, marginBottom: 4 },
  label: { color: "rgba(240,160,60,0.5)", fontSize: 11, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 6, fontFamily: "Georgia, serif" },
  row:   { display: "flex", gap: 10 },
  card: {
    flex: 1, display: "flex", alignItems: "center", gap: 10,
    background: "rgba(26,15,46,0.6)", backdropFilter: "blur(6px)",
    border: "1px solid rgba(240,160,60,0.2)", borderRadius: 12, padding: "10px 12px",
  },
  icon:     { fontSize: 22, flexShrink: 0 },
  cardTitle:{ color: "#FDE4C0", fontSize: 13, fontWeight: 600, fontFamily: "Georgia, serif" },
  cardSub:  { color: "rgba(253,228,192,0.5)", fontSize: 11, marginTop: 1, fontFamily: "Georgia, serif" },
  btn:      { marginLeft: "auto", background: "rgba(240,160,60,0.2)", color: "#F0C060", border: "1px solid rgba(240,160,60,0.35)", borderRadius: 20, padding: "4px 12px", fontSize: 12, cursor: "pointer", fontFamily: "Georgia, serif", whiteSpace: "nowrap" },
};

export default { InputBar, EmergencyPanel, MemorySidebar, EventSuggestions };
