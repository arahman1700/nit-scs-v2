/**
 * Bin Card Routes — V2
 * CRUD for bin cards + nested transaction log.
 */
import { Router } from 'express';
import { createCrudRouter } from '../utils/crud-factory.js';
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
  allowedRoles: ['admin', 'warehouse_supervisor', 'warehouse_staff'],
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
router.use('/', binCardCrud);
router.use('/transactions', txnCrud);

export default router;
