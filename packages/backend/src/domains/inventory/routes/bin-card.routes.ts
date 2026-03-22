/**
 * Bin Card Routes — V2
 *
 * SOW C1: Bin cards are "computed views" showing running balance per item
 * per bin location. The /computed endpoint aggregates from InventoryLevel +
 * LotConsumption (authoritative source), while CRUD endpoints remain for
 * physical bin location management.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { createCrudRouter } from '../../../utils/crud-factory.js';
import { authenticate } from '../../../middleware/auth.js';
import { requirePermission } from '../../../middleware/rbac.js';
import { prisma } from '../../../utils/prisma.js';
import { applyScopeFilter } from '../../../utils/scope-filter.js';
import {
  binCardCreateSchema,
  binCardUpdateSchema,
  binCardTransactionCreateSchema,
} from '../../../schemas/document.schema.js';

const binCardCrud = createCrudRouter({
  modelName: 'binCard',
  tableName: 'bin_cards',
  resource: 'bin_card',
  createSchema: binCardCreateSchema,
  updateSchema: binCardUpdateSchema,
  searchFields: ['binNumber'],
  includes: {
    item: { select: { id: true, itemCode: true, itemDescription: true } },
    warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
  },
  detailIncludes: {
    item: true,
    warehouse: true,
    lastVerifiedBy: { select: { id: true, fullName: true } },
    transactions: {
      orderBy: { performedAt: 'desc' as const },
      take: 50,
      include: { performedBy: { select: { id: true, fullName: true } } },
    },
  },
  allowedRoles: ['admin', 'warehouse_supervisor', 'warehouse_staff', 'inventory_specialist'],
  allowedFilters: ['warehouseId', 'itemId'],
  defaultSort: 'updatedAt',
  scopeMapping: { warehouseField: 'warehouseId' },
  softDelete: false,
});

// Standalone transaction CRUD (for logging receipts / issues)
const txnCrud = createCrudRouter({
  modelName: 'binCardTransaction',
  tableName: 'bin_card_transactions',
  createSchema: binCardTransactionCreateSchema,
  updateSchema: binCardTransactionCreateSchema.partial(),
  searchFields: ['referenceNumber'],
  includes: {
    binCard: { select: { id: true, binNumber: true } },
    performedBy: { select: { id: true, fullName: true } },
  },
  allowedRoles: ['admin', 'warehouse_supervisor', 'warehouse_staff'],
  allowedFilters: ['binCardId', 'transactionType', 'referenceType'],
  defaultSort: 'performedAt',
  softDelete: false,
});

const router = Router();

/**
 * SOW M1-F05 — Authoritative computed bin card endpoint.
 *
 * This is the PRIMARY endpoint for bin card data per the SOW. It aggregates
 * InventoryLevel + recent LotConsumption to produce a live running-balance
 * view per item per warehouse. Frontend consumers should prefer this over
 * the CRUD list endpoint.
 *
 * The BinCard CRUD records (GET /bin-cards) track physical bin location
 * assignments only and are NOT the authoritative source for balances.
 *
 * Performance: Uses 3 batch queries (bin cards, lot consumptions, lot counts)
 * instead of 3N individual queries per inventory level. Includes a 15-second
 * query timeout to prevent indefinite hangs and caps pageSize at 100.
 *
 * GET /bin-cards/computed?warehouseId=...&itemId=...&page=1&pageSize=50
 */
