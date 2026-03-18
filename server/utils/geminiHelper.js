/**
 * geminiHelper.js
 *
 * Shared Gemini API caller with:
 *  - Model fallback chain (tries each model in order)
 *  - Retry with exponential backoff for 429 / 503 errors
 */

// Confirmed available models for this API key (verified via ListModels)
// Ordered: best quality first, lightest last (highest quota headroom)
const MODELS = [
  "gemini-2.5-flash",      // Best quality, 65k output tokens, free tier
  "gemini-2.0-flash",      // Fast and reliable, confirmed working
  "gemini-2.0-flash-lite", // Lightest — most quota headroom as final fallback
];

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Call the Gemini API with automatic model fallback and retry on 429/503.
 *
 * @param {string} prompt        - The full prompt text
 * @param {object} genConfig     - generationConfig overrides (temperature, maxOutputTokens, …)
 * @param {number} maxRetries    - How many times to retry each model on rate-limit (default 2)
 * @returns {string}             - Raw text from the model
 */
export async function callGemini(prompt, genConfig = {}, maxRetries = 2) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set in environment");

  const config = {
    temperature:     0.7,
    maxOutputTokens: 1500,
    ...genConfig,
  };

  let lastError;

  for (const model of MODELS) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId  = setTimeout(() => controller.abort(), 30_000); // 30s timeout

        const response = await fetch(
          `${BASE_URL}/${model}:generateContent?key=${apiKey}`,
          {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            signal:  controller.signal,
            body: JSON.stringify({
              contents:         [{ parts: [{ text: prompt }] }],
              generationConfig: config,
            }),
          }
        );
        clearTimeout(timeoutId);

        // Rate limited — wait then retry this model
        if (response.status === 429 || response.status === 503) {
          const waitMs = 1000 * Math.pow(2, attempt); // 1s, 2s, 4s
          console.warn(`Gemini ${model} rate-limited (${response.status}), waiting ${waitMs}ms…`);
          await sleep(waitMs);
          lastError = new Error(`${model} rate-limited (${response.status})`);
          continue; // retry same model
        }

        // Other non-OK responses (404, 400, etc.) — skip to next model immediately
        if (!response.ok) {
          const text = await response.text();
          console.warn(`Gemini ${model} error ${response.status}: ${text.slice(0, 120)}`);
          lastError = new Error(`${model} returned ${response.status}`);
          break; // try next model
        }

        const data = await response.json();
        const raw  = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!raw) throw new Error(`${model} returned empty content`);

        console.log(`✅ Gemini response from ${model}`);
        return raw;

      } catch (err) {
        // Network-level error — retry
        lastError = err;
        if (attempt < maxRetries) {
          await sleep(1000 * (attempt + 1));
        }
      }
    }
    // All retries for this model exhausted — move to next model
  }

  throw lastError || new Error("All Gemini models failed");
}

/**
 * Strip markdown code fences that Gemini sometimes wraps around JSON.
 */
export function stripFences(raw) {
  return raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
}

/**
 * Robustly extract a JSON array from Gemini's response.
 * Handles: markdown fences, extra text before/after, trailing commas.
 *
 * @param {string} raw - Raw text from Gemini
 * @returns {Array}    - Parsed array
 * @throws  {Error}    - If no valid JSON array can be found
 */
export function extractJSONArray(raw) {
  // 1. Strip markdown fences first
  let text = stripFences(raw);

  // 2. Try direct parse
  try { return JSON.parse(text); } catch (_) {}

  // 3. Find the outermost [...] in the response
  const start = text.indexOf("[");
  const end   = text.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) {
    const slice = text.slice(start, end + 1);
    try { return JSON.parse(slice); } catch (_) {}

    // 4. Remove trailing commas before ] or } (common Gemini mistake)
    const fixed = slice
      .replace(/,\s*]/g, "]")
      .replace(/,\s*}/g, "}");
    try { return JSON.parse(fixed); } catch (_) {}
  }

  // 5. Last resort — log what we got so it shows in server console
  console.error("Could not parse Gemini JSON. Raw response:\n", raw.slice(0, 500));
  throw new Error("AI returned invalid JSON — please try again");
}
