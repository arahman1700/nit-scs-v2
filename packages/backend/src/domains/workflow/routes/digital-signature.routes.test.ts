/**
 * Integration tests for digital signature routes.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
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
vi.mock('../../auth/services/permission.service.js', () => ({
  hasPermissionDB: vi.fn().mockResolvedValue(true),
}));
vi.mock('../../audit/services/audit.service.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue({}),
}));

vi.mock('../services/digital-signature.service.js', () => ({
  createSignature: vi.fn(),
  getByDocument: vi.fn(),
  getById: vi.fn(),
}));

import { createTestApp, signTestToken } from '../../../test-utils/test-app.js';
import supertest from 'supertest';
import { createSignature, getByDocument, getById } from '../services/digital-signature.service.js';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/signatures', () => {
  it('should return 200 with signatures for document', async () => {
    vi.mocked(getByDocument).mockResolvedValue([{ id: 'sig-1', signedBy: 'user-1' }] as never);

    const res = await request
      .get('/api/v1/signatures?documentType=grn&documentId=00000000-0000-0000-0000-000000000001')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/signatures');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/signatures/:id', () => {
  it('should return 200 with signature detail', async () => {
    vi.mocked(getById).mockResolvedValue({
      id: 'sig-1',
      signedBy: 'user-1',
      signature: 'data:image/png;base64,...',
    } as never);

    const res = await request.get('/api/v1/signatures/sig-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/signatures', () => {
  const validBody = {
    documentType: 'grn',
    documentId: '00000000-0000-0000-0000-000000000001',
    signatureData: 'data:image/png;base64,abc123',
    purpose: 'approval',
  };

  it('should return 201 on create', async () => {
    vi.mocked(createSignature).mockResolvedValue({ id: 'sig-1', ...validBody } as never);

    const res = await request.post('/api/v1/signatures').set('Authorization', `Bearer ${ADMIN_TOKEN}`).send(validBody);

    expect(res.status).toBe(201);
  });
});
