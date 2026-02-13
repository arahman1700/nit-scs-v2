import type { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.js';
import { getRedis } from '../config/redis.js';

// ── In-memory fallback ──────────────────────────────────────────────────

const requestCounts = new Map<string, { count: number; resetAt: number }>();

function inMemoryLimiter(
  key: string,
  maxRequests: number,
  windowMs: number,
): { allowed: boolean; remaining: number; retryAfterSec: number } {
  const now = Date.now();
  const entry = requestCounts.get(key);

  if (!entry || now > entry.resetAt) {
    requestCounts.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, retryAfterSec: 0 };
  }

  entry.count++;

  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }

  return { allowed: true, remaining: maxRequests - entry.count, retryAfterSec: 0 };
}

// ── Redis-backed limiter (atomic Lua script) ────────────────────────────

/**
 * Lua script: INCR + EXPIRE in a single atomic operation.
 * Returns [current_count, ttl_remaining].
 */
const RATE_LIMIT_LUA = `
  local current = redis.call('INCR', KEYS[1])
  if current == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
  end
  local ttl = redis.call('TTL', KEYS[1])
  return {current, ttl}
`;

async function redisLimiter(
  key: string,
  maxRequests: number,
  windowSec: number,
): Promise<{ allowed: boolean; remaining: number; retryAfterSec: number }> {
  const redis = getRedis();
  if (!redis) {
    return inMemoryLimiter(key, maxRequests, windowSec * 1000);
  }

  try {
    const result = (await redis.eval(RATE_LIMIT_LUA, 1, key, windowSec)) as [number, number];
    const current = result[0];
    const ttl = result[1];

    if (current > maxRequests) {
      return { allowed: false, remaining: 0, retryAfterSec: ttl > 0 ? ttl : windowSec };
    }
    return { allowed: true, remaining: maxRequests - current, retryAfterSec: 0 };
  } catch {
    // Fallback to in-memory on Redis failure
    return inMemoryLimiter(key, maxRequests, windowSec * 1000);
  }
}

// ── Public API ──────────────────────────────────────────────────────────

/**
 * General rate limiter middleware.
 * Uses Redis when available, falls back to in-memory.
 */
export function rateLimiter(maxRequests = 100, windowMs = 60_000) {
  const windowSec = Math.ceil(windowMs / 1000);

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || 'unknown';
    const key = `rl:global:${ip}`;

    redisLimiter(key, maxRequests, windowSec)
      .then(({ allowed, remaining, retryAfterSec }) => {
        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining));

        if (!allowed) {
          res.setHeader('Retry-After', retryAfterSec);
          sendError(res, 429, 'Too many requests. Please try again later.');
          return;
        }
        next();
      })
      .catch(() => next());
  };
}

/**
 * Strict auth rate limiter for sensitive endpoints (login, forgot-password).
 * 5 attempts per IP per 15-minute window.
 */
export function authRateLimiter(maxAttempts = 5, windowSec = 900) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || 'unknown';
    const key = `rl:auth:${ip}:${req.path}`;

    redisLimiter(key, maxAttempts, windowSec)
      .then(({ allowed, remaining, retryAfterSec }) => {
        res.setHeader('X-RateLimit-Limit', maxAttempts);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining));

        if (!allowed) {
          res.setHeader('Retry-After', retryAfterSec);
          sendError(res, 429, 'Too many attempts. Please try again later.');
          return;
        }
        next();
      })
      .catch(() => next());
  };
}

/**
 * Per-user rate limiter for AI endpoints.
 * Keys on userId (requires authenticate middleware to run first).
 * Default: 30 requests per hour per user.
 */
export function aiRateLimiter(maxRequests = 30, windowSec = 3600) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userId = (req as unknown as { user?: { userId?: string } }).user?.userId || 'anon';
    const key = `rl:ai:${userId}`;

    redisLimiter(key, maxRequests, windowSec)
      .then(({ allowed, remaining, retryAfterSec }) => {
        res.setHeader('X-RateLimit-Limit', maxRequests);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, remaining));

        if (!allowed) {
          res.setHeader('Retry-After', retryAfterSec);
          sendError(res, 429, 'AI chat rate limit exceeded. Please try again later.');
          return;
        }
        next();
      })
      .catch(() => next());
  };
}

// Periodic cleanup for in-memory fallback
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of requestCounts.entries()) {
    if (now > entry.resetAt) {
      requestCounts.delete(key);
    }
  }
}, 60_000);
