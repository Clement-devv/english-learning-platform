// src/utils/managedStudent.js
// Managed (no-login) students get a placeholder email on the reserved ".invalid"
// domain (server/utils/managedStudent.js). It is never a real inbox, so never show it.

export const MANAGED_EMAIL_DOMAIN = "managed.invalid";

export const isManagedEmail = (email) =>
  typeof email === "string" && email.trim().toLowerCase().endsWith(`@${MANAGED_EMAIL_DOMAIN}`);

/** The email to display, or "" for a managed student's placeholder. */
export const visibleEmail = (email) => (isManagedEmail(email) ? "" : email || "");
