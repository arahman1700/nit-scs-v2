import Redis from 'ioredis';
import { logger } from './logger.js';

// ---------------------------------------------------------------------------
// Redis Client Singleton
// ---------------------------------------------------------------------------
// Used for: rate limiting, token blacklisting, caching.
// Falls back gracefully when Redis is unavailable (non-fatal in development).
// ---------------------------------------------------------------------------

let _redis: Redis | null = null;
let _available = false;

/**
 * Get the shared Redis client.  Created lazily on first call.
 * In production the connection is required; in development it is optional.
 */
export function getRedis(): Redis | null {
  if (_redis) return _available ? _redis : null;

  const url = process.env.REDIS_URL || 'redis://localhost:6379';

  // Upstash and other managed Redis providers use rediss:// (TLS).
  // ioredis parses the protocol automatically, but we add explicit TLS
  // options for reliability across environments.
  const useTls = url.startsWith('rediss://');

  try {
    _redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      connectTimeout: 5000, // 5 s connection timeout
      retryStrategy(times) {
        if (times > 5) {
          logger.warn('Redis: max reconnect attempts reached — giving up');
          return null; // stop retrying
        }
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true, // don't connect until first command
      ...(useTls ? { tls: {} } : {}),
    });

    _redis.on('connect', () => {
      _available = true;
      logger.info('Redis connected');
    });

    _redis.on('error', err => {
      _available = false;
      // Only log once per error burst to avoid log spam
      logger.warn({ err: err.message }, 'Redis connection error');
    });

    _redis.on('close', () => {
      _available = false;
    });

    // Attempt the actual connection
    _redis.connect().catch(() => {
      // Handled by the 'error' event — swallow here so the app continues
      if (process.env.NODE_ENV === 'production') {
        logger.error('Redis is required in production but failed to connect');
      }
    });
  } catch (err) {
    logger.warn({ err }, 'Redis initialisation failed — features will degrade');
    _redis = null;
  }

  return _available ? _redis : null;
}

/** Check whether Redis is currently connected and usable. */
export function isRedisAvailable(): boolean {
  return _available && _redis !== null;
}

/** Graceful shutdown — called from the main process shutdown handler. */
export async function disconnectRedis(): Promise<void> {
  if (_redis) {
    try {
      await _redis.quit();
      logger.info('Redis disconnected');
    } catch {
      _redis.disconnect();
    }
    _redis = null;
    _available = false;
  }
}
