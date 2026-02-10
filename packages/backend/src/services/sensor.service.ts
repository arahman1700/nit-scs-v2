/**
 * Sensor Service — IoT Sensor Monitoring
 * CRUD for sensors, reading ingestion with threshold alerts, analytics.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';

// ── Types ──────────────────────────────────────────────────────────────────

export interface SensorCreateDto {
  sensorCode: string;
  sensorType: string;
  warehouseId: string;
  zoneId?: string | null;
  location?: string | null;
  minThreshold?: number | null;
  maxThreshold?: number | null;
  unit?: string;
}

export interface SensorUpdateDto {
  sensorCode?: string;
  sensorType?: string;
  zoneId?: string | null;
  location?: string | null;
  minThreshold?: number | null;
  maxThreshold?: number | null;
  unit?: string;
  isActive?: boolean;
}

export interface SensorListParams {
  warehouseId?: string;
  sensorType?: string;
  isActive?: boolean;
  search?: string;
}

// ── Includes ───────────────────────────────────────────────────────────────

const SENSOR_LIST_INCLUDE = {
  warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
  zone: { select: { id: true, zoneName: true, zoneCode: true } },
  _count: { select: { alerts: { where: { acknowledged: false } } } },
} satisfies Prisma.SensorInclude;

const SENSOR_DETAIL_INCLUDE = {
  warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
  zone: { select: { id: true, zoneName: true, zoneCode: true, zoneType: true } },
  _count: { select: { alerts: { where: { acknowledged: false } }, readings: true } },
} satisfies Prisma.SensorInclude;

// ── CRUD ───────────────────────────────────────────────────────────────────

export async function listSensors(params: SensorListParams) {
  const where: Prisma.SensorWhereInput = {};

  if (params.warehouseId) where.warehouseId = params.warehouseId;
  if (params.sensorType) where.sensorType = params.sensorType;
  if (params.isActive !== undefined) where.isActive = params.isActive;
  if (params.search) {
    where.OR = [
      { sensorCode: { contains: params.search, mode: 'insensitive' } },
      { location: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const data = await prisma.sensor.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: SENSOR_LIST_INCLUDE,
  });
  return data;
}

export async function getSensorById(id: string) {
  const sensor = await prisma.sensor.findUnique({
    where: { id },
    include: SENSOR_DETAIL_INCLUDE,
  });
  if (!sensor) throw new NotFoundError('Sensor', id);
  return sensor;
}

export async function createSensor(data: SensorCreateDto) {
  return prisma.sensor.create({
    data: {
      sensorCode: data.sensorCode,
      sensorType: data.sensorType,
      warehouseId: data.warehouseId,
      zoneId: data.zoneId ?? null,
      location: data.location ?? null,
      minThreshold: data.minThreshold ?? null,
      maxThreshold: data.maxThreshold ?? null,
      unit: data.unit ?? '°C',
    },
    include: SENSOR_DETAIL_INCLUDE,
  });
}

export async function updateSensor(id: string, data: SensorUpdateDto) {
  const existing = await prisma.sensor.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Sensor', id);

  return prisma.sensor.update({
    where: { id },
    data: {
      ...(data.sensorCode !== undefined && { sensorCode: data.sensorCode }),
      ...(data.sensorType !== undefined && { sensorType: data.sensorType }),
      ...(data.zoneId !== undefined && { zoneId: data.zoneId }),
      ...(data.location !== undefined && { location: data.location }),
      ...(data.minThreshold !== undefined && { minThreshold: data.minThreshold }),
      ...(data.maxThreshold !== undefined && { maxThreshold: data.maxThreshold }),
      ...(data.unit !== undefined && { unit: data.unit }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
    },
    include: SENSOR_DETAIL_INCLUDE,
  });
}

export async function deleteSensor(id: string) {
  const existing = await prisma.sensor.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Sensor', id);
  await prisma.sensor.delete({ where: { id } });
}

// ── Reading Ingestion ──────────────────────────────────────────────────────

export async function ingestReading(sensorId: string, value: number) {
  const sensor = await prisma.sensor.findUnique({ where: { id: sensorId } });
  if (!sensor) throw new NotFoundError('Sensor', sensorId);
  if (!sensor.isActive) throw new BusinessRuleError('Sensor is inactive');

  const now = new Date();

  // Record the reading and update sensor's last value in a transaction
  const [reading] = await prisma.$transaction(async tx => {
    const newReading = await tx.sensorReading.create({
      data: {
        sensorId,
        value,
        recordedAt: now,
      },
    });

    await tx.sensor.update({
      where: { id: sensorId },
      data: {
        lastValue: value,
        lastReadingAt: now,
      },
    });

    return [newReading];
  });

  // Check thresholds and create alerts if breached
  const decimalValue = new Prisma.Decimal(value);

  if (sensor.maxThreshold !== null && decimalValue.greaterThan(sensor.maxThreshold)) {
    await prisma.sensorAlert.create({
      data: {
        sensorId,
        alertType: 'threshold_high',
        value,
        threshold: sensor.maxThreshold,
        message: `${sensor.sensorCode} reading ${value}${sensor.unit} exceeds max threshold ${sensor.maxThreshold}${sensor.unit}`,
      },
    });
  }

  if (sensor.minThreshold !== null && decimalValue.lessThan(sensor.minThreshold)) {
    await prisma.sensorAlert.create({
      data: {
        sensorId,
        alertType: 'threshold_low',
        value,
        threshold: sensor.minThreshold,
        message: `${sensor.sensorCode} reading ${value}${sensor.unit} is below min threshold ${sensor.minThreshold}${sensor.unit}`,
      },
    });
  }

  return reading;
}

// ── Readings History ───────────────────────────────────────────────────────

export async function getReadings(sensorId: string, from?: string | Date, to?: string | Date) {
  const sensor = await prisma.sensor.findUnique({ where: { id: sensorId } });
  if (!sensor) throw new NotFoundError('Sensor', sensorId);

  const where: Prisma.SensorReadingWhereInput = { sensorId };

  if (from || to) {
    where.recordedAt = {};
    if (from) where.recordedAt.gte = new Date(from);
    if (to) where.recordedAt.lte = new Date(to);
  }

  return prisma.sensorReading.findMany({
    where,
    orderBy: { recordedAt: 'asc' },
    take: 5000, // safety limit
  });
}

// ── Alerts ─────────────────────────────────────────────────────────────────

export async function getAlerts(warehouseId?: string, acknowledged?: boolean) {
  const where: Prisma.SensorAlertWhereInput = {};

  if (warehouseId) {
    where.sensor = { warehouseId };
  }
  if (acknowledged !== undefined) {
    where.acknowledged = acknowledged;
  }

  return prisma.sensorAlert.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      sensor: {
        select: {
          id: true,
          sensorCode: true,
          sensorType: true,
          unit: true,
          location: true,
          warehouse: { select: { id: true, warehouseName: true } },
          zone: { select: { id: true, zoneName: true, zoneCode: true } },
        },
      },
    },
  });
}

export async function acknowledgeAlert(alertId: string, userId: string) {
  const alert = await prisma.sensorAlert.findUnique({ where: { id: alertId } });
  if (!alert) throw new NotFoundError('Sensor Alert', alertId);
  if (alert.acknowledged) throw new BusinessRuleError('Alert already acknowledged');

  return prisma.sensorAlert.update({
    where: { id: alertId },
    data: {
      acknowledged: true,
      acknowledgedById: userId,
      acknowledgedAt: new Date(),
    },
  });
}

// ── Sensor Status Dashboard ────────────────────────────────────────────────

export async function getSensorStatus(warehouseId: string) {
  const sensors = await prisma.sensor.findMany({
    where: { warehouseId },
    include: {
      zone: { select: { id: true, zoneName: true, zoneCode: true } },
      _count: { select: { alerts: { where: { acknowledged: false } } } },
    },
    orderBy: { sensorCode: 'asc' },
  });

  return sensors;
}

// ── Zone Heatmap ───────────────────────────────────────────────────────────

export async function getZoneHeatmap(warehouseId: string) {
  // Get all zones for this warehouse
  const zones = await prisma.warehouseZone.findMany({
    where: { warehouseId },
    select: { id: true, zoneName: true, zoneCode: true, zoneType: true },
  });

  // Get all active sensors with last values, grouped by zone
  const sensors = await prisma.sensor.findMany({
    where: {
      warehouseId,
      isActive: true,
      zoneId: { not: null },
      lastValue: { not: null },
    },
    select: {
      zoneId: true,
      sensorType: true,
      lastValue: true,
    },
  });

  // Compute average values per zone per sensor type
  const zoneMap = new Map<string, { temps: number[]; humidities: number[] }>();

  for (const sensor of sensors) {
    if (!sensor.zoneId || sensor.lastValue === null) continue;
    if (!zoneMap.has(sensor.zoneId)) {
      zoneMap.set(sensor.zoneId, { temps: [], humidities: [] });
    }
    const entry = zoneMap.get(sensor.zoneId)!;
    const val = Number(sensor.lastValue);
    if (sensor.sensorType === 'temperature') entry.temps.push(val);
    if (sensor.sensorType === 'humidity') entry.humidities.push(val);
  }

  const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

  return zones.map(zone => {
    const data = zoneMap.get(zone.id);
    return {
      ...zone,
      avgTemperature: data ? avg(data.temps) : null,
      avgHumidity: data ? avg(data.humidities) : null,
    };
  });
}
