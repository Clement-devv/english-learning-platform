import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { config } from '../config/config.js';

const ALGO       = 'aes-256-gcm';
const ENC_PREFIX = 'enc::';
const HASH_PREFIX = 'h::';

function getKey() {
  return Buffer.from(config.encryptionKey, 'hex'); // 32 bytes validated at startup
}

// Encrypt a plaintext string. Returns "enc::<ivHex>:<authTagHex>:<ciphertextHex>".
export function encrypt(plaintext) {
  if (!plaintext) return plaintext;
  const iv     = randomBytes(12); // 96-bit IV is the GCM standard
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const body   = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return `${ENC_PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${body.toString('hex')}`;
}

// Decrypt a value produced by encrypt(). If the value lacks the enc:: prefix
// (i.e. it was stored before this change was deployed), it is returned as-is
// so that existing TOTP secrets remain usable until the user re-sets up 2FA.
export function decrypt(value) {
  if (!value || !value.startsWith(ENC_PREFIX)) return value;
  const inner = value.slice(ENC_PREFIX.length);
  const colonA = inner.indexOf(':');
  const colonB = inner.indexOf(':', colonA + 1);
  const ivHex  = inner.slice(0, colonA);
  const tagHex = inner.slice(colonA + 1, colonB);
  const encHex = inner.slice(colonB + 1);
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(encHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}

// One-way hash for backup codes. Stored as "h::<sha256hex>".
// Callers hash the user-supplied code before any DB query or comparison,
// so the plaintext code never needs to be retrieved from the database.
export function hashBackupCode(code) {
  const normalized = String(code).toUpperCase().trim();
  return `${HASH_PREFIX}${createHash('sha256').update(normalized).digest('hex')}`;
}
