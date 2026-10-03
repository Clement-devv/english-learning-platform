// src/utils/deviceKey.js
// Device identity used to tie a login session to THIS browser.
//
// On first use the browser creates an ECDSA P-256 key pair with the private
// key marked NON-EXTRACTABLE: page scripts (and anyone typing in the console)
// can ask the browser to sign with it, but can never read it out. It is kept
// in IndexedDB as a CryptoKey object. The public half goes to the server at
// login; renewing the session later needs a fresh signature from this key.
// So copying sessionStorage to another computer is useless — that computer
// cannot produce the signature.
//
// Everything here is best-effort: without WebCrypto/IndexedDB (insecure http,
// very old browsers) we return nulls and the server falls back to a weaker
// same-browser check.

const DB_NAME = "clemify-device";
const STORE   = "kv";
const KEY     = "identity";

let identityPromise = null;

function idb(mode, fn) {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1);
    open.onupgradeneeded = () => open.result.createObjectStore(STORE);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction(STORE, mode);
      const req = fn(tx.objectStore(STORE));
      tx.oncomplete = () => { db.close(); resolve(req?.result); };
      tx.onerror    = () => { db.close(); reject(tx.error); };
    };
  });
}

const b64url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function randomId() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  return b64url(bytes);
}

async function loadOrCreate() {
  if (!globalThis.crypto?.subtle || !globalThis.indexedDB) return null;
  const existing = await idb("readonly", s => s.get(KEY));
  if (existing?.privateKey && existing?.publicJwk && existing?.deviceId) return existing;

  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false,                // private key can never be exported
    ["sign", "verify"],
  );
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey); // public half only
  const identity = {
    deviceId:   randomId(),
    privateKey: pair.privateKey,
    publicJwk:  { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y },
  };
  await idb("readwrite", s => s.put(identity, KEY));
  return identity;
}

/** This browser's identity, created on first call; null if unsupported. */
export function getDeviceIdentity() {
  if (!identityPromise) {
    identityPromise = loadOrCreate().catch(() => null);
  }
  return identityPromise;
}

/** Headers sent with login requests so the server can bind the new session. */
export async function deviceLoginHeaders() {
  const id = await getDeviceIdentity();
  if (!id) return {};
  return {
    "x-device-id":  id.deviceId,
    "x-device-key": b64url(new TextEncoder().encode(JSON.stringify(id.publicJwk))),
  };
}

/** Proof for /auth/refresh: signature over `${sessionToken}.${ts}`. */
export async function signRenewal(sessionToken) {
  const id = await getDeviceIdentity();
  if (!id || !sessionToken) return null;
  const ts  = Date.now();
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    id.privateKey,
    new TextEncoder().encode(`${sessionToken}.${ts}`),
  );
  return { ts, sig: b64url(sig) };
}

/** Delete this browser's identity (used when the device is signed out remotely). */
export async function forgetDeviceIdentity() {
  identityPromise = null;
  try { await idb("readwrite", s => s.delete(KEY)); } catch { /* nothing stored */ }
}
