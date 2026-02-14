import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import {
  listFieldDefinitions,
  getFieldDefinition,
  createFieldDefinition,
  updateFieldDefinition,
  deleteFieldDefinition,
  getCustomFieldValues,
  setCustomFieldValues,
} from '../services/custom-fields.service.js';
import { createAuditLog } from '../services/audit.service.js';
import { logger } from '../config/logger.js';

const router = Router();
router.use(authenticate);

// ── Field Definitions (Admin) ────────────────────────────────────────

// GET /definitions — List all (optionally filter by entityType)
router.get('/definitions', async (req, res, next) => {
  try {
    const entityType = req.query.entityType as string | undefined;
    const defs = await listFieldDefinitions(entityType);
    res.json({ success: true, data: defs });
  } catch (err) {
    next(err);
  }
});

// GET /definitions/:id
router.get('/definitions/:id', async (req, res, next) => {
  try {
    const def = await getFieldDefinition(req.params.id as string);
    res.json({ success: true, data: def });
  } catch (err) {
    next(err);
  }
});

// POST /definitions
router.post('/definitions', requireRole('admin'), async (req, res, next) => {
  try {
    const def = await createFieldDefinition(req.body);
    createAuditLog({
      tableName: 'CustomFieldDefinition',
      recordId: def.id,
      action: 'create',
      newValues: req.body,
      performedById: req.user!.userId,
      ipAddress: req.ip,
    }).catch(err => {
      logger.error({ err }, 'Audit log write failed');
    });
    res.status(201).json({ success: true, data: def });
  } catch (err) {
    next(err);
  }
});

// PUT /definitions/:id
router.put('/definitions/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const def = await updateFieldDefinition(req.params.id as string, req.body);
    createAuditLog({
      tableName: 'CustomFieldDefinition',
      recordId: req.params.id as string,
      action: 'update',
      newValues: req.body,
      performedById: req.user!.userId,
      ipAddress: req.ip,
    }).catch(err => {
      logger.error({ err }, 'Audit log write failed');
    });
    res.json({ success: true, data: def });
  } catch (err) {
    next(err);
  }
});

// DELETE /definitions/:id
router.delete('/definitions/:id', requireRole('admin'), async (req, res, next) => {
  try {
    await deleteFieldDefinition(req.params.id as string);
    createAuditLog({
      tableName: 'CustomFieldDefinition',
      recordId: req.params.id as string,
      action: 'delete',
      performedById: req.user!.userId,
      ipAddress: req.ip,
    }).catch(err => {
      logger.error({ err }, 'Audit log write failed');
    });
    res.json({ success: true, message: 'Field definition deleted' });
  } catch (err) {
    next(err);
  }
});

// ── Field Values (per entity) ────────────────────────────────────────

// GET /values/:entityType/:entityId
router.get('/values/:entityType/:entityId', async (req, res, next) => {
  try {
    const values = await getCustomFieldValues(req.params.entityType as string, req.params.entityId as string);
    res.json({ success: true, data: values });
  } catch (err) {
    next(err);
  }
});

// PUT /values/:entityType/:entityId
router.put('/values/:entityType/:entityId', async (req, res, next) => {
  try {
    const entityType = req.params.entityType as string;
    const entityId = req.params.entityId as string;
    await setCustomFieldValues(entityType, entityId, req.body);
    const values = await getCustomFieldValues(entityType, entityId);
    res.json({ success: true, data: values });
  } catch (err) {
    next(err);
  }
});

export default router;
