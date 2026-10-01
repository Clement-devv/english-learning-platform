// src/utils/recordingStore.js
// Keeps recording parts in IndexedDB until the server confirms they are saved.
// If the tab closes, crashes, or an upload fails, the part survives and the
// teacher can retry it next time the app opens.
//
// Every call is best-effort: when IndexedDB is unavailable (private window,
// blocked storage) the functions resolve quietly and uploads still work,
// just without the crash protection.

const DB_NAME = 'recording-uploads';
const STORE   = 'parts';

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    } catch (err) {
      reject(err);
    }
  }).catch(err => {
    dbPromise = null;
    throw err;
  });
  return dbPromise;
}

function run(mode, fn) {
  return openDb().then(db => new Promise((resolve, reject) => {
    const tx     = db.transaction(STORE, mode);
    const result = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(result?.result);
    tx.onerror    = () => reject(tx.error);
    tx.onabort    = () => reject(tx.error);
  }));
}

/** Save a part (blob + upload metadata). Resolves true when stored. */
export async function savePart(item) {
  try {
    await run('readwrite', store => store.put(item));
    return true;
  } catch (err) {
    console.warn('[recordingStore] could not save part locally', err);
    return false;
  }
}

/** Remove a part once the server has it (or the teacher discards it). */
export async function deletePart(id) {
  try {
    await run('readwrite', store => store.delete(id));
  } catch (_) { /* nothing to clean up */ }
}

/** All parts that were never confirmed as saved. */
export async function loadParts() {
  try {
    const parts = await run('readonly', store => store.getAll());
    return Array.isArray(parts) ? parts : [];
  } catch (_) {
    return [];
  }
}
