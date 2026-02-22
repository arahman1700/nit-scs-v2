import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import {
  listCustomDataSources,
  getCustomDataSource,
  createCustomDataSource,
  updateCustomDataSource,
  deleteCustomDataSource,
  executeCustomDataSource,
} from '../services/custom-data-source.service.js';
import { createAuditLog } from '../services/audit.service.js';
import { logger } from '../config/logger.js';

const router = Router();

function canAccessSource(
  source: { isPublic: boolean; createdById: string | null },
  user: { userId: string; systemRole: string },
) {
  return user.systemRole === 'admin' || source.isPublic || source.createdById === user.userId;
}

// All routes require authentication
router.use(authenticate);

// GET / — List data sources (public + own)
router.get('/', async (req, res, next) => {
  try {
    const sources = await listCustomDataSources(req.user!.userId);
    res.json({ success: true, data: sources });
  } catch (err) {
    next(err);
  }
});

// GET /:id — Get single data source
router.get('/:id', async (req, res, next) => {
  try {
    const source = await getCustomDataSource(req.params.id as string);
    if (!canAccessSource(source, req.user!)) {
      res.status(403).json({ success: false, message: 'Access denied' });
      return;
    }
    res.json({ success: true, data: source });
  } catch (err) {
    next(err);
  }
});

// POST / — Create data source
router.post('/', requirePermission('custom_data_source', 'create'), async (req, res, next) => {
  try {
    const source = await createCustomDataSource({
      ...req.body,
      createdById: req.user!.userId,
    });
    createAuditLog({
      tableName: 'CustomDataSource',
      recordId: source.id,
      action: 'create',
      newValues: req.body,
      performedById: req.user!.userId,
      ipAddress: req.ip,
    }).catch(err => {
      logger.error({ err }, 'Audit log write failed');
    });
    res.status(201).json({ success: true, data: source });
  } catch (err) {
    next(err);
  }
});

// PUT /:id — Update data source
router.put('/:id', requirePermission('custom_data_source', 'update'), async (req, res, next) => {
  try {
    const source = await updateCustomDataSource(req.params.id as string, req.body);
    createAuditLog({
      tableName: 'CustomDataSource',
      recordId: req.params.id as string,
      action: 'update',
      newValues: req.body,
      performedById: req.user!.userId,
      ipAddress: req.ip,
    }).catch(err => {
      logger.error({ err }, 'Audit log write failed');
    });
    res.json({ success: true, data: source });
  } catch (err) {
    next(err);
  }
});

// DELETE /:id — Delete data source
router.delete('/:id', requirePermission('custom_data_source', 'delete'), async (req, res, next) => {
  try {
    await deleteCustomDataSource(req.params.id as string);
    createAuditLog({
      tableName: 'CustomDataSource',
      recordId: req.params.id as string,
      action: 'delete',
      performedById: req.user!.userId,
      ipAddress: req.ip,
    }).catch(err => {
      logger.error({ err }, 'Audit log write failed');
    });
    res.json({ success: true, message: 'Data source deleted' });
  } catch (err) {
    next(err);
  }
});

// POST /:id/test — Preview/test execution
router.post('/:id/test', requirePermission('custom_data_source', 'update'), async (req, res, next) => {
  try {
    const source = await getCustomDataSource(req.params.id as string);
    const result = await executeCustomDataSource(source);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// POST /preview — Test a query template without saving
router.post('/preview', requirePermission('custom_data_source', 'update'), async (req, res, next) => {
  try {
    const result = await executeCustomDataSource({
      entityType: req.body.entityType,
      aggregation: req.body.aggregation,
      queryTemplate: req.body.queryTemplate,
      outputType: req.body.outputType ?? 'number',
      name: req.body.name ?? 'Preview',
    });
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

export default router;
