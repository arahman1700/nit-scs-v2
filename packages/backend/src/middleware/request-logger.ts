// ---------------------------------------------------------------------------
// Structured Request Logger Middleware
// ---------------------------------------------------------------------------
// Replaces morgan with structured JSON logging for production observability.
// Logs: method, url, statusCode, responseTime, requestId, userId.
// ---------------------------------------------------------------------------

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger.js';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  // Log when response finishes
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    const method = req.method;
    const url = req.originalUrl || req.url;
    const requestId = req.headers['x-request-id'] as string | undefined;
    const userId = req.user?.userId;

    const logData = {
      method,
      url,
      statusCode,
      durationMs: duration,
      requestId,
      userId,
      contentLength: res.getHeader('content-length'),
    };

    // Log errors at error level, slow requests at warn, rest at info
    if (statusCode >= 500) {
      logger.error(logData, `${method} ${url} ${statusCode} ${duration}ms`);
    } else if (statusCode >= 400 || duration > 5000) {
      logger.warn(logData, `${method} ${url} ${statusCode} ${duration}ms`);
    } else {
      logger.info(logData, `${method} ${url} ${statusCode} ${duration}ms`);
    }
  });

  next();
}
