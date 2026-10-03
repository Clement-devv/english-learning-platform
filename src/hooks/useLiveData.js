// src/hooks/useLiveData.js
// Two small hooks that plug existing loaders into the live-update system
// (src/lib/queryClient.js + server/utils/liveUpdates.js).
//
// useLiveRefresh(queryKey, refreshFn)
//   For always-mounted dashboard data. TanStack Query decides WHEN refreshFn
//   runs: a "data-changed" push for queryKey[0], returning to the browser tab,
//   the 5-minute safety refresh — and refreshStale() when the user switches tab.
//   The first load is done by the caller, so nothing runs twice at start-up.
//
// useOnDataChanged(resources, callback)
//   For tabs that load their own data on mount. Re-runs callback when a push
//   names one of `resources`, or when the user comes back to the browser tab
//   after being away longer than the stale time.
import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient, STALE_MS, subscribeDataChanged, subscribeLiveEvent } from "../lib/queryClient";

export function useLiveRefresh(queryKey, refreshFn, { enabled = true } = {}) {
  const fnRef = useRef(refreshFn);
  fnRef.current = refreshFn;
  useQuery({
    queryKey,
    queryFn: async () => { await fnRef.current(); return Date.now(); },
    enabled,
    initialData: () => Date.now(),   // the caller already loaded this — fresh for STALE_MS
    initialDataUpdatedAt: () => Date.now(),
  });
}

/** Refetch, among the queries starting with `prefix`, the ones older than the stale time (tab switch). */
export function refreshStale(prefix) {
  queryClient.refetchQueries({ queryKey: prefix, stale: true, type: "active" });
}

/** Run callback(payload) for a named live push (e.g. "class-presence"). */
export function useLiveEvent(name, callback) {
  const cbRef = useRef(callback);
  cbRef.current = callback;
  useEffect(() => subscribeLiveEvent(name, (p) => cbRef.current(p)), [name]);
}

export function useOnDataChanged(resources, callback) {
  const cbRef = useRef(callback);
  cbRef.current = callback;
  const key = resources.join(",");
  useEffect(() => {
    const wanted = new Set(key.split(","));
    // One push can name several related resources — run the loader once.
    let t = null;
    const run = () => { clearTimeout(t); t = setTimeout(() => cbRef.current(), 60); };
    const off = subscribeDataChanged((keys) => {
      if (keys.includes("*") || keys.some(k => wanted.has(k))) run();
    });
    let hiddenAt = 0;
    const onVis = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > STALE_MS) { hiddenAt = 0; cbRef.current(); }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => { off(); clearTimeout(t); document.removeEventListener("visibilitychange", onVis); };
  }, [key]);
}
