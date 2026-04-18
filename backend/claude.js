// ─────────────────────────────────────────────────────────────────────────────
// claude.js — Anthropic SDK wrapper
//
// Three jobs:
//   extractMemoryItems()   → parse a message for positions/decisions/issues
//   checkIntervention()    → ask Claude: should Sage speak? Why?
//   generateResponse()     → produce Sage's actual message, grounded in context
//
// Prompt caching: the system prompt + static context are marked with
// cache_control so repeat calls within the 5-min TTL are cheaper.
// ─────────────────────────────────────────────────────────────────────────────

import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL  = 'claude-sonnet-4-20250514';

// ── Shared system prompt (cached) ─────────────────────────────────────────────

const SAGE_SYSTEM = `You are Sage, an AI participant embedded in an iMessage group chat.

Your core principle: RESTRAINT. You silently observe all messages but only speak when it meaningfully helps the group. One well-timed intervention beats five mediocre ones.

You intervene ONLY when:
1. CONTRADICTION — Someone contradicts their own earlier position, or two members hold directly opposing views on the same specific topic.
2. STUCK LOOP — The group is repeating the same question, concern, or argument without making progress (same topic 3+ times in recent messages).
3. DECISION REVERSAL — A past group decision is being relitigated or ignored without acknowledgment.
4. COORDINATION BREAKDOWN — Multiple unresolved questions are open simultaneously with no convergence.

When you do speak:
- Ground every statement in specific retrieved past messages. Never say anything vague.
- Name the people and approximate time ("Last Tuesday, Alex said...").
- Summarize conflicting views neutrally — you are not a judge.
- Propose ONE concrete next step (a vote, a 5-minute sync, a specific question to answer).
- Be brief. 3 sentences max. No preamble, no sign-off.

You are NOT a chatbot. Do NOT respond to greetings, jokes, banter, or general questions.
You are NOT a summarizer. Do NOT recap conversations that are progressing fine.
You NEVER hide, rewrite, or judge messages. You surface and synthesize.`;

// ── 1. Extract memory items from a new message ────────────────────────────────

export async function extractMemoryItems(sender, content, recentContext) {
  const contextStr = recentContext
    .map(m => `${m.sender}: ${m.content}`)
    .join('\n');

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    system: [
      {
        type: 'text',
        text: SAGE_SYSTEM,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Recent context:\n${contextStr}\n\nNew message from ${sender}:\n"${content}"\n\nExtract any structured facts from this message. Return JSON only:\n{\n  "items": [\n    {\n      "type": "position" | "decision" | "issue" | "preference",\n      "content": "plain English summary of the fact",\n      "sender": "${sender}" | null\n    }\n  ]\n}\n\nReturn { "items": [] } if nothing meaningful to extract. Do not extract banter, greetings, or filler.`,
      },
    ],
  });

  try {
    const text = res.content[0].text.trim();
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    return JSON.parse(json).items || [];
  } catch {
    return [];
  }
}

// ── 2. Check whether Sage should intervene ───────────────────────────────────

// recentMessages: [{sender, content, timestamp}]
// memories:       [{type, content, sender, timestamp}]
//
// Returns: { intervene: bool, triggerType: string, triggerDesc: string } | null

export async function checkIntervention(recentMessages, memories) {
  const recentStr = recentMessages
    .slice(-15) // last 15 messages for context window
    .map(m => `[${m.timestamp?.slice(0, 16) || 'now'}] ${m.sender}: ${m.content}`)
    .join('\n');

  const memoriesStr = memories
    .slice(0, 20)
    .map(m => `[${m.type.toUpperCase()}] ${m.sender ? m.sender + ': ' : ''}${m.content} (${m.timestamp?.slice(0, 10)})`)
    .join('\n');

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: [
      {
        type: 'text',
        text: SAGE_SYSTEM,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Stored memories:\n${memoriesStr || '(none yet)'}\n\nRecent conversation:\n${recentStr}\n\nShould Sage intervene? Apply the strictest standard — only intervene if there is a clear, specific trigger.\n\nReturn JSON only:\n{\n  "intervene": true | false,\n  "triggerType": "contradiction" | "stuck_loop" | "decision_reversal" | "coordination_breakdown" | null,\n  "triggerDesc": "one sentence explaining exactly what triggered this, citing specific messages/people — or null if not intervening"\n}`,
      },
    ],
  });

  try {
    const text = res.content[0].text.trim();
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    return JSON.parse(json);
  } catch {
    return { intervene: false, triggerType: null, triggerDesc: null };
  }
}

// ── 3. Generate the actual Sage response ─────────────────────────────────────

// triggerDesc:     why Sage is speaking (from checkIntervention)
// relevantContext: [{sender, content, timestamp, source}] from semantic search
// recentMessages:  [{sender, content}] last few messages

export async function generateResponse(triggerDesc, relevantContext, recentMessages) {
  const contextStr = relevantContext
    .map(r => {
      const when = r.timestamp ? r.timestamp.slice(0, 10) : 'earlier';
      return `[${when}] ${r.sender ? r.sender + ': ' : ''}${r.content}`;
    })
    .join('\n');

  const recentStr = recentMessages
    .slice(-8)
    .map(m => `${m.sender}: ${m.content}`)
    .join('\n');

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    system: [
      {
        type: 'text',
        text: SAGE_SYSTEM,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [
      {
        role: 'user',
        content: `Intervention reason: ${triggerDesc}\n\nRelevant past context:\n${contextStr}\n\nCurrent conversation tail:\n${recentStr}\n\nWrite Sage's response. Requirements:\n- Ground it in specific retrieved context above (name people, approximate dates)\n- Neutral — summarize views, do not take sides\n- End with ONE concrete next step for the group\n- 3 sentences maximum\n- No greeting, no sign-off\n- Do NOT start with "Sage:" — that gets prepended automatically`,
      },
    ],
  });

  return res.content[0].text.trim();
}
