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

vi.mock('../services/yard.service.js', () => ({
  listDockDoors: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getDockDoor: vi.fn().mockResolvedValue({ id: 'dd1', doorNumber: 'D-01' }),
  createDockDoor: vi.fn().mockResolvedValue({ id: 'dd1' }),
  updateDockDoor: vi.fn().mockResolvedValue({ id: 'dd1' }),
  deleteDockDoor: vi.fn().mockResolvedValue(undefined),
  getAvailableDockDoors: vi.fn().mockResolvedValue([]),
  listAppointments: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  getAppointment: vi.fn().mockResolvedValue({ id: 'apt1' }),
  createAppointment: vi.fn().mockResolvedValue({ id: 'apt1' }),
  checkInAppointment: vi.fn().mockResolvedValue({ id: 'apt1', status: 'checked_in' }),
  completeAppointment: vi.fn().mockResolvedValue({ id: 'apt1', status: 'completed' }),
  cancelAppointment: vi.fn().mockResolvedValue({ id: 'apt1', status: 'cancelled' }),
  listTruckVisits: vi.fn().mockResolvedValue({ data: [], total: 0 }),
  checkInTruck: vi.fn().mockResolvedValue({ id: 'tv1' }),
  assignDock: vi.fn().mockResolvedValue({ id: 'tv1' }),
  checkOutTruck: vi.fn().mockResolvedValue({ id: 'tv1', status: 'checked_out' }),
  getYardStatus: vi.fn().mockResolvedValue({ totalDoors: 10, occupiedDoors: 3 }),
  getDockUtilization: vi.fn().mockResolvedValue({ utilizationRate: 0.5 }),
}));

import * as yardService from '../services/yard.service.js';

const app = createTestApp();
const request = supertest(app);
const BASE = '/api/v1/yard';

