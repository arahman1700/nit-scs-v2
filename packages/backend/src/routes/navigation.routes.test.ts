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

// Navigation uses requirePermission for update operations
vi.mock('../services/permission.service.js', () => ({
  hasPermissionDB: vi.fn().mockResolvedValue(true),
}));

vi.mock('../services/navigation.service.js', () => ({
  getNavigationForRole: vi.fn().mockResolvedValue([]),
  updateNavigationOrder: vi.fn().mockResolvedValue(undefined),
  hideNavigationItem: vi.fn().mockResolvedValue(undefined),
  showNavigationItem: vi.fn().mockResolvedValue(undefined),
  invalidateNavCache: vi.fn(),
}));

import * as navService from '../services/navigation.service.js';
import { createTestApp, signTestToken } from '../test-utils/test-app.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/navigation';

describe('Navigation Routes', () => {
  let token: string;

  beforeEach(() => {
    vi.clearAllMocks();
    token = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  describe('GET /api/v1/navigation', () => {
    it('returns 200 with navigation data', async () => {
      vi.mocked(navService.getNavigationForRole).mockResolvedValue([
        { label: 'Dashboard', path: '/dashboard', icon: 'Home' },
      ] as any);

      const res = await request.get(BASE).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(BASE);
      expect(res.status).toBe(401);
    });

    it('uses user systemRole for navigation lookup', async () => {
      vi.mocked(navService.getNavigationForRole).mockResolvedValue([]);
      const staffToken = signTestToken({ userId: 'staff-1', systemRole: 'warehouse_staff' });

      await request.get(BASE).set('Authorization', `Bearer ${staffToken}`);
      expect(navService.getNavigationForRole).toHaveBeenCalledWith('warehouse_staff');
    });
  });

  describe('PUT /api/v1/navigation/order', () => {
    it('returns 200 on successful reorder', async () => {
      const res = await request
        .put(`${BASE}/order`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'admin', overrides: [{ path: '/a', sortOrder: 1 }] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(navService.updateNavigationOrder).toHaveBeenCalledWith('admin', [{ path: '/a', sortOrder: 1 }]);
    });

    it('returns 401 without auth', async () => {
      const res = await request.put(`${BASE}/order`).send({ role: 'admin', overrides: [] });
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/v1/navigation/visibility', () => {
    it('calls hideNavigationItem when hidden=true', async () => {
      const res = await request
        .put(`${BASE}/visibility`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'admin', path: '/reports', hidden: true });

      expect(res.status).toBe(200);
      expect(navService.hideNavigationItem).toHaveBeenCalledWith('admin', '/reports');
    });

    it('calls showNavigationItem when hidden=false', async () => {
      const res = await request
        .put(`${BASE}/visibility`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'admin', path: '/reports', hidden: false });

      expect(res.status).toBe(200);
      expect(navService.showNavigationItem).toHaveBeenCalledWith('admin', '/reports');
    });
  });
});
