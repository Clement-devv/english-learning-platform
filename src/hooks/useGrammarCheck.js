/**
 * useGrammarCheck.js
 * Debounced grammar checking via Gemini API (server-side).
 * - 1.5s debounce after user stops typing
 * - AbortController cancels in-flight requests on unmount or new check
 * - Request ID prevents stale responses from updating state
 */

import { useState, useRef, useCallback, useEffect } from "react";
import api from "../api";

function wordDiff(original, corrected) {
  const origWords = original.trim().split(/\s+/);
  const corrWords = corrected.trim().split(/\s+/);
  const maxLen    = Math.max(origWords.length, corrWords.length);
  const result    = [];
  for (let i = 0; i < maxLen; i++) {
    const ow = origWords[i] || "";
    const cw = corrWords[i] || "";
    result.push({
      word:          ow || cw,
      correctedWord: cw,
      changed:       ow.toLowerCase().replace(/[^a-z]/g, "") !== cw.toLowerCase().replace(/[^a-z]/g, ""),
    });
  }
  return result;
}

export function useGrammarCheck() {
  const [status,      setStatus]      = useState("idle");
  const [suggestions, setSuggestions] = useState([]);

  const timerRef   = useRef(null);
  const reqIdRef   = useRef(0);          // increments per check; stale responses are ignored
  const abortRef   = useRef(null);       // AbortController for in-flight request
  const mountedRef = useRef(true);       // prevents state updates after unmount

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimeout(timerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const check = useCallback((text) => {
    // Cancel previous debounce + in-flight request
    clearTimeout(timerRef.current);
    abortRef.current?.abort();

    if (!text?.trim() || text.trim().length < 3) {
      setSuggestions([]);
      setStatus("idle");
      return;
    }

    timerRef.current = setTimeout(async () => {
      if (!mountedRef.current) return;

      const reqId = ++reqIdRef.current;
      const controller = new AbortController();
      abortRef.current = controller;

      setStatus("checking");
      setSuggestions([]);

      try {
        const { data } = await api.post(
          "/api/grammar/check",
          { text },
          { signal: controller.signal }
        );

        // Discard if a newer check was started or component unmounted
        if (reqId !== reqIdRef.current || !mountedRef.current) return;

        if (!data.success) { setStatus("error"); return; }

        const enriched = (data.suggestions || []).map(s => ({
          ...s,
          diff: wordDiff(s.original, s.corrected),
        }));

        setSuggestions(enriched);
        setStatus("done");
      } catch (err) {
        if (err.name === "CanceledError" || err.name === "AbortError") return;
        if (!mountedRef.current) return;
        console.error("Grammar check failed:", err.message);
        setStatus("error");
      }
    }, 1500);
  }, []);

  return { status, suggestions, check };
}