router.get(
  '/computed',
  authenticate,
  requirePermission('bin_card', 'read'),
  applyScopeFilter({ warehouseField: 'warehouseId' }),
  async (req: Request, res: Response, next: NextFunction) => {
    const QUERY_TIMEOUT_MS = 15_000; // 15 seconds

    const { warehouseId, itemId, page = '1', pageSize = '50' } = req.query as Record<string, string>;
    const parsedPage = Math.max(Number(page) || 1, 1);
    const parsedPageSize = Math.min(Math.max(Number(pageSize) || 50, 1), 100);
    const skip = (parsedPage - 1) * parsedPageSize;

    const where: Record<string, unknown> = { ...req.scopeFilter };
    if (warehouseId) where.warehouseId = warehouseId;
    if (itemId) where.itemId = itemId;

    /** Inner function that performs all DB queries and assembles the result. */
    async function computeCards() {
      // Step 1: Fetch paginated inventory levels + total count
      const [levels, total] = await Promise.all([
        prisma.inventoryLevel.findMany({
          where,
          skip,
          take: parsedPageSize,
          orderBy: { updatedAt: 'desc' },
          include: {
            item: { select: { id: true, itemCode: true, itemDescription: true, mainCategory: true } },
            warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
          },
        }),
        prisma.inventoryLevel.count({ where }),
      ]);

      if (levels.length === 0) {
        return { data: [], total, page: parsedPage, pageSize: parsedPageSize };
      }

      // Step 2: Extract unique item/warehouse pairs for batch lookups
      const pairs = levels.map(l => ({ itemId: l.itemId, warehouseId: l.warehouseId }));

      // Step 3: Batch bin card lookup (replaces N individual findFirst calls)
      const binCards = await prisma.binCard.findMany({
        where: {
          OR: pairs.map(p => ({ itemId: p.itemId, warehouseId: p.warehouseId })),
        },
        select: { itemId: true, warehouseId: true, binNumber: true, lastVerifiedAt: true },
      });
      const binCardMap = new Map(binCards.map(bc => [`${bc.itemId}:${bc.warehouseId}`, bc]));

      // Step 4: Batch recent lot consumptions (replaces N individual findMany calls)
      // Fetch an upper-bound of results and group in-memory, keeping first 10 per pair
      const recentTransactions = await prisma.lotConsumption.findMany({
        where: {
          lot: {
            OR: pairs.map(p => ({ itemId: p.itemId, warehouseId: p.warehouseId })),
          },
        },
        orderBy: { consumptionDate: 'desc' },
        take: pairs.length * 10,
        select: {
          quantity: true,
          unitCost: true,
          consumptionDate: true,
          referenceType: true,
          referenceId: true,
          lot: { select: { itemId: true, warehouseId: true } },
        },
      });
      const txnMap = new Map<string, typeof recentTransactions>();
      for (const txn of recentTransactions) {
        const key = `${txn.lot.itemId}:${txn.lot.warehouseId}`;
        const list = txnMap.get(key) || [];
        if (list.length < 10) {
          list.push(txn);
          txnMap.set(key, list);
        }
      }

      // Step 5: Batch active lot counts (replaces N individual count calls)
      const lotCounts = await prisma.inventoryLot.groupBy({
        by: ['itemId', 'warehouseId'],
        where: {
          OR: pairs.map(p => ({ itemId: p.itemId, warehouseId: p.warehouseId })),
          status: 'active',
        },
        _count: true,
      });
      const lotCountMap = new Map(lotCounts.map(lc => [`${lc.itemId}:${lc.warehouseId}`, lc._count]));

      // Step 6: Assemble results without any per-level queries
      const computedCards = levels.map(level => {
        const key = `${level.itemId}:${level.warehouseId}`;
        const bc = binCardMap.get(key);
        const txns = txnMap.get(key) || [];
        const activeLots = lotCountMap.get(key) || 0;
        return {
          itemId: level.itemId,
          warehouseId: level.warehouseId,
          item: level.item,
          warehouse: level.warehouse,
          binNumber: bc?.binNumber ?? null,
          lastVerifiedAt: bc?.lastVerifiedAt ?? null,
          // Computed balances (authoritative)
          qtyOnHand: Number(level.qtyOnHand),
          qtyReserved: Number(level.qtyReserved),
          qtyAvailable: Number(level.qtyOnHand) - Number(level.qtyReserved),
          activeLots,
          recentTransactions: txns.map(t => ({
            quantity: t.quantity,
            unitCost: t.unitCost,
            consumptionDate: t.consumptionDate,
            referenceType: t.referenceType,
            referenceId: t.referenceId,
          })),
          lastMovementDate: level.lastMovementDate,
        };
      });

      return { data: computedCards, total, page: parsedPage, pageSize: parsedPageSize };
    }

    // Query timeout — prevent indefinite hangs on large datasets
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Bin card computation timed out')), QUERY_TIMEOUT_MS),
    );

    try {
      const result = await Promise.race([computeCards(), timeoutPromise]);
      res.json(result);
    } catch (err) {
      if (err instanceof Error && err.message.includes('timed out')) {
        res.status(504).json({ error: 'Bin card computation timed out. Try filtering by warehouseId or itemId.' });
        return;
      }
      next(err);
    }
  },
);

router.use('/', binCardCrud);
router.use('/transactions', txnCrud);

export default router;
