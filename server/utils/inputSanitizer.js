// server/utils/inputSanitizer.js
// Safe input coercion and validation helpers used in route handlers.
//
// Why this exists:
//   A JSON body can send ANY type for any field. A client sending
//   `{"title": 123}` causes `title.trim()` to throw TypeError.
//   These helpers validate type FIRST and return a descriptive 400-friendly
//   error rather than letting a TypeError bubble up as a 500.

import { isValidObjectId } from "mongoose";

/**
 * Coerce a body field to a trimmed string, or throw a 400-friendly Error.
 *
 * @param {unknown}  val       - raw value from req.body
 * @param {string}   field     - field name (used in error message)
 * @param {object}   [opts]
 * @param {number}   [opts.maxLen]  - hard max length (characters)
 * @param {boolean}  [opts.required=false] - throw if falsy after trim
 * @returns {string}
 */
export function toStr(val, field, { maxLen, required = false } = {}) {
  if (val === undefined || val === null) {
    if (required) throw Object.assign(new Error(`${field} is required`), { statusCode: 400 });
    return "";
  }
  if (typeof val !== "string") {
    throw Object.assign(
      new Error(`${field} must be a string, got ${Array.isArray(val) ? "array" : typeof val}`),
      { statusCode: 400 }
    );
  }
  const trimmed = val.trim();
  if (required && !trimmed) {
    throw Object.assign(new Error(`${field} cannot be empty`), { statusCode: 400 });
  }
  if (maxLen !== undefined && trimmed.length > maxLen) {
    throw Object.assign(
      new Error(`${field} must be ${maxLen} characters or fewer`),
      { statusCode: 400 }
    );
  }
  return trimmed;
}

/**
 * Coerce to integer, or throw a 400-friendly Error.
 *
 * @param {unknown} val
 * @param {string}  field
 * @param {object}  [opts]
 * @param {number}  [opts.min]
 * @param {number}  [opts.max]
 * @param {number}  [opts.default] - return this instead of throwing if val is absent
 * @returns {number}
 */
export function toInt(val, field, { min, max, default: def } = {}) {
  if ((val === undefined || val === null || val === "") && def !== undefined) return def;
  const n = parseInt(val, 10);
  if (!Number.isFinite(n)) {
    throw Object.assign(new Error(`${field} must be a whole number`), { statusCode: 400 });
  }
  if (min !== undefined && n < min) {
    throw Object.assign(new Error(`${field} must be at least ${min}`), { statusCode: 400 });
  }
  if (max !== undefined && n > max) {
    throw Object.assign(new Error(`${field} must be at most ${max}`), { statusCode: 400 });
  }
  return n;
}

/**
 * Assert a body value is a valid MongoDB ObjectId string.
 * Returns the raw string so it can be passed straight to findById.
 *
 * @param {unknown} val
 * @param {string}  field
 * @returns {string}
 */
export function toObjectId(val, field) {
  if (!val || typeof val !== "string" || !isValidObjectId(val)) {
    throw Object.assign(
      new Error(`${field} must be a valid ID`),
      { statusCode: 400 }
    );
  }
  return val;
}

/**
 * Assert a value is a non-empty array, or throw 400.
 *
 * @param {unknown} val
 * @param {string}  field
 * @param {object}  [opts]
 * @param {number}  [opts.minLen]
 * @param {number}  [opts.maxLen]
 * @returns {Array}
 */
export function toArray(val, field, { minLen = 1, maxLen } = {}) {
  if (!Array.isArray(val)) {
    throw Object.assign(new Error(`${field} must be an array`), { statusCode: 400 });
  }
  if (val.length < minLen) {
    throw Object.assign(new Error(`${field} must have at least ${minLen} item(s)`), { statusCode: 400 });
  }
  if (maxLen !== undefined && val.length > maxLen) {
    throw Object.assign(
      new Error(`${field} must have at most ${maxLen} item(s)`),
      { statusCode: 400 }
    );
  }
  return val;
}
