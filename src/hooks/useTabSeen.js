// src/hooks/useTabSeen.js
// Tab badges that clear when the tab is opened.
//
// Some badges count a to-do list (quizzes not done yet, homework to grade, bookings to
// approve). Shown as-is, the number never goes away when the tab is opened — only when
// the work is finished. This remembers, per user and per tab, how many items the tab
// held when it was last opened, and the badge shows only what arrived since:
//
//   const badge = useTabSeen(`student:${id}`, activeTab, { quiz: quizPending }, { quiz: quizLoaded });
//   badge("quiz")  → number of new quizzes since the Quiz tab was last opened, or null
//
// • While a tab is open, everything in it counts as seen.
// • When items are finished / removed the remembered count drops with them, so the next
//   new item shows again.
// • A tab never opened on this device shows its whole count.
// • A count is ignored until `loaded[key]` is true, so a page still loading (count 0)
//   can't wipe what was seen.
// Kept in localStorage (per device); storage blocked → badges simply behave per visit.
import { useState, useEffect, useCallback } from "react";

const read = (key) => {
  try { return JSON.parse(localStorage.getItem(key) || "{}") || {}; } catch { return {}; }
};

export function useTabSeen(owner, activeTab, counts, loaded) {
  const storageKey = owner ? `tabSeen:${owner}` : null;
  const [seen, setSeen] = useState(() => (storageKey ? read(storageKey) : {}));

  // A different user signed in on this device → their own memory
  useEffect(() => { setSeen(storageKey ? read(storageKey) : {}); }, [storageKey]);

  const sig = JSON.stringify([counts, loaded]); // one effect for any count change
  useEffect(() => {
    setSeen((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const [tab, raw] of Object.entries(counts)) {
        if (!loaded?.[tab]) continue;
        const n = Math.max(0, Number(raw) || 0);
        const before = prev[tab];
        const after = tab === activeTab ? n                 // open → all seen
          : before == null ? before                         // never opened here → show it all
          : Math.min(before, n);                            // finished items leave the memory
        if (after !== before) { next[tab] = after; changed = true; }
      }
      if (!changed) return prev;
      if (storageKey) { try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* storage blocked */ } }
      return next;
    });
  }, [activeTab, sig, storageKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return useCallback((tab) => {
    if (!loaded?.[tab] || tab === activeTab) return null;
    const n = Math.max(0, Number(counts[tab]) || 0);
    const fresh = seen[tab] == null ? n : n - seen[tab];
    return fresh > 0 ? fresh : null;
  }, [sig, seen, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps
}
