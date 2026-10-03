// src/utils/pushNotifications.js
// Per-DEVICE push notifications. Each signed-in device decides for itself
// (the "Get notifications on this device?" card), the server only notifies
// devices that are signed in and opted in, and the choice is remembered on
// this device for this user so we don't ask on every login.

import api from "../api";
import { detectActiveRole, getStoredUser } from "./authStorage";

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

// ── Remembered choice (this device + this user) ──────────────────────────────

function choiceKey() {
  const role = detectActiveRole();
  const user = role ? getStoredUser(role) : null;
  const id   = user?.id || user?._id;
  return role && id ? `notify-choice:${role}:${id}` : null;
}

/** "on" | "off" | null (never asked on this device) */
export function getDeviceChoice() {
  const key = choiceKey();
  try { return key ? localStorage.getItem(key) : null; } catch { return null; }
}

function setDeviceChoice(value) {
  const key = choiceKey();
  try { if (key) localStorage.setItem(key, value); } catch { /* ignore */ }
}

// ── Weekly reminder (the "ℹ️ tip") ───────────────────────────────────────────
// When notifications are NOT on for this device, a small tip reminds the user
// at most once a week. They can switch the reminder off (tip button or the
// My devices settings).

export const TIP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

function tipKey() {
  const key = choiceKey();
  return key ? key.replace(/^notify-choice:/, "notify-tip:") : null;
}

function readTip() {
  const key = tipKey();
  try { return (key && JSON.parse(localStorage.getItem(key) || "null")) || {}; } catch { return {}; }
}

function writeTip(patch) {
  const key = tipKey();
  try { if (key) localStorage.setItem(key, JSON.stringify({ ...readTip(), ...patch })); } catch { /* ignore */ }
}

/** Is the weekly reminder switched on? (default: yes) */
export function getTipsEnabled() {
  return readTip().off !== true;
}

export function setTipsEnabled(enabled) {
  writeTip({ off: !enabled });
}

/** Has a week passed since the tip (or first prompt) was last shown? */
export function isTipDue() {
  if (!getTipsEnabled()) return false;
  const last = Number(readTip().lastShown) || 0;
  return Date.now() - last >= TIP_INTERVAL_MS;
}

export function markTipShown() {
  writeTip({ lastShown: Date.now() });
}

// ── Subscribe / unsubscribe ──────────────────────────────────────────────────

async function subscribeAndSave() {
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;

  // Reuse this browser's existing subscription if there is one
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    const { data } = await api.get("/push/vapid-key");
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.key),
    });
  }
  await api.post("/push/subscribe", { subscription: sub.toJSON() });
}

/**
 * Turn notifications ON for this device (asks the browser for permission).
 * Returns { ok: true } on success, { ok: false, reason } on failure.
 */
export async function enablePush() {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };

  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    setDeviceChoice("off");
    markTipShown();
    return { ok: false, reason: "denied" };
  }

  try {
    await subscribeAndSave();
    setDeviceChoice("on");
    return { ok: true };
  } catch (err) {
    const reason = err?.response?.status === 503 ? "no_vapid" : (err?.message || "failed");
    console.warn("Could not turn on notifications:", reason);
    return { ok: false, reason };
  }
}

/** Turn notifications OFF for this device. */
export async function disablePush() {
  setDeviceChoice("off");
  try { await api.delete("/push/subscribe"); } catch { /* ignore */ }
  try {
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    await sub?.unsubscribe();
  } catch { /* ignore */ }
}

/** "Not now" on the device prompt — remember it; remind again in a week. */
export function declinePush() {
  setDeviceChoice("off");
  markTipShown();
}

/** Does THIS device currently receive notifications? */
export async function getPushStatus() {
  try {
    const { data } = await api.get("/push/status");
    return !!data?.subscribed;
  } catch {
    return false;
  }
}

/**
 * After a login on a device where this user already said yes: re-attach the
 * browser's subscription to the new session silently (no prompt — permission
 * is already granted). Returns true when notifications are on.
 */
export async function restorePushIfAllowed() {
  if (!pushSupported() || pushPermission() !== "granted") return false;
  if (getDeviceChoice() === "off") return false;
  try {
    if (await getPushStatus()) { setDeviceChoice("on"); return true; }
    await subscribeAndSave();
    setDeviceChoice("on");
    return true;
  } catch {
    return false;
  }
}
