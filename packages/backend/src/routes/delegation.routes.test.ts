/**
 * Integration tests for delegation routes.
 *
 * Mocks at the SERVICE layer so the full route+middleware stack is exercised.
 * Uses the dev JWT fallback secret so signTestToken() tokens pass verification.
 */

// ── Set env vars BEFORE any module is loaded (vi.hoisted runs first) ────

vi.hoisted(() => {
  process.env.JWT_SECRET = 'nit-scs-dev-only-jwt-secret-2026-do-not-use-in-production!';
  process.env.JWT_REFRESH_SECRET = 'nit-scs-dev-only-jwt-refresh-2026-do-not-use-in-production!';
});

// ── Infrastructure mocks (must come before any app import) ──────────────

vi.mock('../config/redis.js', () => ({
  getRedis: vi.fn().mockReturnValue(null),
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

// ── Service mocks ───────────────────────────────────────────────────────

vi.mock('../services/auth.service.js', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));

vi.mock('../services/delegation.service.js', () => ({
  createDelegation: vi.fn(),
  listDelegations: vi.fn(),
  getDelegation: vi.fn(),
  updateDelegation: vi.fn(),
  deleteDelegation: vi.fn(),
  toggleDelegation: vi.fn(),
}));

// ── Imports ─────────────────────────────────────────────────────────────

import * as authService from '../services/auth.service.js';
import * as delegationService from '../services/delegation.service.js';
import { createTestApp, signTestToken } from '../test-utils/test-app.js';
import supertest from 'supertest';

const app = createTestApp();
const request = supertest(app);

// ── Helpers ─────────────────────────────────────────────────────────────

const listMock = delegationService.listDelegations as ReturnType<typeof vi.fn>;
const getMock = delegationService.getDelegation as ReturnType<typeof vi.fn>;
const createMock = delegationService.createDelegation as ReturnType<typeof vi.fn>;
const updateMock = delegationService.updateDelegation as ReturnType<typeof vi.fn>;
const deleteMock = delegationService.deleteDelegation as ReturnType<typeof vi.fn>;
const toggleMock = delegationService.toggleDelegation as ReturnType<typeof vi.fn>;

const ADMIN_TOKEN = signTestToken({ userId: 'admin-1', systemRole: 'admin' });
const USER_TOKEN = signTestToken({ userId: 'user-1', systemRole: 'user' });

const fakeDelegation = {
  id: 'del-1',
  delegatorId: 'user-1',
  delegateId: 'user-2',
  startDate: '2026-03-01T00:00:00.000Z',
  endDate: '2026-03-31T00:00:00.000Z',
  scope: 'all',
  isActive: true,
  notes: null,
  delegator: { id: 'user-1', fullName: 'User One', email: 'one@nit.com', department: 'Ops' },
  delegate: { id: 'user-2', fullName: 'User Two', email: 'two@nit.com', department: 'Ops' },
};

// ── Tests ───────────────────────────────────────────────────────────────

beforeEach(() => {
  // Reset only the delegation service mocks (not isTokenBlacklisted)
  listMock.mockReset();
  getMock.mockReset();
  createMock.mockReset();
  updateMock.mockReset();
  deleteMock.mockReset();
  toggleMock.mockReset();
});

// ---------------------------------------------------------------------------
// GET /api/v1/delegations
// ---------------------------------------------------------------------------
describe('GET /api/v1/delegations', () => {
  const listResult = {
    delegations: [fakeDelegation],
    total: 1,
    page: 1,
    pageSize: 25,
  };

  it('should return 200 with all delegations for admin (no userId filter)', async () => {
    listMock.mockResolvedValue(listResult);

    const res = await request.get('/api/v1/delegations').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);

    // Admin: userId should be undefined (no filter)
    expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ userId: undefined }));
  });

  it('should return 200 with filtered delegations for regular user', async () => {
    listMock.mockResolvedValue(listResult);

    const res = await request.get('/api/v1/delegations').set('Authorization', `Bearer ${USER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Regular user: userId filter applied
    expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }));
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/delegations');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(listMock).not.toHaveBeenCalled();
  });

  it('should forward pagination query params', async () => {
    listMock.mockResolvedValue({ delegations: [], total: 0, page: 2, pageSize: 10 });

    const res = await request
      .get('/api/v1/delegations?page=2&pageSize=10')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(listMock).toHaveBeenCalledWith(expect.objectContaining({ page: 2, pageSize: 10 }));
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/delegations/:id
// ---------------------------------------------------------------------------
describe('GET /api/v1/delegations/:id', () => {
  it('should return 200 for admin accessing any delegation', async () => {
    getMock.mockResolvedValue(fakeDelegation);

    const res = await request.get('/api/v1/delegations/del-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('del-1');
    expect(getMock).toHaveBeenCalledWith('del-1');
  });

  it('should return 200 for regular user accessing own delegation', async () => {
    // user-1 is the delegator
    getMock.mockResolvedValue(fakeDelegation);

    const res = await request.get('/api/v1/delegations/del-1').set('Authorization', `Bearer ${USER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 404 when delegation not found', async () => {
    getMock.mockResolvedValue(null);

    const res = await request.get('/api/v1/delegations/nonexistent').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not found/i);
  });

  it('should return 403 when non-admin accesses another user delegation', async () => {
    // Delegation owned by user-3 (not user-1)
    getMock.mockResolvedValue({
      ...fakeDelegation,
      delegatorId: 'user-3',
      delegateId: 'user-4',
    });

    const res = await request.get('/api/v1/delegations/del-1').set('Authorization', `Bearer ${USER_TOKEN}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/delegations/del-1');

    expect(res.status).toBe(401);
    expect(getMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/delegations
// ---------------------------------------------------------------------------
describe('POST /api/v1/delegations', () => {
  // The createDelegationSchema expects { body: { delegateId, startDate, endDate, ... } }
  // because the schema wraps fields inside a `body` key.
  // The validate middleware parses req.body against this schema.
  const validBody = {
    body: {
      delegateId: '550e8400-e29b-41d4-a716-446655440000',
      startDate: '2026-03-01T00:00:00Z',
      endDate: '2026-03-31T00:00:00Z',
    },
  };

  it('should return 201 on success for admin', async () => {
    createMock.mockResolvedValue(fakeDelegation);

    const res = await request.post('/api/v1/delegations').set('Authorization', `Bearer ${ADMIN_TOKEN}`).send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('del-1');
    expect(createMock).toHaveBeenCalled();
  });

  it('should return 201 on success for regular user', async () => {
    createMock.mockResolvedValue(fakeDelegation);

    const res = await request.post('/api/v1/delegations').set('Authorization', `Bearer ${USER_TOKEN}`).send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    // Non-admin: delegatorId should be forced to req.user.userId
    const call = createMock.mock.calls[0][0];
    expect(call.delegatorId).toBe('user-1');
  });

  it('should return 400 on validation failure (missing required fields)', async () => {
    const res = await request.post('/api/v1/delegations').set('Authorization', `Bearer ${ADMIN_TOKEN}`).send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('should return 400 when delegateId is not a UUID', async () => {
    const res = await request
      .post('/api/v1/delegations')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ body: { delegateId: 'not-a-uuid', startDate: '2026-03-01', endDate: '2026-03-31' } });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/api/v1/delegations').send(validBody);

    expect(res.status).toBe(401);
    expect(createMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// PUT /api/v1/delegations/:id
// ---------------------------------------------------------------------------
describe('PUT /api/v1/delegations/:id', () => {
  // The updateDelegationSchema expects { body: { ... } } wrapper
  const validUpdate = { body: { notes: 'Updated via test' } };

  it('should return 200 on success for admin', async () => {
    getMock.mockResolvedValue(fakeDelegation);
    updateMock.mockResolvedValue({ ...fakeDelegation, notes: 'Updated via test' });

    const res = await request
      .put('/api/v1/delegations/del-1')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send(validUpdate);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(updateMock).toHaveBeenCalled();
  });

  it('should return 404 when delegation not found', async () => {
    getMock.mockResolvedValue(null);

    const res = await request
      .put('/api/v1/delegations/nonexistent')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send(validUpdate);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('should return 403 when non-admin edits another user delegation', async () => {
    getMock.mockResolvedValue({ ...fakeDelegation, delegatorId: 'user-3' });

    const res = await request
      .put('/api/v1/delegations/del-1')
      .set('Authorization', `Bearer ${USER_TOKEN}`)
      .send(validUpdate);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('should return 200 when non-admin edits own delegation', async () => {
    getMock.mockResolvedValue({ ...fakeDelegation, delegatorId: 'user-1' });
    updateMock.mockResolvedValue({ ...fakeDelegation, notes: 'My update' });

    const res = await request
      .put('/api/v1/delegations/del-1')
      .set('Authorization', `Bearer ${USER_TOKEN}`)
      .send(validUpdate);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/delegations/:id/toggle
// ---------------------------------------------------------------------------
describe('POST /api/v1/delegations/:id/toggle', () => {
  it('should return 200 on success', async () => {
    getMock.mockResolvedValue(fakeDelegation);
    toggleMock.mockResolvedValue({ ...fakeDelegation, isActive: false });

    const res = await request.post('/api/v1/delegations/del-1/toggle').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isActive).toBe(false);
    expect(toggleMock).toHaveBeenCalledWith('del-1');
  });

  it('should return 404 when delegation not found', async () => {
    getMock.mockResolvedValue(null);

    const res = await request
      .post('/api/v1/delegations/nonexistent/toggle')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(toggleMock).not.toHaveBeenCalled();
  });

  it('should return 403 when non-admin toggles another user delegation', async () => {
    getMock.mockResolvedValue({ ...fakeDelegation, delegatorId: 'user-3' });

    const res = await request.post('/api/v1/delegations/del-1/toggle').set('Authorization', `Bearer ${USER_TOKEN}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('should return 200 when non-admin toggles own delegation', async () => {
    getMock.mockResolvedValue({ ...fakeDelegation, delegatorId: 'user-1' });
    toggleMock.mockResolvedValue({ ...fakeDelegation, isActive: false });

    const res = await request.post('/api/v1/delegations/del-1/toggle').set('Authorization', `Bearer ${USER_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/delegations/:id
// ---------------------------------------------------------------------------
describe('DELETE /api/v1/delegations/:id', () => {
  it('should return 204 on success for admin', async () => {
    getMock.mockResolvedValue(fakeDelegation);
    deleteMock.mockResolvedValue(undefined);

    const res = await request.delete('/api/v1/delegations/del-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(204);
    expect(deleteMock).toHaveBeenCalledWith('del-1');
  });

  it('should return 404 when delegation not found', async () => {
    getMock.mockResolvedValue(null);

    const res = await request.delete('/api/v1/delegations/nonexistent').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('should return 403 when non-admin deletes another user delegation', async () => {
    getMock.mockResolvedValue({ ...fakeDelegation, delegatorId: 'user-3' });

    const res = await request.delete('/api/v1/delegations/del-1').set('Authorization', `Bearer ${USER_TOKEN}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('should return 204 when non-admin deletes own delegation', async () => {
    getMock.mockResolvedValue({ ...fakeDelegation, delegatorId: 'user-1' });
    deleteMock.mockResolvedValue(undefined);

    const res = await request.delete('/api/v1/delegations/del-1').set('Authorization', `Bearer ${USER_TOKEN}`);

    expect(res.status).toBe(204);
    expect(deleteMock).toHaveBeenCalledWith('del-1');
  });
});
