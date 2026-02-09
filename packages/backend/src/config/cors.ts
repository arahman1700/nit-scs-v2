import type { CorsOptions } from 'cors';

export function getCorsOptions(): CorsOptions {
  const origin = process.env.CORS_ORIGIN || 'http://localhost:3000';
  return {
    origin: origin.split(',').map(o => o.trim()),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    credentials: true,
    maxAge: 86400,
  };
}
