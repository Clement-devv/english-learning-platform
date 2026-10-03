// src/utils/deviceWipe.js
// Erase everything this app stored in the browser. Runs when this device is
// signed out remotely ("Log out this device" from another device) or when the
// server rejects the session as belonging to another device.
//
// A website can only clear ITS OWN data — not the browser's history or other
// sites' cookies. This removes: login tokens, cached profile/settings,
// unsent recording parts, the device key, offline caches and this browser's
// push subscription.

import { forgetDeviceIdentity } from "./deviceKey.js";
import { ROLE_CONFIG } from "./authStorage.js";

const APP_DATABASES = ["recording-uploads", "clemify-device", "eng_platform_ring"];

let wiping = false;

/**
 * Wipe this app's data from the browser, then go to the login page.
 * @param {object} [opts]
 * @param {string} [opts.role]    role that was signed in (picks the login page)
 * @param {string} [opts.reason]  shown on the login page
 */
export async function wipeDeviceAndSignOut({ role, reason = "remote" } = {}) {
  if (wiping) return;
  wiping = true;

  const loginPath = ROLE_CONFIG[role]?.loginPath || "/";

  // Push: stop this browser receiving any notifications for this app
  try {
    const reg = await navigator.serviceWorker?.getRegistration("/");
    const sub = await reg?.pushManager?.getSubscription();
    await sub?.unsubscribe();
  } catch { /* ignore */ }

  // Offline caches (service worker)
  try {
    if (globalThis.caches) {
      const names = await caches.keys();
      await Promise.all(names.map(n => caches.delete(n)));
    }
  } catch { /* ignore */ }

  // IndexedDB databases this app created
  await forgetDeviceIdentity();
  try {
    const dbs = indexedDB.databases ? (await indexedDB.databases()).map(d => d.name) : APP_DATABASES;
    await Promise.all([...new Set([...dbs, ...APP_DATABASES])].filter(Boolean).map(name =>
      new Promise(resolve => {
        const req = indexedDB.deleteDatabase(name);
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      })));
  } catch { /* ignore */ }

  // Tokens, profile and settings
  try { sessionStorage.clear(); } catch { /* ignore */ }
  try { localStorage.clear(); }   catch { /* ignore */ }

  // Tell the login page why (survives the reload; cleared when shown)
  try { sessionStorage.setItem("signedOutReason", reason); } catch { /* ignore */ }

  window.location.replace(loginPath);
}
