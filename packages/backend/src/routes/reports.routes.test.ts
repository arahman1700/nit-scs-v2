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

// Reports uses requirePermission for supplier-performance & financial-summary
vi.mock('../services/permission.service.js', () => ({
  hasPermissionDB: vi.fn().mockResolvedValue(true),
}));

// Reports route uses prisma directly (no separate service)
vi.mock('../utils/prisma.js', () => ({
  prisma: {
    inventoryLevel: {
      groupBy: vi.fn().mockResolvedValue([]),
      aggregate: vi.fn().mockResolvedValue({ _count: { id: 0 }, _sum: { qtyOnHand: 0, qtyReserved: 0 } }),
    },
    item: {
      groupBy: vi.fn().mockResolvedValue([]),
    },
    warehouse: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    jobOrder: {
      groupBy: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      aggregate: vi.fn().mockResolvedValue({ _sum: { totalAmount: 0 }, _count: { id: 0 } }),
    },
    joSlaTracking: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    mrrv: {
      count: vi.fn().mockResolvedValue(0),
      aggregate: vi.fn().mockResolvedValue({ _sum: { totalValue: 0 } }),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    mirv: {
      count: vi.fn().mockResolvedValue(0),
      aggregate: vi.fn().mockResolvedValue({ _sum: { estimatedValue: 0 } }),
    },
    mrv: {
      count: vi.fn().mockResolvedValue(0),
    },
    supplier: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    osdReport: {
      groupBy: vi.fn().mockResolvedValue([]),
    },
    joPayment: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { grandTotal: 0 }, _count: { id: 0 } }),
    },
    inventoryLot: {
      aggregate: vi.fn().mockResolvedValue({ _sum: { availableQty: 0 } }),
    },
    // Proxy fallback for any other model
    $transaction: vi.fn(),
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    savedReport: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'r-1' }),
      update: vi.fn().mockResolvedValue({ id: 'r-1' }),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

import { createTestApp, signTestToken } from '../test-utils/test-app.js';
import { prisma } from '../utils/prisma.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/reports';

describe('Reports Routes', () => {
  let token: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    token = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
    // Re-mock after clearAllMocks
    const { hasPermissionDB } = await import('../services/permission.service.js');
    vi.mocked(hasPermissionDB).mockResolvedValue(true);
    // Re-set prisma aggregate mocks
    vi.mocked(prisma.jobOrder.aggregate).mockResolvedValue({ _sum: { totalAmount: 0 }, _count: { id: 0 } } as any);
    vi.mocked(prisma.mrrv.aggregate).mockResolvedValue({ _sum: { totalValue: 0 }, _count: { id: 0 } } as any);
    vi.mocked(prisma.joPayment.aggregate).mockResolvedValue({ _sum: { grandTotal: 0 }, _count: { id: 0 } } as any);
    vi.mocked(prisma.inventoryLot.aggregate).mockResolvedValue({ _sum: { availableQty: 0 } } as any);
    vi.mocked(prisma.inventoryLevel.aggregate).mockResolvedValue({
      _count: { id: 0 },
      _sum: { qtyOnHand: 0, qtyReserved: 0 },
    } as any);
  });

  describe('GET /api/v1/reports/inventory-summary', () => {
    it('returns 200 with inventory summary', async () => {
      const res = await request.get(`${BASE}/inventory-summary`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('totalRecords');
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(`${BASE}/inventory-summary`);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/reports/job-order-status', () => {
    it('returns 200 with job order status', async () => {
      const res = await request.get(`${BASE}/job-order-status`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('total');
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(`${BASE}/job-order-status`);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/reports/sla-compliance', () => {
    it('returns 200 with SLA compliance data', async () => {
      vi.mocked(prisma.joSlaTracking.findMany).mockResolvedValue([
        { slaMet: true },
        { slaMet: false },
        { slaMet: null },
      ] as any);

      const res = await request.get(`${BASE}/sla-compliance`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        total: 3,
        met: 1,
        breached: 1,
      });
    });
  });

  describe('GET /api/v1/reports/material-movement', () => {
    it('returns 200 with material movement data', async () => {
      const res = await request.get(`${BASE}/material-movement`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('mrrv');
      expect(res.body.data).toHaveProperty('mirv');
      expect(res.body.data).toHaveProperty('mrv');
    });
  });

  describe('GET /api/v1/reports/supplier-performance', () => {
    it('returns 200 for admin', async () => {
      const res = await request.get(`${BASE}/supplier-performance`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/reports/financial-summary', () => {
    it('returns 200 for admin', async () => {
      const res = await request.get(`${BASE}/financial-summary`).set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('jobOrders');
    });
  });
});
