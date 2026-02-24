/**
 * Integration tests for custom-fields routes.
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

// Mock permission service to allow admin through requirePermission
vi.mock('../services/permission.service.js', () => ({
  hasPermissionDB: vi.fn().mockResolvedValue(true),
  getAllPermissions: vi.fn().mockResolvedValue({}),
  getPermissionsForRole: vi.fn().mockResolvedValue({}),
  invalidatePermissionCache: vi.fn(),
}));

vi.mock('../services/audit.service.js', () => ({
  getAuditLogs: vi.fn(),
  createAuditLog: vi.fn().mockResolvedValue({}),
}));

vi.mock('../services/custom-fields.service.js', () => ({
  listFieldDefinitions: vi.fn(),
  getFieldDefinition: vi.fn(),
  createFieldDefinition: vi.fn(),
  updateFieldDefinition: vi.fn(),
  deleteFieldDefinition: vi.fn(),
  getCustomFieldValues: vi.fn(),
  setCustomFieldValues: vi.fn(),
}));

import { createTestApp, signTestToken } from '../test-utils/test-app.js';
import supertest from 'supertest';
import * as cfService from '../services/custom-fields.service.js';

const app = createTestApp();
const request = supertest(app);

const ADMIN_TOKEN = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/v1/custom-fields/definitions', () => {
  it('should return 200 with field definitions', async () => {
    vi.mocked(cfService.listFieldDefinitions).mockResolvedValue([{ id: 'fd-1', label: 'Color' }] as never);

    const res = await request.get('/api/v1/custom-fields/definitions').set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should forward entityType query param', async () => {
    vi.mocked(cfService.listFieldDefinitions).mockResolvedValue([] as never);

    await request
      .get('/api/v1/custom-fields/definitions?entityType=mrrv')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(cfService.listFieldDefinitions).toHaveBeenCalledWith('mrrv');
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/custom-fields/definitions');
    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/custom-fields/definitions/:id', () => {
  it('should return 200 with definition', async () => {
    vi.mocked(cfService.getFieldDefinition).mockResolvedValue({ id: 'fd-1', label: 'Color' } as never);

    const res = await request
      .get('/api/v1/custom-fields/definitions/fd-1')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('POST /api/v1/custom-fields/definitions', () => {
  it('should return 201 on success', async () => {
    vi.mocked(cfService.createFieldDefinition).mockResolvedValue({ id: 'fd-new', label: 'Size' } as never);

    const res = await request
      .post('/api/v1/custom-fields/definitions')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ label: 'Size', entityType: 'mrrv', fieldType: 'text' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('should return 401 without auth', async () => {
    const res = await request.post('/api/v1/custom-fields/definitions').send({ label: 'Size' });
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/v1/custom-fields/definitions/:id', () => {
  it('should return 200 on update', async () => {
    vi.mocked(cfService.updateFieldDefinition).mockResolvedValue({ id: 'fd-1', label: 'Updated' } as never);

    const res = await request
      .put('/api/v1/custom-fields/definitions/fd-1')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ label: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('DELETE /api/v1/custom-fields/definitions/:id', () => {
  it('should return 200 on delete', async () => {
    vi.mocked(cfService.deleteFieldDefinition).mockResolvedValue(undefined as never);

    const res = await request
      .delete('/api/v1/custom-fields/definitions/fd-1')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

describe('GET /api/v1/custom-fields/values/:entityType/:entityId', () => {
  it('should return 200 with values', async () => {
    vi.mocked(cfService.getCustomFieldValues).mockResolvedValue([{ fieldId: 'fd-1', value: 'Red' }] as never);

    const res = await request
      .get('/api/v1/custom-fields/values/mrrv/rec-1')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(cfService.getCustomFieldValues).toHaveBeenCalledWith('mrrv', 'rec-1');
  });

  it('should return 401 without auth', async () => {
    const res = await request.get('/api/v1/custom-fields/values/mrrv/rec-1');
    expect(res.status).toBe(401);
  });
});

describe('PUT /api/v1/custom-fields/values/:entityType/:entityId', () => {
  it('should return 200 on set values', async () => {
    vi.mocked(cfService.setCustomFieldValues).mockResolvedValue(undefined as never);
    vi.mocked(cfService.getCustomFieldValues).mockResolvedValue([{ fieldId: 'fd-1', value: 'Blue' }] as never);

    const res = await request
      .put('/api/v1/custom-fields/values/mrrv/rec-1')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({ 'fd-1': 'Blue' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return 400 on validation error', async () => {
    const err = new Error('Validation failed') as Error & { status?: number; errors?: unknown[] };
    err.status = 400;
    err.errors = [{ field: 'fd-1', message: 'Required' }];
    vi.mocked(cfService.setCustomFieldValues).mockRejectedValue(err);

    const res = await request
      .put('/api/v1/custom-fields/values/mrrv/rec-1')
      .set('Authorization', `Bearer ${ADMIN_TOKEN}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.code).toBe('CUSTOM_FIELD_VALIDATION_ERROR');
  });
});
