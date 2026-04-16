// Central place for magic numbers used across the server.
// Import from here instead of scattering literals in route/util files.

// ── Auth & Sessions ───────────────────────────────────────────────────────────
export const MAX_LOGIN_ATTEMPTS  = 10;
export const ACCOUNT_LOCK_MS     = 60 * 60 * 1000;   // 1 hour
export const SESSION_LIMIT       = 5;                  // max concurrent sessions per user
export const SESSION_EXPIRY_DAYS = 7;                  // sessions older than this are purged

// ── Password reset ────────────────────────────────────────────────────────────
export const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;  // 1 hour

// ── Pagination ────────────────────────────────────────────────────────────────
export const DEFAULT_PAGE_LIMIT = 50;
export const MAX_PAGE_LIMIT     = 500;

// ── Background jobs ───────────────────────────────────────────────────────────
export const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;  // run hourly
