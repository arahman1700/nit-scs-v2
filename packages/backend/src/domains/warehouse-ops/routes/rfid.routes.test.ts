/**
 * Integration tests for RFID tag routes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.hoisted(() => {
  process.env.JWT_SECRET = 'nit-scs-dev-only-jwt-secret-2026-do-not-use-in-production!';
  process.env.JWT_REFRESH_SECRET = 'nit-scs-dev-only-jwt-refresh-2026-do-not-use-in-production!';
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
  getAuditLogs: vi.fn(),
  createAuditLog: vi.fn().mockResolvedValue({}),
}));

vi.mock('../services/rfid.service.js', () => ({
  getTags: vi.fn(),
  getStats: vi.fn(),
  getTagById: vi.fn(),
  getTagByEpc: vi.fn(),
  registerTag: vi.fn(),
  recordScan: vi.fn(),
  bulkScan: vi.fn(),
  associateWithLpn: vi.fn(),
  deactivate: vi.fn(),
}));

import { createTestApp, signTestToken } from '../../../test-utils/test-app.js';
import supertest from 'supertest';
import * as rfidService from '../services/rfid.service.js';

const app = createTestApp();
const request = supertest(app);

// RFID routes do not use authenticate middleware, but we still generate
// a token in case any shared middleware needs it for other route registrations.
const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });

beforeEach(() => {
  vi.clearAllMocks();
});

// ── GET /api/v1/rfid — List tags ─────────────────────────────────────────

describe('GET /api/v1/rfid', () => {
  it('should return 200 with tag list', async () => {
    vi.mocked(rfidService.getTags).mockResolvedValue({
      data: [{ id: 'tag-1', epc: 'EPC-001', tagType: 'lpn' }],
      total: 1,
      page: 1,
      pageSize: 25,
    } as never);

    const res = await request.get('/api/v1/rfid');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  it('should pass query filters to service', async () => {
    vi.mocked(rfidService.getTags).mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      pageSize: 25,
    } as never);

    await request.get('/api/v1/rfid?warehouseId=wh-1&tagType=lpn&isActive=true&page=2&pageSize=10');

    expect(rfidService.getTags).toHaveBeenCalledWith({
      warehouseId: 'wh-1',
      tagType: 'lpn',
      isActive: true,
      lpnId: undefined,
      page: 2,
      pageSize: 10,
    });
  });

  it('should return 500 when service throws', async () => {
    vi.mocked(rfidService.getTags).mockRejectedValue(new Error('DB error'));

    const res = await request.get('/api/v1/rfid');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to fetch RFID tags');
  });
});

// ── GET /api/v1/rfid/stats — Tag statistics ──────────────────────────────

describe('GET /api/v1/rfid/stats', () => {
  it('should return 200 with stats', async () => {
    vi.mocked(rfidService.getStats).mockResolvedValue({
      totalActive: 50,
      totalInactive: 5,
      byType: { lpn: 30, item: 15, asset: 5, zone_gate: 0 },
    } as never);

    const res = await request.get('/api/v1/rfid/stats');

    expect(res.status).toBe(200);
    expect(res.body.totalActive).toBe(50);
  });

  it('should return 500 when service throws', async () => {
    vi.mocked(rfidService.getStats).mockRejectedValue(new Error('DB error'));

    const res = await request.get('/api/v1/rfid/stats');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Failed to fetch RFID stats');
  });
});

// ── GET /api/v1/rfid/:id — Get tag by ID ────────────────────────────────

describe('GET /api/v1/rfid/:id', () => {
  it('should return 200 with tag detail', async () => {
    vi.mocked(rfidService.getTagById).mockResolvedValue({
      id: 'tag-1',
      epc: 'EPC-001',
      tagType: 'lpn',
      isActive: true,
    } as never);

    const res = await request.get('/api/v1/rfid/tag-1');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe('tag-1');
  });

  it('should return 404 when tag not found', async () => {
    const { NotFoundError } = await import('@nit-scs-v2/shared');
    vi.mocked(rfidService.getTagById).mockRejectedValue(new NotFoundError('RfidTag', 'missing-id'));

    const res = await request.get('/api/v1/rfid/missing-id');

    expect(res.status).toBe(404);
  });
});

// ── POST /api/v1/rfid — Register a new tag ──────────────────────────────

describe('POST /api/v1/rfid', () => {
  const validBody = {
    epc: 'EPC-001',
    tagType: 'lpn',
    warehouseId: '00000000-0000-0000-0000-000000000001',
  };

  it('should return 201 on successful registration', async () => {
    vi.mocked(rfidService.registerTag).mockResolvedValue({
      id: 'tag-1',
      ...validBody,
      isActive: true,
    } as never);

    const res = await request.post('/api/v1/rfid').send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.id).toBe('tag-1');
  });

  it('should return 409 on duplicate EPC', async () => {
    vi.mocked(rfidService.registerTag).mockRejectedValue(
      Object.assign(new Error('Unique constraint'), { code: 'P2002' }),
    );

    const res = await request.post('/api/v1/rfid').send(validBody);

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('EPC already registered');
  });

  it('should return 400 when service throws generic error', async () => {
    vi.mocked(rfidService.registerTag).mockRejectedValue(new Error('Validation failed'));

    const res = await request.post('/api/v1/rfid').send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });
});

// ── POST /api/v1/rfid/scan — Record a single scan event ─────────────────

describe('POST /api/v1/rfid/scan', () => {
  it('should return 200 on successful scan', async () => {
    vi.mocked(rfidService.recordScan).mockResolvedValue({
      id: 'tag-1',
      epc: 'EPC-001',
      lastReaderId: 'reader-1',
    } as never);

    const res = await request.post('/api/v1/rfid/scan').send({ epc: 'EPC-001', readerId: 'reader-1' });

    expect(res.status).toBe(200);
    expect(res.body.epc).toBe('EPC-001');
  });

  it('should return 400 when epc is missing', async () => {
    const res = await request.post('/api/v1/rfid/scan').send({ readerId: 'reader-1' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('epc and readerId required');
  });

  it('should return 400 when readerId is missing', async () => {
    const res = await request.post('/api/v1/rfid/scan').send({ epc: 'EPC-001' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('epc and readerId required');
  });

  it('should return 404 when tag not found', async () => {
    const { NotFoundError } = await import('@nit-scs-v2/shared');
    vi.mocked(rfidService.recordScan).mockRejectedValue(new NotFoundError('RfidTag', 'EPC-999'));

    const res = await request.post('/api/v1/rfid/scan').send({ epc: 'EPC-999', readerId: 'reader-1' });

    expect(res.status).toBe(404);
  });
});

// ── POST /api/v1/rfid/bulk-scan — Process multiple scan events ──────────

describe('POST /api/v1/rfid/bulk-scan', () => {
  it('should return 200 with scan results', async () => {
    vi.mocked(rfidService.bulkScan).mockResolvedValue([
      { epc: 'EPC-001', found: true, tagType: 'lpn' },
      { epc: 'EPC-002', found: false },
    ] as never);

    const res = await request.post('/api/v1/rfid/bulk-scan').send({
      scans: [
        { epc: 'EPC-001', readerId: 'reader-1' },
        { epc: 'EPC-002', readerId: 'reader-1' },
      ],
    });

    expect(res.status).toBe(200);
    expect(res.body.results).toHaveLength(2);
  });

  it('should return 400 when scans is not an array', async () => {
    const res = await request.post('/api/v1/rfid/bulk-scan').send({ scans: 'not-an-array' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('scans array required');
  });

  it('should return 400 when scans is missing', async () => {
    const res = await request.post('/api/v1/rfid/bulk-scan').send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('scans array required');
  });
});

// ── PATCH /api/v1/rfid/:id/associate-lpn — Link tag to LPN ──────────────

describe('PATCH /api/v1/rfid/:id/associate-lpn', () => {
  it('should return 200 on successful association', async () => {
    vi.mocked(rfidService.associateWithLpn).mockResolvedValue({
      id: 'tag-1',
      lpnId: 'lpn-1',
      tagType: 'lpn',
    } as never);

    const res = await request.patch('/api/v1/rfid/tag-1/associate-lpn').send({ lpnId: 'lpn-1' });

    expect(res.status).toBe(200);
    expect(res.body.lpnId).toBe('lpn-1');
  });

  it('should return 400 when lpnId is missing', async () => {
    const res = await request.patch('/api/v1/rfid/tag-1/associate-lpn').send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('lpnId required');
  });
});

// ── PATCH /api/v1/rfid/:id/deactivate — Deactivate tag ──────────────────

describe('PATCH /api/v1/rfid/:id/deactivate', () => {
  it('should return 200 on successful deactivation', async () => {
    vi.mocked(rfidService.deactivate).mockResolvedValue({
      id: 'tag-1',
      isActive: false,
    } as never);

    const res = await request.patch('/api/v1/rfid/tag-1/deactivate');

    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);
  });

  it('should return 404 when tag not found', async () => {
    const { NotFoundError } = await import('@nit-scs-v2/shared');
    vi.mocked(rfidService.deactivate).mockRejectedValue(new NotFoundError('RfidTag', 'missing-id'));

    const res = await request.patch('/api/v1/rfid/missing-id/deactivate');

    expect(res.status).toBe(404);
  });
});
