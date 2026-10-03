// src/lib/queryClient.js
// One shared data cache for the whole app (TanStack Query).
//
//  • Opening / switching to a screen shows cached data at once and refetches in
//    the background when it is older than STALE_MS.
//  • Coming back to the browser tab, or the network coming back, refetches.
//  • The server pushes "data-changed" { keys } over Socket.IO after any write
//    (server/utils/liveUpdates.js); we refetch just those resources, and only
//    for screens that are on display. Nothing is pushed but the names.
//  • A slow safety refresh (SAFETY_MS) covers anything a push could miss; it
//    pauses while the tab is hidden.
//
// Query-key convention: the FIRST element is the resource name the server
// uses — "bookings", "schedule", "classes", "homework", "quizzes", "recordings",
// "payments", "credits", "students", "teachers", "reviews", "offline-classes",
// "parent-checks"… e.g. ["bookings", "teacher", teacherId, "pending"].
import { QueryClient } from "@tanstack/react-query";

export const STALE_MS  = 30_000;
export const SAFETY_MS = 5 * 60_000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE_MS,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchInterval: SAFETY_MS,
      refetchIntervalInBackground: false,
      retry: 1,
    },
  },
});

// Some screens are touched by more than one resource (a booking changes the
// schedule and the class lists, a payment changes credits…).
const ALSO = {
  bookings: ["classes", "schedule", "offline-classes", "parent-checks", "disputes"],
  payments: ["credits"],
  students: ["credits"],
};

// A busy class can update its booking every few seconds — refetch each
// resource at most once per THROTTLE_MS (the last change in a burst still lands).
const THROTTLE_MS = 2_000;
const lastRun = new Map();
const trailing = new Map();

// Screens that load their own data subscribe here (hooks/useLiveData.js → useOnDataChanged)
const listeners = new Set();
export function subscribeDataChanged(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function invalidateNow(key) {
  lastRun.set(key, Date.now());
  queryClient.invalidateQueries({ queryKey: [key] });
  listeners.forEach(fn => { try { fn([key]); } catch { /* a screen's loader failing must not stop the others */ } });
}

/** Refetch everything cached under these resource names (active screens only). */
export function invalidateResources(keys = []) {
  const all = new Set();
  keys.forEach(k => { all.add(k); (ALSO[k] || []).forEach(x => all.add(x)); });
  for (const key of all) {
    const wait = THROTTLE_MS - (Date.now() - (lastRun.get(key) || 0));
    if (wait <= 0) { invalidateNow(key); continue; }
    if (!trailing.has(key)) {
      trailing.set(key, setTimeout(() => { trailing.delete(key); invalidateNow(key); }, wait));
    }
  }
}

/** After a reconnect we may have missed pushes — refresh whatever is on screen. */
export function refreshEverythingVisible() {
  queryClient.invalidateQueries();
  listeners.forEach(fn => { try { fn(["*"]); } catch { /* ignore */ } });
}

// Named pushes that carry a small payload (e.g. "class-presence" for admins)
const eventListeners = new Map(); // name → Set(fn)
export function emitLiveEvent(name, payload) {
  (eventListeners.get(name) || []).forEach(fn => { try { fn(payload); } catch { /* ignore */ } });
}
export function subscribeLiveEvent(name, fn) {
  if (!eventListeners.has(name)) eventListeners.set(name, new Set());
  eventListeners.get(name).add(fn);
  return () => eventListeners.get(name)?.delete(fn);
}

/** Logout / switching account: drop every cached response. */
export function clearDataCache() {
  queryClient.clear();
}
