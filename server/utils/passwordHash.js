// server/utils/passwordHash.js
// Password hashing for the running server. Native `bcrypt` hashes on libuv's
// thread pool, so a burst of logins no longer freezes the event loop: measured
// locally, 60 simultaneous checks took 46 s with bcryptjs (main thread frozen up
// to 6 s, stalling every live class) vs 12 s with native bcrypt (max stall 16 ms).
// Falls back to bcryptjs if the native build can't load on this platform.
// Both produce/accept the same $2a$/$2b$ hashes, so existing passwords keep working.
import { createRequire } from "module";
import bcryptjs from "bcryptjs";
import logger from "./logger.js";

let impl = bcryptjs;
try {
  impl = createRequire(import.meta.url)("bcrypt");
} catch (err) {
  logger.warn("Native bcrypt unavailable — using bcryptjs (logins will block the event loop)", { error: err?.message });
}

const passwordHash = {
  hash: (password, rounds) => impl.hash(password, rounds),
  compare: (password, hashed) => impl.compare(password, hashed),
};

export default passwordHash;
