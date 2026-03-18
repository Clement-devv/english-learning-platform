// src/utils/pushNotifications.js
// Handles browser permission request, SW registration, and push subscription lifecycle.

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

function authHeader() {
  const t =
    localStorage.getItem("studentToken") ||
    localStorage.getItem("teacherToken") ||
    localStorage.getItem("token");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw     = window.atob(base64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

/** Returns true if the browser supports Web Push */
export function pushSupported() {
  return (
    "serviceWorker" in navigator &&
    "PushManager"   in window   &&
    "Notification"  in window
  );
}

/** Current browser permission state: "granted" | "denied" | "default" */
export function pushPermission() {
  return typeof Notification !== "undefined" ? Notification.permission : "default";
}

/**
 * Request permission, register SW, subscribe to push server, save to backend.
 * Returns { ok: true } on success, { ok: false, reason } on failure.
 */
export async function enablePush() {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };

  // 1. Ask for permission
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "denied" };

  try {
    // 2. Register (or reuse) service worker
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;

    // 3. Fetch VAPID public key from server
    const keyRes = await fetch(`${API}/api/push/vapid-key`);
    if (!keyRes.ok) return { ok: false, reason: "no_vapid" };
    const { key } = await keyRes.json();

    // 4. Subscribe
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });

    // 5. Save subscription to backend
    await fetch(`${API}/api/push/subscribe`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });

    return { ok: true };
  } catch (err) {
    console.error("enablePush error:", err);
    return { ok: false, reason: err.message };
  }
}

/**
 * Unsubscribe from push and remove from backend.
 */
export async function disablePush() {
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    }
    await fetch(`${API}/api/push/subscribe`, {
      method: "DELETE",
      headers: authHeader(),
    });
  } catch (err) {
    console.error("disablePush error:", err);
  }
}

/**
 * Check if the current user already has an active subscription on the server.
 */
export async function getPushStatus() {
  try {
    const res = await fetch(`${API}/api/push/status`, { headers: authHeader() });
    const json = await res.json();
    return json.subscribed ?? false;
  } catch {
    return false;
  }
}
