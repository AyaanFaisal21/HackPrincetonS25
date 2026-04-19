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