// ─────────────────────────────────────────────────────────────────────────────
// elevenlabs.js — Stretch goal: TTS for voice conversations
//
// Build order: get text pipeline working first. Only wire this in if time allows.
//
// Usage:
//   import { textToSpeech } from './elevenlabs.js';
//   const audioBuffer = await textToSpeech("Earlier you agreed...");
//   // play audioBuffer into the voice channel
//
// Design constraint: Sage must NEVER interrupt mid-sentence.
// Feed only after a natural pause (>1.5s silence from speech-to-text layer).
// ─────────────────────────────────────────────────────────────────────────────

const ELEVENLABS_API_URL = 'https://api.elevenlabs.io/v1';
const VOICE_ID           = process.env.ELEVENLABS_VOICE_ID;
const API_KEY            = process.env.ELEVENLABS_API_KEY;

// Voice settings — calm, neutral, measured pace
const VOICE_SETTINGS = {
  stability:         0.75,  // higher = more consistent, less expressive
  similarity_boost:  0.75,
  style:             0.0,   // 0 = neutral, no dramatic flair
  use_speaker_boost: false,
};

// Convert text to mp3 audio buffer
// Returns: Buffer (mp3 binary data), or null on failure
export async function textToSpeech(text) {
  if (!API_KEY || !VOICE_ID) {
    console.warn('[elevenlabs] ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID not set — TTS disabled');
    return null;
  }

  const res = await fetch(`${ELEVENLABS_API_URL}/text-to-speech/${VOICE_ID}`, {
    method: 'POST',
    headers: {
      'xi-api-key':    API_KEY,
      'Content-Type':  'application/json',
      'Accept':        'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id:       'eleven_turbo_v2',  // lowest latency model — good for real-time
      voice_settings: VOICE_SETTINGS,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    console.error(`[elevenlabs] TTS failed (${res.status}):`, err);
    return null;
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ── Silence detection helper (for voice pipeline) ─────────────────────────────
// Returns true when audioLevel has been below threshold for durationMs.
// Hook this into your speech-to-text audio stream.
// durationMs default: 1500ms (1.5 second pause = safe to speak)

export function createSilenceDetector(onSilence, { thresholdDb = -40, durationMs = 1500 } = {}) {
  let silenceStart = null;
  let fired = false;

  return function checkAudioLevel(currentDb) {
    if (currentDb < thresholdDb) {
      if (!silenceStart) silenceStart = Date.now();
      if (!fired && Date.now() - silenceStart >= durationMs) {
        fired = true;
        onSilence();
      }
    } else {
      silenceStart = null;
      fired = false;
    }
  };
}
