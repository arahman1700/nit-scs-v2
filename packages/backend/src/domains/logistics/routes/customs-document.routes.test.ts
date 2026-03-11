/**
 * Integration tests for customs document routes.
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

vi.mock('../services/customs-document.service.js', () => ({
  listByShipment: vi.fn(),
  getById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  verify: vi.fn(),
  reject: vi.fn(),
  getCompleteness: vi.fn(),
}));

import { createTestApp, signTestToken } from '../../../test-utils/test-app.js';
import supertest from 'supertest';
import * as customsDocService from '../services/customs-document.service.js';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/customs-documents', () => {
  it('should return 200 with document list', async () => {
    vi.mocked(customsDocService.listByShipment).mockResolvedValue([{ id: 'cd-1' }] as never);

    const res = await request
      .get('/api/v1/customs-documents?shipmentId=sh-1')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/customs-documents');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/customs-documents/completeness/:shipmentId', () => {
  it('should return 200 with completeness check', async () => {
    vi.mocked(customsDocService.getCompleteness).mockResolvedValue({
      complete: false,
      missing: ['Bill of Lading'],
    } as never);

    const res = await request
      .get('/api/v1/customs-documents/completeness/sh-1')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/customs-documents', () => {
  const validBody = {
    shipmentId: '00000000-0000-0000-0000-000000000001',
    documentType: 'bill_of_lading',
    documentNumber: 'BOL-001',
  };

  it('should return 201 on create', async () => {
    vi.mocked(customsDocService.create).mockResolvedValue({ id: 'cd-1', ...validBody } as never);

    const res = await request
      .post('/api/v1/customs-documents')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send(validBody);

    expect(res.status).toBe(201);
  });
});

describe('POST /api/v1/customs-documents/:id/verify', () => {
  it('should return 200 on verify', async () => {
    vi.mocked(customsDocService.verify).mockResolvedValue({ id: 'cd-1', status: 'verified' } as never);

    const res = await request
      .post('/api/v1/customs-documents/cd-1/verify')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
  });
});

describe('POST /api/v1/customs-documents/:id/reject', () => {
  it('should return 200 on reject', async () => {
    vi.mocked(customsDocService.reject).mockResolvedValue({ id: 'cd-1', status: 'rejected' } as never);

    const res = await request
      .post('/api/v1/customs-documents/cd-1/reject')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ reason: 'Incorrect document number' });

    expect(res.status).toBe(200);
  });
});
