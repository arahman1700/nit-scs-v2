import type { Request } from 'express';

/**
 * Safely extract the client IP address from an Express 5 request.
 * Express 5 may return `string | string[]` for req.ip.
 */
export function clientIp(req: Request): string | undefined {
  const ip = req.ip;
  if (Array.isArray(ip)) return ip[0];
  return ip;
}
