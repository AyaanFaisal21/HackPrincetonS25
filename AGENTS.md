Here's a AGENTS.md file scoped to get you through the echo loop reliably. I've written it to be directive where Codex tends to drift (hallucinating Photon APIs, over-engineering, jumping ahead) and open-ended where your team needs to make judgment calls.
markdown# Sage — Project Context for Codex

## What we're building

Sage is an AI agent that lives in iMessage group chats as a persistent participant. It builds memory over time of what each group member has said, and intervenes selectively when the group is stuck, drifting, or contradicting itself. Its interventions are grounded in retrievable context from the chat's actual history — never hallucinated.

Sage is being built for the Photon "Agents in iMessage" track at HackPrinceton Spring 2026. The qualifying requirement is that the project must integrate with Spectrum (Photon's framework for bringing agents to messaging platforms).

**Core design principle:** Sage speaks less than 1 in 10 messages in a busy chat. Restraint is a feature, not an absence. When in doubt, Sage stays silent. "Would a sage do that?" is the test for any behavior decision.

## Current phase: Echo loop (do not skip ahead)

We are in the first build phase: proving we can get a message from iMessage → through our code → back to iMessage as a reply. Until this works end-to-end, nothing else matters — not the database, not the memory system, not the intervention policy.

Do not propose or build:
- Database schemas (we design these AFTER we've seen real message shapes)
- LLM integration for intelligent responses
- Memory/retrieval systems
- Frontend or dashboard UI
- Deployment infrastructure beyond local dev

Do propose and help with:
- Echo loop setup
- Logging and inspecting real message shapes from Spectrum
- Infinite-loop guards
- Group chat handling specifics

## Tech stack (locked — do not suggest alternatives)

- **Language:** TypeScript (Spectrum's ecosystem is TS-native; Python is not a good fit here)
- **SDK:** `@photon-ai/advanced-imessage-kit` in remote mode
  - We explicitly chose this over the higher-level `chat-adapter-imessage` because the adapter's `onNewMention` is "DMs only," and Sage operates in group chats. The advanced SDK's `new-message` event fires on all messages, which is what we need.
- **Mode:** Remote (using Photon's managed infrastructure via promo code `HACKPTON2026` for Pro subscription)
- **Runtime:** Node.js via `tsx` for dev
- **Env management:** `dotenv`
- **Future database (not yet):** SQLite via `better-sqlite3` or Bun's built-in, plus a lightweight vector store (Chroma or in-memory FAISS). Do not scaffold this yet.

## Important Spectrum API facts (verified from docs)

- `chatGuid` format is `service;-;address`, e.g. `iMessage;-;+1234567890` for DMs. Group chat GUIDs have a different format (likely UUID-based) — we need to observe real values, not assume.
- iMessage is plain-text only. Markdown formatting is stripped when sending. Don't plan features that depend on bold/italic/headers in outgoing messages.
- Remote mode requires `IMESSAGE_SERVER_URL` and `IMESSAGE_API_KEY` from the Photon dashboard.
- The SDK emits a `new-message` event for all incoming messages. There is also an `isFromMe` flag on messages.
- Photon publishes an agent skill at `photon-hq/skills` that can be installed via `npx skills add photon-hq/skills --skill chat-adapter-imessage` — this gives source-accurate API reference. If you're unsure about a method signature, prefer consulting that skill or the actual installed package types over guessing.

## Echo loop implementation

### File: `src/echo.ts`

```typescript
import { SDK } from "@photon-ai/advanced-imessage-kit";
import "dotenv/config";

const SAGE_PREFIX = "[Sage echo]:";

async function main() {
  const sdk = SDK({
    serverUrl: process.env.IMESSAGE_SERVER_URL!,
    apiKey: process.env.IMESSAGE_API_KEY!,
    logLevel: "debug",
  });

  await sdk.connect();
  console.log("Sage is listening...");

  sdk.on("new-message", async (message) => {
    // Log the full raw shape — this is how we learn what Spectrum gives us
    console.log("Incoming:", JSON.stringify(message, null, 2));

    // Guard 1: never react to our own messages
    if (message.isFromMe) return;

    // Guard 2: never react to our own echoes (defense against cascades)
    if (message.text?.startsWith(SAGE_PREFIX)) return;

    // Echo back
    await sdk.messages.sendMessage({
      chatGuid: message.chatGuid,
      message: `${SAGE_PREFIX} ${message.text}`,
    });
  });

  process.on("SIGINT", async () => {
    await sdk.close();
    process.exit(0);
  });
}

main().catch(console.error);
```

### Running

```bash
npx tsx src/echo.ts
```

### Success criteria for this phase

1. Sending an iMessage to the Photon-connected number produces console output showing the full message object shape
2. An echo reply appears in iMessage within a few seconds
3. Infinite loops do not occur — Sage does not echo its own echoes
4. Test in both a 1:1 chat AND a group chat to observe both `chatGuid` formats and confirm the group-message flow works

## What to capture from the echo phase

Before moving to the next phase, save the console output of at least these message types to a `sample-messages.md` file:

- A 1:1 direct message
- A message in a group chat
- A reply to a previous message
- A message with a tapback reaction (if observable)
- A message from a different sender in the same group

These real shapes — not hypothetical ones — will drive the schema design in the next phase.

## Environment setup

Required `.env` (add to `.gitignore` immediately):
IMESSAGE_SERVER_URL=https://...   # from Photon dashboard
IMESSAGE_API_KEY=...              # from Photon dashboard

Required install:

```bash
npm install @photon-ai/advanced-imessage-kit dotenv
npm install -D typescript @types/node tsx
```

## Behavior rules for Codex in this repo

- **Do not invent Spectrum API methods.** If the SDK's actual method signature is unclear, say so and suggest we check the installed package's type definitions or the photon-hq/skills reference. Hallucinated Photon APIs are the highest-risk failure mode on this project.
- **Do not add dependencies without asking.** We're optimizing for a 36-hour hackathon build. Every dependency is a potential source of setup friction.
- **Prefer clarity over cleverness.** Explicit is better than implicit. A 10-line function a teammate can debug at 3am beats a 3-line functional pipeline that obscures what's happening.
- **When I ask for a feature, first tell me whether it belongs in the current phase.** If it's a future-phase concern (memory, retrieval, intervention policy, demo staging), say so and push back rather than building it.
- **Guard every message-sending path against infinite loops.** The `SAGE_PREFIX` check and `isFromMe` check are non-negotiable for any outgoing message until we have a more robust sender-identity system.
- **Logging over silence.** During the echo phase, err on the side of logging everything. We need to understand the message shapes before we can design around them.

## Anti-patterns (do not do these)

- Don't propose a "quick" database schema "just to get started" — it will be wrong because we haven't seen real message shapes yet
- Don't integrate an LLM during the echo phase, even to make the echo "smarter"
- Don't build group-chat-member tracking until we've observed what Spectrum exposes about group membership
- Don't scaffold a web dashboard, admin UI, or monitoring interface — the product is in iMessage
- Don't add Gemini / ElevenLabs / any other sponsor API during the echo phase — those stack prizes come later once the core loop is solid
- Don't convert the project to Python, Rust, or any other language — the Spectrum ecosystem is TypeScript-native

## Demo script (our north star — every feature serves this)

The 2-minute demo at judging will show three teammates live-texting in an iMessage group chat, arguing about a hackathon project idea. Sage lives in the chat. Seeded history from "a month ago" includes a message where one teammate stated a hard requirement. At a key moment in the argument, Sage retrieves that month-old position and reframes the current disagreement around it. A fourth teammate narrates what Sage is doing and which Photon criteria it's hitting.

Every feature we build should serve a specific beat in that demo. Features that don't appear in the demo get cut, even if they're cool.

## When asking me questions

If there's ambiguity in a request, ask one clarifying question rather than building three variants. Hackathon time is finite.