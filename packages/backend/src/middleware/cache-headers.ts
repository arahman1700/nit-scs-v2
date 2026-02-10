import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

/**
 * Adds ETag header for GET responses and handles If-None-Match for conditional requests.
 * Use on master data routes that change infrequently.
 */
export function conditionalCache(maxAgeSec = 60) {
  return (_req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (_req.method !== 'GET') return next();

    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => {
      const bodyStr = JSON.stringify(body);
      const etag = `"${crypto.createHash('md5').update(bodyStr).digest('hex')}"`;

      res.setHeader('ETag', etag);
      res.setHeader('Cache-Control', `private, max-age=${maxAgeSec}, must-revalidate`);

      if (_req.headers['if-none-match'] === etag) {
        res.status(304).end();
        return res;
      }

      return originalJson(body);
    };

    next();
  };
}
