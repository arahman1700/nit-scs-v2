import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createTestApp, signTestToken } from '../../../test-utils/test-app.js';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'nit-scs-dev-only-jwt-secret-2026-do-not-use-in-production!';
  process.env.JWT_REFRESH_SECRET = 'nit-scs-dev-only-jwt-refresh-2026-do-not-use-in-production!';
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
vi.mock('../../../utils/prisma.js', () => ({
  prisma: new Proxy(
    {},
    {
      get: (_target: unknown, prop: string) => {
        if (typeof prop === 'string' && prop.startsWith('$')) return vi.fn();
        return new Proxy({}, { get: () => vi.fn().mockResolvedValue(null) });
      },
    },
  ),
  prismaRead: new Proxy(
    {},
    {
      get: (_target: unknown, prop: string) => {
        if (typeof prop === 'string' && prop.startsWith('$')) return vi.fn();
        return new Proxy({}, { get: () => vi.fn().mockResolvedValue(null) });
      },
    },
  ),
}));
vi.mock('../../auth/services/auth.service.js', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));
vi.mock('../../auth/services/permission.service.js', () => ({
  hasPermissionDB: vi.fn().mockResolvedValue(true),
}));
vi.mock('../../audit/services/audit.service.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue({}),
}));

vi.mock('../services/oracle-po-sync.service.js', () => ({
  listPoMirrors: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getPoByNumber: vi.fn().mockResolvedValue(null),
  getPoReconciliation: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  syncPurchaseOrders: vi.fn().mockResolvedValue({ synced: 5, failed: 0, skipped: 0 }),
}));

import * as oraclePoSyncService from '../services/oracle-po-sync.service.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/purchase-orders';

// A sample PO mirror header with lines for reuse across tests
const samplePo = {
  id: 'po-mirror-1',
  poNumber: 'PO-2026-001',
  supplierCode: 'SUP-001',
  supplierName: 'Acme Supplies',
  orderDate: new Date('2026-01-10').toISOString(),
  expectedDate: new Date('2026-01-20').toISOString(),
  status: 'open',
  currency: 'SAR',
  totalAmount: 50000,
  syncedAt: new Date('2026-03-01').toISOString(),
  lines: [
    {
      id: 'line-1',
      poId: 'po-mirror-1',
      lineNumber: 1,
      itemCode: 'ITEM-A',
      description: 'Steel Pipe',
      uom: 'EA',
      unitPrice: 100,
      orderedQty: 200,
      receivedQty: 100,
    },
    {
      id: 'line-2',
      poId: 'po-mirror-1',
      lineNumber: 2,
      itemCode: 'ITEM-B',
      description: 'Valve',
      uom: 'EA',
      unitPrice: 250,
      orderedQty: 50,
      receivedQty: 50,
    },
    {
      id: 'line-3',
      poId: 'po-mirror-1',
      lineNumber: 3,
      itemCode: 'ITEM-C',
      description: 'Bolt',
      uom: 'BOX',
      unitPrice: null,
      orderedQty: 10,
      receivedQty: 0,
    },
    {
      id: 'line-4',
      poId: 'po-mirror-1',
      lineNumber: 4,
      itemCode: 'ITEM-D',
      description: 'Gasket',
      uom: 'EA',
      unitPrice: 15,
      orderedQty: 30,
      receivedQty: 40,
    },
  ],
};

