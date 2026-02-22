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

// ── Permission mock (requirePermission calls hasPermissionDB) ─────────────
vi.mock('../services/permission.service.js', () => ({
  hasPermissionDB: vi.fn().mockImplementation(async (role: string, _resource: string, _action: string) => {
    // admin and manager can read audit-log; others cannot
    return role === 'admin' || role === 'manager';
  }),
}));

// ── Service mock ──────────────────────────────────────────────────────────
vi.mock('../services/audit.service.js', () => ({
  getAuditLogs: vi.fn(),
  createAuditLog: vi.fn(),
}));

// ── Prisma mock (used directly in GET /:id route) ─────────────────────────
vi.mock('../utils/prisma.js', () => ({
  prisma: {
    auditLog: {
      findUnique: vi.fn(),
    },
  },
}));

import { getAuditLogs } from '../services/audit.service.js';
import { prisma } from '../utils/prisma.js';

const app = createTestApp();
const request = supertest(app);

const AUDIT_ID = '00000000-0000-0000-0000-000000000088';
const BASE = '/api/v1/audit';

describe('Audit Routes', () => {
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  // ── GET /audit ────────────────────────────────────────────────────────

  describe('GET /api/v1/audit', () => {
    it('returns 200 with paginated audit logs', async () => {
      vi.mocked(getAuditLogs).mockResolvedValue({
        data: [{ id: AUDIT_ID, tableName: 'mrrv', action: 'create', recordId: 'r1' }],
        total: 1,
      } as any);

      const res = await request.get(BASE).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta).toMatchObject({ total: 1 });
    });

    it('passes query filter params to service', async () => {
      vi.mocked(getAuditLogs).mockResolvedValue({ data: [], total: 0 } as any);

      const recordId = '00000000-0000-0000-0000-000000000077';
      const performedById = '00000000-0000-0000-0000-000000000066';

      const res = await request
        .get(
          `${BASE}?tableName=mrrv&recordId=${recordId}&action=create&performedById=${performedById}&page=2&pageSize=10`,
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(getAuditLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          tableName: 'mrrv',
          recordId,
          action: 'create',
          performedById,
          page: 2,
          pageSize: 10,
        }),
      );
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(BASE);
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-admin/manager users', async () => {
      const viewerToken = signTestToken({ userId: 'viewer-user', systemRole: 'viewer' });

      const res = await request.get(BASE).set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('allows manager role', async () => {
      const managerToken = signTestToken({ userId: 'manager-user', systemRole: 'manager' });
      vi.mocked(getAuditLogs).mockResolvedValue({ data: [], total: 0 } as any);

      const res = await request.get(BASE).set('Authorization', `Bearer ${managerToken}`);

      expect(res.status).toBe(200);
    });
  });

  // ── GET /audit/:id ───────────────────────────────────────────────────

  describe('GET /api/v1/audit/:id', () => {
    it('returns 200 with a single audit log entry', async () => {
      const mockEntry = {
        id: AUDIT_ID,
        tableName: 'mrrv',
        action: 'create',
        recordId: 'r1',
        performedBy: { fullName: 'Admin User', email: 'admin@test.com' },
      };
      vi.mocked(prisma.auditLog.findUnique).mockResolvedValue(mockEntry as any);

      const res = await request.get(`${BASE}/${AUDIT_ID}`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(AUDIT_ID);
      expect(prisma.auditLog.findUnique).toHaveBeenCalledWith({
        where: { id: AUDIT_ID },
        include: {
          performedBy: { select: { fullName: true, email: true } },
        },
      });
    });

    it('returns 404 when audit log entry not found', async () => {
      vi.mocked(prisma.auditLog.findUnique).mockResolvedValue(null);

      const res = await request.get(`${BASE}/${AUDIT_ID}`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 403 for non-admin/manager users', async () => {
      const viewerToken = signTestToken({ userId: 'viewer-user', systemRole: 'viewer' });

      const res = await request.get(`${BASE}/${AUDIT_ID}`).set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
    });
  });
});
