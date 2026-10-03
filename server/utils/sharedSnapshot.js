// server/utils/sharedSnapshot.js
// One shared copy of expensive admin numbers (overview, analytics) per center.
//
//  • The first admin to ask computes it; everyone else gets the same copy from
//    memory. Admins asking at the same moment share ONE computation.
//  • Any write in the center marks its snapshots stale (liveUpdates.notifyChanged
//    → markSnapshotDirty). A single "analytics" push then goes to the center's
//    admins ANALYTICS_PUSH_MS later, so a burst of writes costs at most one
//    recomputation — however many admins are watching.
//  • Snapshots also expire after MAX_AGE_MS as a safety net.
//
// Database cost is therefore driven by how much is HAPPENING, not by how many
// admins are looking. (Per server process; with several API servers each keeps
// its own copy — still at most one computation per server per change window.)

const MAX_AGE_MS = 5 * 60_000;
const ANALYTICS_PUSH_MS = 3_000;
const MAX_ENTRIES = 2_000;

const store = new Map();     // key → { body, at }
const inflight = new Map();  // key → Promise<{ status, body }>
const dirtyAt = new Map();   // slug → time of last write
const pushTimers = new Map(); // slug → timeout

let notifyAdmins = null;     // (slug, keys) => void — set by liveUpdates
export function setSnapshotNotifier(fn) { notifyAdmins = fn; }

/** Called for every write in a center (from liveUpdates.notifyChanged). */
export function markSnapshotDirty(slug) {
  if (!slug) return;
  dirtyAt.set(slug, Date.now());
  if (pushTimers.has(slug)) return; // one push per window
  pushTimers.set(slug, setTimeout(() => {
    pushTimers.delete(slug);
    notifyAdmins?.(slug, ["analytics"]);
  }, ANALYTICS_PUSH_MS));
}

/**
 * Express middleware: serve the response from the shared snapshot.
 * @param {string} name                 snapshot name (e.g. "overview")
 * @param {(req) => Promise<string>|string} [variant]  extra key part (e.g. PIN locked/unlocked)
 */
export function sharedSnapshot(name, variant) {
  return async (req, res, next) => {
    const slug = req.center?.slug;
    if (!slug) return next();
    let key;
    try {
      const v = variant ? await variant(req) : "";
      const q = Object.keys(req.query).sort().map(k => `${k}=${req.query[k]}`).join("&");
      key = `${slug}|${name}|${v}|${q}`;
    } catch { return next(); }

    const hit = store.get(key);
    const fresh = hit && hit.at >= (dirtyAt.get(slug) || 0) && Date.now() - hit.at < MAX_AGE_MS;
    if (fresh) { res.set("X-Snapshot", "hit"); return res.json(hit.body); }

    // Someone is already computing this exact snapshot → wait for it
    if (inflight.has(key)) {
      try {
        const r = await inflight.get(key);
        res.set("X-Snapshot", "shared");
        return res.status(r.status).json(r.body);
      } catch { return next(); }
    }

    // We compute it: capture the handler's JSON response
    let resolve, reject;
    const p = new Promise((a, b) => { resolve = a; reject = b; });
    p.catch(() => {});
    inflight.set(key, p);
    const startedAt = Date.now();
    const origJson = res.json.bind(res);
    res.json = (body) => {
      const status = res.statusCode || 200;
      if (status === 200 && body && body.success !== false) {
        // Only keep it if nothing changed while we were computing
        if (startedAt >= (dirtyAt.get(slug) || 0)) store.set(key, { body, at: startedAt });
        if (store.size > MAX_ENTRIES) store.delete(store.keys().next().value);
      }
      inflight.delete(key);
      resolve({ status, body });
      res.set("X-Snapshot", "miss");
      return origJson(body);
    };
    res.on("close", () => { if (inflight.get(key) === p) { inflight.delete(key); reject(new Error("closed")); } });
    next();
  };
}
