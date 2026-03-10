/**
 * Integration tests for master-data.routes.ts
 *
 * Tests representative CRUD endpoints for the master data router:
 * /regions, /items (two of 17 entities mounted).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createTestApp, signTestToken } from '../../../test-utils/test-app.js';

const { mockRegion, mockItem, mockSupplier, mockProject, genericDelegate } = vi.hoisted(() => {
  process.env.JWT_SECRET = 'nit-scs-dev-only-jwt-secret-2026-do-not-use-in-production!';
  process.env.JWT_REFRESH_SECRET = 'nit-scs-dev-only-jwt-refresh-2026-do-not-use-in-production!';

  const mockRegion = {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue({ id: 'reg1', regionName: 'Eastern' }),
    update: vi.fn().mockResolvedValue({ id: 'reg1', regionName: 'Updated' }),
    delete: vi.fn().mockResolvedValue({ id: 'reg1' }),
  };

  const mockItem = {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue({ id: 'item1', itemCode: 'IT-001' }),
    update: vi.fn().mockResolvedValue({ id: 'item1', itemCode: 'IT-001' }),
    delete: vi.fn().mockResolvedValue({ id: 'item1' }),
  };

  const mockSupplier = {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue({ id: 'sup1', supplierName: 'Supplier A', supplierCode: 'SUP-001' }),
    update: vi.fn().mockResolvedValue({ id: 'sup1', supplierName: 'Supplier A Updated' }),
    delete: vi.fn().mockResolvedValue({ id: 'sup1' }),
  };

  const mockProject = {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue({ id: 'proj1', projectName: 'Project Alpha', projectCode: 'PROJ-001' }),
    update: vi.fn().mockResolvedValue({ id: 'proj1', projectName: 'Project Alpha Updated' }),
    delete: vi.fn().mockResolvedValue({ id: 'proj1' }),
  };

  const genericDelegate = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn().mockResolvedValue({ id: 'gen-id' }),
    update: vi.fn().mockResolvedValue({ id: 'gen-id' }),
    delete: vi.fn().mockResolvedValue({ id: 'gen-id' }),
  });

  return { mockRegion, mockItem, mockSupplier, mockProject, genericDelegate };
});

vi.mock('../../../config/redis.js', () => ({
  getRedis: vi.fn().mockReturnValue(null),
  isRedisAvailable: vi.fn().mockReturnValue(false),
}));
vi.mock('../../../config/logger.js', () => ({
  log: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('../../../socket/setup.js', () => ({
  setupSocketIO: vi.fn(),
  emitToUser: vi.fn(),
  emitToRole: vi.fn(),
  emitToDocument: vi.fn(),
  emitToAll: vi.fn(),
  emitEntityEvent: vi.fn(),
}));
vi.mock('../../../utils/routeHelpers.js', () => ({
  auditAndEmit: vi.fn(),
  emitDocumentEvent: vi.fn(),
  emitEntityEvent: vi.fn(),
}));
vi.mock('../../../domains/auth/services/auth.service.js', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));
vi.mock('../../../domains/auth/services/permission.service.js', () => ({
  hasPermissionDB: vi.fn().mockResolvedValue(true),
}));
vi.mock('../../system/services/audit.service.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue({}),
}));
vi.mock('../../../events/scheduled-rule-runner.js', () => ({
  nextCronRun: vi.fn(),
}));

vi.mock('../../../utils/prisma.js', () => ({
  prisma: new Proxy(
    {},
    {
      get: (_target: unknown, prop: string) => {
        if (prop === 'region') return mockRegion;
        if (prop === 'item') return mockItem;
        if (prop === 'supplier') return mockSupplier;
        if (prop === 'project') return mockProject;
        if (typeof prop === 'string' && prop.startsWith('$')) return vi.fn();
        return genericDelegate();
      },
    },
  ),
}));

const app = createTestApp();
const request = supertest(app);

describe('Master Data Routes', () => {
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  // ── Regions ────────────────────────────────────────────────────────
  describe('GET /api/v1/regions', () => {
    it('returns 200 with list', async () => {
      mockRegion.findMany.mockResolvedValue([{ id: 'reg1', regionName: 'Eastern' }]);
      mockRegion.count.mockResolvedValue(1);

      const res = await request.get('/api/v1/regions').set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get('/api/v1/regions');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/regions/:id', () => {
    it('returns 200 with a single region', async () => {
      mockRegion.findUnique.mockResolvedValue({ id: 'reg1', regionName: 'Eastern' });

      const res = await request.get('/api/v1/regions/reg1').set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 when not found', async () => {
      mockRegion.findUnique.mockResolvedValue(null);

      const res = await request.get('/api/v1/regions/missing').set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/regions/:id', () => {
    it('returns 204 on successful delete', async () => {
      mockRegion.delete.mockResolvedValue({ id: 'reg1' });

      const res = await request.delete('/api/v1/regions/reg1').set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
    });

    it('returns 401 without auth', async () => {
      const res = await request.delete('/api/v1/regions/reg1');
      expect(res.status).toBe(401);
    });
  });

  // ── Items ──────────────────────────────────────────────────────────
  describe('GET /api/v1/items', () => {
    it('returns 200 with list', async () => {
      mockItem.findMany.mockResolvedValue([{ id: 'item1', itemCode: 'IT-001' }]);
      mockItem.count.mockResolvedValue(1);

      const res = await request.get('/api/v1/items').set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns paginated list with correct meta', async () => {
      const items = [
        { id: 'item1', itemCode: 'IT-001', name: 'Steel Bars' },
        { id: 'item2', itemCode: 'IT-002', name: 'Copper Wire' },
      ];
      mockItem.findMany.mockResolvedValue(items);
      mockItem.count.mockResolvedValue(25);

      const res = await request.get('/api/v1/items?page=1&limit=2').set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(25);
    });
  });

  describe('POST /api/v1/items', () => {
    it('creates a new item and returns 201', async () => {
      const newItem = {
        itemCode: 'IT-002',
        itemDescription: 'Copper Wire',
        category: 'electrical',
        uomId: '00000000-0000-0000-0000-000000000001',
      };
      mockItem.create.mockResolvedValue({ id: 'item2', ...newItem });

      const res = await request.post('/api/v1/items').set('Authorization', `Bearer ${adminToken}`).send(newItem);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.itemCode).toBe('IT-002');
    });

    it('returns 401 without auth', async () => {
      const res = await request.post('/api/v1/items').send({ itemCode: 'IT-003' });
      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/v1/items/:id', () => {
    it('updates an existing item', async () => {
      mockItem.findUnique.mockResolvedValue({ id: 'item1', itemCode: 'IT-001' });
      mockItem.update.mockResolvedValue({ id: 'item1', itemCode: 'IT-001', name: 'Updated Steel Bars' });

      const res = await request
        .put('/api/v1/items/item1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Steel Bars' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/items/:id', () => {
    it('returns 404 when not found', async () => {
      mockItem.findUnique.mockResolvedValue(null);

      const res = await request.get('/api/v1/items/missing').set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ── Suppliers ─────────────────────────────────────────────────────
  describe('GET /api/v1/suppliers', () => {
    it('returns 200 with list', async () => {
      mockSupplier.findMany.mockResolvedValue([{ id: 'sup1', supplierName: 'Supplier A', supplierCode: 'SUP-001' }]);
      mockSupplier.count.mockResolvedValue(1);

      const res = await request.get('/api/v1/suppliers').set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get('/api/v1/suppliers');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/suppliers', () => {
    it('creates a new supplier and returns 201', async () => {
      const newSupplier = { supplierName: 'Supplier B', supplierCode: 'SUP-002', types: ['material'] };
      mockSupplier.create.mockResolvedValue({ id: 'sup2', ...newSupplier });

      const res = await request
        .post('/api/v1/suppliers')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newSupplier);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  // ── Projects ──────────────────────────────────────────────────────
  describe('GET /api/v1/projects', () => {
    it('returns 200 with list', async () => {
      mockProject.findMany.mockResolvedValue([{ id: 'proj1', projectName: 'Project Alpha', projectCode: 'PROJ-001' }]);
      mockProject.count.mockResolvedValue(1);

      const res = await request.get('/api/v1/projects').set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get('/api/v1/projects');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/projects', () => {
    it('creates a new project and returns 201', async () => {
      const newProject = { projectName: 'Project Beta', projectCode: 'PROJ-002', client: 'ACME Corp' };
      mockProject.create.mockResolvedValue({ id: 'proj2', ...newProject });

      const res = await request.post('/api/v1/projects').set('Authorization', `Bearer ${adminToken}`).send(newProject);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });
});
