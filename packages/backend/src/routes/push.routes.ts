// ============================================================================
// Push Notification Routes — Web Push subscription management
// ============================================================================

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { sendSuccess, sendError, sendCreated, sendNoContent } from '../utils/response.js';
import * as pushService from '../services/push-notification.service.js';

const router = Router();

// ── GET /vapid-key — Public VAPID key (authenticated) ───────────────────────

router.get('/vapid-key', authenticate, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const publicKey = pushService.getVapidPublicKey();
    sendSuccess(res, { publicKey });
  } catch (err) {
    next(err);
  }
});

// ── POST /subscribe — Register push subscription ────────────────────────────

router.post('/subscribe', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { endpoint, keys } = req.body as {
      endpoint?: string;
      keys?: { p256dh?: string; auth?: string };
    };

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      sendError(res, 400, 'Missing required fields: endpoint, keys.p256dh, keys.auth');
      return;
    }

    const userAgent = req.headers['user-agent'];
    const subscription = await pushService.subscribe(
      req.user!.userId,
      { endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
      userAgent,
    );

    sendCreated(res, subscription);
  } catch (err) {
    next(err);
  }
});

// ── DELETE /unsubscribe — Remove push subscription ──────────────────────────

router.delete('/unsubscribe', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { endpoint } = req.body as { endpoint?: string };

    if (!endpoint) {
      sendError(res, 400, 'Missing required field: endpoint');
      return;
    }

    await pushService.unsubscribe(req.user!.userId, endpoint);
    sendNoContent(res);
  } catch (err) {
    next(err);
  }
});

// ── POST /test — Send test notification to current user (admin only) ────────

router.post('/test', authenticate, requireRole('admin'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    await pushService.sendPushToUser(req.user!.userId, {
      title: 'NIT SCS — Test Notification',
      body: 'Push notifications are working correctly!',
      url: '/notifications',
      tag: 'test',
    });

    sendSuccess(res, { message: 'Test notification sent' });
  } catch (err) {
    next(err);
  }
});

// ── POST /action — Handle push notification action (approve/reject) ─────

router.post('/action', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { action, documentType, documentId } = req.body as {
      action?: string;
      documentType?: string;
      documentId?: string;
    };

    if (!action || !documentType || !documentId) {
      sendError(res, 400, 'Missing required fields: action, documentType, documentId');
      return;
    }

    // Log the action — full approval integration can be added later
    console.log(`[Push Action] ${action} on ${documentType}/${documentId} by user ${req.user!.userId}`);

    sendSuccess(res, { message: `Action "${action}" received for ${documentType} ${documentId}` });
  } catch (err) {
    next(err);
  }
});

export default router;
