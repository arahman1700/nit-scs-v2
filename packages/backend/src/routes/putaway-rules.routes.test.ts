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

vi.mock('../services/putaway-rules.service.js', () => ({
  listRules: vi.fn().mockResolvedValue([]),
  getRuleById: vi.fn().mockResolvedValue({ id: 'rule-1', warehouseId: 'wh-1' }),
  createRule: vi.fn().mockResolvedValue({ id: 'rule-new' }),
  updateRule: vi.fn().mockResolvedValue({ id: 'rule-1' }),
  deleteRule: vi.fn().mockResolvedValue(undefined),
  suggestPutAwayLocation: vi.fn().mockResolvedValue([]),
}));

vi.mock('../services/audit.service.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  getAuditLogs: vi.fn(),
}));

import { listRules, getRuleById, deleteRule, suggestPutAwayLocation } from '../services/putaway-rules.service.js';
import { createTestApp, signTestToken } from '../test-utils/test-app.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/putaway-rules';

describe('Putaway Rules Routes', () => {
  let token: string;

  beforeEach(() => {
    vi.clearAllMocks();
    token = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  describe('GET /api/v1/putaway-rules', () => {
    it('returns 200 with rules list', async () => {
      vi.mocked(listRules).mockResolvedValue([{ id: 'rule-1' }] as any);

      const res = await request.get(BASE).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(listRules).toHaveBeenCalled();
    });

    it('passes warehouseId filter', async () => {
      vi.mocked(listRules).mockResolvedValue([]);

      const res = await request.get(`${BASE}?warehouseId=wh-1`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(listRules).toHaveBeenCalledWith('wh-1');
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(BASE);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/putaway-rules/suggest', () => {
    it('returns 200 with suggestions', async () => {
      vi.mocked(suggestPutAwayLocation).mockResolvedValue([{ zone: 'A', bin: 'A-01' }] as any);

      const res = await request
        .get(`${BASE}/suggest?itemId=item-1&warehouseId=wh-1`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(suggestPutAwayLocation).toHaveBeenCalledWith('item-1', 'wh-1');
    });

    it('returns 400 when missing params', async () => {
      const res = await request.get(`${BASE}/suggest?itemId=item-1`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/putaway-rules/:id', () => {
    it('returns 200 with single rule', async () => {
      vi.mocked(getRuleById).mockResolvedValue({ id: 'rule-1' } as any);

      const res = await request.get(`${BASE}/rule-1`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /api/v1/putaway-rules/:id', () => {
    it('returns 204 on delete', async () => {
      const res = await request.delete(`${BASE}/rule-1`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);
      expect(deleteRule).toHaveBeenCalledWith('rule-1');
    });

    it('returns 403 for unauthorized role', async () => {
      const staffToken = signTestToken({ userId: 'staff-1', systemRole: 'warehouse_staff' });

      const res = await request.delete(`${BASE}/rule-1`).set('Authorization', `Bearer ${staffToken}`);

      expect(res.status).toBe(403);
    });
  });
});
