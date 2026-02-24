import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';

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

vi.mock('../services/parallel-approval.service.js', () => ({
  createParallelApproval: vi.fn().mockResolvedValue({ id: 'grp-1', status: 'pending' }),
  respondToApproval: vi.fn().mockResolvedValue({ id: 'grp-1', status: 'approved' }),
  getGroupStatus: vi.fn().mockResolvedValue([]),
  getPendingForApprover: vi.fn().mockResolvedValue([]),
  evaluateGroupCompletion: vi.fn(),
}));

import {
  createParallelApproval,
  respondToApproval,
  getGroupStatus,
  getPendingForApprover,
} from '../services/parallel-approval.service.js';
import { createTestApp, signTestToken } from '../test-utils/test-app.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/parallel-approvals';

describe('Parallel Approval Routes', () => {
  let token: string;

  beforeEach(() => {
    vi.clearAllMocks();
    token = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  describe('GET /api/v1/parallel-approvals/pending', () => {
    it('returns 200 with pending approvals', async () => {
      vi.mocked(getPendingForApprover).mockResolvedValue([{ id: 'grp-1' }] as any);

      const res = await request.get(`${BASE}/pending`).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(getPendingForApprover).toHaveBeenCalledWith('test-user-id');
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(`${BASE}/pending`);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/parallel-approvals', () => {
    it('returns 200 with group status', async () => {
      vi.mocked(getGroupStatus).mockResolvedValue([{ id: 'grp-1' }] as any);

      const res = await request
        .get(`${BASE}?documentType=mrrv&documentId=doc-1`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(getGroupStatus).toHaveBeenCalledWith('mrrv', 'doc-1');
    });

    it('returns 400 when missing query params', async () => {
      const res = await request.get(BASE).set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(`${BASE}?documentType=mrrv&documentId=doc-1`);
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/parallel-approvals', () => {
    it('returns 201 on create', async () => {
      vi.mocked(createParallelApproval).mockResolvedValue({ id: 'grp-new' } as any);

      const res = await request
        .post(BASE)
        .set('Authorization', `Bearer ${token}`)
        .send({
          documentType: 'mrrv',
          documentId: 'doc-1',
          level: 1,
          mode: 'all',
          approverIds: ['user-1', 'user-2'],
        });

      expect(res.status).toBe(201);
      expect(createParallelApproval).toHaveBeenCalled();
    });

    it('returns 400 when missing required fields', async () => {
      const res = await request.post(BASE).set('Authorization', `Bearer ${token}`).send({ documentType: 'mrrv' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid mode', async () => {
      const res = await request
        .post(BASE)
        .set('Authorization', `Bearer ${token}`)
        .send({
          documentType: 'mrrv',
          documentId: 'doc-1',
          level: 1,
          mode: 'invalid',
          approverIds: ['user-1'],
        });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/v1/parallel-approvals/:groupId/respond', () => {
    it('returns 200 on respond', async () => {
      vi.mocked(respondToApproval).mockResolvedValue({ id: 'grp-1' } as any);

      const res = await request
        .post(`${BASE}/grp-1/respond`)
        .set('Authorization', `Bearer ${token}`)
        .send({ decision: 'approved', comments: 'Looks good' });

      expect(res.status).toBe(200);
      expect(respondToApproval).toHaveBeenCalledWith({
        groupId: 'grp-1',
        approverId: 'test-user-id',
        decision: 'approved',
        comments: 'Looks good',
      });
    });

    it('returns 400 for invalid decision', async () => {
      const res = await request
        .post(`${BASE}/grp-1/respond`)
        .set('Authorization', `Bearer ${token}`)
        .send({ decision: 'maybe' });

      expect(res.status).toBe(400);
    });
  });
});
