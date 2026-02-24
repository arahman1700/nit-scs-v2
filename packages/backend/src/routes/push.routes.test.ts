import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'nit-scs-dev-only-jwt-secret-2026-do-not-use-in-production!';
  process.env.JWT_REFRESH_SECRET = 'nit-scs-dev-only-jwt-refresh-2026-do-not-use-in-production!';
});

vi.mock('../config/redis.js', () => ({ getRedis: vi.fn().mockReturnValue(null) }));
vi.mock('../config/logger.js', () => ({
  log: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../socket/setup.js', () => ({
  setupSocketIO: vi.fn(),
  emitToUser: vi.fn(),
  emitToRole: vi.fn(),
  emitToDocument: vi.fn(),
  emitToAll: vi.fn(),
}));
vi.mock('../utils/routeHelpers.js', () => ({
  auditAndEmit: vi.fn(),
  emitDocumentEvent: vi.fn(),
  emitEntityEvent: vi.fn(),
}));
vi.mock('../middleware/rate-limiter.js', () => ({
  rateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  authRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
  aiRateLimiter: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../utils/prisma.js', () => ({
  prisma: new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (typeof prop === 'string' && prop.startsWith('$')) return vi.fn();
        return new Proxy({}, { get: () => vi.fn().mockResolvedValue(null) });
      },
    },
  ),
}));
vi.mock('../services/auth.service.js', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));

vi.mock('../services/push-notification.service.js', () => ({
  getVapidPublicKey: vi.fn().mockResolvedValue('BPUBLIC_KEY_123'),
  subscribe: vi.fn().mockResolvedValue({ id: 'sub-1', endpoint: 'https://push.example.com' }),
  unsubscribe: vi.fn().mockResolvedValue(undefined),
  sendPushToUser: vi.fn().mockResolvedValue(undefined),
  sendPushToRole: vi.fn(),
  broadcastPush: vi.fn(),
}));

import * as pushService from '../services/push-notification.service.js';
import { createTestApp, signTestToken } from '../test-utils/test-app.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/push';

describe('Push Routes', () => {
  let token: string;

  beforeEach(() => {
    vi.clearAllMocks();
    token = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  describe('GET /api/v1/push/vapid-key', () => {
    it('returns 200 with VAPID public key', async () => {
      vi.mocked(pushService.getVapidPublicKey).mockResolvedValue('BPUBLIC_KEY_123');

      const res = await request.get(`${BASE}/vapid-key`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.publicKey).toBe('BPUBLIC_KEY_123');
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(`${BASE}/vapid-key`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/push/subscribe', () => {
    it('returns 201 on subscribe', async () => {
      vi.mocked(pushService.subscribe).mockResolvedValue({ id: 'sub-1' } as any);

      const res = await request
        .post(`${BASE}/subscribe`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          endpoint: 'https://push.example.com/sub',
          keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
        });

      expect(res.status).toBe(201);
      expect(pushService.subscribe).toHaveBeenCalled();
    });

    it('returns 400 when missing required fields', async () => {
      const res = await request
        .post(`${BASE}/subscribe`)
        .set('Authorization', `Bearer ${token}`)
        .send({ endpoint: 'https://push.example.com' });

      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(`${BASE}/subscribe`).send({
        endpoint: 'https://push.example.com',
        keys: { p256dh: 'k1', auth: 'k2' },
      });
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/v1/push/unsubscribe', () => {
    it('returns 204 on unsubscribe', async () => {
      const res = await request
        .delete(`${BASE}/unsubscribe`)
        .set('Authorization', `Bearer ${token}`)
        .send({ endpoint: 'https://push.example.com/sub' });

      expect(res.status).toBe(204);
      expect(pushService.unsubscribe).toHaveBeenCalledWith('test-user-id', 'https://push.example.com/sub');
    });

    it('returns 400 when endpoint missing', async () => {
      const res = await request.delete(`${BASE}/unsubscribe`).set('Authorization', `Bearer ${token}`).send({});

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/push/test', () => {
    it('returns 200 for admin', async () => {
      const res = await request.post(`${BASE}/test`).set('Authorization', `Bearer ${token}`).send({});

      expect(res.status).toBe(200);
      expect(pushService.sendPushToUser).toHaveBeenCalledWith(
        'test-user-id',
        expect.objectContaining({
          title: expect.any(String),
          body: expect.any(String),
        }),
      );
    });

    it('returns 403 for non-admin', async () => {
      const staffToken = signTestToken({ userId: 'staff-1', systemRole: 'warehouse_staff' });

      const res = await request.post(`${BASE}/test`).set('Authorization', `Bearer ${staffToken}`).send({});

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/push/action', () => {
    it('returns 200 on action', async () => {
      const res = await request
        .post(`${BASE}/action`)
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'approve', documentType: 'grn', documentId: 'doc-1' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 400 when missing required fields', async () => {
      const res = await request
        .post(`${BASE}/action`)
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'approve' });

      expect(res.status).toBe(400);
    });
  });
});
