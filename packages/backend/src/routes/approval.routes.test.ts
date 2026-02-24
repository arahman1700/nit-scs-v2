/**
 * Integration tests for approval routes.
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

vi.mock('../services/approval.service.js', () => ({
  getApprovalSteps: vi.fn(),
  getPendingApprovalsForUser: vi.fn(),
  getApprovalChain: vi.fn(),
}));

import { createTestApp, signTestToken } from '../test-utils/test-app.js';
import supertest from 'supertest';
import * as approvalService from '../services/approval.service.js';
import { prisma } from '../utils/prisma.js';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
const USER_TOKEN = signTestToken({ userId: 'user-1', systemRole: 'site_engineer' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/approvals/pending', () => {
  it('should return 200 with pending approvals', async () => {
    vi.mocked(approvalService.getPendingApprovalsForUser).mockResolvedValue([{ id: 'step-1' }] as never);

    const res = await request.get('/api/v1/approvals/pending').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(approvalService.getPendingApprovalsForUser).toHaveBeenCalledWith('test-user-id');
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/approvals/pending');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/approvals/chain/:documentType/:amount', () => {
  it('should return 200 with chain', async () => {
    vi.mocked(approvalService.getApprovalChain).mockResolvedValue([{ level: 1, role: 'manager' }] as never);

    const res = await request.get('/api/v1/approvals/chain/mrrv/5000').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(approvalService.getApprovalChain).toHaveBeenCalledWith('mrrv', 5000);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/approvals/chain/mrrv/5000');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/approvals/steps/:documentType/:documentId', () => {
  it('should return 200 with steps', async () => {
    vi.mocked(approvalService.getApprovalSteps).mockResolvedValue([{ id: 's1', level: 1 }] as never);

    const res = await request.get('/api/v1/approvals/steps/mrrv/doc-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(approvalService.getApprovalSteps).toHaveBeenCalledWith('mrrv', 'doc-1');
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/approvals/steps/mrrv/doc-1');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/approvals/workflows', () => {
  it('should return 200 with workflows', async () => {
    const findManyMock = vi.fn().mockResolvedValue([{ id: 'w1', documentType: 'mrrv' }]);
    (prisma.approvalWorkflow as unknown as { findMany: ReturnType<typeof vi.fn> }).findMany = findManyMock;

    const res = await request.get('/api/v1/approvals/workflows').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/approvals/workflows');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/approvals/workflows', () => {
  it('should return 200 for admin creating workflow', async () => {
    const createMock = vi.fn().mockResolvedValue({ id: 'w1', documentType: 'mrrv', minAmount: 0 });
    (prisma.approvalWorkflow as unknown as { create: ReturnType<typeof vi.fn> }).create = createMock;

    const res = await request
      .post('/api/v1/approvals/workflows')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ documentType: 'mrrv', minAmount: 0, approverRole: 'manager', slaHours: 24 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 when missing required fields', async () => {
    const res = await request
      .post('/api/v1/approvals/workflows')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ documentType: 'mrrv' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 403 for non-admin', async () => {
    const res = await request
      .post('/api/v1/approvals/workflows')
      .set('Authorization', `Bearer ${USER_TOKEN}`)
      .send({ documentType: 'mrrv', minAmount: 0, approverRole: 'manager', slaHours: 24 });

    expect(res.status).toBe(403);
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/api/v1/approvals/workflows').send({});
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/v1/approvals/workflows/:id', () => {
  it('should return 200 for admin deleting workflow', async () => {
    const deleteMock = vi.fn().mockResolvedValue({});
    (prisma.approvalWorkflow as unknown as { delete: ReturnType<typeof vi.fn> }).delete = deleteMock;

    const res = await request.delete('/api/v1/approvals/workflows/w1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 403 for non-admin', async () => {
    const res = await request.delete('/api/v1/approvals/workflows/w1').set('Authorization', `Bearer ${USER_TOKEN}`);

    expect(res.status).toBe(403);
  });
});
