/**
 * Bin Card Routes — V2
 *
 * SOW C1: Bin cards are "computed views" showing running balance per item
 * per bin location. The /computed endpoint aggregates from InventoryLevel +
 * LotConsumption (authoritative source), while CRUD endpoints remain for
 * physical bin location management.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { createCrudRouter } from '../utils/crud-factory.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { prisma } from '../utils/prisma.js';
import {
  binCardCreateSchema,
  binCardUpdateSchema,
  binCardTransactionCreateSchema,
} from '../schemas/document.schema.js';

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
 * SOW C1: Computed bin card view.
 * Aggregates InventoryLevel + recent LotConsumption to produce a live
 * running-balance view per item per warehouse. This is the authoritative
 * view — the BinCard CRUD records track physical bin locations only.
 *
 * GET /bin-cards/computed?warehouseId=...&itemId=...&page=1&pageSize=50
 */
const COMPUTED_ROLES = ['admin', 'warehouse_supervisor', 'warehouse_staff', 'inventory_specialist'];

router.get(
  '/computed',
  authenticate,
  requireRole(...COMPUTED_ROLES),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { warehouseId, itemId, page = '1', pageSize = '50' } = req.query as Record<string, string>;
      const skip = (Number(page) - 1) * Number(pageSize);
      const take = Number(pageSize);

      const where: Record<string, unknown> = {};
      if (warehouseId) where.warehouseId = warehouseId;
      if (itemId) where.itemId = itemId;

      // Row-owner scoping for warehouse-bound roles
      const user = req.user;
      if (
        user &&
        ['warehouse_supervisor', 'warehouse_staff', 'gate_officer', 'inventory_specialist'].includes(user.systemRole)
      ) {
        if (user.assignedWarehouseId) {
          where.warehouseId = user.assignedWarehouseId;
        }
      }

      const [levels, total] = await Promise.all([
        prisma.inventoryLevel.findMany({
          where,
          skip,
          take,
          orderBy: { updatedAt: 'desc' },
          include: {
            item: { select: { id: true, itemCode: true, itemDescription: true, mainCategory: true } },
            warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
          },
        }),
        prisma.inventoryLevel.count({ where }),
      ]);

      // For each inventory level, fetch the bin location and recent transactions
      const computedCards = await Promise.all(
        levels.map(async level => {
          // Get the bin card assignment (physical location)
          const binCard = await prisma.binCard.findFirst({
            where: { itemId: level.itemId, warehouseId: level.warehouseId },
            select: { binNumber: true, lastVerifiedAt: true },
          });

          // Get the last 10 lot consumptions for transaction history
          const recentTransactions = await prisma.lotConsumption.findMany({
            where: {
              lot: { itemId: level.itemId, warehouseId: level.warehouseId },
            },
            orderBy: { consumptionDate: 'desc' },
            take: 10,
            select: {
              quantity: true,
              unitCost: true,
              consumptionDate: true,
              referenceType: true,
              referenceId: true,
            },
          });

          // Get active lot count
          const activeLots = await prisma.inventoryLot.count({
            where: {
              itemId: level.itemId,
              warehouseId: level.warehouseId,
              status: 'active',
            },
          });

          return {
            itemId: level.itemId,
            warehouseId: level.warehouseId,
            item: level.item,
            warehouse: level.warehouse,
            binNumber: binCard?.binNumber ?? null,
            lastVerifiedAt: binCard?.lastVerifiedAt ?? null,
            // Computed balances (authoritative)
            qtyOnHand: Number(level.qtyOnHand),
            qtyReserved: Number(level.qtyReserved),
            qtyAvailable: Number(level.qtyOnHand) - Number(level.qtyReserved),
            activeLots,
            recentTransactions,
            lastMovementDate: level.lastMovementDate,
          };
        }),
      );

      res.json({ data: computedCards, total, page: Number(page), pageSize: take });
    } catch (err) {
      next(err);
    }
  },
);

router.use('/', binCardCrud);
router.use('/transactions', txnCrud);

export default router;