describe('Yard Routes', () => {
  let adminToken: string;
  let viewerToken: string;

  beforeEach(() => {
    vi.clearAllMocks();
    adminToken = signTestToken({ userId: 'test-user-id', systemRole: 'admin' });
    viewerToken = signTestToken({ userId: 'viewer-id', systemRole: 'viewer' });
  });

  // ── DOCK DOORS ──────────────────────────────────────────────────

  describe('GET /yard/dock-doors/available', () => {
    it('returns 200 with available doors', async () => {
      const res = await request
        .get(`${BASE}/dock-doors/available?warehouseId=wh1`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(yardService.getAvailableDockDoors).toHaveBeenCalledWith('wh1', undefined);
    });

    it('returns 400 without warehouseId', async () => {
      const res = await request.get(`${BASE}/dock-doors/available`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /yard/dock-doors', () => {
    it('returns 200 with list', async () => {
      const res = await request.get(`${BASE}/dock-doors`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(yardService.listDockDoors).toHaveBeenCalled();
    });

    it('returns 403 for viewer', async () => {
      const res = await request.get(`${BASE}/dock-doors`).set('Authorization', `Bearer ${viewerToken}`);
      expect(res.status).toBe(403);
    });
  });

  describe('POST /yard/dock-doors', () => {
    it('returns 201 on create', async () => {
      const res = await request
        .post(`${BASE}/dock-doors`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ warehouseId: 'wh1', doorNumber: 'D-02', doorType: 'inbound' });
      expect(res.status).toBe(201);
      expect(yardService.createDockDoor).toHaveBeenCalled();
    });

    it('returns 400 without required fields', async () => {
      const res = await request.post(`${BASE}/dock-doors`).set('Authorization', `Bearer ${adminToken}`).send({});
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid doorType', async () => {
      const res = await request
        .post(`${BASE}/dock-doors`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ warehouseId: 'wh1', doorNumber: 'D-02', doorType: 'invalid' });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /yard/dock-doors/:id', () => {
    it('returns 200 for admin', async () => {
      const res = await request.delete(`${BASE}/dock-doors/dd1`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(yardService.deleteDockDoor).toHaveBeenCalledWith('dd1');
    });

    it('returns 403 for viewer', async () => {
      const res = await request.delete(`${BASE}/dock-doors/dd1`).set('Authorization', `Bearer ${viewerToken}`);
      expect(res.status).toBe(403);
    });
  });

  // ── APPOINTMENTS ────────────────────────────────────────────────

  describe('GET /yard/appointments', () => {
    it('returns 200 with list', async () => {
      const res = await request.get(`${BASE}/appointments`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(yardService.listAppointments).toHaveBeenCalled();
    });
  });

  describe('POST /yard/appointments', () => {
    it('returns 201 on create', async () => {
      const res = await request.post(`${BASE}/appointments`).set('Authorization', `Bearer ${adminToken}`).send({
        warehouseId: 'wh1',
        appointmentType: 'delivery',
        scheduledStart: '2026-03-01T10:00:00Z',
        scheduledEnd: '2026-03-01T12:00:00Z',
      });
      expect(res.status).toBe(201);
      expect(yardService.createAppointment).toHaveBeenCalled();
    });

    it('returns 400 without required fields', async () => {
      const res = await request.post(`${BASE}/appointments`).set('Authorization', `Bearer ${adminToken}`).send({});
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid appointmentType', async () => {
      const res = await request.post(`${BASE}/appointments`).set('Authorization', `Bearer ${adminToken}`).send({
        warehouseId: 'wh1',
        appointmentType: 'invalid',
        scheduledStart: '2026-03-01T10:00:00Z',
        scheduledEnd: '2026-03-01T12:00:00Z',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /yard/appointments/:id/check-in', () => {
    it('returns 200 on check-in', async () => {
      const res = await request.post(`${BASE}/appointments/apt1/check-in`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(yardService.checkInAppointment).toHaveBeenCalledWith('apt1');
    });
  });

  describe('POST /yard/appointments/:id/complete', () => {
    it('returns 200 on complete', async () => {
      const res = await request.post(`${BASE}/appointments/apt1/complete`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(yardService.completeAppointment).toHaveBeenCalledWith('apt1');
    });
  });

  describe('DELETE /yard/appointments/:id', () => {
    it('returns 200 on cancel', async () => {
      const res = await request.delete(`${BASE}/appointments/apt1`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(yardService.cancelAppointment).toHaveBeenCalledWith('apt1');
    });
  });

  // ── TRUCK VISITS ────────────────────────────────────────────────

  describe('GET /yard/trucks', () => {
    it('returns 200 with list', async () => {
      const res = await request.get(`${BASE}/trucks`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(yardService.listTruckVisits).toHaveBeenCalled();
    });
  });

  describe('POST /yard/trucks/check-in', () => {
    it('returns 201 on truck check-in', async () => {
      const res = await request
        .post(`${BASE}/trucks/check-in`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ warehouseId: 'wh1', vehiclePlate: 'ABC-123', purpose: 'delivery' });
      expect(res.status).toBe(201);
      expect(yardService.checkInTruck).toHaveBeenCalled();
    });

    it('returns 400 without required fields', async () => {
      const res = await request.post(`${BASE}/trucks/check-in`).set('Authorization', `Bearer ${adminToken}`).send({});
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid purpose', async () => {
      const res = await request
        .post(`${BASE}/trucks/check-in`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ warehouseId: 'wh1', vehiclePlate: 'ABC-123', purpose: 'sightseeing' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /yard/trucks/:id/assign-dock', () => {
    it('returns 200 on assign dock', async () => {
      const res = await request
        .post(`${BASE}/trucks/tv1/assign-dock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ dockDoorId: 'dd1' });
      expect(res.status).toBe(200);
      expect(yardService.assignDock).toHaveBeenCalledWith('tv1', 'dd1');
    });

    it('returns 400 without dockDoorId', async () => {
      const res = await request
        .post(`${BASE}/trucks/tv1/assign-dock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('POST /yard/trucks/:id/check-out', () => {
    it('returns 200 on check-out', async () => {
      const res = await request.post(`${BASE}/trucks/tv1/check-out`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(yardService.checkOutTruck).toHaveBeenCalledWith('tv1');
    });
  });

  // ── YARD STATUS & UTILIZATION ──────────────────────────────────

  describe('GET /yard/status', () => {
    it('returns 200 with status', async () => {
      const res = await request.get(`${BASE}/status?warehouseId=wh1`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(yardService.getYardStatus).toHaveBeenCalledWith('wh1');
    });

    it('returns 400 without warehouseId', async () => {
      const res = await request.get(`${BASE}/status`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });

  describe('GET /yard/utilization', () => {
    it('returns 200 with utilization', async () => {
      const res = await request
        .get(`${BASE}/utilization?warehouseId=wh1&date=2026-03-01`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      expect(yardService.getDockUtilization).toHaveBeenCalledWith('wh1', '2026-03-01');
    });

    it('returns 400 without warehouseId', async () => {
      const res = await request.get(`${BASE}/utilization?date=2026-03-01`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });

    it('returns 400 without date', async () => {
      const res = await request.get(`${BASE}/utilization?warehouseId=wh1`).set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(400);
    });
  });

  // ── AUTH ────────────────────────────────────────────────────────

  describe('Auth requirements', () => {
    it('returns 401 for unauthenticated request', async () => {
      const res = await request.get(`${BASE}/dock-doors`);
      expect(res.status).toBe(401);
    });
  });
});
