/**
 * Inspection Routes — AQL calculator & Inspection Checklists
 * Mounted at /api/v1/inspections
 */
import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendCreated, sendNoContent, sendError } from '../utils/response.js';
import * as aqlService from '../services/aql.service.js';
import * as checklistService from '../services/inspection-checklist.service.js';
import type { InspectionLevel } from '../services/aql.service.js';

const router = Router();

// All inspection routes require authentication
router.use(authenticate);

// ── AQL Calculator ─────────────────────────────────────────────────────────

/**
 * GET /inspections/aql/calculate?lotSize=X&level=II&aql=1.0
 * Calculate AQL sample size and accept/reject numbers.
 */
router.get('/aql/calculate', (req, res) => {
  try {
    const lotSize = parseInt(req.query.lotSize as string, 10);
    const level = (req.query.level as InspectionLevel) || 'II';
    const aqlPercent = parseFloat(req.query.aql as string);

    if (isNaN(lotSize) || lotSize < 1) {
      sendError(res, 400, 'lotSize must be a positive integer');
      return;
    }
    if (!['I', 'II', 'III'].includes(level)) {
      sendError(res, 400, 'level must be I, II, or III');
      return;
    }
    if (isNaN(aqlPercent) || aqlPercent <= 0) {
      sendError(res, 400, 'aql must be a positive number');
      return;
    }

    const result = aqlService.calculateSampleSize(lotSize, level, aqlPercent);
    sendSuccess(res, result);
  } catch (err) {
    sendError(res, 500, (err as Error).message);
  }
});

/**
 * GET /inspections/aql/table
 * Full AQL reference table for UI display.
 */
router.get('/aql/table', (_req, res) => {
  try {
    const table = aqlService.getAqlTable();
    sendSuccess(res, table);
  } catch (err) {
    sendError(res, 500, (err as Error).message);
  }
});

// ── Checklists CRUD ────────────────────────────────────────────────────────

/**
 * GET /inspections/checklists
 * List all checklists, optionally filtered by category, isActive, search.
 */
router.get('/checklists', async (req, res) => {
  try {
    const category = req.query.category as string | undefined;
    const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
    const search = req.query.search as string | undefined;

    const data = await checklistService.list({ category, isActive, search });
    sendSuccess(res, data);
  } catch (err) {
    sendError(res, 500, (err as Error).message);
  }
});

/**
 * GET /inspections/checklists/:id
 * Get a checklist with its items.
 */
router.get('/checklists/:id', async (req, res) => {
  try {
    const data = await checklistService.getById(req.params.id);
    sendSuccess(res, data);
  } catch (err: unknown) {
    const e = err as Error & { statusCode?: number };
    sendError(res, e.statusCode ?? 500, e.message);
  }
});

/**
 * POST /inspections/checklists
 * Create a new checklist (optionally with items).
 */
router.post('/checklists', async (req, res) => {
  try {
    const data = await checklistService.create(req.body);
    sendCreated(res, data);
  } catch (err) {
    sendError(res, 500, (err as Error).message);
  }
});

/**
 * PUT /inspections/checklists/:id
 * Update checklist metadata.
 */
router.put('/checklists/:id', async (req, res) => {
  try {
    const data = await checklistService.update(req.params.id, req.body);
    sendSuccess(res, data);
  } catch (err: unknown) {
    const e = err as Error & { statusCode?: number };
    sendError(res, e.statusCode ?? 500, e.message);
  }
});

/**
 * DELETE /inspections/checklists/:id
 * Delete a checklist and all its items.
 */
router.delete('/checklists/:id', async (req, res) => {
  try {
    await checklistService.remove(req.params.id);
    sendNoContent(res);
  } catch (err: unknown) {
    const e = err as Error & { statusCode?: number };
    sendError(res, e.statusCode ?? 500, e.message);
  }
});

// ── Checklist Items CRUD ───────────────────────────────────────────────────

/**
 * GET /inspections/checklists/:id/items
 * List all items for a checklist, ordered by itemOrder.
 */
router.get('/checklists/:id/items', async (req, res) => {
  try {
    const data = await checklistService.listItems(req.params.id);
    sendSuccess(res, data);
  } catch (err: unknown) {
    const e = err as Error & { statusCode?: number };
    sendError(res, e.statusCode ?? 500, e.message);
  }
});

/**
 * POST /inspections/checklists/:id/items
 * Add a new item to a checklist.
 */
router.post('/checklists/:id/items', async (req, res) => {
  try {
    const data = await checklistService.addItem(req.params.id, req.body);
    sendCreated(res, data);
  } catch (err: unknown) {
    const e = err as Error & { statusCode?: number };
    sendError(res, e.statusCode ?? 500, e.message);
  }
});

/**
 * PUT /inspections/checklists/:checklistId/items/:itemId
 * Update a checklist item.
 */
router.put('/checklists/:checklistId/items/:itemId', async (req, res) => {
  try {
    const data = await checklistService.updateItem(req.params.itemId, req.body);
    sendSuccess(res, data);
  } catch (err: unknown) {
    const e = err as Error & { statusCode?: number };
    sendError(res, e.statusCode ?? 500, e.message);
  }
});

/**
 * DELETE /inspections/checklists/:checklistId/items/:itemId
 * Remove a checklist item.
 */
router.delete('/checklists/:checklistId/items/:itemId', async (req, res) => {
  try {
    await checklistService.removeItem(req.params.itemId);
    sendNoContent(res);
  } catch (err: unknown) {
    const e = err as Error & { statusCode?: number };
    sendError(res, e.statusCode ?? 500, e.message);
  }
});

/**
 * POST /inspections/checklists/:id/items/reorder
 * Reorder items in a checklist. Body: { itemIds: string[] }
 */
router.post('/checklists/:id/items/reorder', async (req, res) => {
  try {
    const { itemIds } = req.body as { itemIds: string[] };
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      sendError(res, 400, 'itemIds must be a non-empty array of item UUIDs');
      return;
    }
    const data = await checklistService.reorderItems(req.params.id, itemIds);
    sendSuccess(res, data);
  } catch (err: unknown) {
    const e = err as Error & { statusCode?: number };
    sendError(res, e.statusCode ?? 500, e.message);
  }
});

export default router;
