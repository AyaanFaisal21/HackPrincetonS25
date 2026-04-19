
# Sage

An AI participant that lives in your group chats. Sage builds memory over time, learns the chat's tone, and speaks only when it has something grounded to say — a direct answer to an @mention, a nudge when the group is drifting, or a callback to something someone actually said weeks ago.

Built for the Photon "Agents in iMessage" track at HackPrinceton Spring 2026.

## Why Sage

Most group-chat bots are either dead weight or an interruption. Sage is designed around one rule: **speak less than 1 in 10 messages, and only when grounded in real context.** No hallucinations, no unprompted help, no filler. If a sage wouldn't say it, Sage doesn't either.

## What it does

- **Direct asks** — `@sage what did Maya say about the venue?` retrieves from short-term buffer + long-term vector memory and answers like a friend who was there.
- **Indirect address** — "hey sage, did you catch that?" routes the same way; no `@` required.
- **Autonomous intervention** — when the group contradicts a past decision or relitigates something already resolved, Sage surfaces the anchor message. Gated by a 3-minute cooldown and a relevance threshold so it never spams.
- **Silence detection** — ~20s after the last message, Sage classifies the quiet as CONFLICT vs RESOLVED and only speaks if tension was left hanging.
- **Vibe inference** — after ~8 non-Sage messages, Sage reads the room and adopts the chat's tone (formal, joke-heavy, dry, supportive). Refreshes every 20 messages. Override with `@sage vibe: <directive>`.
- **Relative time** — "earlier today", "a couple weeks ago" — never ISO dates.

## Stack

- **TypeScript** via `tsx` on Node
- **Spectrum** (`spectrum-ts`) + `spectrum-ts/providers/imessage` — Photon's framework for agent messaging
- **Gemini 2.5 Flash** — classification, response generation, vibe inference
- **Chroma** — vector store for long-term chat memory
- **Voyage AI** — embeddings
- **React + Vite** (frontend) — landing page and phone-number onboarding
- **Express + SQLite** (backend) — registration API

## Repo layout

```
sage/        agent runtime (Spectrum listener, Gemini pipeline, memory)
frontend/    React landing page — onboarding modal posts to /api/register
backend/     Express server for registration + JWT auth
```

Key files in [sage/src/](sage/src/):

- [sage-bot.ts](sage/src/sage-bot.ts) — main entry; Spectrum loop, mention routing, vibe inference, silence watcher
- [agent.ts](sage/src/agent.ts) — `classify()` (should Sage speak?), `respond()` (what does Sage say?), `checkSilence()`
- [memory.ts](sage/src/memory.ts) — Chroma + Voyage ingest/retrieve
- [utils.ts](sage/src/utils.ts) — Gemini client factory

## Setup

```bash
cd sage
npm install
```

Create `sage/.env`:

```
PHOTON_PROJECT_ID=...
PHOTON_PROJECT_SECRET=...
GEMINI_API_KEY=...
VOYAGE_API_KEY=...
SAGE_PHONE=+14155550123   # the Photon line's E.164 number — lets Sage recognize its own messages
```

## Run

```bash
# terminal 1 — vector store (required for autonomous mode)
npx chroma run --path /tmp/sage-chroma

# terminal 2 — the agent
cd sage
npx tsx src/sage-bot.ts
```

You should see `Sage is online.` Text the Photon number, or add it to a group chat, and watch the console.

Restart cleanly with:

```bash
pkill -f "tsx src/" ; sleep 1 ; npx tsx src/sage-bot.ts
```

## Expected behavior

- Normal chat flows through — Sage stays silent most of the time (by design).
- `@sage <anything>` — always replies, with full context.
- Indirect address ("hey sage, ...") — replies.
- When the group drifts, contradicts, or gets stuck AND there's relevant memory to anchor on AND the 3-min cooldown has elapsed → Sage speaks autonomously.
- 20s of silence after a tense message → Sage may check in with a warm nudge.
- First time joining a group → Sage introduces itself and asks members to rename the contact.

## Design principles

- **Restraint is a feature.** The test for any behavior is "would a sage do this?"
- **Grounded or silent.** If there's no retrievable anchor, Sage doesn't speak.
- **Plain text only.** iMessage strips markdown; responses are 1–4 short sentences.
- **Identity, not prefix.** Sage recognizes its own messages by phone number, not a `[Sage]:` tag — so replies blend in.

## Demo

The 2-minute demo shows three teammates live-arguing in an iMessage group chat over a hackathon idea. Seeded memory from "a month ago" contains a hard constraint one teammate stated. At the key moment, Sage surfaces that month-old position and reframes the disagreement around it. A fourth teammate narrates what Sage is doing and which Photon judging criteria it hits.

## Built by

Ayaan Faisal, Bayo Bandele, and the HackPrinceton 2026 team.












Run it

pkill -f "tsx src/" ; sleep 1
cd /Users/ayaanfaisal/Documents/Sandbox/Sage/HackPrincetonS25/sage
npx tsx src/sage-bot.ts
If you want long-term memory active (autonomous mode needs it to ever fire), run Chroma in a second terminal:


npx chroma run --path /tmp/sage-chroma
Expected behavior
Normal chat flows through — Sage stays silent most of the time (by design)
@sage <anything> — always replies, with full context
When the group drifts, contradicts, or gets stuck AND there's ≥0.75-relevance memory to anchor on AND the 3-min cooldown has elapsed → Sage speaks autonomously
