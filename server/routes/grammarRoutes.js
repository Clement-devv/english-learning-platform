import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js";
import { callGemini } from "../utils/geminiHelper.js";

const router = express.Router();

// POST /api/grammar/check
router.post("/check", verifyToken, async (req, res) => {
  try {
    const { text } = req.body;

    if (!text?.trim() || text.trim().length < 3) {
      return res.json({ success: true, suggestions: [] });
    }

    const safeText = text.trim().slice(0, 2000);

    // Ask Gemini to correct the text — much more reliable than asking it to list errors
    const prompt = `Fix ALL spelling and grammar mistakes in the text below. Return ONLY the corrected text with no explanation, no quotes, no markdown.

Text: ${safeText}`;

    const corrected = (await callGemini(prompt, { temperature: 0.1, maxOutputTokens: 1024 })).trim();

    console.log("Grammar original :", safeText);
    console.log("Grammar corrected:", corrected);

    // If Gemini returned nothing useful, no suggestions
    if (!corrected || corrected === safeText) {
      return res.json({ success: true, suggestions: [] });
    }

    // Split both into sentences and pair them up
    const origSentences = splitSentences(safeText);
    const corrSentences = splitSentences(corrected);

    const suggestions = [];
    const maxLen = Math.max(origSentences.length, corrSentences.length);

    for (let i = 0; i < maxLen; i++) {
      const orig = origSentences[i] || "";
      const corr = corrSentences[i] || "";

      // Only report if something actually changed
      if (normalise(orig) !== normalise(corr) && orig && corr) {
        suggestions.push({ original: orig, corrected: corr });
      }
    }

    // If sentence-level diffing found nothing but overall text changed, report as one block
    if (suggestions.length === 0 && normalise(safeText) !== normalise(corrected)) {
      suggestions.push({ original: safeText, corrected: corrected });
    }

    console.log("Grammar suggestions:", suggestions.length);
    res.json({ success: true, suggestions });
  } catch (err) {
    console.error("Grammar check error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

// Normalise for comparison: lowercase, collapse whitespace, strip punctuation
function normalise(s) {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

export default router;
