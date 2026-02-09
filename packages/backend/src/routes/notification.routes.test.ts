import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createTestApp, signTestToken } from '../test-utils/test-app.js';

// Ensure JWT secrets are available before any module evaluates
vi.hoisted(() => {
  process.env.JWT_SECRET = 'nit-scs-dev-only-jwt-secret-2026-do-not-use-in-production!';
  process.env.JWT_REFRESH_SECRET = 'nit-scs-dev-only-jwt-refresh-2026-do-not-use-in-production!';
});

// ── Common mocks ──────────────────────────────────────────────────────────
vi.mock('../services/auth.service.js', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));
vi.mock('../config/redis.js', () => ({ getRedis: vi.fn().mockReturnValue(null) }));
vi.mock('../config/logger.js', () => ({
  log: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../socket/setup.js', () => ({
  setupSocketIO: vi.fn(),
  emitToUser: vi.fn(),
  emitToRole: vi.fn(),
  emitToDocument: vi.fn(),
  emitToAll: vi.fn(),
}));
vi.mock('../utils/routeHelpers.js', () => ({ auditAndEmit: vi.fn() }));

// ── Service mock ──────────────────────────────────────────────────────────
vi.mock('../services/notification.service.js', () => ({
  getNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  deleteNotification: vi.fn(),
  createNotification: vi.fn(),
}));

import * as notificationService from '../services/notification.service.js';

const app = createTestApp();
const request = supertest(app);

const NOTIF_ID = '00000000-0000-0000-0000-000000000099';
const BASE = '/api/v1/notifications';

describe('Notification Routes', () => {
  let token: string;

  beforeEach(() => {
    vi.clearAllMocks();
    token = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  // ── GET /notifications ────────────────────────────────────────────────

  describe('GET /api/v1/notifications', () => {
    it('returns 200 with paginated notifications', async () => {
      vi.mocked(notificationService.getNotifications).mockResolvedValue({
        data: [{ id: NOTIF_ID, title: 'Test notification', readAt: null }],
        total: 1,
      } as any);

      const res = await request.get(BASE).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta).toMatchObject({ total: 1 });
      expect(notificationService.getNotifications).toHaveBeenCalledWith(
        'test-user-id',
        expect.objectContaining({ page: 1, pageSize: 20 }),
      );
    });

    it('passes query params for pagination and unreadOnly', async () => {
      vi.mocked(notificationService.getNotifications).mockResolvedValue({
        data: [],
        total: 0,
      } as any);

      const res = await request
        .get(`${BASE}?page=2&pageSize=5&unreadOnly=true`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(notificationService.getNotifications).toHaveBeenCalledWith(
        'test-user-id',
        expect.objectContaining({ page: 2, pageSize: 5, unreadOnly: true }),
      );
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(BASE);
      expect(res.status).toBe(401);
    });
  });

  // ── GET /notifications/unread-count ───────────────────────────────────

  describe('GET /api/v1/notifications/unread-count', () => {
    it('returns 200 with unread count', async () => {
      vi.mocked(notificationService.getUnreadCount).mockResolvedValue(7);

      const res = await request.get(`${BASE}/unread-count`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({ unreadCount: 7 });
      expect(notificationService.getUnreadCount).toHaveBeenCalledWith('test-user-id');
    });
  });

  // ── PUT /notifications/:id/read ───────────────────────────────────────

  describe('PUT /api/v1/notifications/:id/read', () => {
    it('returns 200 and marks notification as read', async () => {
      vi.mocked(notificationService.markAsRead).mockResolvedValue(undefined);

      const res = await request.put(`${BASE}/${NOTIF_ID}/read`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(notificationService.markAsRead).toHaveBeenCalledWith(NOTIF_ID, 'test-user-id');
    });

    it('returns 404 when notification not found', async () => {
      vi.mocked(notificationService.markAsRead).mockRejectedValue(new Error('Notification not found'));

      const res = await request.put(`${BASE}/${NOTIF_ID}/read`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 403 when access denied', async () => {
      vi.mocked(notificationService.markAsRead).mockRejectedValue(new Error('Access denied'));

      const res = await request.put(`${BASE}/${NOTIF_ID}/read`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });

  // ── PUT /notifications/read-all ───────────────────────────────────────

  describe('PUT /api/v1/notifications/read-all', () => {
    it('returns 200 and marks all as read', async () => {
      vi.mocked(notificationService.markAllAsRead).mockResolvedValue(5);

      const res = await request.put(`${BASE}/read-all`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({ updatedCount: 5 });
      expect(notificationService.markAllAsRead).toHaveBeenCalledWith('test-user-id');
    });
  });

  // ── DELETE /notifications/:id ─────────────────────────────────────────

  describe('DELETE /api/v1/notifications/:id', () => {
    it('returns 204 on successful delete', async () => {
      vi.mocked(notificationService.deleteNotification).mockResolvedValue(undefined);

      const res = await request.delete(`${BASE}/${NOTIF_ID}`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);
      expect(notificationService.deleteNotification).toHaveBeenCalledWith(NOTIF_ID, 'test-user-id');
    });

    it('returns 404 when notification not found', async () => {
      vi.mocked(notificationService.deleteNotification).mockRejectedValue(new Error('Notification not found'));

      const res = await request.delete(`${BASE}/${NOTIF_ID}`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 403 when access denied', async () => {
      vi.mocked(notificationService.deleteNotification).mockRejectedValue(new Error('Access denied'));

      const res = await request.delete(`${BASE}/${NOTIF_ID}`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });
  });
});
