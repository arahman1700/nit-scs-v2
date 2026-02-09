import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { prisma } from '../utils/prisma.js';
import { sendSuccess } from '../utils/response.js';

const router = Router();

// Helper: parse common date filters
function parseDateFilters(query: Record<string, unknown>) {
  const dateFrom = query.dateFrom ? new Date(String(query.dateFrom)) : undefined;
  const dateTo = query.dateTo ? new Date(String(query.dateTo)) : undefined;
  const projectId = query.projectId as string | undefined;
  const warehouseId = query.warehouseId as string | undefined;
  return { dateFrom, dateTo, projectId, warehouseId };
}

// GET /api/reports/inventory-summary — Stock by warehouse/category
router.get('/inventory-summary', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { warehouseId } = parseDateFilters(req.query as Record<string, unknown>);
    const where: Record<string, unknown> = {};
    if (warehouseId) where.warehouseId = warehouseId;

    const [byWarehouse, byCategory, totals] = await Promise.all([
      prisma.inventoryLevel.groupBy({
        by: ['warehouseId'],
        where,
        _sum: { qtyOnHand: true, qtyReserved: true },
        _count: { id: true },
      }),
      prisma.item.groupBy({
        by: ['category'],
        _count: { id: true },
      }),
      prisma.inventoryLevel.aggregate({
        where,
        _sum: { qtyOnHand: true, qtyReserved: true },
        _count: { id: true },
      }),
    ]);

    // Resolve warehouse names
    const warehouseIds = byWarehouse.map(w => w.warehouseId);
    const warehouses = warehouseIds.length > 0
      ? await prisma.warehouse.findMany({ where: { id: { in: warehouseIds } }, select: { id: true, warehouseName: true } })
      : [];
    const whMap = new Map(warehouses.map(w => [w.id, w.warehouseName]));

    sendSuccess(res, {
      totalRecords: totals._count.id,
      totalQtyOnHand: totals._sum.qtyOnHand ?? 0,
      totalQtyReserved: totals._sum.qtyReserved ?? 0,
      byWarehouse: byWarehouse.map(w => ({
        warehouseId: w.warehouseId,
        warehouseName: whMap.get(w.warehouseId) ?? w.warehouseId,
        qtyOnHand: w._sum.qtyOnHand ?? 0,
        qtyReserved: w._sum.qtyReserved ?? 0,
        itemCount: w._count.id,
      })),
      byCategory: byCategory.map(c => ({
        category: c.category,
        count: c._count.id,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/job-order-status — JOs by status/type
router.get('/job-order-status', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dateFrom, dateTo, projectId } = parseDateFilters(req.query as Record<string, unknown>);
    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;
    if (dateFrom || dateTo) {
      where.requestDate = {};
      if (dateFrom) (where.requestDate as Record<string, unknown>).gte = dateFrom;
      if (dateTo) (where.requestDate as Record<string, unknown>).lte = dateTo;
    }

    const [byStatus, byType, total] = await Promise.all([
      prisma.jobOrder.groupBy({ by: ['status'], where, _count: { id: true } }),
      prisma.jobOrder.groupBy({ by: ['joType'], where, _count: { id: true }, _sum: { totalAmount: true } }),
      prisma.jobOrder.count({ where }),
    ]);

    sendSuccess(res, {
      total,
      byStatus: byStatus.map(s => ({ status: s.status, count: s._count.id })),
      byType: byType.map(t => ({ type: t.joType, count: t._count.id, totalAmount: t._sum.totalAmount ?? 0 })),
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/sla-compliance — On-time vs breached
router.get('/sla-compliance', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dateFrom, dateTo, projectId } = parseDateFilters(req.query as Record<string, unknown>);
    const joWhere: Record<string, unknown> = {};
    if (projectId) joWhere.projectId = projectId;
    if (dateFrom || dateTo) {
      joWhere.requestDate = {};
      if (dateFrom) (joWhere.requestDate as Record<string, unknown>).gte = dateFrom;
      if (dateTo) (joWhere.requestDate as Record<string, unknown>).lte = dateTo;
    }

    const slaRecords = await prisma.joSlaTracking.findMany({
      where: { jobOrder: joWhere },
      select: { slaMet: true },
    });

    const total = slaRecords.length;
    const met = slaRecords.filter(s => s.slaMet === true).length;
    const breached = slaRecords.filter(s => s.slaMet === false).length;
    const pending = total - met - breached;

    sendSuccess(res, {
      total,
      met,
      breached,
      pending,
      compliancePct: total > 0 ? Math.round((met / total) * 100) : 0,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/material-movement — MRRV/MIRV/MRV activity over time
router.get('/material-movement', authenticate, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dateFrom, dateTo, projectId } = parseDateFilters(req.query as Record<string, unknown>);
    const mrrvWhere: Record<string, unknown> = {};
    const mirvWhere: Record<string, unknown> = {};
    const mrvWhere: Record<string, unknown> = {};

    if (projectId) {
      mrrvWhere.projectId = projectId;
      mirvWhere.projectId = projectId;
      mrvWhere.projectId = projectId;
    }
    if (dateFrom || dateTo) {
      const dateRange: Record<string, unknown> = {};
      if (dateFrom) dateRange.gte = dateFrom;
      if (dateTo) dateRange.lte = dateTo;
      mrrvWhere.receiveDate = dateRange;
      mirvWhere.requestDate = dateRange;
      mrvWhere.returnDate = dateRange;
    }

    const [mrrvCount, mirvCount, mrvCount, mrrvValue, mirvValue] = await Promise.all([
      prisma.mrrv.count({ where: mrrvWhere }),
      prisma.mirv.count({ where: mirvWhere }),
      prisma.mrv.count({ where: mrvWhere }),
      prisma.mrrv.aggregate({ where: mrrvWhere, _sum: { totalValue: true } }),
      prisma.mirv.aggregate({ where: mirvWhere, _sum: { estimatedValue: true } }),
    ]);

    sendSuccess(res, {
      mrrv: { count: mrrvCount, totalValue: mrrvValue._sum.totalValue ?? 0 },
      mirv: { count: mirvCount, totalValue: mirvValue._sum.estimatedValue ?? 0 },
      mrv: { count: mrvCount },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/supplier-performance — Admin/Manager only
router.get('/supplier-performance', authenticate, requireRole('admin', 'manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dateFrom, dateTo } = parseDateFilters(req.query as Record<string, unknown>);
    const where: Record<string, unknown> = {};
    if (dateFrom || dateTo) {
      where.receiveDate = {};
      if (dateFrom) (where.receiveDate as Record<string, unknown>).gte = dateFrom;
      if (dateTo) (where.receiveDate as Record<string, unknown>).lte = dateTo;
    }

    const supplierMrrv = await prisma.mrrv.groupBy({
      by: ['supplierId'],
      where,
      _count: { id: true },
      _sum: { totalValue: true },
    });

    const supplierIds = supplierMrrv.map(s => s.supplierId);
    const suppliers = supplierIds.length > 0
      ? await prisma.supplier.findMany({ where: { id: { in: supplierIds } }, select: { id: true, supplierName: true, rating: true } })
      : [];
    const suppMap = new Map(suppliers.map(s => [s.id, s]));

    // Count OSD reports per supplier
    const osdCounts = await prisma.osdReport.groupBy({
      by: ['supplierId'],
      where: { supplierId: { in: supplierIds } },
      _count: { id: true },
    });
    const osdMap = new Map(osdCounts.map(o => [o.supplierId, o._count.id]));

    sendSuccess(res, supplierMrrv.map(s => ({
      supplierId: s.supplierId,
      supplierName: suppMap.get(s.supplierId)?.supplierName ?? 'Unknown',
      rating: suppMap.get(s.supplierId)?.rating ?? null,
      deliveries: s._count.id,
      totalValue: s._sum.totalValue ?? 0,
      osdReports: osdMap.get(s.supplierId) ?? 0,
    })));
  } catch (err) {
    next(err);
  }
});

// GET /api/reports/financial-summary — Admin/Manager only
router.get('/financial-summary', authenticate, requireRole('admin', 'manager'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { dateFrom, dateTo, projectId } = parseDateFilters(req.query as Record<string, unknown>);
    const joWhere: Record<string, unknown> = {};
    const mrrvWhere: Record<string, unknown> = {};
    if (projectId) {
      joWhere.projectId = projectId;
      mrrvWhere.projectId = projectId;
    }
    if (dateFrom || dateTo) {
      const dateRange: Record<string, unknown> = {};
      if (dateFrom) dateRange.gte = dateFrom;
      if (dateTo) dateRange.lte = dateTo;
      joWhere.requestDate = dateRange;
      mrrvWhere.receiveDate = dateRange;
    }

    const [joTotals, mrrvTotals, paymentTotals, inventoryValue] = await Promise.all([
      prisma.jobOrder.aggregate({ where: joWhere, _sum: { totalAmount: true }, _count: { id: true } }),
      prisma.mrrv.aggregate({ where: mrrvWhere, _sum: { totalValue: true }, _count: { id: true } }),
      prisma.joPayment.aggregate({
        where: { jobOrder: joWhere },
        _sum: { grandTotal: true },
        _count: { id: true },
      }),
      prisma.inventoryLot.aggregate({
        where: { status: 'active' },
        _sum: { availableQty: true },
      }),
    ]);

    sendSuccess(res, {
      jobOrders: {
        count: joTotals._count.id,
        totalAmount: joTotals._sum.totalAmount ?? 0,
      },
      receipts: {
        count: mrrvTotals._count.id,
        totalValue: mrrvTotals._sum.totalValue ?? 0,
      },
      payments: {
        count: paymentTotals._count.id,
        totalPaid: paymentTotals._sum.grandTotal ?? 0,
      },
      inventoryValue: inventoryValue._sum.availableQty ?? 0,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
