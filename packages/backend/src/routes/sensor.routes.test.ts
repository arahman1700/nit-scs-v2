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

vi.mock('../services/sensor.service.js', () => ({
  listSensors: vi.fn().mockResolvedValue([]),
  getSensorById: vi.fn().mockResolvedValue({ id: 's1', sensorType: 'temperature' }),
  createSensor: vi.fn().mockResolvedValue({ id: 's1' }),
  updateSensor: vi.fn().mockResolvedValue({ id: 's1' }),
  deleteSensor: vi.fn().mockResolvedValue(undefined),
  ingestReading: vi.fn().mockResolvedValue({ id: 'r1' }),
  getReadings: vi.fn().mockResolvedValue([]),
  getAlerts: vi.fn().mockResolvedValue([]),
  acknowledgeAlert: vi.fn().mockResolvedValue({ id: 'a1', acknowledged: true }),
  getSensorStatus: vi.fn().mockResolvedValue({ total: 5, active: 3 }),
  getZoneHeatmap: vi.fn().mockResolvedValue([]),
}));

import * as sensorService from '../services/sensor.service.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/sensors';

describe('Sensor Routes', () => {
  let adminToken: string;
  let viewerToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
    viewerToken = signTestToken({ userId: 'viewer-id', systemRole: 'viewer' });
  });

  // GET /sensors
  describe('GET /sensors', () => {
    it('returns 200 with sensor list', async () => {
      const res = await request.get(BASE).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(sensorService.listSensors).toHaveBeenCalled();
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(BASE);
      expect(res.status).toBe(401);
    });
  });

  // GET /sensors/status/:warehouseId
  describe('GET /sensors/status/:warehouseId', () => {
    it('returns 200 with sensor status', async () => {
      const res = await request.get(`${BASE}/status/wh1`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(sensorService.getSensorStatus).toHaveBeenCalledWith('wh1');
    });

    it('returns 401 without auth', async () => {
      const res = await request.get(`${BASE}/status/wh1`);
      expect(res.status).toBe(401);
    });
  });

  // GET /sensors/heatmap/:warehouseId
  describe('GET /sensors/heatmap/:warehouseId', () => {
    it('returns 200 with heatmap data', async () => {
      const res = await request.get(`${BASE}/heatmap/wh1`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(sensorService.getZoneHeatmap).toHaveBeenCalledWith('wh1');
    });
  });

  // GET /sensors/alerts
  describe('GET /sensors/alerts', () => {
    it('returns 200 with alerts', async () => {
      const res = await request.get(`${BASE}/alerts`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(sensorService.getAlerts).toHaveBeenCalled();
    });
  });

  // POST /sensors/alerts/:alertId/acknowledge
  describe('POST /sensors/alerts/:alertId/acknowledge', () => {
    it('returns 200 on acknowledge', async () => {
      const res = await request.post(`${BASE}/alerts/a1/acknowledge`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(sensorService.acknowledgeAlert).toHaveBeenCalledWith('a1', 'test-user-id');
    });
  });

  // GET /sensors/readings/:sensorId
  describe('GET /sensors/readings/:sensorId', () => {
    it('returns 200 with readings', async () => {
      const res = await request.get(`${BASE}/readings/s1`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(sensorService.getReadings).toHaveBeenCalledWith('s1', undefined, undefined);
    });
  });

  // POST /sensors/readings
  describe('POST /sensors/readings', () => {
    it('returns 201 on ingest', async () => {
      const res = await request
        .post(`${BASE}/readings`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sensorId: 's1', value: 23.5 });
      expect(res.status).toBe(201);
      expect(sensorService.ingestReading).toHaveBeenCalledWith('s1', 23.5);
    });

    it('returns 400 without required fields', async () => {
      const res = await request.post(`${BASE}/readings`).set('Authorization', `Bearer ${adminToken}`).send({});
      expect(res.status).toBe(400);
    });
  });

  // GET /sensors/:id
  describe('GET /sensors/:id', () => {
    it('returns 200 with sensor', async () => {
      const res = await request.get(`${BASE}/s1`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(sensorService.getSensorById).toHaveBeenCalledWith('s1');
    });
  });

  // POST /sensors
  describe('POST /sensors', () => {
    it('returns 201 for admin', async () => {
      const res = await request
        .post(BASE)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ sensorType: 'temperature', warehouseId: 'wh1' });
      expect(res.status).toBe(201);
      expect(sensorService.createSensor).toHaveBeenCalled();
    });

    it('returns 403 for unauthorized role', async () => {
      const res = await request
        .post(BASE)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ sensorType: 'temperature' });
      expect(res.status).toBe(403);
    });

    it('returns 401 without auth', async () => {
      const res = await request.post(BASE).send({ sensorType: 'temperature' });
      expect(res.status).toBe(401);
    });
  });

  // PUT /sensors/:id
  describe('PUT /sensors/:id', () => {
    it('returns 200 for admin', async () => {
      const res = await request
        .put(`${BASE}/s1`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ isActive: false });
      expect(res.status).toBe(200);
      expect(sensorService.updateSensor).toHaveBeenCalledWith('s1', { isActive: false });
    });

    it('returns 403 for unauthorized role', async () => {
      const res = await request
        .put(`${BASE}/s1`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ isActive: false });
      expect(res.status).toBe(403);
    });
  });

  // DELETE /sensors/:id
  describe('DELETE /sensors/:id', () => {
    it('returns 204 for admin', async () => {
      const res = await request.delete(`${BASE}/s1`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(204);
      expect(sensorService.deleteSensor).toHaveBeenCalledWith('s1');
    });

    it('returns 403 for unauthorized role', async () => {
      const res = await request.delete(`${BASE}/s1`).set('Authorization', `Bearer ${viewerToken}`);
      expect(res.status).toBe(403);
    });
  });
});
