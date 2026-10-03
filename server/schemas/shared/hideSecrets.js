// server/schemas/shared/hideSecrets.js
// Account documents (student, teacher, admin, parent, sub-admin, super admin)
// hold secrets that must never reach a browser: the password hash, every
// device's session/refresh token, invite + reset tokens and 2FA material.
// This toJSON transform removes them from EVERY res.json(doc), so a route
// that forgets a .select() can't leak them. Server code reading the document
// directly (doc.password, doc.sessions) is unaffected; .lean() results are
// plain objects and still need their own .select().
const SECRET_FIELDS = [
  "password",
  "sessions",
  "knownDevices",
  "inviteToken",
  "resetPasswordToken",
  "resetPasswordExpires",
  "resetPasswordCenter",
  "twoFactorSecret",
  "twoFactorBackupCodes",
  "analyticsPinHash",
  "analyticsPinPending",
  "pendingPasswordHash",
  "loginCode",
];

/** Apply to a schema: hides SECRET_FIELDS from toJSON, keeping any existing toJSON options. */
export function hideSecrets(schema) {
  const prev = schema.get("toJSON") || {};
  const prevTransform = prev.transform;
  schema.set("toJSON", {
    ...prev,
    transform(doc, ret, options) {
      const out = typeof prevTransform === "function" ? (prevTransform(doc, ret, options) ?? ret) : ret;
      for (const f of SECRET_FIELDS) delete out[f];
      return out;
    },
  });
  return schema;
}
