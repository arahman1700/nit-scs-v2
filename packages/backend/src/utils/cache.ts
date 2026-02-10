// ---------------------------------------------------------------------------
// Redis Cache Utility
// ---------------------------------------------------------------------------
// Provides a simple cache-aside pattern with configurable TTL.
// Falls back gracefully when Redis is unavailable — the function runs
// without caching, ensuring the app always works without Redis.
// ---------------------------------------------------------------------------

import { getRedis, isRedisAvailable } from '../config/redis.js';
import { logger } from '../config/logger.js';

/** Default TTL values in seconds */
export const CacheTTL = {
  /** Dashboard stats — refresh every 30 seconds */
  DASHBOARD_STATS: 30,
  /** Inventory summary — refresh every 60 seconds */
  INVENTORY_SUMMARY: 60,
  /** Document counts — refresh every 30 seconds */
  DOCUMENT_COUNTS: 30,
  /** SLA compliance — refresh every 2 minutes */
  SLA_COMPLIANCE: 120,
  /** Top projects — refresh every 2 minutes */
  TOP_PROJECTS: 120,
  /** Recent activity — refresh every 15 seconds */
  RECENT_ACTIVITY: 15,
  /** Labor productivity — refresh every 5 minutes */
  LABOR_PRODUCTIVITY: 300,
} as const;

/** Cache key prefix to namespace all keys */
const PREFIX = 'nit-scs:cache:';

/**
 * Cache-aside wrapper. Attempts to read from Redis first; on miss, calls
 * the fetcher function, stores the result, and returns it.
 *
 * @param key   - Unique cache key (will be prefixed automatically)
 * @param ttl   - Time-to-live in seconds
 * @param fetcher - Async function that fetches the fresh data
 * @returns The cached or freshly fetched data
 */
export async function cached<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
  if (!isRedisAvailable()) {
    // Redis not available — fall through to the fetcher
    return fetcher();
  }

  const redis = getRedis();
  if (!redis) return fetcher();

  const fullKey = `${PREFIX}${key}`;

  try {
    // Try cache hit
    const raw = await redis.get(fullKey);
    if (raw !== null) {
      return JSON.parse(raw) as T;
    }
  } catch (err) {
    logger.warn({ err, key: fullKey }, 'Cache read error — falling through to fetcher');
  }

  // Cache miss — fetch fresh data
  const data = await fetcher();

  try {
    await redis.setex(fullKey, ttl, JSON.stringify(data));
  } catch (err) {
    logger.warn({ err, key: fullKey }, 'Cache write error — data returned uncached');
  }

  return data;
}

/**
 * Invalidate one or more cache keys.
 * Useful when a mutation changes data that is cached (e.g. inventory update).
 */
export async function invalidateCache(...keys: string[]): Promise<void> {
  if (!isRedisAvailable()) return;

  const redis = getRedis();
  if (!redis) return;

  const fullKeys = keys.map(k => `${PREFIX}${k}`);

  try {
    await redis.del(...fullKeys);
  } catch (err) {
    logger.warn({ err, keys: fullKeys }, 'Cache invalidation error');
  }
}

/**
 * Invalidate all cache keys matching a pattern.
 * Uses SCAN to avoid blocking Redis.
 */
export async function invalidateCachePattern(pattern: string): Promise<void> {
  if (!isRedisAvailable()) return;

  const redis = getRedis();
  if (!redis) return;

  const fullPattern = `${PREFIX}${pattern}`;

  try {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', fullPattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch (err) {
    logger.warn({ err, pattern: fullPattern }, 'Cache pattern invalidation error');
  }
}
