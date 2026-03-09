/**
 * Integration tests for compliance checklist & audit routes.
 */

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

vi.mock('../services/compliance.service.js', () => ({
  listChecklists: vi.fn(),
  getChecklistById: vi.fn(),
  createChecklist: vi.fn(),
  updateChecklist: vi.fn(),
  listAudits: vi.fn(),
  getAuditById: vi.fn(),
  createAudit: vi.fn(),
  updateAudit: vi.fn(),
  submitResponses: vi.fn(),
  completeAudit: vi.fn(),
}));

import { createTestApp, signTestToken } from '../../../test-utils/test-app.js';
import supertest from 'supertest';
import * as complianceService from '../services/compliance.service.js';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
const QC_TOKEN = signTestToken({ userId: 'qc-1', systemRole: 'qc_officer' });
const STAFF_TOKEN = signTestToken({ userId: 'staff-1', systemRole: 'warehouse_staff' });

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════
// CHECKLISTS
// ═══════════════════════════════════════════════════════════════════════

describe('GET /api/v1/compliance/checklists', () => {
  it('should return 200 with checklist list', async () => {
    vi.mocked(complianceService.listChecklists).mockResolvedValue({
      data: [{ id: 'cl-1', title: 'ISO 9001' }],
      total: 1,
    } as never);

    const res = await request.get('/api/v1/compliance/checklists').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should pass query params to service', async () => {
    vi.mocked(complianceService.listChecklists).mockResolvedValue({ data: [], total: 0 } as never);

    await request
      .get('/api/v1/compliance/checklists?search=iso&status=active&page=2&pageSize=10')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(complianceService.listChecklists).toHaveBeenCalledWith(
      expect.objectContaining({
        search: 'iso',
        status: 'active',
        skip: 10,
        pageSize: 10,
      }),
    );
  });

  it('should allow qc_officer role', async () => {
    vi.mocked(complianceService.listChecklists).mockResolvedValue({ data: [], total: 0 } as never);

    const res = await request.get('/api/v1/compliance/checklists').set('Authorization', `Bearer ${QC_TOKEN}`);

    expect(res.status).toBe(200);
  });

  it('should return 403 for unauthorized role', async () => {
    const res = await request.get('/api/v1/compliance/checklists').set('Authorization', `Bearer ${STAFF_TOKEN}`);

    expect(res.status).toBe(403);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/compliance/checklists');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/compliance/checklists', () => {
  const validBody = { title: 'Safety Checklist', standard: 'ISO 9001', category: 'safety' };

  it('should return 201 on success', async () => {
    vi.mocked(complianceService.createChecklist).mockResolvedValue({ id: 'cl-1', ...validBody } as never);

    const res = await request
      .post('/api/v1/compliance/checklists')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('should return 403 for unauthorized role', async () => {
    const res = await request
      .post('/api/v1/compliance/checklists')
      .set('Authorization', `Bearer ${STAFF_TOKEN}`)
      .send(validBody);

    expect(res.status).toBe(403);
  });
});

describe('GET /api/v1/compliance/checklists/:id', () => {
  it('should return 200 with checklist detail', async () => {
    vi.mocked(complianceService.getChecklistById).mockResolvedValue({
      id: 'cl-1',
      title: 'ISO 9001',
      items: [],
    } as never);

    const res = await request.get('/api/v1/compliance/checklists/cl-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(complianceService.getChecklistById).toHaveBeenCalledWith('cl-1');
  });

  it('should propagate not found error', async () => {
    vi.mocked(complianceService.getChecklistById).mockRejectedValue(
      Object.assign(new Error('Not found'), { statusCode: 404 }),
    );

    const res = await request
      .get('/api/v1/compliance/checklists/nonexistent')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(500);
  });
});

describe('PUT /api/v1/compliance/checklists/:id', () => {
  it('should return 200 on update', async () => {
    vi.mocked(complianceService.updateChecklist).mockResolvedValue({ id: 'cl-1', title: 'Updated' } as never);

    const res = await request
      .put('/api/v1/compliance/checklists/cl-1')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ title: 'Updated' });

    expect(res.status).toBe(200);
    expect(complianceService.updateChecklist).toHaveBeenCalledWith('cl-1', { title: 'Updated' });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// AUDITS
// ═══════════════════════════════════════════════════════════════════════

describe('GET /api/v1/compliance/audits', () => {
  it('should return 200 with audit list', async () => {
    vi.mocked(complianceService.listAudits).mockResolvedValue({
      data: [{ id: 'aud-1' }],
      total: 1,
    } as never);

    const res = await request.get('/api/v1/compliance/audits').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should pass filter params', async () => {
    vi.mocked(complianceService.listAudits).mockResolvedValue({ data: [], total: 0 } as never);

    await request
      .get('/api/v1/compliance/audits?status=draft&warehouseId=wh-1&checklistId=cl-1')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(complianceService.listAudits).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'draft',
        warehouseId: 'wh-1',
        checklistId: 'cl-1',
      }),
    );
  });

  it('should return 403 for unauthorized role', async () => {
    const res = await request.get('/api/v1/compliance/audits').set('Authorization', `Bearer ${STAFF_TOKEN}`);

    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/compliance/audits', () => {
  const validBody = { checklistId: 'cl-1', warehouseId: 'wh-1', title: 'Q1 Audit' };

  it('should return 201 and pass userId', async () => {
    vi.mocked(complianceService.createAudit).mockResolvedValue({ id: 'aud-1', ...validBody } as never);

    const res = await request
      .post('/api/v1/compliance/audits')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send(validBody);

    expect(res.status).toBe(201);
    expect(complianceService.createAudit).toHaveBeenCalledWith(validBody, 'test-user-id');
  });
});

describe('GET /api/v1/compliance/audits/:id', () => {
  it('should return 200 with audit detail', async () => {
    vi.mocked(complianceService.getAuditById).mockResolvedValue({
      id: 'aud-1',
      responses: [],
    } as never);

    const res = await request.get('/api/v1/compliance/audits/aud-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(complianceService.getAuditById).toHaveBeenCalledWith('aud-1');
  });
});

describe('PUT /api/v1/compliance/audits/:id', () => {
  it('should return 200 on update', async () => {
    vi.mocked(complianceService.updateAudit).mockResolvedValue({ id: 'aud-1' } as never);

    const res = await request
      .put('/api/v1/compliance/audits/aud-1')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ title: 'Updated Audit' });

    expect(res.status).toBe(200);
    expect(complianceService.updateAudit).toHaveBeenCalledWith('aud-1', { title: 'Updated Audit' });
  });
});

describe('POST /api/v1/compliance/audits/:id/responses', () => {
  const validResponses = {
    responses: [
      { checklistItemId: 'item-1', response: 'compliant', notes: 'All good' },
      { checklistItemId: 'item-2', response: 'non_compliant', evidence: 'photo.jpg' },
    ],
  };

  it('should return 200 on valid responses', async () => {
    vi.mocked(complianceService.submitResponses).mockResolvedValue({ id: 'aud-1' } as never);

    const res = await request
      .post('/api/v1/compliance/audits/aud-1/responses')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send(validResponses);

    expect(res.status).toBe(200);
    expect(complianceService.submitResponses).toHaveBeenCalledWith('aud-1', validResponses.responses);
  });

  it('should return 400 for empty responses array', async () => {
    const res = await request
      .post('/api/v1/compliance/audits/aud-1/responses')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ responses: [] });

    expect(res.status).toBe(400);
  });

  it('should return 400 for missing responses', async () => {
    const res = await request
      .post('/api/v1/compliance/audits/aud-1/responses')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

describe('POST /api/v1/compliance/audits/:id/complete', () => {
  it('should return 200 and pass userId', async () => {
    vi.mocked(complianceService.completeAudit).mockResolvedValue({
      id: 'aud-1',
      status: 'completed',
      score: 95,
    } as never);

    const res = await request
      .post('/api/v1/compliance/audits/aud-1/complete')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(complianceService.completeAudit).toHaveBeenCalledWith('aud-1', 'test-user-id');
  });

  it('should return 403 for unauthorized role', async () => {
    const res = await request
      .post('/api/v1/compliance/audits/aud-1/complete')
      .set('Authorization', `Bearer ${STAFF_TOKEN}`);

    expect(res.status).toBe(403);
  });
});
