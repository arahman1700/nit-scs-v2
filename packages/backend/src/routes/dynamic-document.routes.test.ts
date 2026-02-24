/**
 * Integration tests for dynamic-document routes.
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

vi.mock('../services/dynamic-document-type.service.js', () => ({
  getDocumentTypeByCode: vi.fn(),
  listDocumentTypes: vi.fn(),
  getActiveTypesForRole: vi.fn(),
  getDocumentTypeById: vi.fn(),
  createDocumentType: vi.fn(),
  updateDocumentType: vi.fn(),
  deleteDocumentType: vi.fn(),
  addField: vi.fn(),
  updateField: vi.fn(),
  deleteField: vi.fn(),
  reorderFields: vi.fn(),
}));

vi.mock('../services/dynamic-document.service.js', () => ({
  listDocuments: vi.fn(),
  getDocumentById: vi.fn(),
  createDocument: vi.fn(),
  updateDocument: vi.fn(),
  transitionDocument: vi.fn(),
  approveDocument: vi.fn(),
  getDocumentHistory: vi.fn(),
}));

import { createTestApp, signTestToken } from '../test-utils/test-app.js';
import supertest from 'supertest';
import * as ddService from '../services/dynamic-document.service.js';
import * as ddtService from '../services/dynamic-document-type.service.js';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });

beforeEach(() => {
  vi.clearAllMocks();
  // Default: type exists with no role restrictions
  vi.mocked(ddtService.getDocumentTypeByCode).mockResolvedValue({
    id: 'dt-1',
    code: 'CUSTOM',
    name: 'Custom',
    permissionConfig: {},
  } as never);
});

describe('GET /api/v1/dynamic/CUSTOM', () => {
  it('should return 200 with documents', async () => {
    vi.mocked(ddService.listDocuments).mockResolvedValue({
      data: [{ id: 'doc-1', status: 'draft' }],
      total: 1,
    } as never);

    const res = await request.get('/api/v1/dynamic/CUSTOM').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/dynamic/CUSTOM');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/dynamic/CUSTOM/:id', () => {
  it('should return 200 with document', async () => {
    vi.mocked(ddService.getDocumentById).mockResolvedValue({
      id: 'doc-1',
      status: 'draft',
      documentType: { code: 'CUSTOM' },
    } as never);

    const res = await request.get('/api/v1/dynamic/CUSTOM/doc-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 404 when type mismatch', async () => {
    vi.mocked(ddService.getDocumentById).mockResolvedValue({
      id: 'doc-1',
      status: 'draft',
      documentType: { code: 'OTHER' },
    } as never);

    const res = await request.get('/api/v1/dynamic/CUSTOM/doc-1').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(404);
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/dynamic/CUSTOM/doc-1');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/dynamic/CUSTOM', () => {
  it('should return 201 on creation', async () => {
    vi.mocked(ddService.createDocument).mockResolvedValue({ id: 'doc-new', status: 'draft' } as never);

    const res = await request
      .post('/api/v1/dynamic/CUSTOM')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ title: 'My doc', data: { field1: 'value1' } });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('should return 403 when role not in createRoles', async () => {
    vi.mocked(ddtService.getDocumentTypeByCode).mockResolvedValue({
      id: 'dt-1',
      code: 'CUSTOM',
      name: 'Custom',
      permissionConfig: { createRoles: ['manager'] },
    } as never);

    const userToken = signTestToken({ userId: 'user-1', systemRole: 'site_engineer' });

    const res = await request
      .post('/api/v1/dynamic/CUSTOM')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ title: 'Test' });

    expect(res.status).toBe(403);
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/api/v1/dynamic/CUSTOM').send({});
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/dynamic/CUSTOM/:id/transition', () => {
  it('should return 200 on transition', async () => {
    vi.mocked(ddService.getDocumentById).mockResolvedValue({
      id: 'doc-1',
      status: 'draft',
      documentType: { code: 'CUSTOM' },
    } as never);
    vi.mocked(ddService.transitionDocument).mockResolvedValue({ id: 'doc-1', status: 'submitted' } as never);

    const res = await request
      .post('/api/v1/dynamic/CUSTOM/doc-1/transition')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ targetStatus: 'submitted' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/api/v1/dynamic/CUSTOM/doc-1/transition').send({ targetStatus: 'submitted' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/v1/dynamic/CUSTOM/:id/approve', () => {
  it('should return 200 on approval', async () => {
    vi.mocked(ddService.getDocumentById).mockResolvedValue({
      id: 'doc-1',
      status: 'pending_approval',
      documentType: { code: 'CUSTOM' },
    } as never);
    vi.mocked(ddService.approveDocument).mockResolvedValue({
      approvedLevel: 1,
      allApproved: true,
      remainingLevels: 0,
    } as never);

    const res = await request
      .post('/api/v1/dynamic/CUSTOM/doc-1/approve')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/v1/dynamic/CUSTOM/:id/history', () => {
  it('should return 200 with history', async () => {
    vi.mocked(ddService.getDocumentById).mockResolvedValue({
      id: 'doc-1',
      status: 'draft',
      documentType: { code: 'CUSTOM' },
    } as never);
    vi.mocked(ddService.getDocumentHistory).mockResolvedValue([{ id: 'h1', action: 'created' }] as never);

    const res = await request.get('/api/v1/dynamic/CUSTOM/doc-1/history').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
