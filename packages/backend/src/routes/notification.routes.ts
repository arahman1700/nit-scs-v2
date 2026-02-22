import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import type { Server as SocketIOServer } from 'socket.io';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { validate } from '../middleware/validate.js';
import { sendSuccess, sendCreated, sendNoContent } from '../utils/response.js';
import * as notificationService from '../services/notification.service.js';
import { notificationListSchema, notificationCreateSchema } from '../schemas/system.schema.js';
import { verifyUnsubscribeToken } from '../services/email.service.js';
import { prisma } from '../utils/prisma.js';
import { log } from '../config/logger.js';

const router = Router();

// ── GET /unsubscribe — GDPR email unsubscribe (NO authentication required) ──
// Users click this link from emails, so they may not be logged in.

router.get('/unsubscribe', async (req: Request, res: Response, _next: NextFunction) => {
  const token = req.query.token as string | undefined;

  if (!token) {
    res.status(400).send(
      renderUnsubscribePage({
        success: false,
        message: 'Missing unsubscribe token. Please use the link from your email.',
      }),
    );
    return;
  }

  const payload = verifyUnsubscribeToken(token);
  if (!payload) {
    res.status(400).send(
      renderUnsubscribePage({
        success: false,
        message: 'Invalid or expired unsubscribe link. Please contact support if you need assistance.',
      }),
    );
    return;
  }

  try {
    // Find the employee by email
    const employee = await prisma.employee.findUnique({
      where: { email: payload.email },
      select: { id: true, fullName: true },
    });

    if (!employee) {
      res.status(404).send(
        renderUnsubscribePage({
          success: false,
          message: 'Employee not found. The email address may no longer be active.',
        }),
      );
      return;
    }

    // Upsert the notification preference — set emailEnabled to false
    await prisma.notificationPreference.upsert({
      where: {
        employeeId_templateCode: {
          employeeId: employee.id,
          templateCode: payload.templateCode,
        },
      },
      create: {
        employeeId: employee.id,
        templateCode: payload.templateCode,
        emailEnabled: false,
        pushEnabled: true,
        inAppEnabled: true,
      },
      update: {
        emailEnabled: false,
      },
    });

    log('info', `[Unsubscribe] ${payload.email} unsubscribed from '${payload.templateCode}'`);

    res.status(200).send(
      renderUnsubscribePage({
        success: true,
        message: `You have been successfully unsubscribed from "${payload.templateCode.replace(/_/g, ' ')}" email notifications.`,
        email: payload.email,
        templateCode: payload.templateCode,
      }),
    );
  } catch (err) {
    log('error', `[Unsubscribe] Error processing unsubscribe: ${err instanceof Error ? err.message : String(err)}`);
    res.status(500).send(
      renderUnsubscribePage({
        success: false,
        message: 'An error occurred while processing your request. Please try again later.',
      }),
    );
  }
});

// ── Authenticated routes below ───────────────────────────────────────────
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

// ── Unsubscribe HTML Page Renderer ──────────────────────────────────────

function renderUnsubscribePage(opts: {
  success: boolean;
  message: string;
  email?: string;
  templateCode?: string;
}): string {
  const statusIcon = opts.success ? '&#10003;' : '&#10007;';
  const statusColor = opts.success ? '#34d399' : '#ef4444';
  const statusTitle = opts.success ? 'Unsubscribed' : 'Error';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${statusTitle} - NIT Supply Chain</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Inter, system-ui, -apple-system, sans-serif;
      background: #0a1628;
      color: #e5e7eb;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: rgba(255, 255, 255, 0.05);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 48px;
      max-width: 480px;
      width: 100%;
      text-align: center;
    }
    .icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: ${statusColor}20;
      color: ${statusColor};
      font-size: 32px;
      line-height: 64px;
      margin: 0 auto 24px;
    }
    h1 {
      font-size: 24px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 12px;
    }
    p {
      font-size: 14px;
      color: #9ca3af;
      line-height: 1.6;
      margin-bottom: 8px;
    }
    .footer {
      margin-top: 32px;
      padding-top: 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      font-size: 12px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${statusIcon}</div>
    <h1>${statusTitle}</h1>
    <p>${opts.message}</p>
    ${opts.success ? '<p>You can re-subscribe at any time from your notification settings.</p>' : ''}
    <div class="footer">
      NIT Supply Chain Management System
    </div>
  </div>
</body>
</html>`;
}

export default router;
