import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import PronunciationCache from "../models/PronunciationCache.js";
import { callGemini, extractJSONArray } from "../utils/geminiHelper.js";

const router = express.Router();

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // refresh cache once per day

// Focus areas rotated per difficulty so each generation covers different ground
const FOCUS_AREAS = {
  beginner: [
    "short vowel sounds (a, e, i, o, u)",
    "basic consonant sounds",
    "natural sentence rhythm and stress",
    "simple question intonation",
    "common everyday vocabulary pronunciation",
  ],
  intermediate: [
    "TH sounds — both voiced (the, this) and unvoiced (think, three)",
    "schwa vowel sound — the most common English vowel",
    "word stress in multi-syllable words",
    "connected speech and linking words together",
    "silent letters (know, lamb, island)",
  ],
  advanced: [
    "R and L sound distinction",
    "S and SH sound distinction",
    "W and V sound distinction",
    "complex consonant clusters at word boundaries",
    "sentence-level stress and rhythm patterns",
  ],
};

// ── Call Gemini 1.5 Flash to generate sentences ───────────────────────────────
async function generateWithGemini(difficulty) {
  // Pick 3 focus areas randomly for variety
  const focuses = [...FOCUS_AREAS[difficulty]]
    .sort(() => Math.random() - 0.5)
    .slice(0, 3);

  const prompt = `You are an English pronunciation coach. Generate exactly 10 pronunciation practice sentences for a ${difficulty}-level English learner.

Distribute the sentences across these 3 focus areas: ${focuses.join(" | ")}.

Rules:
- Use natural, conversational language
- Vocabulary must suit ${difficulty} level
- Each sentence must clearly practice the focus area
- Do NOT include explanations, numbering, or markdown
- Return ONLY a valid JSON array, nothing else

Format: [{"text": "The sentence here.", "focus": "Focus area label"}]`;

  const raw    = await callGemini(prompt, { temperature: 0.85, maxOutputTokens: 900 });
  let   parsed;
  try {
    parsed = extractJSONArray(raw);
  } catch {
    throw new Error(`Failed to parse Gemini response as JSON`);
  }

  if (!Array.isArray(parsed)) throw new Error("Gemini response was not an array");

  // Validate + sanitise each sentence
  return parsed
    .filter(s => typeof s.text === "string" && typeof s.focus === "string")
    .map(s => ({ text: s.text.trim(), focus: s.focus.trim() }))
    .slice(0, 10); // never exceed 10
}

// ── GET /api/pronunciation/sentences?difficulty=beginner ──────────────────────
// Returns cached AI sentences or generates a fresh batch.
// Frontend falls back to local bank if this returns { success: false }.
router.get("/sentences", verifyToken, async (req, res) => {
  const { difficulty = "beginner" } = req.query;

  if (!["beginner", "intermediate", "advanced"].includes(difficulty)) {
    return res.status(400).json({ message: "Invalid difficulty" });
  }

  // ── 1. Try cache ────────────────────────────────────────────────────────────
  try {
    const cached = await PronunciationCache.findOne({ difficulty });
    const age    = cached ? Date.now() - new Date(cached.generatedAt).getTime() : Infinity;

    if (cached && age < CACHE_TTL_MS && cached.sentences.length > 0) {
      return res.json({ success: true, sentences: cached.sentences, source: "cache" });
    }
  } catch (dbErr) {
    console.error("PronunciationCache read error:", dbErr.message);
  }

  // ── 2. Generate with Gemini ─────────────────────────────────────────────────
  try {
    const sentences = await generateWithGemini(difficulty);

    if (sentences.length === 0) throw new Error("Gemini returned 0 valid sentences");

    // Save / replace cache entry
    await PronunciationCache.findOneAndUpdate(
      { difficulty },
      { sentences, generatedAt: new Date() },
      { upsert: true, new: true }
    );

    console.log(`✅ Pronunciation cache refreshed — ${difficulty} (${sentences.length} sentences)`);
    return res.json({ success: true, sentences, source: "generated" });

  } catch (genErr) {
    console.error("Gemini generation failed:", genErr.message);
    // ── 3. Fallback — tell frontend to use local bank ───────────────────────
    return res.json({ success: false, sentences: [], reason: genErr.message });
  }
});

export default router;
