/**
 * Reorder Suggestions Routes — Inventory Domain
 *
 * GET  /inventory/reorder-suggestions        — Items where currentQty <= reorderPoint
 * POST /inventory/reorder-suggestions/:itemId/apply — Update reorder settings on InventoryLevel
 */

import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../../middleware/auth.js';
import { requirePermission } from '../../../middleware/rbac.js';
import { prisma } from '../../../utils/prisma.js';
import { sendSuccess, sendError } from '../../../utils/response.js';
import { buildScopeFilter } from '../../../utils/scope-filter.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /inventory/reorder-suggestions
 *
 * Returns inventory levels where qtyOnHand <= reorderPoint and reorderPoint > 0,
 * ordered by qtyOnHand ASC (most urgent first).
 */
router.get(
  '/reorder-suggestions',
  requirePermission('inventory', 'read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const scopeFilter = buildScopeFilter(req.user!, { warehouseField: 'warehouseId' });

      const levels = await prisma.inventoryLevel.findMany({
        where: {
          ...scopeFilter,
          reorderPoint: {
            gt: 0,
          },
        },
        include: {
          item: {
            select: {
              id: true,
              itemCode: true,
              itemDescription: true,
              category: true,
              reorderPoint: true,
            },
          },
          warehouse: {
            select: {
              id: true,
              warehouseName: true,
              warehouseCode: true,
            },
          },
        },
        orderBy: { qtyOnHand: 'asc' },
      });

      // Filter to only items at or below their reorder point
      const suggestions = levels.filter(level => Number(level.qtyOnHand) <= Number(level.reorderPoint));

      const result = suggestions.map(level => ({
        id: level.id,
        itemId: level.itemId,
        warehouseId: level.warehouseId,
        item: level.item,
        warehouse: level.warehouse,
        currentQty: Number(level.qtyOnHand),
        reorderPoint: Number(level.reorderPoint),
        minLevel: level.minLevel !== null ? Number(level.minLevel) : null,
        // Suggested order qty: double the reorder point as a simple heuristic
        suggestedOrderQty: Number(level.reorderPoint) * 2,
        lastMovementDate: level.lastMovementDate,
        alertSent: level.alertSent,
      }));

      sendSuccess(res, result);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /inventory/reorder-suggestions/:itemId/apply
 *
 * Updates reorderPoint and/or minLevel on an InventoryLevel record.
 * Body: { warehouseId, reorderPoint?, minLevel? }
 */
router.post(
  '/reorder-suggestions/:itemId/apply',
  requirePermission('inventory', 'update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { itemId } = req.params as { itemId: string };
      const { warehouseId, reorderPoint, minLevel } = req.body as {
        warehouseId?: string;
        reorderPoint?: number;
        minLevel?: number;
      };

      if (!warehouseId) {
        return sendError(res, 400, 'warehouseId is required');
      }

      if (reorderPoint === undefined && minLevel === undefined) {
        return sendError(res, 400, 'At least one of reorderPoint or minLevel is required');
      }

      // Validate numeric values
      if (reorderPoint !== undefined && (typeof reorderPoint !== 'number' || reorderPoint < 0)) {
        return sendError(res, 400, 'reorderPoint must be a non-negative number');
      }
      if (minLevel !== undefined && (typeof minLevel !== 'number' || minLevel < 0)) {
        return sendError(res, 400, 'minLevel must be a non-negative number');
      }

      const existing = await prisma.inventoryLevel.findUnique({
        where: { itemId_warehouseId: { itemId, warehouseId } },
      });

      if (!existing) {
        return sendError(res, 404, 'Inventory level record not found for this item/warehouse combination');
      }

      const updateData: { reorderPoint?: number; minLevel?: number } = {};
      if (reorderPoint !== undefined) updateData.reorderPoint = reorderPoint;
      if (minLevel !== undefined) updateData.minLevel = minLevel;

      const updated = await prisma.inventoryLevel.update({
        where: { itemId_warehouseId: { itemId, warehouseId } },
        data: updateData,
        include: {
          item: {
            select: { id: true, itemCode: true, itemDescription: true },
          },
          warehouse: {
            select: { id: true, warehouseName: true, warehouseCode: true },
          },
        },
      });

      sendSuccess(res, {
        itemId: updated.itemId,
        warehouseId: updated.warehouseId,
        item: updated.item,
        warehouse: updated.warehouse,
        reorderPoint: updated.reorderPoint !== null ? Number(updated.reorderPoint) : null,
        minLevel: updated.minLevel !== null ? Number(updated.minLevel) : null,
        qtyOnHand: Number(updated.qtyOnHand),
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
