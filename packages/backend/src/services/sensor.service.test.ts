import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaMock, PrismaModelMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => ({ mockPrisma: {} as PrismaMock }));
vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('@prisma/client', () => ({
  Prisma: {
    Decimal: class MockDecimal {
      private v: number;
      constructor(v: number) {
        this.v = v;
      }
      greaterThan(other: unknown) {
        return this.v > Number(other);
      }
      lessThan(other: unknown) {
        return this.v < Number(other);
      }
    },
  },
}));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import * as sensorService from './sensor.service.js';

function createModelMock(): PrismaModelMock {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    upsert: vi.fn(),
    aggregate: vi.fn(),
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeSensor(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sensor-1',
    sensorCode: 'TEMP-001',
    sensorType: 'temperature',
    warehouseId: 'wh-1',
    zoneId: 'zone-1',
    location: 'Aisle A, Rack 3',
    minThreshold: 2,
    maxThreshold: 30,
    unit: '°C',
    isActive: true,
    lastValue: 22,
    lastReadingAt: new Date('2026-02-20T10:00:00Z'),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  };
}

function makeReading(overrides: Record<string, unknown> = {}) {
  return {
    id: 'reading-1',
    sensorId: 'sensor-1',
    value: 22,
    recordedAt: new Date('2026-02-20T10:00:00Z'),
    ...overrides,
  };
}

function makeAlert(overrides: Record<string, unknown> = {}) {
  return {
    id: 'alert-1',
    sensorId: 'sensor-1',
    alertType: 'threshold_high',
    value: 35,
    threshold: 30,
    message: 'TEMP-001 reading 35°C exceeds max threshold 30°C',
    acknowledged: false,
    acknowledgedById: null,
    acknowledgedAt: null,
    createdAt: new Date('2026-02-20T10:00:00Z'),
    ...overrides,
  };
}

// ── Test Suite ──────────────────────────────────────────────────────────────

