// src/utils/reportClientError.js
// Tells the platform owner's App Health dashboard when a page crashes in
// someone's browser (server: routes/monitorRoutes.js → POST /client-errors).
// Sends only the error message, the page path and a few lines of where it
// happened — never form contents. At most 10 reports per page load, and the
// same error is sent once a minute at most.
import api from "../api";

const MAX_PER_LOAD = 10;
const SAME_ERROR_MS = 60_000;
let sent = 0;
const recent = new Map();

export function reportClientError(error, { type = "crash", where = "" } = {}) {
  try {
    if (import.meta.env.MODE === "test") return;
    const message = String(error?.message || error || "Unknown error").slice(0, 300);
    const now = Date.now();
    if (sent >= MAX_PER_LOAD || now - (recent.get(message) || 0) < SAME_ERROR_MS) return;
    recent.set(message, now);
    sent++;
    const stackTop = String(error?.stack || "").split("\n").slice(1, 4).map(s => s.trim()).join(" | ");
    api.post("/client-errors", {
      type, message,
      // Share-link tokens and ids live in some paths — never send them
      page: window.location.pathname.replace(/\/[A-Za-z0-9_-]{20,}/g, "/:token"),
      where: String(where || stackTop).slice(0, 300),
    }).catch(() => { /* reporting must never cause another error */ });
  } catch { /* ignore */ }
}

/** Catch errors that happen outside React (event handlers, promises). Call once at start-up. */
export function installClientErrorReporting() {
  window.addEventListener("error", (e) => {
    // Ignore failed <img>/<script> loads and cross-origin "Script error." noise
    if (!e.error && (!e.message || e.message === "Script error.")) return;
    reportClientError(e.error || e.message, { type: "unhandled" });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r = e.reason;
    // Failed API calls are already handled (and recorded server-side)
    if (r?.isAxiosError || r?.name === "AxiosError" || r?.name === "CanceledError") return;
    reportClientError(r, { type: "unhandled" });
  });
}
