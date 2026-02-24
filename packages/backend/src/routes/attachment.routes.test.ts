/**
 * Integration tests for attachment routes.
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

vi.mock('../services/attachment.service.js', () => ({
  validateEntityType: vi.fn(),
  listByEntity: vi.fn(),
  create: vi.fn(),
  getById: vi.fn(),
  softDelete: vi.fn(),
}));

import { createTestApp, signTestToken } from '../test-utils/test-app.js';
import supertest from 'supertest';
import * as attachmentService from '../services/attachment.service.js';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/attachments/:entityType/:recordId', () => {
  it('should return 200 with attachments', async () => {
    vi.mocked(attachmentService.validateEntityType).mockReturnValue(undefined as never);
    vi.mocked(attachmentService.listByEntity).mockResolvedValue([{ id: 'att-1', fileName: 'test.pdf' }] as never);

    const res = await request.get('/api/v1/attachments/mrrv/rec-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(attachmentService.listByEntity).toHaveBeenCalledWith('mrrv', 'rec-1');
  });

  it('should return 400 for invalid entity type', async () => {
    vi.mocked(attachmentService.validateEntityType).mockImplementation(() => {
      throw new Error('Invalid entity type');
    });

    const res = await request.get('/api/v1/attachments/invalid/rec-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/attachments/mrrv/rec-1');
    expect(res.status).toBe(401);
  });
});

describe('DELETE /api/v1/attachments/:id', () => {
  it('should return 200 on soft delete', async () => {
    vi.mocked(attachmentService.softDelete).mockResolvedValue(undefined as never);

    const res = await request.delete('/api/v1/attachments/att-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.deleted).toBe(true);
  });

  it('should return error when softDelete throws', async () => {
    const err = new Error('Not found') as Error & { statusCode?: number };
    err.statusCode = 404;
    vi.mocked(attachmentService.softDelete).mockRejectedValue(err);

    const res = await request.delete('/api/v1/attachments/not-found').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('should return 401 without auth', async () => {
    const res = await request.delete('/api/v1/attachments/att-1');
    expect(res.status).toBe(401);
  });
});
