import { createHmac } from 'crypto';
import { config } from '../config/config.js';

// Derive a per-center HMAC-SHA256 secret from the master JWT secret.
// A token signed for center "greenfield" cannot be replayed against "oxford" —
// the signatures are cryptographically independent even though they share one master secret.
export function getCenterSecret(centerSlug) {
  return createHmac('sha256', config.jwtSecret).update(centerSlug).digest('hex');
}
