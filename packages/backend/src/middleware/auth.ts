import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, type JwtPayload } from '../utils/jwt.js';
import { isTokenBlacklisted } from '../services/auth.service.js';
import { sendError } from '../utils/response.js';
import { Sentry } from '../config/sentry.js';
import { logger } from '../config/logger.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
      rawAccessToken?: string;
    }
  }
}

/**
 * JWT authentication middleware.
 * Verifies the access token, checks the Redis blacklist for revoked tokens,
 * and attaches the decoded payload to `req.user`.
 *
 * Express 5 supports async middleware — errors are automatically forwarded to
 * the global error handler.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    sendError(res, 401, 'Authentication required');
    return;
  }

  const token = authHeader.slice(7);

  let payload: JwtPayload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    sendError(res, 401, 'Invalid or expired token');
    return;
  }

  // Check Redis blacklist for revoked tokens
  if (payload.jti) {
    try {
      const blacklisted = await isTokenBlacklisted(payload.jti);
      if (blacklisted) {
        sendError(res, 401, 'Token has been revoked');
        return;
      }
    } catch (err) {
      // Redis failure — in-memory blacklist still checked inside isTokenBlacklisted
      logger.warn({ err, jti: payload.jti }, 'Redis blacklist check failed — in-memory fallback used');
    }
  }

  req.user = payload;
  req.rawAccessToken = token;
  Sentry.setUser({ id: payload.userId, email: payload.email });
  next();
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith('Bearer ')) {
    try {
      req.user = verifyAccessToken(authHeader.slice(7));
    } catch {
      // Ignore invalid tokens for optional auth
    }
  }

  next();
}
