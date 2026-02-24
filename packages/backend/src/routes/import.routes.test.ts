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

vi.mock('../services/import.service.js', () => ({
  parseExcelPreview: vi.fn().mockResolvedValue({ headers: ['col1'], rows: [{ col1: 'val1' }], totalRows: 1 }),
  executeImport: vi.fn().mockResolvedValue({ total: 10, succeeded: 8, failed: 2, errors: [] }),
  getExpectedFields: vi.fn().mockReturnValue([
    { name: 'itemCode', required: true },
    { name: 'itemDescription', required: true },
  ]),
}));

vi.mock('../services/audit.service.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue({}),
}));

import * as importService from '../services/import.service.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/import';

describe('Import Routes', () => {
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  describe('GET /api/v1/import/fields/:entity', () => {
    it('returns 200 with expected fields for an entity', async () => {
      const res = await request.get(`${BASE}/fields/items`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.entity).toBe('items');
      expect(res.body.data.fields).toHaveLength(2);
      expect(importService.getExpectedFields).toHaveBeenCalledWith('items');
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(`${BASE}/fields/items`);
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-admin/manager users', async () => {
      const viewerToken = signTestToken({ userId: 'viewer-user', systemRole: 'viewer' });
      const res = await request.get(`${BASE}/fields/items`).set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/import/execute', () => {
    it('returns 200 on successful import execution', async () => {
      const res = await request
        .post(`${BASE}/execute`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          body: {
            entity: 'items',
            mapping: { col1: 'itemCode', col2: 'itemDescription' },
            rows: [{ col1: 'IT-001', col2: 'Steel Pipe' }],
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total).toBe(10);
      expect(importService.executeImport).toHaveBeenCalled();
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(`${BASE}/execute`).send({ entity: 'items', mapping: {}, rows: [] });

      expect(res.status).toBe(401);
    });
  });
});
