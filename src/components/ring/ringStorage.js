// src/components/ring/ringStorage.js
// Helpers for persisting the user's custom ringtone.
//
// Primary storage: S3 (production) — file uploaded via POST /ring/ringtone,
//   public URL stored in localStorage.
// Fallback storage: IndexedDB — used automatically when S3 is not configured
//   (local dev, staging without AWS creds, etc.).
//
// loadCustomTone() always returns an ArrayBuffer, regardless of which storage
// was used — so RingContext.jsx needs zero changes.
//
// ── Latency strategy ─────────────────────────────────────────────────────────
//   1. RAM cache (_cachedBuffer) — bytes live in memory after the first load.
//      Every subsequent call is microseconds (no network, no disk).
//   2. Browser HTTP cache (force-cache) for S3 path — page reloads repopulate
//      the RAM cache from disk without hitting S3 again.
//   3. Proactive warm-up — RingContext calls warmCustomTone() on socket connect
//      so the buffer is already in RAM before any ring arrives.

// ── localStorage keys ────────────────────────────────────────────────────────
const URL_KEY  = "ring_tone_url";
const NAME_KEY = "ring_tone_file_name";

// ── RAM cache (module-level singleton) ───────────────────────────────────────
let _cachedBuffer = null;

// ── IndexedDB helpers (fallback when S3 is not configured) ───────────────────
const DB_NAME = "eng_platform_ring";
const DB_VER  = 1;
const STORE   = "custom_tone";
const IDB_KEY = "buffer";

function _openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function _idbLoad() {
  try {
    const db = await _openDb();
    return new Promise((resolve) => {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(IDB_KEY);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror   = () => resolve(null);
    });
  } catch { return null; }
}

async function _idbClear() {
  try {
    const db = await _openDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(IDB_KEY);
      tx.oncomplete = resolve;
      tx.onerror    = resolve;
    });
  } catch {}
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Save a public S3 URL (returned by POST /ring/ringtone).
 * Invalidates the RAM cache and removes any stale IndexedDB data.
 */
export function saveCustomToneUrl(url, fileName) {
  localStorage.setItem(URL_KEY, url);
  if (fileName) localStorage.setItem(NAME_KEY, fileName);
  _cachedBuffer = null;
  _idbClear(); // remove any old local-only copy
}

/**
 * Save raw audio bytes to IndexedDB (fallback when S3 is not configured).
 * Also warms the RAM cache with this buffer so the first ring is instant.
 */
export async function saveCustomToneIDB(arrayBuffer, fileName) {
  const db = await _openDb();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(arrayBuffer, IDB_KEY);
    tx.oncomplete = resolve;
    tx.onerror    = () => reject(tx.error);
  });
  if (fileName) localStorage.setItem(NAME_KEY, fileName);
  // Warm the RAM cache immediately — the file is already in memory
  _cachedBuffer = arrayBuffer;
  // Clear any stale S3 URL so loadCustomTone uses IDB path
  localStorage.removeItem(URL_KEY);
}

/**
 * Load the custom tone as an ArrayBuffer ready for Web Audio API decoding.
 *
 * Priority:
 *   1. RAM cache  — instant (microseconds)
 *   2. S3 URL     — HTTP fetch (browser cache after first load)
 *   3. IndexedDB  — local fallback (used in dev / no-S3 environments)
 *
 * Returns null if nothing is stored.
 */
export async function loadCustomTone() {
  // ① RAM cache — fastest
  if (_cachedBuffer) return _cachedBuffer.slice(0);

  // ② S3 URL
  const url = localStorage.getItem(URL_KEY);
  if (url) {
    try {
      const res = await fetch(url, { cache: "force-cache" });
      if (res.ok) {
        _cachedBuffer = await res.arrayBuffer();
        return _cachedBuffer.slice(0);
      }
    } catch { /* fall through to IDB */ }
  }

  // ③ IndexedDB fallback
  const buf = await _idbLoad();
  if (buf) {
    _cachedBuffer = buf;
    return _cachedBuffer.slice(0);
  }

  return null;
}

/**
 * Proactively populate the RAM cache without returning anything.
 * Call this on socket connect so the buffer is ready before any ring arrives.
 */
export async function warmCustomTone() {
  if (_cachedBuffer) return; // already warm
  await loadCustomTone();    // populates _cachedBuffer as a side-effect
}

/** Remove all stored ringtone data (localStorage + IndexedDB + RAM cache). */
export function clearCustomTone() {
  localStorage.removeItem(URL_KEY);
  localStorage.removeItem(NAME_KEY);
  _cachedBuffer = null;
  _idbClear();
}

/** Returns the stored public S3 URL, or null if using local storage. */
export function getCustomToneUrl() {
  return localStorage.getItem(URL_KEY) || null;
}
