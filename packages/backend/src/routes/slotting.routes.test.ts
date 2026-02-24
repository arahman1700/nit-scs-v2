import { describe, it, expect, vi, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createTestApp, signTestToken } from '../test-utils/test-app.js';

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
      get: (_target: unknown, prop: string) => {
        if (typeof prop === 'string' && prop.startsWith('$')) return vi.fn();
        return new Proxy({}, { get: () => vi.fn().mockResolvedValue(null) });
      },
    },
  ),
}));
vi.mock('../services/auth.service.js', () => ({
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));
vi.mock('../services/permission.service.js', () => ({
  hasPermissionDB: vi.fn().mockResolvedValue(true),
}));
vi.mock('../services/audit.service.js', () => ({
  createAuditLog: vi.fn().mockResolvedValue({}),
}));

vi.mock('../services/slotting-optimizer.service.js', () => ({
  analyzeSlotting: vi.fn().mockResolvedValue({ suggestions: [] }),
  getItemPickFrequencies: vi.fn().mockResolvedValue([]),
  applySuggestion: vi.fn().mockResolvedValue({ oldBin: 'A-01-01', newBin: 'A-03-12' }),
}));

vi.mock('../services/ai-slotting.service.js', () => ({
  analyzeCoLocation: vi.fn().mockResolvedValue({ pairs: [] }),
  analyzeSeasonalTrends: vi.fn().mockResolvedValue({ trends: [] }),
  generateAiSlottingSummary: vi.fn().mockResolvedValue({ summary: 'ok' }),
}));

import * as slottingService from '../services/slotting-optimizer.service.js';
import * as aiSlottingService from '../services/ai-slotting.service.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/slotting';

describe('Slotting Routes', () => {
  let adminToken: string;
  let viewerToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
    viewerToken = signTestToken({ userId: 'viewer-id', systemRole: 'viewer' });
  });

  // GET /slotting/analyze
  describe('GET /slotting/analyze', () => {
    it('returns 200 with analysis', async () => {
      const res = await request.get(`${BASE}/analyze?warehouseId=wh1`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(slottingService.analyzeSlotting).toHaveBeenCalledWith('wh1');
    });

    it('returns 400 without warehouseId', async () => {
      const res = await request.get(`${BASE}/analyze`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(`${BASE}/analyze?warehouseId=wh1`);
      expect(res.status).toBe(401);
    });
  });

  // GET /slotting/frequencies
  describe('GET /slotting/frequencies', () => {
    it('returns 200 with frequencies', async () => {
      const res = await request.get(`${BASE}/frequencies?warehouseId=wh1`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(slottingService.getItemPickFrequencies).toHaveBeenCalledWith('wh1');
    });

    it('returns 400 without warehouseId', async () => {
      const res = await request.get(`${BASE}/frequencies`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });

  // POST /slotting/apply
  describe('POST /slotting/apply', () => {
    it('returns 200 for admin', async () => {
      const res = await request
        .post(`${BASE}/apply`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ itemId: 'i1', warehouseId: 'wh1', newBinNumber: 'A-03-12' });
      expect(res.status).toBe(200);
      expect(slottingService.applySuggestion).toHaveBeenCalledWith('i1', 'wh1', 'A-03-12', 'test-user-id');
    });

    it('returns 403 for viewer role', async () => {
      const res = await request
        .post(`${BASE}/apply`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ itemId: 'i1', warehouseId: 'wh1', newBinNumber: 'A-03-12' });
      expect(res.status).toBe(403);
    });

    it('returns 400 without required fields', async () => {
      const res = await request.post(`${BASE}/apply`).set('Authorization', `Bearer ${adminToken}`).send({});
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid bin format', async () => {
      const res = await request
        .post(`${BASE}/apply`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ itemId: 'i1', warehouseId: 'wh1', newBinNumber: 'invalid' });
      expect(res.status).toBe(400);
    });
  });

  // GET /slotting/:warehouseId/co-location
  describe('GET /slotting/:warehouseId/co-location', () => {
    it('returns 200 with co-location analysis', async () => {
      const res = await request.get(`${BASE}/wh1/co-location`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(aiSlottingService.analyzeCoLocation).toHaveBeenCalledWith('wh1');
    });
  });

  // GET /slotting/:warehouseId/seasonal
  describe('GET /slotting/:warehouseId/seasonal', () => {
    it('returns 200 with seasonal analysis', async () => {
      const res = await request.get(`${BASE}/wh1/seasonal`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(aiSlottingService.analyzeSeasonalTrends).toHaveBeenCalledWith('wh1');
    });
  });

  // GET /slotting/:warehouseId/ai-summary
  describe('GET /slotting/:warehouseId/ai-summary', () => {
    it('returns 200 with AI summary', async () => {
      const res = await request.get(`${BASE}/wh1/ai-summary`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(aiSlottingService.generateAiSlottingSummary).toHaveBeenCalledWith('wh1');
    });
  });
});
