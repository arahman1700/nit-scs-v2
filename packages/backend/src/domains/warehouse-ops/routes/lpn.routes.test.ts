/**
 * Integration tests for LPN (License Plate Number) routes.
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

vi.mock('../services/lpn.service.js', () => ({
  createLpn: vi.fn(),
  getLpnById: vi.fn(),
  getLpns: vi.fn(),
  receiveLpn: vi.fn(),
  storeLpn: vi.fn(),
  pickLpn: vi.fn(),
  packLpn: vi.fn(),
  shipLpn: vi.fn(),
  dissolveLpn: vi.fn(),
  moveLpn: vi.fn(),
  addContent: vi.fn(),
  removeContent: vi.fn(),
  getStats: vi.fn(),
}));

import { createTestApp, signTestToken } from '../../../test-utils/test-app.js';
import supertest from 'supertest';
import * as lpnService from '../services/lpn.service.js';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });

const UUID1 = '00000000-0000-0000-0000-000000000001';
const UUID2 = '00000000-0000-0000-0000-000000000002';

beforeEach(() => {
  vi.clearAllMocks();
});

// ── GET /api/v1/lpns — Paginated list ────────────────────────────────────

describe('GET /api/v1/lpns', () => {
  it('should return 200 with paginated list', async () => {
    vi.mocked(lpnService.getLpns).mockResolvedValue({
      data: [{ id: 'lpn-1', lpnNumber: 'LPN-001' }],
      total: 1,
      page: 1,
      pageSize: 25,
    } as never);

    const res = await request.get('/api/v1/lpns').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/lpns');
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/lpns/stats — LPN statistics ─────────────────────────────

describe('GET /api/v1/lpns/stats', () => {
  it('should return 200 with stats', async () => {
    vi.mocked(lpnService.getStats).mockResolvedValue({
      created: 5,
      inReceiving: 2,
      stored: 10,
      inPicking: 1,
      inPacking: 0,
      shipped: 3,
      dissolved: 0,
    } as never);

    const res = await request.get('/api/v1/lpns/stats').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/lpns/stats');
    expect(res.status).toBe(401);
  });
});

// ── GET /api/v1/lpns/:id — Single LPN detail ────────────────────────────

describe('GET /api/v1/lpns/:id', () => {
  it('should return 200 with detail', async () => {
    vi.mocked(lpnService.getLpnById).mockResolvedValue({
      id: 'lpn-1',
      lpnNumber: 'LPN-001',
      status: 'created',
    } as never);

    const res = await request.get('/api/v1/lpns/lpn-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/lpns/lpn-1');
    expect(res.status).toBe(401);
  });
});

// ── POST /api/v1/lpns — Create an LPN ───────────────────────────────────

describe('POST /api/v1/lpns', () => {
  const validBody = {
    lpnNumber: 'LPN-001',
    warehouseId: UUID1,
    lpnType: 'pallet',
  };

  it('should return 201 on successful create', async () => {
    vi.mocked(lpnService.createLpn).mockResolvedValue({ id: 'lpn-1', ...validBody } as never);

    const res = await request.post('/api/v1/lpns').set('Authorization', `Bearer ${ADMIN_TOKEN}`).send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 for invalid body — missing lpnNumber', async () => {
    const res = await request
      .post('/api/v1/lpns')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ warehouseId: UUID1, lpnType: 'pallet' });

    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid body — invalid lpnType', async () => {
    const res = await request
      .post('/api/v1/lpns')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ lpnNumber: 'LPN-001', warehouseId: UUID1, lpnType: 'invalid-type' });

    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid body — warehouseId not a UUID', async () => {
    const res = await request
      .post('/api/v1/lpns')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ lpnNumber: 'LPN-001', warehouseId: 'not-a-uuid', lpnType: 'pallet' });

    expect(res.status).toBe(400);
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/api/v1/lpns').send(validBody);
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/v1/lpns/:id/receive — Transition to in_receiving ─────────

describe('PATCH /api/v1/lpns/:id/receive', () => {
  it('should return 200 on successful receive', async () => {
    vi.mocked(lpnService.receiveLpn).mockResolvedValue({
      id: 'lpn-1',
      status: 'in_receiving',
    } as never);

    const res = await request.patch('/api/v1/lpns/lpn-1/receive').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 when service rejects transition', async () => {
    vi.mocked(lpnService.receiveLpn).mockRejectedValue(
      new Error("Cannot receive LPN in status 'stored'. Must be 'created'."),
    );

    const res = await request.patch('/api/v1/lpns/lpn-1/receive').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(400);
  });

  it('should return 401 without auth', async () => {
    const res = await request.patch('/api/v1/lpns/lpn-1/receive');
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/v1/lpns/:id/store — Transition to stored ─────────────────

describe('PATCH /api/v1/lpns/:id/store', () => {
  it('should return 200 on successful store', async () => {
    vi.mocked(lpnService.storeLpn).mockResolvedValue({
      id: 'lpn-1',
      status: 'stored',
    } as never);

    const res = await request.patch('/api/v1/lpns/lpn-1/store').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 when service rejects transition', async () => {
    vi.mocked(lpnService.storeLpn).mockRejectedValue(
      new Error("Cannot store LPN in status 'created'. Must be 'in_receiving'."),
    );

    const res = await request.patch('/api/v1/lpns/lpn-1/store').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(400);
  });

  it('should return 401 without auth', async () => {
    const res = await request.patch('/api/v1/lpns/lpn-1/store');
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/v1/lpns/:id/pick — Transition to in_picking ──────────────

describe('PATCH /api/v1/lpns/:id/pick', () => {
  it('should return 200 on successful pick', async () => {
    vi.mocked(lpnService.pickLpn).mockResolvedValue({
      id: 'lpn-1',
      status: 'in_picking',
    } as never);

    const res = await request.patch('/api/v1/lpns/lpn-1/pick').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 when service rejects transition', async () => {
    vi.mocked(lpnService.pickLpn).mockRejectedValue(
      new Error("Cannot pick LPN in status 'created'. Must be 'stored'."),
    );

    const res = await request.patch('/api/v1/lpns/lpn-1/pick').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(400);
  });

  it('should return 401 without auth', async () => {
    const res = await request.patch('/api/v1/lpns/lpn-1/pick');
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/v1/lpns/:id/dissolve — Dissolve LPN ──────────────────────

describe('PATCH /api/v1/lpns/:id/dissolve', () => {
  it('should return 200 on successful dissolve', async () => {
    vi.mocked(lpnService.dissolveLpn).mockResolvedValue({
      id: 'lpn-1',
      status: 'dissolved',
    } as never);

    const res = await request.patch('/api/v1/lpns/lpn-1/dissolve').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 when service rejects dissolve', async () => {
    vi.mocked(lpnService.dissolveLpn).mockRejectedValue(new Error("Cannot dissolve LPN in status 'shipped'."));

    const res = await request.patch('/api/v1/lpns/lpn-1/dissolve').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(400);
  });

  it('should return 401 without auth', async () => {
    const res = await request.patch('/api/v1/lpns/lpn-1/dissolve');
    expect(res.status).toBe(401);
  });
});

// ── POST /api/v1/lpns/:id/contents — Add content to LPN ─────────────────

describe('POST /api/v1/lpns/:id/contents', () => {
  const validContent = {
    itemId: UUID1,
    quantity: 10,
  };

  it('should return 201 on successful add', async () => {
    vi.mocked(lpnService.addContent).mockResolvedValue({ id: 'content-1', ...validContent } as never);

    const res = await request
      .post('/api/v1/lpns/lpn-1/contents')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send(validContent);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 for invalid body — missing itemId', async () => {
    const res = await request
      .post('/api/v1/lpns/lpn-1/contents')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ quantity: 10 });

    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid body — non-positive quantity', async () => {
    const res = await request
      .post('/api/v1/lpns/lpn-1/contents')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ itemId: UUID1, quantity: 0 });

    expect(res.status).toBe(400);
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/api/v1/lpns/lpn-1/contents').send(validContent);
    expect(res.status).toBe(401);
  });
});

// ── DELETE /api/v1/lpns/contents/:contentId — Remove content ─────────────

describe('DELETE /api/v1/lpns/contents/:contentId', () => {
  it('should return 200 on successful delete', async () => {
    vi.mocked(lpnService.removeContent).mockResolvedValue({ deleted: true } as never);

    const res = await request.delete('/api/v1/lpns/contents/content-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.delete('/api/v1/lpns/contents/content-1');
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/v1/lpns/:id/move — Move LPN to new location ──────────────

describe('PATCH /api/v1/lpns/:id/move', () => {
  it('should return 200 on successful move', async () => {
    vi.mocked(lpnService.moveLpn).mockResolvedValue({ id: 'lpn-1', zoneId: UUID2 } as never);

    const res = await request
      .patch('/api/v1/lpns/lpn-1/move')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ zoneId: UUID2 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.patch('/api/v1/lpns/lpn-1/move').send({ zoneId: UUID2 });
    expect(res.status).toBe(401);
  });
});
