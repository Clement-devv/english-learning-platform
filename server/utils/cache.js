// server/utils/cache.js
// Thin Redis cache wrapper for database query results.
// Falls back to running the query directly when Redis is unavailable.
//
// Usage:
//   const teacher = await cachedQuery(
//     `teacher:${id}`,   // cache key
//     60,                // TTL in seconds
//     () => Teacher.findById(id).lean()
//   );
//
//   // Invalidate on update:
//   await invalidateCache(`teacher:${id}`);

import redisClient from '../config/redis.js';
import logger from './logger.js';

/**
 * Return cached value or execute queryFn, cache its result, then return it.
 * @param {string} key - Redis key
 * @param {number} ttlSeconds - How long to cache the result
 * @param {() => Promise<any>} queryFn - The database query to run on cache miss
 */
export async function cachedQuery(key, ttlSeconds, queryFn) {
  if (!redisClient) return queryFn();

  try {
    const cached = await redisClient.get(key);
    if (cached !== null) return JSON.parse(cached);
  } catch (err) {
    logger.warn(`Cache read error for key "${key}":`, { error: err?.message });
  }

  const result = await queryFn();

  try {
    if (result !== null && result !== undefined) {
      await redisClient.setex(key, ttlSeconds, JSON.stringify(result));
    }
  } catch (err) {
    logger.warn(`Cache write error for key "${key}":`, { error: err?.message });
  }

  return result;
}

/**
 * Delete one or more cache keys.
 * Call this in update/delete routes to keep cache consistent.
 * @param {...string} keys
 */
export async function invalidateCache(...keys) {
  if (!redisClient || keys.length === 0) return;
  try {
    await redisClient.del(...keys);
  } catch (err) {
    logger.warn('Cache invalidation error:', { error: err?.message });
  }
}
