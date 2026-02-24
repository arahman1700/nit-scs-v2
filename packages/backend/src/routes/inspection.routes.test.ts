import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createTestApp, signTestToken } from '../test-utils/test-app.js';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'nit-scs-dev-only-jwt-secret-2026-do-not-use-in-production!';
  process.env.JWT_REFRESH_SECRET = 'nit-scs-dev-only-jwt-refresh-2026-do-not-use-in-production!';
});

vi.mock('../config/redis.js', () => ({
  getRedis: vi.fn().mockReturnValue(null),
  isRedisAvailable: vi.fn().mockReturnValue(false),
}));
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

vi.mock('../services/aql.service.js', () => ({
  calculateSampleSize: vi.fn().mockReturnValue({
    lotSize: 1000,
    level: 'II',
    aqlPercent: 1.0,
    sampleSize: 80,
    acceptNumber: 2,
    rejectNumber: 3,
    sampleCode: 'J',
  }),
  getAqlTable: vi.fn().mockReturnValue({
    rows: [{ letterCode: 'A', sampleSize: 2 }],
  }),
}));

vi.mock('../services/inspection-checklist.service.js', () => ({
  list: vi.fn().mockResolvedValue([{ id: 'cl1', name: 'QC Checklist', isActive: true }]),
  getById: vi.fn().mockResolvedValue({ id: 'cl1', name: 'QC Checklist', items: [] }),
  create: vi.fn().mockResolvedValue({ id: 'cl2', name: 'New Checklist' }),
  update: vi.fn().mockResolvedValue({ id: 'cl1', name: 'Updated' }),
  remove: vi.fn().mockResolvedValue(undefined),
  listItems: vi.fn().mockResolvedValue([{ id: 'item1', description: 'Check A' }]),
  addItem: vi.fn().mockResolvedValue({ id: 'item2', description: 'Check B' }),
  updateItem: vi.fn().mockResolvedValue({ id: 'item1', description: 'Updated Check' }),
  removeItem: vi.fn().mockResolvedValue(undefined),
  reorderItems: vi.fn().mockResolvedValue([{ id: 'item1' }, { id: 'item2' }]),
  getChecklistsByCategory: vi.fn().mockResolvedValue([]),
}));

import * as aqlService from '../services/aql.service.js';
import * as checklistService from '../services/inspection-checklist.service.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/inspections';

describe('Inspection Routes', () => {
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  describe('GET /api/v1/inspections/aql/calculate', () => {
    it('returns 200 with sample size calculation', async () => {
      const res = await request
        .get(`${BASE}/aql/calculate?lotSize=1000&level=II&aql=1.0`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sampleSize).toBe(80);
      expect(aqlService.calculateSampleSize).toHaveBeenCalledWith(1000, 'II', 1.0);
    });

    it('returns 400 for invalid lotSize', async () => {
      const res = await request
        .get(`${BASE}/aql/calculate?lotSize=abc&level=II&aql=1.0`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(`${BASE}/aql/calculate?lotSize=1000&level=II&aql=1.0`);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/inspections/aql/table', () => {
    it('returns 200 with AQL reference table', async () => {
      const res = await request.get(`${BASE}/aql/table`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(aqlService.getAqlTable).toHaveBeenCalled();
    });
  });

  describe('GET /api/v1/inspections/checklists', () => {
    it('returns 200 with list of checklists', async () => {
      const res = await request.get(`${BASE}/checklists`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(checklistService.list).toHaveBeenCalled();
    });
  });

  describe('POST /api/v1/inspections/checklists', () => {
    it('returns 201 on creating a checklist', async () => {
      const res = await request
        .post(`${BASE}/checklists`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New Checklist', category: 'general', isActive: true });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /api/v1/inspections/checklists/:id', () => {
    it('returns 204 on successful delete', async () => {
      const res = await request.delete(`${BASE}/checklists/cl1`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(204);
    });
  });
});
