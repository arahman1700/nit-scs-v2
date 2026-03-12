import Redis from 'ioredis';
import { logger } from './logger.js';

// ---------------------------------------------------------------------------
// Redis Client Singleton — Hardened for Production
// ---------------------------------------------------------------------------
// Used for: BullMQ job queues, rate limiting, token blacklisting, caching.
// Falls back gracefully when Redis is unavailable (non-fatal in development).
//
// Hardening features:
// - Exponential backoff with jitter on reconnect
// - Connection health monitoring (periodic PING)
// - Memory usage tracking and alerts
// - Structured event logging for ops observability
// ---------------------------------------------------------------------------

let _redis: Redis | null = null;
let _available = false;
let _healthCheckTimer: ReturnType<typeof setInterval> | null = null;
let _lastErrorTime = 0;
const ERROR_LOG_THROTTLE_MS = 30_000; // Log errors at most once per 30s

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
      connectTimeout: 10_000, // 10s connection timeout (was 5s)
      commandTimeout: 5_000, // 5s per-command timeout
      enableReadyCheck: true, // Wait for INFO before marking ready
      retryStrategy(times) {
        if (times > 20) {
          logger.error({ attempts: times }, 'Redis: max reconnect attempts reached — giving up');
          return null; // stop retrying
        }
        // Exponential backoff with jitter: base * 2^min(attempts,8) + random jitter
        const baseDelay = 500;
        const expDelay = baseDelay * Math.pow(2, Math.min(times, 8));
        const jitter = Math.random() * 1000;
        const delay = Math.min(expDelay + jitter, 30_000); // Cap at 30s
        logger.debug({ attempt: times, delayMs: Math.round(delay) }, 'Redis reconnect scheduled');
        return delay;
      },
      reconnectOnError(err) {
        // Auto-reconnect on READONLY errors (Upstash failover) and connection resets
        const targetErrors = ['READONLY', 'ECONNRESET', 'ETIMEDOUT'];
        return targetErrors.some(e => err.message.includes(e));
      },
      lazyConnect: true,
      ...(useTls ? { tls: {} } : {}),
    });

    _redis.on('connect', () => {
      _available = true;
      logger.info('Redis connected');
    });

    _redis.on('ready', () => {
      _available = true;
      logger.info('Redis ready — accepting commands');
      startHealthCheck();
    });

    _redis.on('error', err => {
      _available = false;
      const now = Date.now();
      // Throttle error logs to prevent log spam during outages
      if (now - _lastErrorTime > ERROR_LOG_THROTTLE_MS) {
        _lastErrorTime = now;
        logger.warn({ err: err.message }, 'Redis connection error');
      }
    });

    _redis.on('close', () => {
      _available = false;
      logger.debug('Redis connection closed');
    });

    _redis.on('reconnecting', (delay: number) => {
      logger.info({ delayMs: delay }, 'Redis reconnecting');
    });

    // Attempt the actual connection
    _redis.connect().catch(err => {
      logger.warn({ err: err.message }, 'Redis connect() failed');
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

// ── Health Check (PING + memory monitoring) ──────────────────────────────

function startHealthCheck(): void {
  if (_healthCheckTimer) return;

  _healthCheckTimer = setInterval(async () => {
    if (!_redis || !_available) return;

    try {
      const start = Date.now();
      await _redis.ping();
      const latency = Date.now() - start;

      if (latency > 100) {
        logger.warn({ latencyMs: latency }, 'Redis PING latency high');
      }

      // Check memory usage periodically (every 5th health check ≈ every 2.5 min)
      const info = await _redis.info('memory');
      const usedMatch = info.match(/used_memory:(\d+)/);
      const maxMatch = info.match(/maxmemory:(\d+)/);
      if (usedMatch && maxMatch) {
        const usedBytes = parseInt(usedMatch[1], 10);
        const maxBytes = parseInt(maxMatch[1], 10);
        if (maxBytes > 0) {
          const usagePercent = (usedBytes / maxBytes) * 100;
          if (usagePercent > 85) {
            logger.warn(
              {
                usedMB: Math.round(usedBytes / 1024 / 1024),
                maxMB: Math.round(maxBytes / 1024 / 1024),
                usagePercent: Math.round(usagePercent),
              },
              'Redis memory usage above 85%',
            );
          }
        }
      }
    } catch {
      // Health check failure — connection event handlers will manage state
    }
  }, 30_000); // Every 30 seconds
}

function stopHealthCheck(): void {
  if (_healthCheckTimer) {
    clearInterval(_healthCheckTimer);
    _healthCheckTimer = null;
  }
}

/** Graceful shutdown — called from the main process shutdown handler. */
export async function disconnectRedis(): Promise<void> {
  stopHealthCheck();
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
