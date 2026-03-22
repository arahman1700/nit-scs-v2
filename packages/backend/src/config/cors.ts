import type { CorsOptions } from 'cors';
import { logger } from './logger.js';

export function getCorsOptions(): CorsOptions {
  const rawOrigins = process.env.CORS_ORIGIN || 'http://localhost:3000';
  const allowedOrigins = rawOrigins.split(',').map(o => o.trim()).filter(Boolean);

  // Production safety checks (SECR-04)
  if (process.env.NODE_ENV === 'production') {
    if (allowedOrigins.includes('*')) {
      throw new Error('CORS_ORIGIN must not be "*" in production');
    }
    if (allowedOrigins.some(o => o.includes('localhost') || o.includes('127.0.0.1'))) {
      logger.warn('CORS_ORIGIN contains localhost in production mode — this is likely a misconfiguration');
    }
  }

  logger.info({ origins: allowedOrigins }, 'CORS configured with allowed origins');

  return {
    origin: (requestOrigin, callback) => {
      // Allow server-to-server requests (no Origin header)
      if (!requestOrigin) return callback(null, true);
      if (allowedOrigins.includes(requestOrigin)) return callback(null, true);
      callback(new Error(`Origin ${requestOrigin} not allowed by CORS`));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    credentials: true,
    maxAge: 86400,
  };
}