describe('Purchase Order Routes', () => {
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  // ── GET / — List PO mirrors ──────────────────────────────────────────────

  describe('GET /api/v1/purchase-orders', () => {
    it('returns 200 with paginated list of POs', async () => {
      vi.mocked(oraclePoSyncService.listPoMirrors).mockResolvedValue({
        data: [samplePo],
        total: 1,
      } as never);

      const res = await request.get(BASE).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
      expect(res.body.meta.page).toBe(1);
      expect(res.body.meta.pageSize).toBe(25);
      expect(oraclePoSyncService.listPoMirrors).toHaveBeenCalledWith({
        supplierCode: undefined,
        status: undefined,
        search: undefined,
        page: 1,
        pageSize: 25,
      });
    });

    it('passes pagination params to service', async () => {
      vi.mocked(oraclePoSyncService.listPoMirrors).mockResolvedValue({ data: [], total: 0 } as never);

      const res = await request.get(`${BASE}?page=2&pageSize=10`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.meta.page).toBe(2);
      expect(res.body.meta.pageSize).toBe(10);
      expect(oraclePoSyncService.listPoMirrors).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2, pageSize: 10 }),
      );
    });

    it('passes filter params (supplierCode, status, search) to service', async () => {
      vi.mocked(oraclePoSyncService.listPoMirrors).mockResolvedValue({ data: [], total: 0 } as never);

      const res = await request
        .get(`${BASE}?supplierCode=SUP-001&status=open&search=PO-2026`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(oraclePoSyncService.listPoMirrors).toHaveBeenCalledWith({
        supplierCode: 'SUP-001',
        status: 'open',
        search: 'PO-2026',
        page: 1,
        pageSize: 25,
      });
    });

    it('clamps pageSize to a maximum of 100', async () => {
      vi.mocked(oraclePoSyncService.listPoMirrors).mockResolvedValue({ data: [], total: 0 } as never);

      const res = await request.get(`${BASE}?pageSize=999`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.meta.pageSize).toBe(100);
      expect(oraclePoSyncService.listPoMirrors).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 100 }));
    });

    it('falls back to page=1 for invalid page values', async () => {
      vi.mocked(oraclePoSyncService.listPoMirrors).mockResolvedValue({ data: [], total: 0 } as never);

      const res = await request.get(`${BASE}?page=-5`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.meta.page).toBe(1);
      expect(oraclePoSyncService.listPoMirrors).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
    });

    it('returns 401 without auth token', async () => {
      const res = await request.get(BASE);
      expect(res.status).toBe(401);
    });

    it('returns 500 when service throws an unexpected error', async () => {
      vi.mocked(oraclePoSyncService.listPoMirrors).mockRejectedValue(new Error('DB connection lost'));

      const res = await request.get(BASE).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ── GET /:poNumber — Single PO detail ───────────────────────────────────

  describe('GET /api/v1/purchase-orders/:poNumber', () => {
    it('returns 200 with PO detail when found', async () => {
      vi.mocked(oraclePoSyncService.getPoByNumber).mockResolvedValue(samplePo as never);

      const res = await request.get(`${BASE}/PO-2026-001`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.poNumber).toBe('PO-2026-001');
      expect(res.body.data.supplierCode).toBe('SUP-001');
      expect(oraclePoSyncService.getPoByNumber).toHaveBeenCalledWith('PO-2026-001');
    });

    it('returns 404 when PO is not found in mirror', async () => {
      vi.mocked(oraclePoSyncService.getPoByNumber).mockResolvedValue(null as never);

      const res = await request.get(`${BASE}/PO-NONEXISTENT`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(oraclePoSyncService.getPoByNumber).toHaveBeenCalledWith('PO-NONEXISTENT');
    });

    it('returns 401 without auth token', async () => {
      const res = await request.get(`${BASE}/PO-2026-001`);
      expect(res.status).toBe(401);
    });

    it('returns 500 when service throws an unexpected error', async () => {
      vi.mocked(oraclePoSyncService.getPoByNumber).mockRejectedValue(new Error('Unexpected DB error'));

      const res = await request.get(`${BASE}/PO-2026-001`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ── GET /:poNumber/reconciliation — Single-PO reconciliation detail ──────

  describe('GET /api/v1/purchase-orders/:poNumber/reconciliation', () => {
    it('returns 200 with per-line reconciliation for a valid PO', async () => {
      vi.mocked(oraclePoSyncService.getPoByNumber).mockResolvedValue(samplePo as never);

      const res = await request.get(`${BASE}/PO-2026-001/reconciliation`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const data = res.body.data;
      expect(data.poNumber).toBe('PO-2026-001');
      expect(data.supplierCode).toBe('SUP-001');
      expect(data.supplierName).toBe('Acme Supplies');
      expect(data.currency).toBe('SAR');
      expect(data.lines).toHaveLength(4);
    });

    it('correctly computes "partially_received" status for ITEM-A (100/200)', async () => {
      vi.mocked(oraclePoSyncService.getPoByNumber).mockResolvedValue(samplePo as never);

      const res = await request.get(`${BASE}/PO-2026-001/reconciliation`).set('Authorization', `Bearer ${adminToken}`);

      const lineA = res.body.data.lines.find((l: { itemCode: string }) => l.itemCode === 'ITEM-A');
      expect(lineA.orderedQty).toBe(200);
      expect(lineA.receivedQty).toBe(100);
      expect(lineA.variance).toBe(-100);
      expect(lineA.status).toBe('partially_received');
    });

    it('correctly computes "fully_received" status for ITEM-B (50/50)', async () => {
      vi.mocked(oraclePoSyncService.getPoByNumber).mockResolvedValue(samplePo as never);

      const res = await request.get(`${BASE}/PO-2026-001/reconciliation`).set('Authorization', `Bearer ${adminToken}`);

      const lineB = res.body.data.lines.find((l: { itemCode: string }) => l.itemCode === 'ITEM-B');
      expect(lineB.orderedQty).toBe(50);
      expect(lineB.receivedQty).toBe(50);
      expect(lineB.variance).toBe(0);
      expect(lineB.status).toBe('fully_received');
    });

    it('correctly computes "not_received" status for ITEM-C (0/10)', async () => {
      vi.mocked(oraclePoSyncService.getPoByNumber).mockResolvedValue(samplePo as never);

      const res = await request.get(`${BASE}/PO-2026-001/reconciliation`).set('Authorization', `Bearer ${adminToken}`);

      const lineC = res.body.data.lines.find((l: { itemCode: string }) => l.itemCode === 'ITEM-C');
      expect(lineC.orderedQty).toBe(10);
      expect(lineC.receivedQty).toBe(0);
      expect(lineC.variance).toBe(-10);
      expect(lineC.status).toBe('not_received');
      expect(lineC.unitPrice).toBeNull();
    });

    it('correctly computes "over_received" status for ITEM-D (40/30)', async () => {
      vi.mocked(oraclePoSyncService.getPoByNumber).mockResolvedValue(samplePo as never);

      const res = await request.get(`${BASE}/PO-2026-001/reconciliation`).set('Authorization', `Bearer ${adminToken}`);

      const lineD = res.body.data.lines.find((l: { itemCode: string }) => l.itemCode === 'ITEM-D');
      expect(lineD.orderedQty).toBe(30);
      expect(lineD.receivedQty).toBe(40);
      expect(lineD.variance).toBe(10);
      expect(lineD.status).toBe('over_received');
    });

    it('returns 404 when PO is not found in mirror', async () => {
      vi.mocked(oraclePoSyncService.getPoByNumber).mockResolvedValue(null as never);

      const res = await request
        .get(`${BASE}/PO-NONEXISTENT/reconciliation`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 without auth token', async () => {
      const res = await request.get(`${BASE}/PO-2026-001/reconciliation`);
      expect(res.status).toBe(401);
    });

    it('returns 500 when service throws an unexpected error', async () => {
      vi.mocked(oraclePoSyncService.getPoByNumber).mockRejectedValue(new Error('Unexpected error'));

      const res = await request.get(`${BASE}/PO-2026-001/reconciliation`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ── GET /reconciliation — Paginated cross-PO reconciliation ────────────

  describe('GET /api/v1/purchase-orders/reconciliation', () => {
    it('returns 200 with reconciliation data', async () => {
      vi.mocked(oraclePoSyncService.getPoReconciliation).mockResolvedValue({
        data: [
          {
            poNumber: 'PO-2026-001',
            supplierCode: 'SUP-001',
            supplierName: 'Acme Supplies',
            itemCode: 'ITEM-A',
            description: 'Steel Pipe',
            lineNumber: 1,
            orderedQty: 200,
            receivedQty: 100,
            variance: -100,
            status: 'partially_received',
            uom: 'EA',
            unitPrice: 100,
          },
        ],
        total: 1,
      } as never);

      const res = await request.get(`${BASE}/reconciliation`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
      expect(oraclePoSyncService.getPoReconciliation).toHaveBeenCalledWith({
        supplierCode: undefined,
        status: undefined,
        fromDate: undefined,
        toDate: undefined,
        page: 1,
        pageSize: 25,
      });
    });

    it('passes pagination and filter params to service', async () => {
      vi.mocked(oraclePoSyncService.getPoReconciliation).mockResolvedValue({ data: [], total: 0 } as never);

      const res = await request
        .get(
          `${BASE}/reconciliation?page=2&pageSize=10&supplierCode=SUP-001&status=open&fromDate=2026-01-01&toDate=2026-03-31`,
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.meta.page).toBe(2);
      expect(res.body.meta.pageSize).toBe(10);
      expect(oraclePoSyncService.getPoReconciliation).toHaveBeenCalledWith({
        supplierCode: 'SUP-001',
        status: 'open',
        fromDate: '2026-01-01',
        toDate: '2026-03-31',
        page: 2,
        pageSize: 10,
      });
    });

    it('returns 401 without auth token', async () => {
      const res = await request.get(`${BASE}/reconciliation`);
      expect(res.status).toBe(401);
    });

    it('returns 500 when service throws an unexpected error', async () => {
      vi.mocked(oraclePoSyncService.getPoReconciliation).mockRejectedValue(new Error('Query failed'));

      const res = await request.get(`${BASE}/reconciliation`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });

  // ── POST /sync — Trigger manual Oracle sync ──────────────────────────────

  describe('POST /api/v1/purchase-orders/sync', () => {
    it('returns 200 with sync summary on success', async () => {
      vi.mocked(oraclePoSyncService.syncPurchaseOrders).mockResolvedValue({
        synced: 12,
        failed: 0,
        skipped: 0,
      } as never);

      const res = await request.post(`${BASE}/sync`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toBe('Oracle PO sync triggered');
      expect(res.body.data.synced).toBe(12);
      expect(res.body.data.failed).toBe(0);
      expect(res.body.data.skipped).toBe(0);
      expect(oraclePoSyncService.syncPurchaseOrders).toHaveBeenCalledOnce();
    });

    it('returns 200 with skipped=1 when Oracle is not configured', async () => {
      vi.mocked(oraclePoSyncService.syncPurchaseOrders).mockResolvedValue({
        synced: 0,
        failed: 0,
        skipped: 1,
      } as never);

      const res = await request.post(`${BASE}/sync`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.skipped).toBe(1);
    });

    it('returns 401 without auth token', async () => {
      const res = await request.post(`${BASE}/sync`);
      expect(res.status).toBe(401);
    });

    it('returns 500 when sync service throws an unexpected error', async () => {
      vi.mocked(oraclePoSyncService.syncPurchaseOrders).mockRejectedValue(new Error('Network timeout'));

      const res = await request.post(`${BASE}/sync`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
    });
  });
});
