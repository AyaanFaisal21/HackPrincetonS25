import { fileURLToPath } from "node:url";
import { ingest } from "./memory.js";
import type { Message } from "./memory.js";

// Build a timestamp that is `daysAgo` days before yesterday + `minutesOffset`
// minutes past midnight, so seeds always end "yesterday" regardless of when run.
function ts(daysAgo: number, minutesOffset: number): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);
  const d = new Date(yesterday.getTime() - daysAgo * 86_400_000 + minutesOffset * 60_000);
  return d.toISOString();
}

// 48 messages across 14 days.
// Narrative arc:
//   Week 1: project kick-off, Alex says backend scope is fine, team agrees on Python+FastAPI
//   Mid:    scope creep tensions surface, Jordan pushes back, unresolved auth debate stalls
//   Week 2: Alex reverses position on scope, group ships a trimmed MVP
const MESSAGES: Message[] = [
  // ── Day 14 ago: kick-off ──────────────────────────────────────────────────
  { speaker: "Alex",   content: "ok so we're doing this. who's taking backend?", timestamp: ts(13, 540) },
  { speaker: "Jordan", content: "i can if you want, been meaning to try fastapi", timestamp: ts(13, 542) },
  { speaker: "Sam",    content: "sounds good. i'll own frontend + integration tests", timestamp: ts(13, 544) },
  { speaker: "Alex",   content: "i'll do ml pipeline + infra then. split feels right", timestamp: ts(13, 546) },
  { speaker: "Jordan", content: "agreed. let's ship something actually working over something fancy", timestamp: ts(13, 548) },
  { speaker: "Sam",    content: "lmao yes. last hackathon we built auth for 10hrs and demoed a login screen", timestamp: ts(13, 551) },

  // ── Day 12 ago: scope discussion, Alex signs off on it ────────────────────
  { speaker: "Jordan", content: "quick q — should we add user accounts or just session-based?", timestamp: ts(11, 600) },
  { speaker: "Alex",   content: "user accounts feels like scope creep tbh. sessions are fine for a demo", timestamp: ts(11, 603) },
  { speaker: "Sam",    content: "agreed, no auth. judges don't care, they want to see the feature", timestamp: ts(11, 605) },
  { speaker: "Jordan", content: "ok cool. no auth it is. i'll hardcode a demo user", timestamp: ts(11, 607) },
  { speaker: "Alex",   content: "backend scope looks totally manageable btw, don't stress it", timestamp: ts(11, 610) },
  { speaker: "Sam",    content: "famous last words lol", timestamp: ts(11, 612) },

  // ── Day 11 ago: casual banter ─────────────────────────────────────────────
  { speaker: "Jordan", content: "anyone else get 4hrs of sleep or just me", timestamp: ts(10, 480) },
  { speaker: "Sam",    content: "5hrs. coffee count: 3", timestamp: ts(10, 482) },
  { speaker: "Alex",   content: "i dont even track anymore", timestamp: ts(10, 484) },
  { speaker: "Jordan", content: "healthy. very healthy team dynamic", timestamp: ts(10, 486) },

  // ── Day 10 ago: decision on stack ────────────────────────────────────────
  { speaker: "Sam",    content: "we need to pick the ml framework today or jordan can't wire the api", timestamp: ts(9, 900) },
  { speaker: "Alex",   content: "pytorch for training, onnx for inference. keeps the backend light", timestamp: ts(9, 903) },
  { speaker: "Jordan", content: "works for me, i can accept onnx inputs no problem", timestamp: ts(9, 905) },
  { speaker: "Sam",    content: "perfect. pytorch + onnx, locked in?", timestamp: ts(9, 907) },
  { speaker: "Alex",   content: "locked in", timestamp: ts(9, 908) },
  { speaker: "Jordan", content: "locked in 🤝", timestamp: ts(9, 909) },

  // ── Day 8 ago: scope creep starts, tension surfaces ──────────────────────
  { speaker: "Jordan", content: "pm just dropped a new req — they want per-user history saved between sessions", timestamp: ts(7, 780) },
  { speaker: "Sam",    content: "...that's basically user accounts", timestamp: ts(7, 782) },
  { speaker: "Jordan", content: "i know. told them it was out of scope, they pushed back", timestamp: ts(7, 784) },
  { speaker: "Alex",   content: "wait how much extra work is it really? maybe we just add a db", timestamp: ts(7, 788) },
  { speaker: "Sam",    content: "alex we literally agreed no auth a week ago", timestamp: ts(7, 790) },
  { speaker: "Alex",   content: "storing history isn't auth", timestamp: ts(7, 792) },
  { speaker: "Jordan", content: "it requires identifying users which requires auth. same thing", timestamp: ts(7, 794) },
  { speaker: "Alex",   content: "ok whatever. i'll drop it", timestamp: ts(7, 796) },

  // ── Day 6 ago: unresolved auth debate (stalls) ───────────────────────────
  { speaker: "Sam",    content: "jordan what's the status on the /predict endpoint?", timestamp: ts(5, 840) },
  { speaker: "Jordan", content: "blocked. can't finalize the response schema until alex tells me if we're doing sessions or not", timestamp: ts(5, 843) },
  { speaker: "Alex",   content: "i thought we said no sessions", timestamp: ts(5, 845) },
  { speaker: "Jordan", content: "you said 'drop it' but never confirmed the original plan", timestamp: ts(5, 847) },
  { speaker: "Sam",    content: "guys can we just decide. yes or no on sessions", timestamp: ts(5, 849) },
  { speaker: "Alex",   content: "no sessions. stateless. done.", timestamp: ts(5, 851) },
  { speaker: "Jordan", content: "fine but if the pm complains i'm pointing at this chat", timestamp: ts(5, 853) },
  { speaker: "Sam",    content: "screenshot saved 😂", timestamp: ts(5, 855) },

  // ── Day 4 ago: Alex reverses on scope ────────────────────────────────────
  { speaker: "Alex",   content: "ok i was wrong about backend scope, there's way more edge cases than i thought", timestamp: ts(3, 720) },
  { speaker: "Sam",    content: "lmaoooo called it", timestamp: ts(3, 722) },
  { speaker: "Alex",   content: "yes yes. we need to cut the batch inference feature or we won't finish", timestamp: ts(3, 724) },
  { speaker: "Jordan", content: "agreed. batch was always nice-to-have. cut it", timestamp: ts(3, 726) },
  { speaker: "Sam",    content: "i'll update the demo script to not mention it", timestamp: ts(3, 728) },

  // ── Day 2 ago: final stretch banter + wrap-up ─────────────────────────────
  { speaker: "Jordan", content: "frontend looks sick btw sam", timestamp: ts(1, 1020) },
  { speaker: "Sam",    content: "ty!! jordan your api docs are actually readable which is rare", timestamp: ts(1, 1022) },
  { speaker: "Alex",   content: "we're gonna win. i can feel it", timestamp: ts(1, 1024) },
  { speaker: "Jordan", content: "we're gonna sleep after. i can feel that more", timestamp: ts(1, 1026) },
  { speaker: "Sam",    content: "demo is locked. ml pipeline, clean api, decent ui. that's the pitch", timestamp: ts(1, 1028) },
  { speaker: "Alex",   content: "ship it", timestamp: ts(1, 1030) },
];

export async function seedChat(chatId: string): Promise<void> {
  // Ingest in batches of 6 to simulate realistic chunked ingestion.
  const BATCH = 6;
  for (let i = 0; i < MESSAGES.length; i += BATCH) {
    const batch = MESSAGES.slice(i, i + BATCH);
    await ingest(chatId, batch);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seedChat("demo_chat").then(() => console.log("Seeded successfully"));
}
