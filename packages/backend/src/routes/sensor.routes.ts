/**
 * Sensor Routes — IoT Sensor Monitoring
 * REST endpoints for sensor CRUD, reading ingestion, alerts, and analytics.
 */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { sendSuccess, sendCreated, sendNoContent, sendError } from '../utils/response.js';
import { createAuditLog } from '../services/audit.service.js';
import { clientIp } from '../utils/helpers.js';
import {
  listSensors,
  getSensorById,
  createSensor,
  updateSensor,
  deleteSensor,
  ingestReading,
  getReadings,
  getAlerts,
  acknowledgeAlert,
  getSensorStatus,
  getZoneHeatmap,
} from '../services/sensor.service.js';
import type { SensorCreateDto, SensorUpdateDto, SensorListParams } from '../services/sensor.service.js';

const router = Router();

const WRITE_ROLES = ['admin', 'warehouse_supervisor'];
const READ_ROLES = ['admin', 'warehouse_supervisor', 'warehouse_staff', 'manager'];

// ── GET / — List sensors ────────────────────────────────────────────────────
router.get('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const params: SensorListParams = {
      warehouseId: req.query.warehouseId as string | undefined,
      sensorType: req.query.sensorType as string | undefined,
      search: req.query.search as string | undefined,
    };
    if (req.query.isActive !== undefined) {
      params.isActive = req.query.isActive === 'true';
    }
    const data = await listSensors(params);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// ── GET /status/:warehouseId — Sensor status for a warehouse ───────────────
router.get('/status/:warehouseId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getSensorStatus(req.params.warehouseId as string);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// ── GET /heatmap/:warehouseId — Zone heatmap data ──────────────────────────
router.get('/heatmap/:warehouseId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getZoneHeatmap(req.params.warehouseId as string);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// ── GET /alerts — List alerts ──────────────────────────────────────────────
router.get('/alerts', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const warehouseId = req.query.warehouseId as string | undefined;
    const acknowledged = req.query.acknowledged !== undefined ? req.query.acknowledged === 'true' : undefined;
    const data = await getAlerts(warehouseId, acknowledged);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// ── POST /alerts/:alertId/acknowledge — Acknowledge alert ──────────────────
router.post('/alerts/:alertId/acknowledge', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await acknowledgeAlert(req.params.alertId as string, req.user!.userId);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// ── GET /readings/:sensorId — Historical readings ─────────────────────────
router.get('/readings/:sensorId', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const data = await getReadings(req.params.sensorId as string, from, to);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// ── POST /readings — Ingest a reading ──────────────────────────────────────
router.post('/readings', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sensorId, value } = req.body as { sensorId: string; value: number };
    if (!sensorId || value === undefined) {
      sendError(res, 400, 'sensorId and value are required');
      return;
    }
    const data = await ingestReading(sensorId, value);
    sendCreated(res, data);
  } catch (err) {
    next(err);
  }
});

// ── GET /:id — Get single sensor ──────────────────────────────────────────
router.get('/:id', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await getSensorById(req.params.id as string);
    sendSuccess(res, data);
  } catch (err) {
    next(err);
  }
});

// ── POST / — Create sensor ─────────────────────────────────────────────────
router.post('/', authenticate, requireRole(...WRITE_ROLES), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await createSensor(req.body as SensorCreateDto);

    await createAuditLog({
      tableName: 'sensors',
      recordId: data.id,
      action: 'create',
      newValues: req.body,
      performedById: req.user!.userId,
      ipAddress: clientIp(req),
    });

    sendCreated(res, data);
  } catch (err) {
    next(err);
  }
});

// ── PUT /:id — Update sensor ──────────────────────────────────────────────
router.put(
  '/:id',
  authenticate,
  requireRole(...WRITE_ROLES),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await updateSensor(req.params.id as string, req.body as SensorUpdateDto);

      await createAuditLog({
        tableName: 'sensors',
        recordId: req.params.id as string,
        action: 'update',
        newValues: req.body,
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendSuccess(res, data);
    } catch (err) {
      next(err);
    }
  },
);

// ── DELETE /:id — Delete sensor ───────────────────────────────────────────
router.delete(
  '/:id',
  authenticate,
  requireRole(...WRITE_ROLES),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await deleteSensor(req.params.id as string);

      await createAuditLog({
        tableName: 'sensors',
        recordId: req.params.id as string,
        action: 'delete',
        performedById: req.user!.userId,
        ipAddress: clientIp(req),
      });

      sendNoContent(res);
    } catch (err) {
      next(err);
    }
  },
);

export default router;
