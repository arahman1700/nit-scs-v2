/**
 * Integration tests for receiving-automation routes.
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

vi.mock('../services/receiving-automation.service.js', () => ({
  generateReceivingPlan: vi.fn(),
  executeReceiving: vi.fn(),
  autoReceiveGrn: vi.fn(),
  calculateAsnDuties: vi.fn(),
}));

import { createTestApp, signTestToken } from '../../../test-utils/test-app.js';
import supertest from 'supertest';
import * as receivingService from '../services/receiving-automation.service.js';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
const USER_TOKEN = signTestToken({ userId: 'user-1', systemRole: 'site_engineer' });

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// RECEIVING PLAN
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/v1/receiving-automation/:grnId/plan', () => {
  it('should return 200 with plan', async () => {
    vi.mocked(receivingService.generateReceivingPlan).mockResolvedValue({
      grnId: 'grn-1',
      grnNumber: 'GRN-001',
      warehouseId: 'wh-1',
      lines: [],
    } as never);

    const res = await request
      .post('/api/v1/receiving-automation/grn-1/plan')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 200 for any authenticated role (permission mocked)', async () => {
    vi.mocked(receivingService.generateReceivingPlan).mockResolvedValue({
      grnId: 'grn-1',
      grnNumber: 'GRN-001',
      warehouseId: 'wh-1',
      lines: [],
    } as never);

    const res = await request
      .post('/api/v1/receiving-automation/grn-1/plan')
      .set('Authorization', `Bearer ${USER_TOKEN}`);

    expect(res.status).toBe(200);
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/api/v1/receiving-automation/grn-1/plan');
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// EXECUTE RECEIVING
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/v1/receiving-automation/:grnId/execute', () => {
  it('should return 200 with plan and results', async () => {
    const mockPlan = {
      grnId: 'grn-1',
      grnNumber: 'GRN-001',
      warehouseId: 'wh-1',
      lines: [],
    };
    vi.mocked(receivingService.generateReceivingPlan).mockResolvedValue(mockPlan as never);
    vi.mocked(receivingService.executeReceiving).mockResolvedValue([] as never);

    const res = await request
      .post('/api/v1/receiving-automation/grn-1/execute')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/api/v1/receiving-automation/grn-1/execute');
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// AUTO RECEIVE
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/v1/receiving-automation/:grnId/auto-receive', () => {
  it('should return 200 with auto-receive result', async () => {
    vi.mocked(receivingService.autoReceiveGrn).mockResolvedValue({
      grnId: 'grn-1',
      grnNumber: 'GRN-001',
      warehouseId: 'wh-1',
      lpnsCreated: 3,
      tasksCreated: 3,
      details: [],
    } as never);

    const res = await request
      .post('/api/v1/receiving-automation/grn-1/auto-receive')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 200 for any authenticated role (permission mocked)', async () => {
    vi.mocked(receivingService.autoReceiveGrn).mockResolvedValue({
      grnId: 'grn-1',
      grnNumber: 'GRN-001',
      warehouseId: 'wh-1',
      lpnsCreated: 1,
      tasksCreated: 1,
      details: [],
    } as never);

    const res = await request
      .post('/api/v1/receiving-automation/grn-1/auto-receive')
      .set('Authorization', `Bearer ${USER_TOKEN}`);

    expect(res.status).toBe(200);
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/api/v1/receiving-automation/grn-1/auto-receive');
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CALCULATE ASN DUTIES
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/v1/receiving-automation/asn/:asnId/duties', () => {
  it('should return 200 with duty calculations', async () => {
    vi.mocked(receivingService.calculateAsnDuties).mockResolvedValue({
      asnId: 'asn-1',
      asnNumber: 'ASN-001',
      lineCount: 2,
      totalEstimatedDuty: 500,
      totalEstimatedVat: 825,
      totalEstimatedCost: 1325,
      lines: [],
    } as never);

    const res = await request
      .get('/api/v1/receiving-automation/asn/asn-1/duties')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 200 for any authenticated role (permission mocked)', async () => {
    vi.mocked(receivingService.calculateAsnDuties).mockResolvedValue({
      asnId: 'asn-1',
      asnNumber: 'ASN-001',
      lineCount: 0,
      totalEstimatedDuty: 0,
      totalEstimatedVat: 0,
      totalEstimatedCost: 0,
      lines: [],
    } as never);

    const res = await request
      .get('/api/v1/receiving-automation/asn/asn-1/duties')
      .set('Authorization', `Bearer ${USER_TOKEN}`);

    expect(res.status).toBe(200);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/receiving-automation/asn/asn-1/duties');
    expect(res.status).toBe(401);
  });
});
