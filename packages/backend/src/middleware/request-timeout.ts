import type { Request, Response, NextFunction } from 'express';
import { getEnv } from '../config/env.js';

/**
 * Middleware that terminates requests exceeding the configured timeout.
 * Default: 30 seconds (configurable via REQUEST_TIMEOUT_MS env var).
 */
export function requestTimeout(req: Request, res: Response, next: NextFunction): void {
  const timeoutMs = getEnv().REQUEST_TIMEOUT_MS;
  const timer = setTimeout(() => {
    if (!res.headersSent) {
      res.status(408).json({
        success: false,
        message: `Request timeout after ${timeoutMs}ms`,
        code: 'REQUEST_TIMEOUT',
      });
    }
  }, timeoutMs);

  res.on('finish', () => clearTimeout(timer));
  res.on('close', () => clearTimeout(timer));
  next();
}
