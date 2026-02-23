// ---------------------------------------------------------------------------
// Health Check Endpoint
// ---------------------------------------------------------------------------
// Returns comprehensive health status including:
// - Database connectivity (PostgreSQL via Prisma)
// - Redis connectivity
// - Memory usage (RSS, heap)
// - Process uptime
// ---------------------------------------------------------------------------

import type { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { getRedis, isRedisAvailable } from '../config/redis.js';
import { comparePassword, hashPassword } from '../utils/password.js';

interface ComponentStatus {
  status: 'up' | 'down';
  latencyMs?: number;
  message?: string;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  uptime: number;
  components: {
    database: ComponentStatus;
    redis: ComponentStatus;
  };
  memory: {
    rssBytes: number;
    heapUsedBytes: number;
    heapTotalBytes: number;
    externalBytes: number;
    rssMB: string;
    heapUsedMB: string;
  };
}

export async function healthCheck(_req: Request, res: Response): Promise<void> {
  const _startTime = Date.now();

  // ── Database Check ──────────────────────────────────────────────────────
  let dbStatus: ComponentStatus;
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbStatus = { status: 'up', latencyMs: Date.now() - dbStart };
  } catch (err) {
    dbStatus = {
      status: 'down',
      message: err instanceof Error ? err.message : 'Unknown database error',
    };
  }

  // ── Redis Check ─────────────────────────────────────────────────────────
  let redisStatus: ComponentStatus;
  if (!isRedisAvailable()) {
    redisStatus = { status: 'down', message: 'Not connected' };
  } else {
    try {
      const redis = getRedis();
      const redisStart = Date.now();
      await redis!.ping();
      redisStatus = { status: 'up', latencyMs: Date.now() - redisStart };
    } catch (err) {
      redisStatus = {
        status: 'down',
        message: err instanceof Error ? err.message : 'Unknown Redis error',
      };
    }
  }

  // ── Memory Stats ────────────────────────────────────────────────────────
  const mem = process.memoryUsage();
  const toMB = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

  // ── Overall Status ──────────────────────────────────────────────────────
  const dbUp = dbStatus.status === 'up';
  const redisUp = redisStatus.status === 'up';

  let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  if (dbUp && redisUp) {
    overallStatus = 'healthy';
  } else if (dbUp) {
    // Redis down is degraded (non-fatal)
    overallStatus = 'degraded';
  } else {
    // Database down is unhealthy
    overallStatus = 'unhealthy';
  }

  const response: HealthResponse = {
    status: overallStatus,
    version: 'v1',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    components: {
      database: dbStatus,
      redis: redisStatus,
    },
    memory: {
      rssBytes: mem.rss,
      heapUsedBytes: mem.heapUsed,
      heapTotalBytes: mem.heapTotal,
      externalBytes: mem.external,
      rssMB: `${toMB(mem.rss)} MB`,
      heapUsedMB: `${toMB(mem.heapUsed)} MB`,
    },
  };

  const httpStatus = overallStatus === 'unhealthy' ? 503 : 200;
  res.status(httpStatus).json(response);
}

/**
 * TEMPORARY diagnostic endpoint — remove after debugging login issue.
 * Tests bcrypt hash/compare and checks admin user state.
 */
export async function authDiagnostic(_req: Request, res: Response): Promise<void> {
  try {
    const testPw = 'Admin@2026!';
    const freshHash = await hashPassword(testPw);
    const freshMatch = await comparePassword(testPw, freshHash);

    const admin = await prisma.employee.findUnique({
      where: { email: 'admin@nit.sa' },
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        passwordHash: true,
        systemRole: true,
      },
    });

    let dbMatch = false;
    let hashPrefix = 'N/A';
    let hashLen = 0;
    if (admin?.passwordHash) {
      hashPrefix = admin.passwordHash.substring(0, 10);
      hashLen = admin.passwordHash.length;
      dbMatch = await comparePassword(testPw, admin.passwordHash);
    }

    res.json({
      freshHashWorks: freshMatch,
      adminExists: !!admin,
      adminActive: admin?.isActive ?? null,
      adminRole: admin?.systemRole ?? null,
      hashPrefix,
      hashLen,
      dbPasswordMatch: dbMatch,
    });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
