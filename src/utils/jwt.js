// Read a JWT's payload in the browser (no signature check — the server does that).
// JWTs use base64url ("-" and "_", no padding); atob only understands standard
// base64, so it threw on many real tokens.

/** @returns {object|null} the payload, or null when the token can't be read */
export function decodeJwtPayload(token) {
  try {
    const part = String(token || '').split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (part.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)); // UTF-8 safe (names with accents etc.)
  } catch {
    return null;
  }
}
