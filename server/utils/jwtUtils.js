import { createHmac } from 'crypto';
import { config } from '../config/config.js';

// Derive a per-center HMAC-SHA256 secret from the master JWT secret.
// A token signed for center "greenfield" cannot be replayed against "oxford" —
// the signatures are cryptographically independent even though they share one master secret.
export function getCenterSecret(centerSlug) {
  return createHmac('sha256', config.jwtSecret).update(centerSlug).digest('hex');
}

// Separate secret for the "password OK, 2FA code still needed" token. Signed with
// its own key so it can never pass verifyToken / the socket handshake as a login token.
export function getCenter2faPendingSecret(centerSlug) {
  return createHmac('sha256', getCenterSecret(centerSlug)).update('login-2fa-pending').digest('hex');
}
