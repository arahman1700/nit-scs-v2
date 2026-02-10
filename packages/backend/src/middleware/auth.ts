import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, type JwtPayload } from '../utils/jwt.js';
import { isTokenBlacklisted } from '../services/auth.service.js';
import { sendError } from '../utils/response.js';
import { Sentry } from '../config/sentry.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
      rawAccessToken?: string;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    sendError(res, 401, 'Authentication required');
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = verifyAccessToken(token);

    // Check Redis blacklist for revoked tokens (async, non-blocking)
    if (payload.jti) {
      isTokenBlacklisted(payload.jti)
        .then(blacklisted => {
          if (blacklisted) {
            sendError(res, 401, 'Token has been revoked');
            return;
          }
          req.user = payload;
          req.rawAccessToken = token;
          Sentry.setUser({ id: payload.userId, email: payload.email });
          next();
        })
        .catch(() => {
          // Redis failure — allow request (graceful degradation)
          req.user = payload;
          req.rawAccessToken = token;
          Sentry.setUser({ id: payload.userId, email: payload.email });
          next();
        });
    } else {
      // No jti (legacy token) — allow but mark for future revocation
      req.user = payload;
      req.rawAccessToken = token;
      Sentry.setUser({ id: payload.userId, email: payload.email });
      next();
    }
  } catch {
    sendError(res, 401, 'Invalid or expired token');
  }
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
