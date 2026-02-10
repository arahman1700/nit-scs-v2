// ---------------------------------------------------------------------------
// Structured Request Logger Middleware
// ---------------------------------------------------------------------------
// Replaces morgan with structured JSON logging for production observability.
// Logs: method, url, statusCode, responseTime, requestId, correlationId, userId.
// Generates a correlation ID for request tracing.
// ---------------------------------------------------------------------------

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';
import { createLogger } from '../utils/logger.js';

const log = createLogger('http');

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const correlationId = crypto.randomUUID();
  const start = Date.now();

  // Attach correlation ID to request for downstream use
  (req as any).correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);

  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const method = req.method;
    const url = req.originalUrl || req.url;
    const requestId = req.headers['x-request-id'] as string | undefined;
    const userId = req.user?.userId;

    const logData = {
      correlationId,
      method,
      url,
      statusCode,
      durationMs: duration,
      duration: `${duration}ms`,
      requestId,
      userId,
      ip: req.ip,
      userAgent: req.headers['user-agent']?.substring(0, 100),
      contentLength: res.getHeader('content-length'),
    };

    // Log errors at error level, slow requests at warn, rest at info
    if (statusCode >= 500) {
      logger.error(logData, `${method} ${url} ${statusCode} ${duration}ms`);
      log.error(logData, 'Request failed');
    } else if (statusCode >= 400 || duration > 5000) {
      logger.warn(logData, `${method} ${url} ${statusCode} ${duration}ms`);
      log.warn(logData, 'Client error');
    } else {
      logger.info(logData, `${method} ${url} ${statusCode} ${duration}ms`);
      log.info(logData, 'Request completed');
    }
  });

  next();
}
