import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createTestApp, signTestToken } from '../test-utils/test-app.js';

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
  emitEntityEvent: vi.fn(),
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
      get: (_target: unknown, prop: string) => {
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
  hasPermissionDB: vi.fn().mockResolvedValue(true),
}));
vi.mock('../services/audit.service.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue({}),
}));

vi.mock('../services/shipment.service.js', () => ({
  list: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getById: vi.fn().mockResolvedValue({ id: 'sh1', status: 'draft' }),
  create: vi.fn().mockResolvedValue({ id: 'sh1' }),
  update: vi.fn().mockResolvedValue({ existing: {}, updated: { id: 'sh1' } }),
  updateStatus: vi
    .fn()
    .mockResolvedValue({ existing: { status: 'draft' }, updated: { id: 'sh1', status: 'in_transit' } }),
  addCustomsStage: vi
    .fn()
    .mockResolvedValue({ shipmentId: 'sh1', customs: { id: 'c1', stage: 'clearance' }, newShipmentStatus: null }),
  updateCustomsStage: vi.fn().mockResolvedValue({ existing: {}, updated: { id: 'c1' } }),
  deliver: vi.fn().mockResolvedValue({ id: 'sh1', status: 'delivered' }),
  cancel: vi.fn().mockResolvedValue({ id: 'sh1', status: 'cancelled' }),
}));

import * as shipmentService from '../services/shipment.service.js';

const app = createTestApp();
const request = supertest(app);
// Shipment is mounted under logistics: /api/v1/shipments
const BASE = '/api/v1/shipments';

describe('Shipment Routes', () => {
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  // GET /shipments
  describe('GET /shipments', () => {
    it('returns 200 with paginated list', async () => {
      const res = await request.get(BASE).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(shipmentService.list).toHaveBeenCalled();
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(BASE);
      expect(res.status).toBe(401);
    });
  });

  // GET /shipments/:id
  describe('GET /shipments/:id', () => {
    it('returns 200 with shipment', async () => {
      const res = await request.get(`${BASE}/sh1`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(shipmentService.getById).toHaveBeenCalledWith('sh1');
    });
  });

  // POST /shipments/:id/deliver
  describe('POST /shipments/:id/deliver', () => {
    it('returns 200 on deliver', async () => {
      const res = await request.post(`${BASE}/sh1/deliver`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(shipmentService.deliver).toHaveBeenCalledWith('sh1');
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(`${BASE}/sh1/deliver`);
      expect(res.status).toBe(401);
    });
  });

  // POST /shipments/:id/cancel
  describe('POST /shipments/:id/cancel', () => {
    it('returns 200 on cancel', async () => {
      const res = await request.post(`${BASE}/sh1/cancel`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(shipmentService.cancel).toHaveBeenCalledWith('sh1');
    });
  });
});