describe('sensor.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mockPrisma, createPrismaMock());
    (mockPrisma as Record<string, unknown>).sensor = createModelMock();
    (mockPrisma as Record<string, unknown>).sensorReading = createModelMock();
    (mockPrisma as Record<string, unknown>).sensorAlert = createModelMock();
    (mockPrisma as Record<string, unknown>).warehouseZone = createModelMock();

    // Re-wire $transaction so tx delegates to the same model mocks
    mockPrisma.$transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') {
        return (arg as (tx: PrismaMock) => Promise<unknown>)(mockPrisma as PrismaMock);
      }
      return Promise.all(arg as Promise<unknown>[]);
    });
  });

  // ##########################################################################
  // listSensors
  // ##########################################################################

  describe('listSensors', () => {
    it('should return all sensors with no filters', async () => {
      const sensors = [makeSensor(), makeSensor({ id: 'sensor-2', sensorCode: 'HUM-001' })];
      (mockPrisma as any).sensor.findMany.mockResolvedValue(sensors);

      const result = await sensorService.listSensors({});
      expect(result).toEqual(sensors);
      expect((mockPrisma as any).sensor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {}, orderBy: { createdAt: 'desc' } }),
      );
    });

    it('should filter by warehouseId', async () => {
      (mockPrisma as any).sensor.findMany.mockResolvedValue([]);

      await sensorService.listSensors({ warehouseId: 'wh-1' });
      expect((mockPrisma as any).sensor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { warehouseId: 'wh-1' } }),
      );
    });

    it('should filter by sensorType', async () => {
      (mockPrisma as any).sensor.findMany.mockResolvedValue([]);

      await sensorService.listSensors({ sensorType: 'humidity' });
      expect((mockPrisma as any).sensor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { sensorType: 'humidity' } }),
      );
    });

    it('should filter by isActive', async () => {
      (mockPrisma as any).sensor.findMany.mockResolvedValue([]);

      await sensorService.listSensors({ isActive: true });
      expect((mockPrisma as any).sensor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });

    it('should filter inactive sensors when isActive=false', async () => {
      (mockPrisma as any).sensor.findMany.mockResolvedValue([]);

      await sensorService.listSensors({ isActive: false });
      expect((mockPrisma as any).sensor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: false } }),
      );
    });

    it('should apply search filter with OR on sensorCode and location', async () => {
      (mockPrisma as any).sensor.findMany.mockResolvedValue([]);

      await sensorService.listSensors({ search: 'TEMP' });
      expect((mockPrisma as any).sensor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { sensorCode: { contains: 'TEMP', mode: 'insensitive' } },
              { location: { contains: 'TEMP', mode: 'insensitive' } },
            ],
          },
        }),
      );
    });

    it('should combine multiple filters', async () => {
      (mockPrisma as any).sensor.findMany.mockResolvedValue([]);

      await sensorService.listSensors({ warehouseId: 'wh-1', sensorType: 'temperature', isActive: true });
      expect((mockPrisma as any).sensor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { warehouseId: 'wh-1', sensorType: 'temperature', isActive: true },
        }),
      );
    });
  });

  // ##########################################################################
  // getSensorById
  // ##########################################################################

  describe('getSensorById', () => {
    it('should return sensor with detail include', async () => {
      const sensor = makeSensor();
      (mockPrisma as any).sensor.findUnique.mockResolvedValue(sensor);

      const result = await sensorService.getSensorById('sensor-1');
      expect(result).toEqual(sensor);
      expect((mockPrisma as any).sensor.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'sensor-1' } }),
      );
    });

    it('should throw NotFoundError if sensor does not exist', async () => {
      (mockPrisma as any).sensor.findUnique.mockResolvedValue(null);

      await expect(sensorService.getSensorById('missing')).rejects.toThrow('Sensor');
    });
  });

  // ##########################################################################
  // createSensor
  // ##########################################################################

  describe('createSensor', () => {
    it('should create a sensor with all fields', async () => {
      const created = makeSensor();
      (mockPrisma as any).sensor.create.mockResolvedValue(created);

      const result = await sensorService.createSensor({
        sensorCode: 'TEMP-001',
        sensorType: 'temperature',
        warehouseId: 'wh-1',
        zoneId: 'zone-1',
        location: 'Aisle A, Rack 3',
        minThreshold: 2,
        maxThreshold: 30,
        unit: '°C',
      });

      expect(result).toEqual(created);
      expect((mockPrisma as any).sensor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            sensorCode: 'TEMP-001',
            sensorType: 'temperature',
            warehouseId: 'wh-1',
            zoneId: 'zone-1',
            location: 'Aisle A, Rack 3',
            minThreshold: 2,
            maxThreshold: 30,
            unit: '°C',
          },
        }),
      );
    });

    it('should default unit to °C when not provided', async () => {
      (mockPrisma as any).sensor.create.mockResolvedValue(makeSensor());

      await sensorService.createSensor({
        sensorCode: 'TEMP-002',
        sensorType: 'temperature',
        warehouseId: 'wh-1',
      });

      expect((mockPrisma as any).sensor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ unit: '°C' }),
        }),
      );
    });

    it('should default optional fields to null', async () => {
      (mockPrisma as any).sensor.create.mockResolvedValue(makeSensor());

      await sensorService.createSensor({
        sensorCode: 'TEMP-003',
        sensorType: 'temperature',
        warehouseId: 'wh-1',
      });

      expect((mockPrisma as any).sensor.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            zoneId: null,
            location: null,
            minThreshold: null,
            maxThreshold: null,
          }),
        }),
      );
    });
  });

  // ##########################################################################
  // updateSensor
  // ##########################################################################

  describe('updateSensor', () => {
    it('should update sensor fields', async () => {
      const existing = makeSensor();
      const updated = makeSensor({ location: 'Aisle B, Rack 1' });
      (mockPrisma as any).sensor.findUnique.mockResolvedValue(existing);
      (mockPrisma as any).sensor.update.mockResolvedValue(updated);

      const result = await sensorService.updateSensor('sensor-1', { location: 'Aisle B, Rack 1' });
      expect(result).toEqual(updated);
      expect((mockPrisma as any).sensor.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sensor-1' },
          data: { location: 'Aisle B, Rack 1' },
        }),
      );
    });

    it('should throw NotFoundError if sensor not found', async () => {
      (mockPrisma as any).sensor.findUnique.mockResolvedValue(null);

      await expect(sensorService.updateSensor('missing', { location: 'X' })).rejects.toThrow('Sensor');
    });

    it('should only include provided fields in update data', async () => {
      (mockPrisma as any).sensor.findUnique.mockResolvedValue(makeSensor());
      (mockPrisma as any).sensor.update.mockResolvedValue(makeSensor());

      await sensorService.updateSensor('sensor-1', { isActive: false });
      expect((mockPrisma as any).sensor.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { isActive: false },
        }),
      );
    });

    it('should update thresholds', async () => {
      (mockPrisma as any).sensor.findUnique.mockResolvedValue(makeSensor());
      (mockPrisma as any).sensor.update.mockResolvedValue(makeSensor({ minThreshold: 5, maxThreshold: 40 }));

      await sensorService.updateSensor('sensor-1', { minThreshold: 5, maxThreshold: 40 });
      expect((mockPrisma as any).sensor.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { minThreshold: 5, maxThreshold: 40 },
        }),
      );
    });

    it('should update multiple fields at once', async () => {
      (mockPrisma as any).sensor.findUnique.mockResolvedValue(makeSensor());
      (mockPrisma as any).sensor.update.mockResolvedValue(makeSensor());

      await sensorService.updateSensor('sensor-1', {
        sensorCode: 'TEMP-UPDATED',
        sensorType: 'humidity',
        unit: '%',
        zoneId: 'zone-2',
      });

      expect((mockPrisma as any).sensor.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            sensorCode: 'TEMP-UPDATED',
            sensorType: 'humidity',
            unit: '%',
            zoneId: 'zone-2',
          },
        }),
      );
    });
  });

  // ##########################################################################
  // deleteSensor
  // ##########################################################################

  describe('deleteSensor', () => {
    it('should delete an existing sensor', async () => {
      (mockPrisma as any).sensor.findUnique.mockResolvedValue(makeSensor());
      (mockPrisma as any).sensor.delete.mockResolvedValue(undefined);

      await sensorService.deleteSensor('sensor-1');
      expect((mockPrisma as any).sensor.delete).toHaveBeenCalledWith({ where: { id: 'sensor-1' } });
    });

    it('should throw NotFoundError if sensor not found', async () => {
      (mockPrisma as any).sensor.findUnique.mockResolvedValue(null);

      await expect(sensorService.deleteSensor('missing')).rejects.toThrow('Sensor');
    });
  });

  // ##########################################################################
  // ingestReading
  // ##########################################################################

  describe('ingestReading', () => {
    it('should create reading and update sensor last value within a transaction', async () => {
      const sensor = makeSensor({ maxThreshold: 30, minThreshold: 2 });
      const reading = makeReading({ value: 22 });

      (mockPrisma as any).sensor.findUnique.mockResolvedValue(sensor);
      (mockPrisma as any).sensorReading.create.mockResolvedValue(reading);
      (mockPrisma as any).sensor.update.mockResolvedValue(sensor);

      const result = await sensorService.ingestReading('sensor-1', 22);

      expect(result).toEqual(reading);
      expect((mockPrisma as any).sensorReading.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sensorId: 'sensor-1', value: 22 }),
        }),
      );
      expect((mockPrisma as any).sensor.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sensor-1' },
          data: expect.objectContaining({ lastValue: 22 }),
        }),
      );
    });

    it('should throw NotFoundError if sensor does not exist', async () => {
      (mockPrisma as any).sensor.findUnique.mockResolvedValue(null);

      await expect(sensorService.ingestReading('missing', 22)).rejects.toThrow('Sensor');
    });

    it('should throw BusinessRuleError if sensor is inactive', async () => {
      (mockPrisma as any).sensor.findUnique.mockResolvedValue(makeSensor({ isActive: false }));

      await expect(sensorService.ingestReading('sensor-1', 22)).rejects.toThrow('inactive');
    });

    it('should create threshold_high alert when value exceeds maxThreshold', async () => {
      const sensor = makeSensor({ maxThreshold: 30, minThreshold: 2 });
      (mockPrisma as any).sensor.findUnique.mockResolvedValue(sensor);
      (mockPrisma as any).sensorReading.create.mockResolvedValue(makeReading({ value: 35 }));
      (mockPrisma as any).sensor.update.mockResolvedValue(sensor);
      (mockPrisma as any).sensorAlert.create.mockResolvedValue(makeAlert());

      await sensorService.ingestReading('sensor-1', 35);

      expect((mockPrisma as any).sensorAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sensorId: 'sensor-1',
            alertType: 'threshold_high',
            value: 35,
            threshold: 30,
          }),
        }),
      );
    });

    it('should create threshold_low alert when value is below minThreshold', async () => {
      const sensor = makeSensor({ maxThreshold: 30, minThreshold: 2 });
      (mockPrisma as any).sensor.findUnique.mockResolvedValue(sensor);
      (mockPrisma as any).sensorReading.create.mockResolvedValue(makeReading({ value: 0 }));
      (mockPrisma as any).sensor.update.mockResolvedValue(sensor);
      (mockPrisma as any).sensorAlert.create.mockResolvedValue(makeAlert({ alertType: 'threshold_low' }));

      await sensorService.ingestReading('sensor-1', 0);

      expect((mockPrisma as any).sensorAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sensorId: 'sensor-1',
            alertType: 'threshold_low',
            value: 0,
            threshold: 2,
          }),
        }),
      );
    });

    it('should NOT create alert when value is within thresholds', async () => {
      const sensor = makeSensor({ maxThreshold: 30, minThreshold: 2 });
      (mockPrisma as any).sensor.findUnique.mockResolvedValue(sensor);
      (mockPrisma as any).sensorReading.create.mockResolvedValue(makeReading({ value: 15 }));
      (mockPrisma as any).sensor.update.mockResolvedValue(sensor);

      await sensorService.ingestReading('sensor-1', 15);

      expect((mockPrisma as any).sensorAlert.create).not.toHaveBeenCalled();
    });

    it('should NOT create alert when value equals maxThreshold exactly', async () => {
      const sensor = makeSensor({ maxThreshold: 30, minThreshold: 2 });
      (mockPrisma as any).sensor.findUnique.mockResolvedValue(sensor);
      (mockPrisma as any).sensorReading.create.mockResolvedValue(makeReading({ value: 30 }));
      (mockPrisma as any).sensor.update.mockResolvedValue(sensor);

      await sensorService.ingestReading('sensor-1', 30);

      expect((mockPrisma as any).sensorAlert.create).not.toHaveBeenCalled();
    });

    it('should NOT create alert when value equals minThreshold exactly', async () => {
      const sensor = makeSensor({ maxThreshold: 30, minThreshold: 2 });
      (mockPrisma as any).sensor.findUnique.mockResolvedValue(sensor);
      (mockPrisma as any).sensorReading.create.mockResolvedValue(makeReading({ value: 2 }));
      (mockPrisma as any).sensor.update.mockResolvedValue(sensor);

      await sensorService.ingestReading('sensor-1', 2);

      expect((mockPrisma as any).sensorAlert.create).not.toHaveBeenCalled();
    });

    it('should NOT check maxThreshold if it is null', async () => {
      const sensor = makeSensor({ maxThreshold: null, minThreshold: 2 });
      (mockPrisma as any).sensor.findUnique.mockResolvedValue(sensor);
      (mockPrisma as any).sensorReading.create.mockResolvedValue(makeReading({ value: 999 }));
      (mockPrisma as any).sensor.update.mockResolvedValue(sensor);

      await sensorService.ingestReading('sensor-1', 999);

      expect((mockPrisma as any).sensorAlert.create).not.toHaveBeenCalled();
    });

    it('should NOT check minThreshold if it is null', async () => {
      const sensor = makeSensor({ maxThreshold: 30, minThreshold: null });
      (mockPrisma as any).sensor.findUnique.mockResolvedValue(sensor);
      (mockPrisma as any).sensorReading.create.mockResolvedValue(makeReading({ value: -100 }));
      (mockPrisma as any).sensor.update.mockResolvedValue(sensor);

      await sensorService.ingestReading('sensor-1', -100);

      expect((mockPrisma as any).sensorAlert.create).not.toHaveBeenCalled();
    });

    it('should create both high and low alerts if both thresholds are breached (extreme case)', async () => {
      // This cannot normally happen with a single value, but exercises both code paths
      // A value of -5 with minThreshold=2 and maxThreshold set — only low alert fires
      const sensor = makeSensor({ maxThreshold: 30, minThreshold: 2 });
      (mockPrisma as any).sensor.findUnique.mockResolvedValue(sensor);
      (mockPrisma as any).sensorReading.create.mockResolvedValue(makeReading({ value: -5 }));
      (mockPrisma as any).sensor.update.mockResolvedValue(sensor);
      (mockPrisma as any).sensorAlert.create.mockResolvedValue(makeAlert({ alertType: 'threshold_low' }));

      await sensorService.ingestReading('sensor-1', -5);

      expect((mockPrisma as any).sensorAlert.create).toHaveBeenCalledTimes(1);
      expect((mockPrisma as any).sensorAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ alertType: 'threshold_low' }),
        }),
      );
    });

    it('should include sensor code and unit in alert message', async () => {
      const sensor = makeSensor({ sensorCode: 'HUM-005', unit: '%', maxThreshold: 80, minThreshold: null });
      (mockPrisma as any).sensor.findUnique.mockResolvedValue(sensor);
      (mockPrisma as any).sensorReading.create.mockResolvedValue(makeReading({ value: 95 }));
      (mockPrisma as any).sensor.update.mockResolvedValue(sensor);
      (mockPrisma as any).sensorAlert.create.mockResolvedValue(makeAlert());

      await sensorService.ingestReading('sensor-1', 95);

      expect((mockPrisma as any).sensorAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            message: expect.stringContaining('HUM-005'),
          }),
        }),
      );
      expect((mockPrisma as any).sensorAlert.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            message: expect.stringContaining('%'),
          }),
        }),
      );
    });

    it('should use $transaction for reading creation', async () => {
      const sensor = makeSensor({ maxThreshold: null, minThreshold: null });
      (mockPrisma as any).sensor.findUnique.mockResolvedValue(sensor);
      (mockPrisma as any).sensorReading.create.mockResolvedValue(makeReading());
      (mockPrisma as any).sensor.update.mockResolvedValue(sensor);

      await sensorService.ingestReading('sensor-1', 22);

      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.$transaction).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  // ##########################################################################
  // getReadings
  // ##########################################################################

  describe('getReadings', () => {
    it('should return readings for a sensor without date filters', async () => {
      const readings = [makeReading(), makeReading({ id: 'reading-2', value: 23 })];
      (mockPrisma as any).sensor.findUnique.mockResolvedValue(makeSensor());
      (mockPrisma as any).sensorReading.findMany.mockResolvedValue(readings);

      const result = await sensorService.getReadings('sensor-1');
      expect(result).toEqual(readings);
      expect((mockPrisma as any).sensorReading.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sensorId: 'sensor-1' },
          orderBy: { recordedAt: 'asc' },
          take: 5000,
        }),
      );
    });

    it('should throw NotFoundError if sensor does not exist', async () => {
      (mockPrisma as any).sensor.findUnique.mockResolvedValue(null);

      await expect(sensorService.getReadings('missing')).rejects.toThrow('Sensor');
    });

    it('should apply from date filter', async () => {
      (mockPrisma as any).sensor.findUnique.mockResolvedValue(makeSensor());
      (mockPrisma as any).sensorReading.findMany.mockResolvedValue([]);

      await sensorService.getReadings('sensor-1', '2026-02-01');

      expect((mockPrisma as any).sensorReading.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            sensorId: 'sensor-1',
            recordedAt: { gte: new Date('2026-02-01') },
          },
        }),
      );
    });

    it('should apply to date filter', async () => {
      (mockPrisma as any).sensor.findUnique.mockResolvedValue(makeSensor());
      (mockPrisma as any).sensorReading.findMany.mockResolvedValue([]);

      await sensorService.getReadings('sensor-1', undefined, '2026-02-28');

      expect((mockPrisma as any).sensorReading.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            sensorId: 'sensor-1',
            recordedAt: { lte: new Date('2026-02-28') },
          },
        }),
      );
    });

    it('should apply both from and to date filters', async () => {
      (mockPrisma as any).sensor.findUnique.mockResolvedValue(makeSensor());
      (mockPrisma as any).sensorReading.findMany.mockResolvedValue([]);

      await sensorService.getReadings('sensor-1', '2026-02-01', '2026-02-28');

      expect((mockPrisma as any).sensorReading.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            sensorId: 'sensor-1',
            recordedAt: {
              gte: new Date('2026-02-01'),
              lte: new Date('2026-02-28'),
            },
          },
        }),
      );
    });

    it('should accept Date objects for from/to', async () => {
      (mockPrisma as any).sensor.findUnique.mockResolvedValue(makeSensor());
      (mockPrisma as any).sensorReading.findMany.mockResolvedValue([]);

      const from = new Date('2026-02-10');
      const to = new Date('2026-02-20');
      await sensorService.getReadings('sensor-1', from, to);

      expect((mockPrisma as any).sensorReading.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            recordedAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('should enforce safety limit of 5000 readings', async () => {
      (mockPrisma as any).sensor.findUnique.mockResolvedValue(makeSensor());
      (mockPrisma as any).sensorReading.findMany.mockResolvedValue([]);

      await sensorService.getReadings('sensor-1');

      expect((mockPrisma as any).sensorReading.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 5000 }));
    });
  });

  // ##########################################################################
  // getAlerts
  // ##########################################################################

  describe('getAlerts', () => {
    it('should return all alerts with no filters', async () => {
      const alerts = [makeAlert()];
      (mockPrisma as any).sensorAlert.findMany.mockResolvedValue(alerts);

      const result = await sensorService.getAlerts();
      expect(result).toEqual(alerts);
      expect((mockPrisma as any).sensorAlert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {},
          orderBy: { createdAt: 'desc' },
          take: 200,
        }),
      );
    });

    it('should filter by warehouseId', async () => {
      (mockPrisma as any).sensorAlert.findMany.mockResolvedValue([]);

      await sensorService.getAlerts('wh-1');
      expect((mockPrisma as any).sensorAlert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sensor: { warehouseId: 'wh-1' } },
        }),
      );
    });

    it('should filter by acknowledged=false', async () => {
      (mockPrisma as any).sensorAlert.findMany.mockResolvedValue([]);

      await sensorService.getAlerts(undefined, false);
      expect((mockPrisma as any).sensorAlert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { acknowledged: false },
        }),
      );
    });

    it('should filter by acknowledged=true', async () => {
      (mockPrisma as any).sensorAlert.findMany.mockResolvedValue([]);

      await sensorService.getAlerts(undefined, true);
      expect((mockPrisma as any).sensorAlert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { acknowledged: true },
        }),
      );
    });

    it('should combine warehouseId and acknowledged filters', async () => {
      (mockPrisma as any).sensorAlert.findMany.mockResolvedValue([]);

      await sensorService.getAlerts('wh-1', false);
      expect((mockPrisma as any).sensorAlert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            sensor: { warehouseId: 'wh-1' },
            acknowledged: false,
          },
        }),
      );
    });

    it('should include sensor details in results', async () => {
      (mockPrisma as any).sensorAlert.findMany.mockResolvedValue([]);

      await sensorService.getAlerts();
      expect((mockPrisma as any).sensorAlert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            sensor: expect.objectContaining({
              select: expect.objectContaining({
                sensorCode: true,
                sensorType: true,
                unit: true,
              }),
            }),
          }),
        }),
      );
    });

    it('should limit results to 200', async () => {
      (mockPrisma as any).sensorAlert.findMany.mockResolvedValue([]);

      await sensorService.getAlerts();
      expect((mockPrisma as any).sensorAlert.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 200 }));
    });
  });

  // ##########################################################################
  // acknowledgeAlert
  // ##########################################################################

  describe('acknowledgeAlert', () => {
    it('should acknowledge an unacknowledged alert', async () => {
      const alert = makeAlert({ acknowledged: false });
      const acked = makeAlert({ acknowledged: true, acknowledgedById: 'user-1', acknowledgedAt: new Date() });
      (mockPrisma as any).sensorAlert.findUnique.mockResolvedValue(alert);
      (mockPrisma as any).sensorAlert.update.mockResolvedValue(acked);

      const result = await sensorService.acknowledgeAlert('alert-1', 'user-1');
      expect(result.acknowledged).toBe(true);
      expect((mockPrisma as any).sensorAlert.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'alert-1' },
          data: expect.objectContaining({
            acknowledged: true,
            acknowledgedById: 'user-1',
            acknowledgedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should throw NotFoundError if alert does not exist', async () => {
      (mockPrisma as any).sensorAlert.findUnique.mockResolvedValue(null);

      await expect(sensorService.acknowledgeAlert('missing', 'user-1')).rejects.toThrow('Sensor Alert');
    });

    it('should throw BusinessRuleError if alert already acknowledged', async () => {
      (mockPrisma as any).sensorAlert.findUnique.mockResolvedValue(makeAlert({ acknowledged: true }));

      await expect(sensorService.acknowledgeAlert('alert-1', 'user-1')).rejects.toThrow('already acknowledged');
    });
  });

  // ##########################################################################
  // getSensorStatus
  // ##########################################################################

  describe('getSensorStatus', () => {
    it('should return sensors for a warehouse with zone and alert count', async () => {
      const sensors = [makeSensor({ _count: { alerts: 2 } }), makeSensor({ id: 'sensor-2', _count: { alerts: 0 } })];
      (mockPrisma as any).sensor.findMany.mockResolvedValue(sensors);

      const result = await sensorService.getSensorStatus('wh-1');
      expect(result).toEqual(sensors);
      expect((mockPrisma as any).sensor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { warehouseId: 'wh-1' },
          orderBy: { sensorCode: 'asc' },
        }),
      );
    });

    it('should include zone info and unacknowledged alert count', async () => {
      (mockPrisma as any).sensor.findMany.mockResolvedValue([]);

      await sensorService.getSensorStatus('wh-1');
      expect((mockPrisma as any).sensor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            zone: expect.objectContaining({
              select: expect.objectContaining({ zoneName: true, zoneCode: true }),
            }),
            _count: expect.objectContaining({
              select: expect.objectContaining({
                alerts: { where: { acknowledged: false } },
              }),
            }),
          }),
        }),
      );
    });
  });

  // ##########################################################################
  // getZoneHeatmap
  // ##########################################################################

  describe('getZoneHeatmap', () => {
    it('should return zones with average temperature and humidity', async () => {
      const zones = [
        { id: 'zone-1', zoneName: 'Zone A', zoneCode: 'ZA', zoneType: 'storage' },
        { id: 'zone-2', zoneName: 'Zone B', zoneCode: 'ZB', zoneType: 'cold_storage' },
      ];
      const sensors = [
        { zoneId: 'zone-1', sensorType: 'temperature', lastValue: 20 },
        { zoneId: 'zone-1', sensorType: 'temperature', lastValue: 24 },
        { zoneId: 'zone-1', sensorType: 'humidity', lastValue: 60 },
        { zoneId: 'zone-2', sensorType: 'temperature', lastValue: 4 },
      ];

      (mockPrisma as any).warehouseZone.findMany.mockResolvedValue(zones);
      (mockPrisma as any).sensor.findMany.mockResolvedValue(sensors);

      const result = await sensorService.getZoneHeatmap('wh-1');

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: 'zone-1',
        zoneName: 'Zone A',
        zoneCode: 'ZA',
        zoneType: 'storage',
        avgTemperature: 22, // (20 + 24) / 2
        avgHumidity: 60, // 60 / 1
      });
      expect(result[1]).toEqual({
        id: 'zone-2',
        zoneName: 'Zone B',
        zoneCode: 'ZB',
        zoneType: 'cold_storage',
        avgTemperature: 4,
        avgHumidity: null,
      });
    });

    it('should return null averages for zones with no sensor data', async () => {
      const zones = [{ id: 'zone-3', zoneName: 'Empty Zone', zoneCode: 'EZ', zoneType: 'staging' }];
      (mockPrisma as any).warehouseZone.findMany.mockResolvedValue(zones);
      (mockPrisma as any).sensor.findMany.mockResolvedValue([]);

      const result = await sensorService.getZoneHeatmap('wh-1');

      expect(result).toHaveLength(1);
      expect(result[0].avgTemperature).toBeNull();
      expect(result[0].avgHumidity).toBeNull();
    });

    it('should filter sensors to active with non-null zoneId and lastValue', async () => {
      (mockPrisma as any).warehouseZone.findMany.mockResolvedValue([]);
      (mockPrisma as any).sensor.findMany.mockResolvedValue([]);

      await sensorService.getZoneHeatmap('wh-1');

      expect((mockPrisma as any).sensor.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            warehouseId: 'wh-1',
            isActive: true,
            zoneId: { not: null },
            lastValue: { not: null },
          },
        }),
      );
    });

    it('should skip sensors with null zoneId in aggregation', async () => {
      const zones = [{ id: 'zone-1', zoneName: 'Zone A', zoneCode: 'ZA', zoneType: 'storage' }];
      const sensors = [
        { zoneId: null, sensorType: 'temperature', lastValue: 50 },
        { zoneId: 'zone-1', sensorType: 'temperature', lastValue: 20 },
      ];

      (mockPrisma as any).warehouseZone.findMany.mockResolvedValue(zones);
      (mockPrisma as any).sensor.findMany.mockResolvedValue(sensors);

      const result = await sensorService.getZoneHeatmap('wh-1');

      expect(result[0].avgTemperature).toBe(20); // Only zone-1 sensor counted
    });

    it('should skip sensors with null lastValue in aggregation', async () => {
      const zones = [{ id: 'zone-1', zoneName: 'Zone A', zoneCode: 'ZA', zoneType: 'storage' }];
      const sensors = [
        { zoneId: 'zone-1', sensorType: 'temperature', lastValue: null },
        { zoneId: 'zone-1', sensorType: 'temperature', lastValue: 18 },
      ];

      (mockPrisma as any).warehouseZone.findMany.mockResolvedValue(zones);
      (mockPrisma as any).sensor.findMany.mockResolvedValue(sensors);

      const result = await sensorService.getZoneHeatmap('wh-1');

      expect(result[0].avgTemperature).toBe(18);
    });

    it('should return empty array when warehouse has no zones', async () => {
      (mockPrisma as any).warehouseZone.findMany.mockResolvedValue([]);
      (mockPrisma as any).sensor.findMany.mockResolvedValue([]);

      const result = await sensorService.getZoneHeatmap('wh-1');
      expect(result).toEqual([]);
    });

    it('should correctly compute average with many sensors per zone', async () => {
      const zones = [{ id: 'zone-1', zoneName: 'Zone A', zoneCode: 'ZA', zoneType: 'storage' }];
      const sensors = [
        { zoneId: 'zone-1', sensorType: 'humidity', lastValue: 40 },
        { zoneId: 'zone-1', sensorType: 'humidity', lastValue: 50 },
        { zoneId: 'zone-1', sensorType: 'humidity', lastValue: 60 },
        { zoneId: 'zone-1', sensorType: 'humidity', lastValue: 70 },
      ];

      (mockPrisma as any).warehouseZone.findMany.mockResolvedValue(zones);
      (mockPrisma as any).sensor.findMany.mockResolvedValue(sensors);

      const result = await sensorService.getZoneHeatmap('wh-1');

      expect(result[0].avgHumidity).toBe(55); // (40+50+60+70) / 4
      expect(result[0].avgTemperature).toBeNull();
    });

    it('should query warehouseZone for the given warehouseId', async () => {
      (mockPrisma as any).warehouseZone.findMany.mockResolvedValue([]);
      (mockPrisma as any).sensor.findMany.mockResolvedValue([]);

      await sensorService.getZoneHeatmap('wh-42');

      expect((mockPrisma as any).warehouseZone.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { warehouseId: 'wh-42' },
        }),
      );
    });
  });
});
