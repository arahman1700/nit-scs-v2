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

vi.mock('../services/permission.service.js', () => ({
  getAllPermissions: vi.fn().mockResolvedValue({}),
  getPermissionsForRole: vi.fn().mockResolvedValue({}),
  updatePermission: vi.fn().mockResolvedValue(undefined),
  updateRolePermissions: vi.fn().mockResolvedValue(undefined),
  resetToDefaults: vi.fn().mockResolvedValue(undefined),
  hasPermissionDB: vi.fn().mockResolvedValue(true),
}));

import {
  getAllPermissions,
  getPermissionsForRole,
  updatePermission,
  resetToDefaults,
} from '../services/permission.service.js';
import { createTestApp, signTestToken } from '../test-utils/test-app.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/permissions';

describe('Permissions Routes', () => {
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  describe('GET /api/v1/permissions', () => {
    it('returns 200 with all permissions', async () => {
      vi.mocked(getAllPermissions).mockResolvedValue({ admin: { grn: ['read', 'create'] } } as any);

      const res = await request.get(BASE).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(getAllPermissions).toHaveBeenCalled();
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(BASE);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/permissions/:role', () => {
    it('returns 200 with role permissions', async () => {
      vi.mocked(getPermissionsForRole).mockResolvedValue({ grn: ['read'] } as any);

      const res = await request.get(`${BASE}/manager`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(getPermissionsForRole).toHaveBeenCalledWith('manager');
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(`${BASE}/manager`);
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/v1/permissions/:role/:resource', () => {
    it('returns 200 on update permission', async () => {
      const res = await request
        .put(`${BASE}/manager/grn`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ actions: ['read', 'create'] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(updatePermission).toHaveBeenCalledWith('manager', 'grn', ['read', 'create'], 'test-user-id');
    });

    it('returns 400 when actions is not an array', async () => {
      const res = await request
        .put(`${BASE}/manager/grn`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ actions: 'read' });

      expect(res.status).toBe(400);
    });

    it('returns 403 for non-admin', async () => {
      const staffToken = signTestToken({ userId: 'staff-1', systemRole: 'warehouse_staff' });

      const res = await request
        .put(`${BASE}/manager/grn`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send({ actions: ['read'] });

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/permissions/reset', () => {
    it('returns 200 on reset', async () => {
      vi.mocked(getAllPermissions).mockResolvedValue({} as any);

      const res = await request.post(`${BASE}/reset`).set('Authorization', `Bearer ${adminToken}`).send({});

      expect(res.status).toBe(200);
      expect(resetToDefaults).toHaveBeenCalled();
    });

    it('returns 403 for non-admin', async () => {
      const staffToken = signTestToken({ userId: 'staff-1', systemRole: 'warehouse_staff' });

      const res = await request.post(`${BASE}/reset`).set('Authorization', `Bearer ${staffToken}`).send({});

      expect(res.status).toBe(403);
    });
  });
});
