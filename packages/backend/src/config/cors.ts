import type { CorsOptions } from 'cors';

export function getCorsOptions(): CorsOptions {
  const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map(o => o.trim());

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
