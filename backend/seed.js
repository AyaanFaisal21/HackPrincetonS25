// ─────────────────────────────────────────────────────────────────────────────
// seed.js — Pre-load 2 weeks of realistic fake group chat history
//
// Run once before the demo:  npm run seed
//
// Creates a believable paper trail of Alex, Jordan, and Sam planning a
// hackathon project. Includes:
//   - Idea brainstorming (competing positions)
//   - A decision that gets made and then ignored
//   - Recurring arguments that set up the live demo intervention
//
// The demo moment: live conversation resurrects Idea B after the group
// had decided on Idea A two weeks ago. Sage surfaces this.
// ─────────────────────────────────────────────────────────────────────────────

import dotenv from 'dotenv';
dotenv.config();

import { storeMessage, storeMemory } from './memory.js';

const GROUP_ID = process.env.GROUP_ID || 'hackathon-team';

function daysAgo(n, hour = 12, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

// ─────────────────────────────────────────────────────────────────────────────
// 2 WEEKS OF CHAT HISTORY
// ─────────────────────────────────────────────────────────────────────────────

const history = [

  // ── Week 1, Day 14 — First brainstorm ─────────────────────────────────────

  { ts: daysAgo(14,  9, 10), sender: 'Alex',   content: "ok team let's actually think about this hackathon. what ideas do we have?" },
  { ts: daysAgo(14,  9, 12), sender: 'Jordan', content: "I've been thinking about an AI tutor that adapts to your learning style in real time. super marketable" },
  { ts: daysAgo(14,  9, 14), sender: 'Sam',    content: "that's been done a million times honestly. I want to build something for local communities — like a neighborhood resource matching app" },
  { ts: daysAgo(14,  9, 16), sender: 'Alex',   content: "I like both but the tutor feels safer to build in 48 hours. the neighborhood app needs real data" },
  { ts: daysAgo(14,  9, 18), sender: 'Jordan', content: "exactly. feasibility matters more than novelty at a hackathon. let's call the tutor Idea A and neighborhood thing Idea B" },
  { ts: daysAgo(14,  9, 20), sender: 'Sam',    content: "fine I'll keep an open mind. but I still think Idea B has more impact" },
  { ts: daysAgo(14, 10,  0), sender: 'Alex',   content: "let's do some research on both this week and decide by friday" },

  // ── Week 1, Day 13 — Technical exploration ────────────────────────────────

  { ts: daysAgo(13, 11,  5), sender: 'Jordan', content: "did some research — we can use Claude's API for the adaptive tutor. the context window is big enough to hold full learning history" },
  { ts: daysAgo(13, 11,  8), sender: 'Alex',   content: "nice. and we can build the frontend in a day if we use shadcn/ui" },
  { ts: daysAgo(13, 11, 15), sender: 'Sam',    content: "looked at Idea B more — there's a public dataset from 211 Helpline we could use for real data. changes the calculus" },
  { ts: daysAgo(13, 11, 18), sender: 'Jordan', content: "that's actually interesting but the API integration alone would eat up half our time. we'd be demo-ing an empty map" },
  { ts: daysAgo(13, 11, 22), sender: 'Sam',    content: "fair. I'm not saying it's easy, just that it's more meaningful" },
  { ts: daysAgo(13, 14, 30), sender: 'Alex',   content: "we have until friday to decide. let's both prototype a bit and see what feels right" },

  // ── Week 1, Day 12 — Side chat, banter ───────────────────────────────────

  { ts: daysAgo(12,  9, 45), sender: 'Sam',    content: "anyone done the ML problem set yet" },
  { ts: daysAgo(12,  9, 48), sender: 'Alex',   content: "lol no. also the hackathon is 3 weeks away we should focus" },
  { ts: daysAgo(12, 10,  0), sender: 'Jordan', content: "quick prototype of Idea A — took me 2 hours to get a working Claude call with adaptive prompting. this is doable" },
  { ts: daysAgo(12, 10,  5), sender: 'Alex',   content: "ok that's a good sign. how does it actually adapt?" },
  { ts: daysAgo(12, 10, 10), sender: 'Jordan', content: "tracks which explanations the user accepted vs asked follow-up questions on. uses that to calibrate next response. simple but effective" },
  { ts: daysAgo(12, 13,  0), sender: 'Sam',    content: "got Idea B working with dummy data. it's actually pretty slick looking. the map viz alone would win design" },
  { ts: daysAgo(12, 13,  5), sender: 'Alex',   content: "I mean looks don't win hackathons alone. need real functionality" },

  // ── Week 1, Day 11 — THE DECISION ─────────────────────────────────────────
  // This is the critical memory: group decided on Idea A for feasibility.

  { ts: daysAgo(11, 15,  0), sender: 'Alex',   content: "ok it's thursday. we need to decide. Idea A: AI tutor, proven tech, 48-hour feasible. Idea B: neighborhood app, more impact but riskier timeline. which one?" },
  { ts: daysAgo(11, 15,  3), sender: 'Jordan', content: "Idea A. we can ship something polished and the adaptive learning angle is genuinely novel in execution even if the concept isn't" },
  { ts: daysAgo(11, 15,  5), sender: 'Sam',    content: "...fine. Idea A. but I want to make sure we frame the social impact angle well in the pitch" },
  { ts: daysAgo(11, 15,  7), sender: 'Alex',   content: "agreed. Idea A it is. let's build the best possible version of that" },
  { ts: daysAgo(11, 15, 10), sender: 'Jordan', content: "we chose Idea A because feasibility > originality for a 48hr hackathon. Sam: we can still pitch impact" },
  { ts: daysAgo(11, 15, 12), sender: 'Sam',    content: "ok ok. I'm in. let's make it great" },

  // ── Week 2, Day 10 — Planning the build ───────────────────────────────────

  { ts: daysAgo(10, 10, 20), sender: 'Alex',   content: "split: Jordan does the Claude backend, Sam does the UI, I handle the adaptive logic and demo script" },
  { ts: daysAgo(10, 10, 22), sender: 'Jordan', content: "works for me. I'll have the API wrapper ready by Tuesday" },
  { ts: daysAgo(10, 10, 25), sender: 'Sam',    content: "I'll have 3 UI screens done by Wednesday. landing, lesson, and results" },

  // ── Week 2, Day 9 — Progress updates ──────────────────────────────────────

  { ts: daysAgo(9, 14,  0), sender: 'Jordan', content: "API wrapper is done. Claude returns structured JSON with topic tags + difficulty rating. wiring it to the adaptive logic tomorrow" },
  { ts: daysAgo(9, 14,  5), sender: 'Alex',   content: "nice. I'm building the quiz flow now — user answers, Claude evaluates, adjusts next question difficulty. feeling good" },
  { ts: daysAgo(9, 16, 30), sender: 'Sam',    content: "landing page looks great. started the lesson UI. one question: do we want a progress bar or a skill tree visualization?" },
  { ts: daysAgo(9, 16, 33), sender: 'Alex',   content: "progress bar, simpler to build and judges can grok it instantly" },
  { ts: daysAgo(9, 16, 35), sender: 'Jordan', content: "yeah skill tree is cool but it's scope creep at this point" },

  // ── Week 2, Day 8 — Technical snag ────────────────────────────────────────

  { ts: daysAgo(8,  9, 0), sender: 'Sam',    content: "ran into a problem — the adaptive logic doesn't actually feel adaptive in a demo because you need multiple rounds to see it work. judges won't have time for that" },
  { ts: daysAgo(8,  9, 5), sender: 'Alex',   content: "good catch. we can pre-seed a simulated history to show the progression from first-attempt to calibrated explanation" },
  { ts: daysAgo(8,  9, 8), sender: 'Jordan', content: "smart. build a 'returning student' mode that loads a pre-built history. shows adaptation immediately" },
  { ts: daysAgo(8,  9, 12), sender: 'Sam',   content: "ok that works. I'll add a toggle in the UI" },

  // ── Week 2, Day 7 — Sam starts questioning the decision ───────────────────

  { ts: daysAgo(7, 20, 0), sender: 'Sam',    content: "not gonna lie, I keep thinking about the neighborhood app. the 211 Helpline API is actually really clean and I've been messing with it" },
  { ts: daysAgo(7, 20, 4), sender: 'Alex',   content: "Sam... we decided this already" },
  { ts: daysAgo(7, 20, 6), sender: 'Sam',    content: "I know I know. just thinking out loud" },
  { ts: daysAgo(7, 20, 8), sender: 'Jordan', content: "we're two weeks in on Idea A. the adaptive logic is mostly done. not the time" },
  { ts: daysAgo(7, 20, 10), sender: 'Sam',  content: "ok fair. I'll drop it" },

  // ── Week 2, Day 6 — More progress, minor disagreement ────────────────────

  { ts: daysAgo(6, 11, 0), sender: 'Alex',   content: "tested the full flow. it actually works really well — the difficulty calibration is noticeable after 3 questions" },
  { ts: daysAgo(6, 11, 5), sender: 'Jordan', content: "added streaming so the response appears token by token. way better UX" },
  { ts: daysAgo(6, 13, 0), sender: 'Sam',    content: "question: should the tutor specialize in one subject or be general-purpose? I built it general but Jordan's prompt is math-focused" },
  { ts: daysAgo(6, 13, 4), sender: 'Jordan', content: "math demo is cleaner because you can verify correctness objectively. judges can test it and see it work" },
  { ts: daysAgo(6, 13, 7), sender: 'Alex',   content: "good point. let's make math the default demo subject but keep it technically subject-agnostic" },
  { ts: daysAgo(6, 13, 9), sender: 'Sam',    content: "works for me" },

  // ── Week 2, Day 5 — Demo prep begins ─────────────────────────────────────

  { ts: daysAgo(5, 10, 0), sender: 'Alex',   content: "need to write the pitch. 3 minutes total: problem (30s), demo (90s), tech + impact (60s). what's our hook line?" },
  { ts: daysAgo(5, 10, 5), sender: 'Jordan', content: "'Every student learns differently. Most software doesn't.' — clean, true, sets up the demo" },
  { ts: daysAgo(5, 10, 8), sender: 'Sam',    content: "I like it. maybe add 'we built a tutor that does' at the end?" },
  { ts: daysAgo(5, 10, 10), sender: 'Alex',  content: "perfect. let's go with that" },

  // ── Day 4 — Demo rehearsal, scope creep discussion ───────────────────────

  { ts: daysAgo(4, 14, 0), sender: 'Sam',    content: "rehearsed the demo. it's good but it's a bit... incremental? like it does what it says but it's not surprising" },
  { ts: daysAgo(4, 14, 5), sender: 'Jordan', content: "it doesn't need to surprise, it needs to work reliably under demo conditions" },
  { ts: daysAgo(4, 14, 8), sender: 'Sam',    content: "I hear you. but I keep coming back to the neighborhood app — that one has a 'wow' factor that judges remember" },
  { ts: daysAgo(4, 14, 12), sender: 'Alex',  content: "Sam we literally decided this two weeks ago. Idea A. we're shipping Idea A" },
  { ts: daysAgo(4, 14, 15), sender: 'Sam',   content: "you're right. sorry. I'm just nervous about the pitch" },

  // ── Day 3 — Continued tension + actual useful question ────────────────────

  { ts: daysAgo(3, 11, 0), sender: 'Jordan', content: "everything's integrated. running final tests. Sam can you push your latest UI changes?" },
  { ts: daysAgo(3, 11, 5), sender: 'Sam',    content: "pushing now. also — genuine question — is there any scenario where we could do BOTH? like Idea A as the main demo and a 'future vision' slide with Idea B?" },
  { ts: daysAgo(3, 11, 9), sender: 'Alex',   content: "that could work as a pitch move, not as actual build scope. keep the deck honest though" },
  { ts: daysAgo(3, 11, 12), sender: 'Jordan', content: "yeah a 'future vision' slide is fine. just don't demo what we haven't built" },

  // ── Day 2 — Final sprint, Sam pushing Idea B again ───────────────────────

  { ts: daysAgo(2, 19, 0), sender: 'Sam',    content: "ok full disclosure I've been building a prototype of Idea B on the side and it looks incredible. the map with real 211 data is genuinely impressive. I think we should pivot" },
  { ts: daysAgo(2, 19, 5), sender: 'Alex',   content: "you what?? Sam we have 30 hours left" },
  { ts: daysAgo(2, 19, 8), sender: 'Jordan', content: "I can't believe this. we made a decision. we agreed on Idea A for feasibility" },
  { ts: daysAgo(2, 19, 11), sender: 'Sam',   content: "I know it sounds crazy but just look at the screenshot" },
  { ts: daysAgo(2, 19, 14), sender: 'Alex',  content: "it does look good but this is insane. we have a working product" },

  // ── Day 1 — Hackathon eve, unresolved ────────────────────────────────────

  { ts: daysAgo(1, 10, 0), sender: 'Jordan', content: "can we please just agree on what we're submitting? I'm losing my mind" },
  { ts: daysAgo(1, 10, 5), sender: 'Sam',    content: "Idea B is feasible now that the API integration is done. I swear it is" },
  { ts: daysAgo(1, 10, 8), sender: 'Alex',   content: "what even is the argument for Idea B at this point? we chose Idea A for feasibility, that was the whole reason" },
  { ts: daysAgo(1, 10, 12), sender: 'Sam',   content: "the argument is it's more original and more impactful. those matter to judges too" },
  { ts: daysAgo(1, 10, 15), sender: 'Jordan', content: "we literally said feasibility > originality for a 48hr hackathon. that was THE reason we chose Idea A" },
  { ts: daysAgo(1, 10, 18), sender: 'Sam',   content: "but feasibility is now equal — that constraint no longer applies!" },
  { ts: daysAgo(1, 10, 20), sender: 'Alex',  content: "ugh. I don't know. I really don't know what to do" },
];

// ─────────────────────────────────────────────────────────────────────────────
// Known decisions / positions to pre-seed as memories (without calling Claude)
// This ensures memory retrieval works perfectly on the first demo run.
// ─────────────────────────────────────────────────────────────────────────────

const seedMemories = [
  {
    type: 'decision',
    content: 'Group decided to pursue Idea A (AI adaptive tutor) over Idea B (neighborhood resource app) because feasibility is more important than originality for a 48-hour hackathon.',
    sender: null,
    timestamp: daysAgo(11, 15, 10),
  },
  {
    type: 'position',
    content: 'Jordan prefers Idea A (AI adaptive tutor) — judges need to see something polished and working in 48 hours.',
    sender: 'Jordan',
    timestamp: daysAgo(14, 9, 18),
  },
  {
    type: 'position',
    content: "Sam prefers Idea B (neighborhood resource app) for its social impact and visual wow factor, though acknowledged feasibility concerns.",
    sender: 'Sam',
    timestamp: daysAgo(14, 9, 20),
  },
  {
    type: 'position',
    content: 'Alex prioritizes feasibility — building something shippable in 48 hours outweighs novelty.',
    sender: 'Alex',
    timestamp: daysAgo(14, 9, 16),
  },
  {
    type: 'preference',
    content: 'Alex and Jordan both agree: math is the best demo subject because answer correctness is objectively verifiable by judges.',
    sender: null,
    timestamp: daysAgo(6, 13, 7),
  },
  {
    type: 'issue',
    content: "Recurring unresolved tension: Sam keeps revisiting the Idea A vs Idea B decision even after the group agreed on Idea A on day 11.",
    sender: 'Sam',
    timestamp: daysAgo(4, 14, 8),
  },
  {
    type: 'decision',
    content: 'Group agreed to include a "future vision" slide about Idea B in the pitch deck without actually building it — keeps pitch honest.',
    sender: null,
    timestamp: daysAgo(3, 11, 12),
  },
  {
    type: 'position',
    content: 'Sam has built a working prototype of Idea B on the side (without the team knowing) and is now advocating for a last-minute pivot with 30 hours remaining.',
    sender: 'Sam',
    timestamp: daysAgo(2, 19, 8),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Seed runner
// ─────────────────────────────────────────────────────────────────────────────

async function seed() {
  console.log(`Seeding ${history.length} messages and ${seedMemories.length} memories into group "${GROUP_ID}"...`);

  for (const msg of history) {
    await storeMessage({
      groupId:   GROUP_ID,
      sender:    msg.sender,
      content:   msg.content,
      timestamp: msg.ts,
    });
  }

  for (const mem of seedMemories) {
    await storeMemory({
      groupId:   GROUP_ID,
      type:      mem.type,
      content:   mem.content,
      sender:    mem.sender,
      timestamp: mem.timestamp,
    });
  }

  console.log('Seed complete.');
  console.log('Run `npm run dev` to start the server, then join the iMessage group and start messaging.');
  console.log('\nDemo scenario:');
  console.log('  Have someone in the group say "I think we should do Idea B after all".');
  console.log('  Sage will stay silent on a few messages, then surface the 2-week history.');
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
