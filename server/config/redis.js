// server/config/redis.js
// Shared Redis client for rate limiters (and anything else that needs Redis).
//
// Behaviour:
//   - REDIS_URL set   → connects to Redis, logs status
//   - REDIS_URL unset → redisClient is null, callers fall back to memory store
//
// Errors never crash the server — Redis is an optional performance layer.

import Redis from "ioredis";
import logger from "../utils/logger.js";

let redisClient = null;

if (process.env.REDIS_URL) {
  redisClient = new Redis(process.env.REDIS_URL, {
    // Don't queue commands while disconnected — fail fast so the app keeps
    // working (memory store kicks in) rather than accumulating a queue.
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    // Reconnect with exponential back-off, capped at 30 s
    retryStrategy: (times) => Math.min(times * 500, 30_000),
    lazyConnect: true,
  });

  redisClient.on("connect",   ()    => logger.info("✅ Redis connected"));
  redisClient.on("ready",     ()    => logger.info("✅ Redis ready"));
  redisClient.on("error",     (err) => logger.warn("⚠️  Redis error:", err.message));
  redisClient.on("close",     ()    => logger.warn("⚠️  Redis connection closed"));
  redisClient.on("reconnecting", () => logger.info("🔄 Redis reconnecting…"));
} else {
  if (process.env.NODE_ENV === "production") {
    logger.warn(
      "REDIS_URL not set — rate limiters using in-memory store. " +
      "Counts reset on restart and are NOT shared across instances. " +
      "Set REDIS_URL in production for persistent rate limiting."
    );
  }
}

export default redisClient;
