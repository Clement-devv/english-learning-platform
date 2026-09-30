// server/utils/managedStudent.js
import crypto from "crypto";

// RFC 2606 reserves ".invalid" — addresses on it can never resolve to a real inbox.
export const MANAGED_EMAIL_DOMAIN = "managed.invalid";

/** Placeholder email for a managed student (email is unique + required on the schema). */
export const makeManagedEmail = () =>
  `managed-${crypto.randomBytes(8).toString("hex")}@${MANAGED_EMAIL_DOMAIN}`;

export const isManagedEmail = (email) =>
  typeof email === "string" && email.trim().toLowerCase().endsWith(`@${MANAGED_EMAIL_DOMAIN}`);
