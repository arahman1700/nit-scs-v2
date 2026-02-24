import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createTestApp, signTestToken } from '../test-utils/test-app.js';

vi.hoisted(() => {
  process.env.JWT_SECRET = 'nit-scs-dev-only-jwt-secret-2026-do-not-use-in-production!';
  process.env.JWT_REFRESH_SECRET = 'nit-scs-dev-only-jwt-refresh-2026-do-not-use-in-production!';
});

vi.mock('../config/redis.js', () => ({
  getRedis: vi.fn().mockReturnValue(null),
  isRedisAvailable: vi.fn().mockReturnValue(false),
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
  emitEntityEvent: vi.fn(),
}));
vi.mock('../utils/routeHelpers.js', () => ({
  auditAndEmit: vi.fn(),
  emitDocumentEvent: vi.fn(),
  emitEntityEvent: vi.fn(),
}));
vi.mock('../services/auth.service.js', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));
vi.mock('../services/permission.service.js', () => ({
  hasPermissionDB: vi.fn().mockResolvedValue(true),
}));

// Mock prisma with emailTemplate methods
const mockEmailTemplate = {
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock('../utils/prisma.js', () => ({
  prisma: new Proxy(
    { emailTemplate: null },
    {
      get: (_target: unknown, prop: string) => {
        if (prop === 'emailTemplate') return mockEmailTemplate;
        if (typeof prop === 'string' && prop.startsWith('$')) return vi.fn();
        return new Proxy({}, { get: () => vi.fn().mockResolvedValue(null) });
      },
    },
  ),
}));

vi.mock('../services/email.service.js', () => ({
  previewTemplate: vi.fn().mockReturnValue({ subject: 'Test Subject', bodyHtml: '<p>Hello</p>' }),
  sendTemplatedEmail: vi.fn(),
  processQueuedEmails: vi.fn(),
  generateUnsubscribeToken: vi.fn(),
  verifyUnsubscribeToken: vi.fn(),
}));

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/email-templates';

describe('Email Template Routes', () => {
  let adminToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
  });

  describe('GET /api/v1/email-templates', () => {
    it('returns 200 with list of templates', async () => {
      mockEmailTemplate.findMany.mockResolvedValue([
        { id: 't1', code: 'grn_created', name: 'GRN Created', _count: { emailLogs: 5 } },
      ]);

      const res = await request.get(BASE).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(BASE);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/email-templates/:id', () => {
    it('returns 200 with a single template', async () => {
      mockEmailTemplate.findUnique.mockResolvedValue({ id: 't1', code: 'grn_created', name: 'GRN Created' });

      const res = await request.get(`${BASE}/t1`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('t1');
    });

    it('returns 404 when template not found', async () => {
      mockEmailTemplate.findUnique.mockResolvedValue(null);

      const res = await request.get(`${BASE}/nonexistent`).set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/v1/email-templates', () => {
    it('returns 201 when creating a template', async () => {
      const payload = { code: 'new_tpl', name: 'New Template', subject: 'Subject', bodyHtml: '<p>Hi</p>' };
      mockEmailTemplate.create.mockResolvedValue({ id: 't2', ...payload });

      const res = await request.post(BASE).set('Authorization', `Bearer ${adminToken}`).send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.code).toBe('new_tpl');
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await request.post(BASE).set('Authorization', `Bearer ${adminToken}`).send({ code: 'test' });

      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(BASE).send({ code: 'x', name: 'X', subject: 'S', bodyHtml: '<p>B</p>' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/email-templates/:id/preview', () => {
    it('returns 200 with preview', async () => {
      mockEmailTemplate.findUnique.mockResolvedValue({
        id: 't1',
        bodyHtml: '<p>{{name}}</p>',
        subject: 'Hello {{name}}',
      });

      const res = await request
        .post(`${BASE}/t1/preview`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ variables: { name: 'John' } });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns 404 when template not found for preview', async () => {
      mockEmailTemplate.findUnique.mockResolvedValue(null);

      const res = await request
        .post(`${BASE}/missing/preview`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ variables: {} });

      expect(res.status).toBe(404);
    });
  });
});
