import type { Request, Response, NextFunction } from 'express';
import { getRedis, isRedisAvailable } from '../../../config/redis.js';
import { prisma } from '../../../utils/prisma.js';
import { authenticate } from '../../../middleware/auth.js';

interface ComponentStatus {
  status: 'up' | 'down';
  latencyMs?: number;
  message?: string;
}

interface DetailedHealthResponse {
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

interface PublicHealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
}

/**
 * Compute overall health status by checking DB and Redis.
 * Returns the overall status plus detailed component info.
 */
async function computeHealthStatus(): Promise<{
  overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  dbStatus: ComponentStatus;
  redisStatus: ComponentStatus;
}> {
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

  const dbUp = dbStatus.status === 'up';
  const redisUp = redisStatus.status === 'up';

  let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
  if (dbUp && redisUp) {
    overallStatus = 'healthy';
  } else if (dbUp) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'unhealthy';
  }

  return { overallStatus, dbStatus, redisStatus };
}

/**
 * Public health check endpoint.
 * Returns only status and timestamp — no internal details.
 */
export async function healthCheck(_req: Request, res: Response): Promise<void> {
  const { overallStatus } = await computeHealthStatus();

  const response: PublicHealthResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
  };

  const httpStatus = overallStatus === 'unhealthy' ? 503 : 200;
  res.status(httpStatus).json(response);
}

/**
 * Detailed health check endpoint (admin-only).
 * Returns full component status, memory usage, and uptime.
 * Must be placed behind `authenticate` middleware.
 */
export async function detailedHealthCheck(req: Request, res: Response): Promise<void> {
  // Only admin users can see detailed health info
  if (req.user?.systemRole !== 'admin') {
    const { overallStatus } = await computeHealthStatus();
    const response: PublicHealthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
    };
    const httpStatus = overallStatus === 'unhealthy' ? 503 : 200;
    res.status(httpStatus).json(response);
    return;
  }

  const { overallStatus, dbStatus, redisStatus } = await computeHealthStatus();

  const mem = process.memoryUsage();
  const toMB = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

  const response: DetailedHealthResponse = {
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

/** Middleware chain for the authenticated detailed health endpoint */
export const detailedHealthMiddleware = [authenticate as (req: Request, res: Response, next: NextFunction) => void];
