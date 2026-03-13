/**
 * Integration tests for reorder-suggestions routes.
 *
 * GET  /inventory/reorder-suggestions        — list items below reorder point
 * POST /inventory/reorder-suggestions/:itemId/apply — update reorder settings
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { modelCache } = vi.hoisted(() => {
  process.env.JWT_SECRET = 'nit-scs-dev-only-jwt-secret-2026-do-not-use-in-production!';
  process.env.JWT_REFRESH_SECRET = 'nit-scs-dev-only-jwt-refresh-2026-do-not-use-in-production!';
  const modelCache: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {};
  return { modelCache };
});

vi.mock('../../../config/redis.js', () => ({ getRedis: vi.fn().mockReturnValue(null) }));
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
vi.mock('../../../utils/prisma.js', () => ({
  prisma: new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (typeof prop === 'string' && prop.startsWith('$')) return vi.fn();
        const key = String(prop);
        if (!modelCache[key]) modelCache[key] = {};
        return new Proxy(modelCache[key], {
          get: (obj, method) => {
            const m = String(method);
            if (!obj[m]) obj[m] = vi.fn().mockResolvedValue(null);
            return obj[m];
          },
          set: (obj, method, value) => {
            obj[String(method)] = value;
            return true;
          },
        });
      },
    },
  ),
}));
vi.mock('../../../utils/scope-filter.js', () => ({
  buildScopeFilter: vi.fn().mockReturnValue({}),
  canAccessRecord: vi.fn().mockReturnValue(true),
  applyScopeFilter: vi.fn().mockReturnValue((_req: unknown, _res: unknown, next: () => void) => next()),
}));
vi.mock('../../auth/services/auth.service.js', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));
vi.mock('../../auth/services/permission.service.js', () => ({
  hasPermissionDB: vi.fn().mockResolvedValue(true),
  getAllPermissions: vi.fn().mockResolvedValue({}),
  getPermissionsForRole: vi.fn().mockResolvedValue({}),
  invalidatePermissionCache: vi.fn(),
}));
vi.mock('../../audit/services/audit.service.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue({}),
}));

import { createTestApp, signTestToken } from '../../../test-utils/test-app.js';
import supertest from 'supertest';
import * as scopeFilter from '../../../utils/scope-filter.js';
import * as permissionService from '../../auth/services/permission.service.js';

const app = createTestApp();
const request = supertest(app);

const BASE = '/api/v1/inventory/reorder-suggestions';
const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
const WAREHOUSE_TOKEN = signTestToken({
  userId: 'wh-user-id',
  systemRole: 'warehouse_supervisor',
  assignedWarehouseId: 'wh-1',
});

// ---------------------------------------------------------------------------
// Helpers — shared inventory level fixtures
// ---------------------------------------------------------------------------

function makeInventoryLevel(overrides: Record<string, unknown> = {}) {
  return {
    id: 'il-1',
    itemId: 'item-1',
    warehouseId: 'wh-1',
    qtyOnHand: 5,
    reorderPoint: 10,
    minLevel: 3,
    lastMovementDate: new Date('2026-01-15').toISOString(),
    alertSent: false,
    item: {
      id: 'item-1',
      itemCode: 'ITEM-001',
      itemDescription: 'Test Item',
      category: 'Spare Parts',
      reorderPoint: 10,
    },
    warehouse: {
      id: 'wh-1',
      warehouseName: 'Main Warehouse',
      warehouseCode: 'WH-001',
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Reset model cache for inventoryLevel before each test
  modelCache['inventoryLevel'] = {};
  vi.mocked(scopeFilter.buildScopeFilter).mockReturnValue({});
  vi.mocked(permissionService.hasPermissionDB).mockResolvedValue(true);
});

// ---------------------------------------------------------------------------
// GET /api/v1/inventory/reorder-suggestions
// ---------------------------------------------------------------------------

describe('GET /api/v1/inventory/reorder-suggestions', () => {
  it('should return 200 with items at or below reorder point', async () => {
    const level = makeInventoryLevel({ qtyOnHand: 5, reorderPoint: 10 });
    modelCache['inventoryLevel']!['findMany'] = vi.fn().mockResolvedValue([level]);

    const res = await request.get(BASE).set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  it('should map response fields correctly', async () => {
    const level = makeInventoryLevel({ qtyOnHand: 5, reorderPoint: 10, minLevel: 3, alertSent: false });
    modelCache['inventoryLevel']!['findMany'] = vi.fn().mockResolvedValue([level]);

    const res = await request.get(BASE).set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    const item = res.body.data[0];
    expect(item.id).toBe('il-1');
    expect(item.itemId).toBe('item-1');
    expect(item.warehouseId).toBe('wh-1');
    expect(item.currentQty).toBe(5);
    expect(item.reorderPoint).toBe(10);
    expect(item.minLevel).toBe(3);
    // suggestedOrderQty = reorderPoint * 2
    expect(item.suggestedOrderQty).toBe(20);
    expect(item.alertSent).toBe(false);
    expect(item.item).toMatchObject({ itemCode: 'ITEM-001' });
    expect(item.warehouse).toMatchObject({ warehouseCode: 'WH-001' });
  });

  it('should filter out levels where qtyOnHand > reorderPoint', async () => {
    // level1 is ABOVE the reorder point — should be excluded
    const level1 = makeInventoryLevel({ id: 'il-1', qtyOnHand: 20, reorderPoint: 10 });
    // level2 is AT the reorder point — should be included
    const level2 = makeInventoryLevel({ id: 'il-2', qtyOnHand: 10, reorderPoint: 10 });
    // level3 is BELOW the reorder point — should be included
    const level3 = makeInventoryLevel({ id: 'il-3', qtyOnHand: 2, reorderPoint: 10 });
    modelCache['inventoryLevel']!['findMany'] = vi.fn().mockResolvedValue([level1, level2, level3]);

    const res = await request.get(BASE).set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    const ids = res.body.data.map((d: { id: string }) => d.id);
    expect(ids).not.toContain('il-1');
    expect(ids).toContain('il-2');
    expect(ids).toContain('il-3');
  });

  it('should return empty array when no items are below reorder point', async () => {
    modelCache['inventoryLevel']!['findMany'] = vi.fn().mockResolvedValue([]);

    const res = await request.get(BASE).set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(0);
  });

  it('should handle null minLevel gracefully', async () => {
    const level = makeInventoryLevel({ qtyOnHand: 5, reorderPoint: 10, minLevel: null });
    modelCache['inventoryLevel']!['findMany'] = vi.fn().mockResolvedValue([level]);

    const res = await request.get(BASE).set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.data[0].minLevel).toBeNull();
  });

  it('should call buildScopeFilter with warehouseId field mapping', async () => {
    modelCache['inventoryLevel']!['findMany'] = vi.fn().mockResolvedValue([]);

    await request.get(BASE).set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(scopeFilter.buildScopeFilter).toHaveBeenCalledWith(expect.objectContaining({ systemRole: 'admin' }), {
      warehouseField: 'warehouseId',
    });
  });

  it('should apply warehouse scope filter for warehouse-scoped user', async () => {
    vi.mocked(scopeFilter.buildScopeFilter).mockReturnValue({ warehouseId: 'wh-1' });
    const level = makeInventoryLevel({ warehouseId: 'wh-1', qtyOnHand: 3, reorderPoint: 10 });
    modelCache['inventoryLevel']!['findMany'] = vi.fn().mockResolvedValue([level]);

    const res = await request.get(BASE).set('Authorization', `Bearer ${WAREHOUSE_TOKEN}`);

    expect(res.status).toBe(200);
    // Verify findMany was called with the scoped warehouseId in the where clause
    expect(modelCache['inventoryLevel']!['findMany']).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ warehouseId: 'wh-1' }),
      }),
    );
  });

  it('should return 401 without auth', async () => {
    const res = await request.get(BASE);
    expect(res.status).toBe(401);
  });

  it('should return 403 when user lacks inventory read permission', async () => {
    vi.mocked(permissionService.hasPermissionDB).mockResolvedValue(false);

    const res = await request.get(BASE).set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('should call findMany with reorderPoint gt 0 filter', async () => {
    modelCache['inventoryLevel']!['findMany'] = vi.fn().mockResolvedValue([]);

    await request.get(BASE).set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(modelCache['inventoryLevel']!['findMany']).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          reorderPoint: { gt: 0 },
        }),
      }),
    );
  });

  it('should call findMany with orderBy qtyOnHand asc', async () => {
    modelCache['inventoryLevel']!['findMany'] = vi.fn().mockResolvedValue([]);

    await request.get(BASE).set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(modelCache['inventoryLevel']!['findMany']).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { qtyOnHand: 'asc' },
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/inventory/reorder-suggestions/:itemId/apply
// ---------------------------------------------------------------------------

describe('POST /api/v1/inventory/reorder-suggestions/:itemId/apply', () => {
  function makeUpdatedLevel(overrides: Record<string, unknown> = {}) {
    return {
      itemId: 'item-1',
      warehouseId: 'wh-1',
      reorderPoint: 15,
      minLevel: 5,
      qtyOnHand: 8,
      item: { id: 'item-1', itemCode: 'ITEM-001', itemDescription: 'Test Item' },
      warehouse: { id: 'wh-1', warehouseName: 'Main Warehouse', warehouseCode: 'WH-001' },
      ...overrides,
    };
  }

  it('should return 200 and updated record when both reorderPoint and minLevel are provided', async () => {
    modelCache['inventoryLevel']!['findUnique'] = vi.fn().mockResolvedValue({ id: 'il-1' });
    modelCache['inventoryLevel']!['update'] = vi.fn().mockResolvedValue(makeUpdatedLevel());

    const res = await request
      .post(`${BASE}/item-1/apply`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ warehouseId: 'wh-1', reorderPoint: 15, minLevel: 5 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reorderPoint).toBe(15);
    expect(res.body.data.minLevel).toBe(5);
    expect(res.body.data.itemId).toBe('item-1');
    expect(res.body.data.warehouseId).toBe('wh-1');
  });

  it('should return 200 when only reorderPoint is provided', async () => {
    modelCache['inventoryLevel']!['findUnique'] = vi.fn().mockResolvedValue({ id: 'il-1' });
    modelCache['inventoryLevel']!['update'] = vi
      .fn()
      .mockResolvedValue(makeUpdatedLevel({ reorderPoint: 20, minLevel: null }));

    const res = await request
      .post(`${BASE}/item-1/apply`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ warehouseId: 'wh-1', reorderPoint: 20 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.reorderPoint).toBe(20);
    // update should only include reorderPoint
    expect(modelCache['inventoryLevel']!['update']).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { reorderPoint: 20 },
      }),
    );
  });

  it('should return 200 when only minLevel is provided', async () => {
    modelCache['inventoryLevel']!['findUnique'] = vi.fn().mockResolvedValue({ id: 'il-1' });
    modelCache['inventoryLevel']!['update'] = vi.fn().mockResolvedValue(makeUpdatedLevel({ minLevel: 7 }));

    const res = await request
      .post(`${BASE}/item-1/apply`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ warehouseId: 'wh-1', minLevel: 7 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // update should only include minLevel
    expect(modelCache['inventoryLevel']!['update']).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { minLevel: 7 },
      }),
    );
  });

  it('should map response fields with numeric conversion', async () => {
    // Simulate Decimal-like values returned by Prisma
    modelCache['inventoryLevel']!['findUnique'] = vi.fn().mockResolvedValue({ id: 'il-1' });
    modelCache['inventoryLevel']!['update'] = vi
      .fn()
      .mockResolvedValue(makeUpdatedLevel({ reorderPoint: 15, minLevel: 5, qtyOnHand: 8 }));

    const res = await request
      .post(`${BASE}/item-1/apply`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ warehouseId: 'wh-1', reorderPoint: 15, minLevel: 5 });

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(typeof data.reorderPoint).toBe('number');
    expect(typeof data.minLevel).toBe('number');
    expect(typeof data.qtyOnHand).toBe('number');
    expect(data.item).toMatchObject({ itemCode: 'ITEM-001' });
    expect(data.warehouse).toMatchObject({ warehouseCode: 'WH-001' });
  });

  it('should return 200 with null reorderPoint when update returns null', async () => {
    modelCache['inventoryLevel']!['findUnique'] = vi.fn().mockResolvedValue({ id: 'il-1' });
    modelCache['inventoryLevel']!['update'] = vi
      .fn()
      .mockResolvedValue(makeUpdatedLevel({ reorderPoint: null, minLevel: 5 }));

    const res = await request
      .post(`${BASE}/item-1/apply`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ warehouseId: 'wh-1', minLevel: 5 });

    expect(res.status).toBe(200);
    expect(res.body.data.reorderPoint).toBeNull();
    expect(res.body.data.minLevel).toBe(5);
  });

  it('should use composite key itemId_warehouseId for findUnique lookup', async () => {
    modelCache['inventoryLevel']!['findUnique'] = vi.fn().mockResolvedValue({ id: 'il-1' });
    modelCache['inventoryLevel']!['update'] = vi.fn().mockResolvedValue(makeUpdatedLevel());

    await request
      .post(`${BASE}/item-1/apply`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ warehouseId: 'wh-1', reorderPoint: 15 });

    expect(modelCache['inventoryLevel']!['findUnique']).toHaveBeenCalledWith({
      where: { itemId_warehouseId: { itemId: 'item-1', warehouseId: 'wh-1' } },
    });
  });

  // --- Validation errors ---

  it('should return 400 when warehouseId is missing', async () => {
    const res = await request
      .post(`${BASE}/item-1/apply`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ reorderPoint: 15 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/warehouseId/i);
  });

  it('should return 400 when neither reorderPoint nor minLevel is provided', async () => {
    const res = await request
      .post(`${BASE}/item-1/apply`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ warehouseId: 'wh-1' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/reorderPoint or minLevel/i);
  });

  it('should return 400 when reorderPoint is a negative number', async () => {
    const res = await request
      .post(`${BASE}/item-1/apply`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ warehouseId: 'wh-1', reorderPoint: -5 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/reorderPoint/i);
  });

  it('should return 400 when reorderPoint is not a number', async () => {
    const res = await request
      .post(`${BASE}/item-1/apply`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ warehouseId: 'wh-1', reorderPoint: 'not-a-number' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/reorderPoint/i);
  });

  it('should return 400 when minLevel is a negative number', async () => {
    const res = await request
      .post(`${BASE}/item-1/apply`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ warehouseId: 'wh-1', minLevel: -1 });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/minLevel/i);
  });

  it('should return 400 when minLevel is not a number', async () => {
    const res = await request
      .post(`${BASE}/item-1/apply`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ warehouseId: 'wh-1', minLevel: 'invalid' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/minLevel/i);
  });

  it('should accept reorderPoint of 0 (non-negative boundary)', async () => {
    modelCache['inventoryLevel']!['findUnique'] = vi.fn().mockResolvedValue({ id: 'il-1' });
    modelCache['inventoryLevel']!['update'] = vi.fn().mockResolvedValue(makeUpdatedLevel({ reorderPoint: 0 }));

    const res = await request
      .post(`${BASE}/item-1/apply`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ warehouseId: 'wh-1', reorderPoint: 0 });

    expect(res.status).toBe(200);
  });

  it('should accept minLevel of 0 (non-negative boundary)', async () => {
    modelCache['inventoryLevel']!['findUnique'] = vi.fn().mockResolvedValue({ id: 'il-1' });
    modelCache['inventoryLevel']!['update'] = vi.fn().mockResolvedValue(makeUpdatedLevel({ minLevel: 0 }));

    const res = await request
      .post(`${BASE}/item-1/apply`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ warehouseId: 'wh-1', minLevel: 0 });

    expect(res.status).toBe(200);
  });

  // --- 404 not found ---

  it('should return 404 when inventory level does not exist for item/warehouse combo', async () => {
    modelCache['inventoryLevel']!['findUnique'] = vi.fn().mockResolvedValue(null);

    const res = await request
      .post(`${BASE}/no-such-item/apply`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ warehouseId: 'wh-999', reorderPoint: 10 });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not found/i);
  });

  // --- Auth / permission checks ---

  it('should return 401 without auth', async () => {
    const res = await request.post(`${BASE}/item-1/apply`).send({ warehouseId: 'wh-1', reorderPoint: 15 });

    expect(res.status).toBe(401);
  });

  it('should return 403 when user lacks inventory update permission', async () => {
    vi.mocked(permissionService.hasPermissionDB).mockResolvedValue(false);

    const res = await request
      .post(`${BASE}/item-1/apply`)
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ warehouseId: 'wh-1', reorderPoint: 15 });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});
