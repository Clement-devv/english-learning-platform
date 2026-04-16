/**
 * AES-256-GCM field-level encryption for sensitive PII (bank details, etc.).
 *
 * Requires ENCRYPTION_KEY env var: 64 hex characters (32 bytes).
 * Generate once with: node -e "logger.info(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Stored format:  <iv_hex>:<auth_tag_hex>:<ciphertext_hex>
 * Legacy plaintext (no colons) is returned as-is so existing records keep working.
 */
import crypto from 'crypto';
import { config } from '../config/config.js';
import { logger } from '../utils/logger.js';

const ALGORITHM = 'aes-256-gcm';
const DELIMITER = ':';
const PARTS     = 3;

function getKey() {
  return Buffer.from(config.encryptionKey, 'hex');
}

export function encryptField(text) {
  if (!text) return text;
  const key = getKey();

  const iv         = crypto.randomBytes(12);
  const cipher     = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted  = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  const tag        = cipher.getAuthTag();

  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(DELIMITER);
}

export function decryptField(text) {
  if (!text) return text;
  const key = getKey();

  const parts = String(text).split(DELIMITER);
  if (parts.length !== PARTS) return text; // legacy plaintext — return as-is

  try {
    const [ivHex, tagHex, encHex] = parts;
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    return decipher.update(Buffer.from(encHex, 'hex')) + decipher.final('utf8');
  } catch {
    return text; // decryption failed (wrong key or tampered) — return raw
  }
}
