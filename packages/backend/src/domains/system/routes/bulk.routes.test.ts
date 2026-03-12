import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createTestApp, signTestToken } from '../../../test-utils/test-app.js';

// Ensure JWT secrets are available before any module evaluates
vi.hoisted(() => {
  process.env.JWT_SECRET = 'nit-scs-dev-only-jwt-secret-2026-do-not-use-in-production!';
  process.env.JWT_REFRESH_SECRET = 'nit-scs-dev-only-jwt-refresh-2026-do-not-use-in-production!';
});

// ── Common mocks ──────────────────────────────────────────────────────────
vi.mock('../../auth/services/auth.service.js', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));
vi.mock('../../../config/redis.js', () => ({ getRedis: vi.fn().mockReturnValue(null) }));
vi.mock('../../../config/logger.js', () => ({
  log: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../../../socket/setup.js', () => ({
  setupSocketIO: vi.fn(),
  emitToUser: vi.fn(),
  emitToRole: vi.fn(),
  emitToDocument: vi.fn(),
  emitToAll: vi.fn(),
}));
vi.mock('../../../utils/routeHelpers.js', () => ({ auditAndEmit: vi.fn() }));

// Mock permission service to allow admin through requirePermission
vi.mock('../../auth/services/permission.service.js', () => ({
  hasPermissionDB: vi.fn().mockResolvedValue(true),
}));

// ── Service mocks ─────────────────────────────────────────────────────────
vi.mock('../services/bulk.service.js', () => ({
  executeBulkAction: vi.fn(),
  getAvailableBulkActions: vi.fn(),
}));

vi.mock('../../audit/services/audit.service.js', () => ({
  getAuditLogs: vi.fn(),
  createAuditLog: vi.fn(),
}));

import { executeBulkAction, getAvailableBulkActions } from '../services/bulk.service.js';

const app = createTestApp();
const request = supertest(app);

const UUID1 = '00000000-0000-0000-0000-000000000001';
const UUID2 = '00000000-0000-0000-0000-000000000002';

describe('Bulk Routes', () => {
  let token: string;

  beforeEach(() => {
    vi.clearAllMocks();
    token = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  // ── GET /bulk/actions/:documentType ───────────────────────────────────

  describe('GET /api/v1/bulk/actions/:documentType', () => {
    it('returns 200 with available actions', async () => {
      vi.mocked(getAvailableBulkActions).mockReturnValue(['approve', 'reject']);

      const res = await request.get('/api/v1/bulk/actions/mrrv').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual({
        documentType: 'mrrv',
        actions: ['approve', 'reject'],
      });
      expect(getAvailableBulkActions).toHaveBeenCalledWith('mrrv');
    });

    it('returns empty actions for unknown document type', async () => {
      vi.mocked(getAvailableBulkActions).mockReturnValue([]);

      const res = await request.get('/api/v1/bulk/actions/unknown').set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.actions).toEqual([]);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get('/api/v1/bulk/actions/mrrv');
      expect(res.status).toBe(401);
    });
  });

  // ── POST /bulk/execute ────────────────────────────────────────────────

  describe('POST /api/v1/bulk/execute', () => {
    it('returns 200 and executes bulk action successfully', async () => {
      vi.mocked(getAvailableBulkActions).mockReturnValue(['approve', 'reject']);
      vi.mocked(executeBulkAction).mockResolvedValue([
        { id: UUID1, success: true },
        { id: UUID2, success: true },
      ] as any);

      const res = await request
        .post('/api/v1/bulk/execute')
        .set('Authorization', `Bearer ${token}`)
        .send({
          documentType: 'mrrv',
          ids: [UUID1, UUID2],
          action: 'approve',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.succeeded).toBe(2);
      expect(res.body.data.failed).toBe(0);
      expect(executeBulkAction).toHaveBeenCalledWith('mrrv', [UUID1, UUID2], 'approve', 'test-user-id', undefined);
    });

    it('returns 400 when action is not available for document type', async () => {
      vi.mocked(getAvailableBulkActions).mockReturnValue(['approve']);

      const res = await request
        .post('/api/v1/bulk/execute')
        .set('Authorization', `Bearer ${token}`)
        .send({
          documentType: 'mrrv',
          ids: [UUID1],
          action: 'nonexistent',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not available');
      expect(executeBulkAction).not.toHaveBeenCalled();
    });

    it('returns 400 for validation failure — missing ids', async () => {
      const res = await request
        .post('/api/v1/bulk/execute')
        .set('Authorization', `Bearer ${token}`)
        .send({ documentType: 'mrrv', action: 'approve' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for validation failure — empty ids array', async () => {
      const res = await request
        .post('/api/v1/bulk/execute')
        .set('Authorization', `Bearer ${token}`)
        .send({ documentType: 'mrrv', ids: [], action: 'approve' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 400 for validation failure — invalid documentType', async () => {
      const res = await request
        .post('/api/v1/bulk/execute')
        .set('Authorization', `Bearer ${token}`)
        .send({
          documentType: 'not-a-valid-type',
          ids: [UUID1],
          action: 'approve',
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 without auth', async () => {
      const res = await request
        .post('/api/v1/bulk/execute')
        .send({ documentType: 'mrrv', ids: [UUID1], action: 'approve' });

      expect(res.status).toBe(401);
    });
  });
});
