// src/utils/localNotify.js
import { getDeviceChoice } from "./pushNotifications";

// A system notification raised by an open dashboard tab (live socket events).
//   • Only while the tab is in the background — when the person is looking at the
//     page, the in-app toast / badge is enough (no pop-up over what they're reading).
//   • `tag` matches the tag of the server's web push for the same event, so when both
//     arrive the second replaces the first instead of showing a duplicate.
//     renotify: alert again for a new message in the same conversation.
//   • Skipped when this device gets the server's web push (it covers the same events,
//     tab open or not) — one pop-up per event, never two.
//   • Shown through the service worker when possible, so clicking it brings this tab
//     back and opens `url` (public/sw.js → notificationclick).

export async function showLocalNotification(title, { body = "", tag, url, renotify = false } = {}) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted" || document.visibilityState === "visible") return;
  if (getDeviceChoice() === "on") return; // the server push shows it
  const options = { body, tag, renotify: !!(renotify && tag), icon: "/icons/icon.svg", badge: "/icons/icon.svg", data: { url: url || window.location.pathname } };
  try {
    const reg = await navigator.serviceWorker?.getRegistration("/");
    if (reg) { await reg.showNotification(title, options); return; }
  } catch { /* fall back to a page notification */ }
  try { new Notification(title, options); } catch { /* some browsers only allow it via the service worker */ }
}
