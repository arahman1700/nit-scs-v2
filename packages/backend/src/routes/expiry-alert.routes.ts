/**
 * Expiry Alert Routes — L2
 *
 * GET /expiring?daysAhead=30 — returns expiring inventory lots grouped by item.
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { prisma } from '../utils/prisma.js';
import { buildScopeFilter } from '../utils/scope-filter.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * GET /inventory/expiring?daysAhead=30
 *
 * Returns active InventoryLot records whose expiryDate falls within the next
 * `daysAhead` days (default 30), grouped by item.
 */
router.get('/expiring', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const daysAhead = Math.min(Math.max(Number(req.query.daysAhead) || 30, 1), 365);

    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);

    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() + daysAhead);

    // Row-level security: restrict to assigned warehouse for scoped roles
    const scopeFilter = buildScopeFilter(req.user!, { warehouseField: 'warehouseId' });

    const lots = await prisma.inventoryLot.findMany({
      where: {
        status: 'active',
        expiryDate: {
          gte: now,
          lte: cutoff,
        },
        ...scopeFilter,
      },
      include: {
        item: {
          select: {
            id: true,
            itemCode: true,
            itemDescription: true,
            category: true,
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
      orderBy: { expiryDate: 'asc' },
    });

    // Group by item
    const grouped: Record<
      string,
      {
        item: { id: string; itemCode: string; itemDescription: string; category: string };
        lots: Array<{
          id: string;
          lotNumber: string;
          expiryDate: Date | null;
          availableQty: unknown;
          binLocation: string | null;
          warehouse: { id: string; warehouseName: string; warehouseCode: string };
        }>;
        totalQty: number;
      }
    > = {};

    for (const lot of lots) {
      const key = lot.itemId;
      if (!grouped[key]) {
        grouped[key] = {
          item: lot.item,
          lots: [],
          totalQty: 0,
        };
      }
      grouped[key].lots.push({
        id: lot.id,
        lotNumber: lot.lotNumber,
        expiryDate: lot.expiryDate,
        availableQty: lot.availableQty,
        binLocation: lot.binLocation,
        warehouse: lot.warehouse,
      });
      grouped[key].totalQty += Number(lot.availableQty);
    }

    const items = Object.values(grouped);

    res.json({
      data: items,
      meta: {
        daysAhead,
        totalItems: items.length,
        totalLots: lots.length,
        asOf: now.toISOString(),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
