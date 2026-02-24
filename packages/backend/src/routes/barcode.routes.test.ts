/**
 * Integration tests for barcode routes.
 */

const { modelCache } = vi.hoisted(() => {
  process.env.JWT_SECRET = 'nit-scs-dev-only-jwt-secret-2026-do-not-use-in-production!';
  process.env.JWT_REFRESH_SECRET = 'nit-scs-dev-only-jwt-refresh-2026-do-not-use-in-production!';
  const modelCache: Record<string, Record<string, ReturnType<typeof vi.fn>>> = {};
  return { modelCache };
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
vi.mock('../services/auth.service.js', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));

vi.mock('../services/barcode.service.js', () => ({
  formatGS1Barcode: vi.fn().mockReturnValue('(01)12345678901234'),
  generateBinLocationQR: vi.fn().mockReturnValue('{"type":"bin","bin":"A-01-01"}'),
  generateItemLabel: vi.fn().mockReturnValue({
    barcodeType: 'code128',
    barcodeValue: 'ITEM-001',
    lines: ['Item 001', 'UOM: EA'],
  }),
}));

// Mock bwip-js to avoid actual barcode generation
vi.mock('bwip-js', () => ({
  default: {
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('fake-png')),
  },
}));

import { createTestApp, signTestToken } from '../test-utils/test-app.js';
import supertest from 'supertest';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });

beforeEach(() => {
  vi.clearAllMocks();
  if (!modelCache['item']) modelCache['item'] = {};
});

describe('GET /api/v1/barcodes/generate', () => {
  it('should return 200 with barcode image', async () => {
    const res = await request
      .get('/api/v1/barcodes/generate?data=TEST123&type=code128')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
  });

  it('should return 400 when data is missing', async () => {
    const res = await request.get('/api/v1/barcodes/generate').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/data/i);
  });

  it('should return 400 for invalid barcode type', async () => {
    const res = await request
      .get('/api/v1/barcodes/generate?data=TEST123&type=invalid')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/barcodes/generate?data=TEST123');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/barcodes/generate/gs1', () => {
  it('should return 200 with GS1 barcode', async () => {
    const res = await request
      .get('/api/v1/barcodes/generate/gs1?itemCode=ITEM001')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
  });

  it('should return 400 when itemCode is missing', async () => {
    const res = await request.get('/api/v1/barcodes/generate/gs1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/itemCode/i);
  });
});

describe('GET /api/v1/barcodes/lookup/:code', () => {
  it('should return 200 when item found', async () => {
    modelCache['item']!['findFirst'] = vi.fn().mockResolvedValue({
      id: 'item-1',
      itemCode: 'ITEM001',
      itemDescription: 'Test Item',
    });

    const res = await request.get('/api/v1/barcodes/lookup/ITEM001').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 404 when item not found', async () => {
    modelCache['item']!['findFirst'] = vi.fn().mockResolvedValue(null);

    const res = await request.get('/api/v1/barcodes/lookup/NOTFOUND').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/barcodes/lookup/ITEM001');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/barcodes/print-labels', () => {
  it('should return 400 when itemIds is empty', async () => {
    const res = await request
      .post('/api/v1/barcodes/print-labels')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ itemIds: [] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/api/v1/barcodes/print-labels').send({ itemIds: ['id-1'] });
    expect(res.status).toBe(401);
  });
});
