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
vi.mock('../services/auth.service.js', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));

vi.mock('../services/widget-data.service.js', () => ({
  getDataSource: vi.fn().mockReturnValue(null),
  register: vi.fn(),
  listDataSources: vi.fn().mockReturnValue([]),
  registerDynamicDataSources: vi.fn(),
}));

// Saved report uses prisma directly
vi.mock('../utils/prisma.js', () => {
  const savedReport = {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 'rpt-1', name: 'Test Report' }),
    update: vi.fn().mockResolvedValue({ id: 'rpt-1', name: 'Updated Report' }),
    delete: vi.fn().mockResolvedValue(undefined),
  };

  return {
    prisma: new Proxy(
      { savedReport },
      {
        get: (target, prop) => {
          if (prop === 'savedReport') return target.savedReport;
          if (typeof prop === 'string' && prop.startsWith('$')) return vi.fn();
          return new Proxy({}, { get: () => vi.fn().mockResolvedValue(null) });
        },
      },
    ),
  };
});

import { prisma } from '../utils/prisma.js';
import { getDataSource } from '../services/widget-data.service.js';
import { createTestApp, signTestToken } from '../test-utils/test-app.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/reports/saved';

describe('Saved Report Routes', () => {
  let token: string;

  beforeEach(() => {
    vi.clearAllMocks();
    token = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  describe('GET /api/v1/reports/saved', () => {
    it('returns 200 with saved reports', async () => {
      vi.mocked(prisma.savedReport.findMany).mockResolvedValue([
        { id: 'rpt-1', name: 'My Report', ownerId: 'test-user-id' },
      ] as any);

      const res = await request.get(BASE).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(BASE);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/reports/saved', () => {
    it('returns 201 on create', async () => {
      vi.mocked(prisma.savedReport.create).mockResolvedValue({ id: 'rpt-new', name: 'New Report' } as any);

      const res = await request
        .post(BASE)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'New Report', dataSource: 'inventory-summary' });

      expect(res.status).toBe(201);
      expect(prisma.savedReport.create).toHaveBeenCalled();
    });

    it('returns 400 when name or dataSource missing', async () => {
      const res = await request.post(BASE).set('Authorization', `Bearer ${token}`).send({ name: 'No datasource' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/reports/saved/templates', () => {
    it('returns 200 with templates', async () => {
      vi.mocked(prisma.savedReport.findMany).mockResolvedValue([
        { id: 'tmpl-1', name: 'Template', isTemplate: true },
      ] as any);

      const res = await request.get(`${BASE}/templates`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/reports/saved/:id', () => {
    it('returns 200 with report', async () => {
      vi.mocked(prisma.savedReport.findUnique).mockResolvedValue({ id: 'rpt-1', name: 'My Report' } as any);

      const res = await request.get(`${BASE}/rpt-1`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 when not found', async () => {
      vi.mocked(prisma.savedReport.findUnique).mockResolvedValue(null);

      const res = await request.get(`${BASE}/nonexistent`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/v1/reports/saved/:id', () => {
    it('returns 200 on update by owner', async () => {
      vi.mocked(prisma.savedReport.findUnique).mockResolvedValue({
        id: 'rpt-1',
        name: 'Old',
        ownerId: 'test-user-id',
      } as any);
      vi.mocked(prisma.savedReport.update).mockResolvedValue({ id: 'rpt-1', name: 'Updated' } as any);

      const res = await request.put(`${BASE}/rpt-1`).set('Authorization', `Bearer ${token}`).send({ name: 'Updated' });

      expect(res.status).toBe(200);
    });

    it('returns 404 when not found', async () => {
      vi.mocked(prisma.savedReport.findUnique).mockResolvedValue(null);

      const res = await request
        .put(`${BASE}/nonexistent`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated' });

      expect(res.status).toBe(404);
    });

    it('returns 403 when non-owner non-admin edits', async () => {
      const userToken = signTestToken({ userId: 'other-user', systemRole: 'warehouse_staff' });
      vi.mocked(prisma.savedReport.findUnique).mockResolvedValue({
        id: 'rpt-1',
        name: 'Not mine',
        ownerId: 'test-user-id',
      } as any);

      const res = await request
        .put(`${BASE}/rpt-1`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Hacked' });

      expect(res.status).toBe(403);
    });
  });

  describe('DELETE /api/v1/reports/saved/:id', () => {
    it('returns 204 on delete by owner', async () => {
      vi.mocked(prisma.savedReport.findUnique).mockResolvedValue({
        id: 'rpt-1',
        ownerId: 'test-user-id',
      } as any);

      const res = await request.delete(`${BASE}/rpt-1`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(204);
    });

    it('returns 404 when not found', async () => {
      vi.mocked(prisma.savedReport.findUnique).mockResolvedValue(null);

      const res = await request.delete(`${BASE}/nonexistent`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/reports/saved/:id/run', () => {
    it('returns 200 when data source found and executed', async () => {
      vi.mocked(prisma.savedReport.findUnique).mockResolvedValue({
        id: 'rpt-1',
        name: 'My Report',
        dataSource: 'inventory-summary',
        filters: {},
        columns: ['col1'],
        visualization: 'table',
      } as any);
      const mockFn = vi.fn().mockResolvedValue({ rows: [{ id: 1 }] });
      vi.mocked(getDataSource).mockReturnValue(mockFn);

      const res = await request.post(`${BASE}/rpt-1/run`).set('Authorization', `Bearer ${token}`).send({});

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('report');
      expect(res.body.data).toHaveProperty('result');
    });

    it('returns 404 when report not found', async () => {
      vi.mocked(prisma.savedReport.findUnique).mockResolvedValue(null);

      const res = await request.post(`${BASE}/nonexistent/run`).set('Authorization', `Bearer ${token}`).send({});

      expect(res.status).toBe(404);
    });

    it('returns 400 when data source unknown', async () => {
      vi.mocked(prisma.savedReport.findUnique).mockResolvedValue({
        id: 'rpt-1',
        dataSource: 'nonexistent-source',
        filters: {},
      } as any);
      vi.mocked(getDataSource).mockReturnValue(undefined);

      const res = await request.post(`${BASE}/rpt-1/run`).set('Authorization', `Bearer ${token}`).send({});

      expect(res.status).toBe(400);
    });
  });
});
