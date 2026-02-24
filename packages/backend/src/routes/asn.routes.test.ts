/**
 * Integration tests for ASN routes.
 */

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

vi.mock('../services/asn.service.js', () => ({
  getAsns: vi.fn(),
  getAsnById: vi.fn(),
  createAsn: vi.fn(),
  updateAsn: vi.fn(),
  markInTransit: vi.fn(),
  markArrived: vi.fn(),
  receiveAsn: vi.fn(),
  cancelAsn: vi.fn(),
  getVarianceReport: vi.fn(),
}));

import { createTestApp, signTestToken } from '../test-utils/test-app.js';
import supertest from 'supertest';
import * as asnService from '../services/asn.service.js';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
const STAFF_TOKEN = signTestToken({ userId: 'staff-1', systemRole: 'warehouse_staff' });
const VIEWER_TOKEN = signTestToken({ userId: 'viewer-1', systemRole: 'site_engineer' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/asn', () => {
  it('should return 200 with ASN list', async () => {
    vi.mocked(asnService.getAsns).mockResolvedValue({ data: [{ id: 'asn-1' }], total: 1 } as never);

    const res = await request.get('/api/v1/asn').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 403 for unauthorized role', async () => {
    const res = await request.get('/api/v1/asn').set('Authorization', `Bearer ${VIEWER_TOKEN}`);
    expect(res.status).toBe(403);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/asn');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/asn/:id', () => {
  it('should return 200 with ASN detail', async () => {
    vi.mocked(asnService.getAsnById).mockResolvedValue({ id: 'asn-1', status: 'draft' } as never);

    const res = await request.get('/api/v1/asn/asn-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/asn/asn-1');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/asn', () => {
  const validBody = {
    supplierId: 'sup-1',
    warehouseId: 'wh-1',
    expectedArrival: '2026-03-01',
    lines: [{ itemId: 'item-1', expectedQty: 100 }],
  };

  it('should return 201 on success', async () => {
    vi.mocked(asnService.createAsn).mockResolvedValue({ id: 'asn-1', ...validBody } as never);

    const res = await request.post('/api/v1/asn').set('Authorization', `Bearer ${ADMIN_TOKEN}`).send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 when missing required fields', async () => {
    const res = await request
      .post('/api/v1/asn')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ supplierId: 'sup-1' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 400 when lines are empty', async () => {
    const res = await request
      .post('/api/v1/asn')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ supplierId: 'sup-1', warehouseId: 'wh-1', expectedArrival: '2026-03-01', lines: [] });

    expect(res.status).toBe(400);
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/api/v1/asn').send(validBody);
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/asn/:id/in-transit', () => {
  it('should return 200 on success', async () => {
    vi.mocked(asnService.markInTransit).mockResolvedValue({ id: 'asn-1', status: 'in_transit' } as never);

    const res = await request.post('/api/v1/asn/asn-1/in-transit').set('Authorization', `Bearer ${STAFF_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/api/v1/asn/asn-1/in-transit');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/asn/:id/receive', () => {
  it('should return 200 for admin', async () => {
    vi.mocked(asnService.receiveAsn).mockResolvedValue({ id: 'asn-1', grnId: 'grn-1' } as never);

    const res = await request.post('/api/v1/asn/asn-1/receive').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 403 for staff', async () => {
    const res = await request.post('/api/v1/asn/asn-1/receive').set('Authorization', `Bearer ${STAFF_TOKEN}`);

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/v1/asn/:id', () => {
  it('should return 200 on cancel', async () => {
    vi.mocked(asnService.cancelAsn).mockResolvedValue({ id: 'asn-1', status: 'cancelled' } as never);

    const res = await request.delete('/api/v1/asn/asn-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.delete('/api/v1/asn/asn-1');
    expect(res.status).toBe(401);
  });
});
