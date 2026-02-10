import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { sendSuccess, sendCreated, sendError, sendNoContent } from '../utils/response.js';
import * as notificationService from '../services/notification.service.js';
import { notificationListSchema, notificationCreateSchema } from '../schemas/system.schema.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

// ── GET / — List current user's notifications ───────────────────────────

router.get('/', validate(notificationListSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, pageSize, unreadOnly } = (res.locals.validatedQuery || req.query) as {
      page: number;
      pageSize: number;
      unreadOnly: boolean;
    };

    const result = await notificationService.getNotifications(req.user!.userId, {
      page,
      pageSize,
      unreadOnly,
    });

    sendSuccess(res, result.data, {
      page,
      pageSize,
      total: result.total,
    });
  } catch (err) {
    next(err);
  }
});

// ── GET /unread-count — Get unread count ────────────────────────────────

router.get('/unread-count', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await notificationService.getUnreadCount(req.user!.userId);
    sendSuccess(res, { unreadCount: count });
  } catch (err) {
    next(err);
  }
});

// ── POST / — Create notification (admin/manager only) ──────────────────

router.post(
  '/',
  requireRole('admin', 'manager'),
  validate(notificationCreateSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const io = req.app.get('io') as SocketIOServer;
      const notification = await notificationService.createNotification(req.body, io);
      sendCreated(res, notification);
    } catch (err) {
      next(err);
    }
  },
);

// ── PUT /read-all — Mark all as read for current user ───────────────────
// IMPORTANT: This must be defined BEFORE /:id/read to avoid route conflicts

router.put('/read-all', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const count = await notificationService.markAllAsRead(req.user!.userId);
    sendSuccess(res, { updatedCount: count });
  } catch (err) {
    next(err);
  }
});

// ── PUT /:id/read — Mark single notification as read ────────────────────

router.put('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notificationId = req.params.id as string;
    await notificationService.markAsRead(notificationId, req.user!.userId);
    sendSuccess(res, { message: 'Notification marked as read' });
  } catch (err) {
    // AppError subclasses (NotFoundError, AuthorizationError) propagate to the global error handler
    next(err);
  }
});

// ── DELETE /:id — Delete notification (current user only) ───────────────

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const notificationId = req.params.id as string;
    await notificationService.deleteNotification(notificationId, req.user!.userId);
    sendNoContent(res);
  } catch (err) {
    // AppError subclasses (NotFoundError, AuthorizationError) propagate to the global error handler
    next(err);
  }
});

export default router;
