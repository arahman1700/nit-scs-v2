import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createTestApp } from '../test-utils/test-app.js';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'nit-scs-dev-only-jwt-secret-2026-do-not-use-in-production!';
  process.env.JWT_REFRESH_SECRET = 'nit-scs-dev-only-jwt-refresh-2026-do-not-use-in-production!';
});

vi.mock('../config/redis.js', () => ({
  getRedis: vi.fn().mockReturnValue(null),
  isRedisAvailable: vi.fn().mockReturnValue(false),
}));
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
  emitEntityEvent: vi.fn(),
}));
vi.mock('../utils/routeHelpers.js', () => ({
  auditAndEmit: vi.fn(),
  emitDocumentEvent: vi.fn(),
  emitEntityEvent: vi.fn(),
}));
vi.mock('../services/auth.service.js', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));

const mockEmailLog = {
  updateMany: vi.fn().mockResolvedValue({ count: 1 }),
};

vi.mock('../utils/prisma.js', () => ({
  prisma: new Proxy(
    { emailLog: null },
    {
      get: (_target: unknown, prop: string) => {
        if (prop === 'emailLog') return mockEmailLog;
        if (typeof prop === 'string' && prop.startsWith('$')) return vi.fn();
        return new Proxy({}, { get: () => vi.fn().mockResolvedValue(null) });
      },
    },
  ),
}));

// Mock getEnv to return dev mode with no webhook secret
vi.mock('../config/env.js', () => ({
  getEnv: vi.fn().mockReturnValue({
    NODE_ENV: 'development',
    RESEND_WEBHOOK_SECRET: '',
  }),
}));

// Mock svix — the Webhook class is used in the route
vi.mock('svix', () => ({
  Webhook: vi.fn().mockImplementation(() => ({
    verify: vi.fn(),
  })),
}));

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/webhooks';

describe('Email Webhook Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/v1/webhooks/resend', () => {
    it('returns 200 and processes email.delivered event (dev mode, no signature)', async () => {
      const payload = {
        type: 'email.delivered',
        data: { email_id: 'ext-123', to: ['user@test.com'] },
      };

      const res = await request
        .post(`${BASE}/resend`)
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(payload));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('received', true);
      expect(mockEmailLog.updateMany).toHaveBeenCalled();
    });

    it('returns 200 for untracked event types', async () => {
      const payload = {
        type: 'email.opened',
        data: { email_id: 'ext-456', to: ['user@test.com'] },
      };

      const res = await request
        .post(`${BASE}/resend`)
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(payload));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('received', true);
    });

    it('returns 400 for invalid payload', async () => {
      const payload = { type: '', data: {} };

      const res = await request
        .post(`${BASE}/resend`)
        .set('Content-Type', 'application/json')
        .send(JSON.stringify(payload));

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('error');
    });
  });
});
