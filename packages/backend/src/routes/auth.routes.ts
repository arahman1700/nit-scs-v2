import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rate-limiter.js';
import {
  loginSchema,
  refreshSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../schemas/auth.schema.js';
import * as authService from '../services/auth.service.js';
import { sendSuccess, sendError } from '../utils/response.js';

const router = Router();

/** Cookie options for the httpOnly refresh token cookie */
const REFRESH_COOKIE_NAME = 'nit_refresh_token';
const REFRESH_COOKIE_PATH = '/api/v1/auth/refresh';
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days

// POST /api/auth/login — 5 attempts per 15 min per IP
router.post(
  '/login',
  authRateLimiter(5, 900),
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;
      const result = await authService.login(email, password);

      // Set refresh token as httpOnly cookie for CSRF protection
      res.cookie(REFRESH_COOKIE_NAME, result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: REFRESH_COOKIE_MAX_AGE,
        path: REFRESH_COOKIE_PATH, // Only sent to refresh endpoint
      });

      sendSuccess(res, result);
    } catch (err) {
      if (err instanceof Error && err.message.includes('Invalid')) {
        sendError(res, 401, err.message);
        return;
      }
      next(err);
    }
  },
);

// POST /api/auth/refresh
router.post('/refresh', validate(refreshSchema), async (req: Request, res: Response, _next: NextFunction) => {
  try {
    // Read refresh token from httpOnly cookie first, fall back to request body
    const refreshToken: string | undefined = req.cookies?.[REFRESH_COOKIE_NAME] || req.body.refreshToken;
    if (!refreshToken) {
      sendError(res, 401, 'Refresh token is required');
      return;
    }

    const tokens = await authService.refreshTokens(refreshToken);

    // Update the httpOnly cookie with the new rotated refresh token
    res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: REFRESH_COOKIE_MAX_AGE,
      path: REFRESH_COOKIE_PATH,
    });

    sendSuccess(res, tokens);
  } catch {
    sendError(res, 401, 'Invalid refresh token');
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await authService.getMe(req.user!.userId);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/change-password
router.post(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { currentPassword, newPassword } = req.body;
      await authService.changePassword(req.user!.userId, currentPassword, newPassword);
      sendSuccess(res, { message: 'Password changed successfully' });
    } catch (err) {
      if (err instanceof Error && err.message.includes('incorrect')) {
        sendError(res, 400, err.message);
        return;
      }
      next(err);
    }
  },
);

// POST /api/auth/forgot-password — 3 attempts per 15 min per IP
router.post(
  '/forgot-password',
  authRateLimiter(3, 900),
  validate(forgotPasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email } = req.body;
      await authService.forgotPassword(email);
      sendSuccess(res, { message: 'If an account with that email exists, a reset code has been sent.' });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/auth/reset-password — 5 attempts per 15 min per IP
router.post(
  '/reset-password',
  authRateLimiter(5, 900),
  validate(resetPasswordSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, code, newPassword } = req.body;
      await authService.resetPassword(email, code, newPassword);
      sendSuccess(res, { message: 'Password has been reset successfully.' });
    } catch (err) {
      if (err instanceof Error && err.message.includes('Invalid or expired')) {
        sendError(res, 400, err.message);
        return;
      }
      next(err);
    }
  },
);

// POST /api/auth/logout — revokes tokens server-side
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    const accessToken = req.rawAccessToken || '';
    // Read refresh token from cookie or body for backward compatibility
    const refreshToken: string | undefined =
      req.cookies?.[REFRESH_COOKIE_NAME] || (req.body as { refreshToken?: string }).refreshToken;
    await authService.logout(accessToken, refreshToken);

    // Clear the httpOnly refresh token cookie
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });

    sendSuccess(res, { message: 'Logged out successfully' });
  } catch {
    // Even if revocation fails, clear the cookie and acknowledge the logout
    res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
    sendSuccess(res, { message: 'Logged out successfully' });
  }
});

export default router;
