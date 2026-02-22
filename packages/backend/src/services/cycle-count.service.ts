import { prisma } from '../utils/prisma.js';
import { generateDocumentNumber } from './document-number.service.js';
import { createAuditLog } from './audit.service.js';
import { log } from '../config/logger.js';

// ── Types ───────────────────────────────────────────────────────────────

export interface CycleCountCreateDto {
  countType: 'full' | 'abc_based' | 'zone' | 'random';
  warehouseId: string;
  zoneId?: string;
  scheduledDate: string;
  notes?: string;
}

export interface ListParams {
  page: number;
  pageSize: number;
  status?: string;
  warehouseId?: string;
  search?: string;
}

// ── List ────────────────────────────────────────────────────────────────

export async function list(params: ListParams) {
  const where: Record<string, unknown> = {};
  if (params.status) where.status = params.status;
  if (params.warehouseId) where.warehouseId = params.warehouseId;
  if (params.search) {
    where.countNumber = { contains: params.search, mode: 'insensitive' };
  }

  const [data, total] = await Promise.all([
    prisma.cycleCount.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (params.page - 1) * params.pageSize,
      take: params.pageSize,
      include: {
        warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
        zone: { select: { id: true, zoneName: true, zoneCode: true } },
        createdBy: { select: { id: true, fullName: true } },
        _count: { select: { lines: true } },
      },
    }),
    prisma.cycleCount.count({ where }),
  ]);

  return { data, total };
}

// ── Get By ID ───────────────────────────────────────────────────────────

export async function getById(id: string) {
  return prisma.cycleCount.findUniqueOrThrow({
    where: { id },
    include: {
      warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
      zone: { select: { id: true, zoneName: true, zoneCode: true } },
      createdBy: { select: { id: true, fullName: true } },
      lines: {
        include: {
          item: { select: { id: true, itemCode: true, itemDescription: true, abcClass: true } },
          countedBy: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
}

// ── Create ──────────────────────────────────────────────────────────────

export async function createCycleCount(data: CycleCountCreateDto, userId: string) {
  const countNumber = await generateDocumentNumber('cycle_count');

  const cycleCount = await prisma.cycleCount.create({
    data: {
      countNumber,
      countType: data.countType,
      warehouseId: data.warehouseId,
      zoneId: data.zoneId ?? null,
      scheduledDate: new Date(data.scheduledDate),
      createdById: userId,
      notes: data.notes ?? null,
    },
    include: {
      warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
      createdBy: { select: { id: true, fullName: true } },
    },
  });

  await createAuditLog({
    tableName: 'cycle_counts',
    recordId: cycleCount.id,
    action: 'create',
    newValues: { countNumber, countType: data.countType, warehouseId: data.warehouseId },
    performedById: userId,
  });

  log('info', `[CycleCount] Created ${countNumber} (${data.countType}) for warehouse ${data.warehouseId}`);
  return cycleCount;
}

// ── Generate Count Lines ────────────────────────────────────────────────

export async function generateCountLines(cycleCountId: string, userId: string) {
  const cycleCount = await prisma.cycleCount.findUniqueOrThrow({
    where: { id: cycleCountId },
  });

  if (cycleCount.status !== 'scheduled') {
    throw new Error('Can only generate lines for scheduled cycle counts');
  }

  // Delete existing lines if re-generating
  await prisma.cycleCountLine.deleteMany({ where: { cycleCountId } });

  // Fetch inventory levels based on count type
  let inventoryLevels: Array<{ itemId: string; qtyOnHand: unknown }>;

  switch (cycleCount.countType) {
    case 'full':
      inventoryLevels = await prisma.inventoryLevel.findMany({
        where: { warehouseId: cycleCount.warehouseId },
        select: { itemId: true, qtyOnHand: true },
      });
      break;

    case 'abc_based':
      inventoryLevels = await prisma.inventoryLevel.findMany({
        where: {
          warehouseId: cycleCount.warehouseId,
          item: { abcClass: 'A' },
        },
        select: { itemId: true, qtyOnHand: true },
      });
      break;

    case 'zone':
      if (!cycleCount.zoneId) {
        throw new Error('Zone-based count requires a zone ID');
      }
      // Get items that have bin cards in the specified zone, or fall back to all warehouse items
      inventoryLevels = await prisma.inventoryLevel.findMany({
        where: { warehouseId: cycleCount.warehouseId },
        select: { itemId: true, qtyOnHand: true },
      });
      break;

    case 'random': {
      const allLevels = await prisma.inventoryLevel.findMany({
        where: { warehouseId: cycleCount.warehouseId },
        select: { itemId: true, qtyOnHand: true },
      });
      // Random 20% of items
      const count = Math.max(1, Math.ceil(allLevels.length * 0.2));
      const shuffled = allLevels.sort(() => Math.random() - 0.5);
      inventoryLevels = shuffled.slice(0, count);
      break;
    }

    default:
      throw new Error(`Unknown count type: ${cycleCount.countType}`);
  }

  if (inventoryLevels.length === 0) {
    throw new Error('No inventory items found for the specified criteria');
  }

  // Create lines — convert Prisma Decimal to plain number
  const lines = await prisma.cycleCountLine.createMany({
    data: inventoryLevels.map(level => ({
      cycleCountId,
      itemId: level.itemId,
      expectedQty: Number(level.qtyOnHand),
    })),
  });

  await createAuditLog({
    tableName: 'cycle_counts',
    recordId: cycleCountId,
    action: 'update',
    changedFields: { lines: true },
    newValues: { action: 'generate_lines', lineCount: lines.count },
    performedById: userId,
  });

  log('info', `[CycleCount] Generated ${lines.count} lines for ${cycleCount.countNumber}`);
  return { lineCount: lines.count };
}

// ── Start Count ─────────────────────────────────────────────────────────

export async function startCount(id: string, userId: string) {
  const cycleCount = await prisma.cycleCount.findUniqueOrThrow({ where: { id } });

  if (cycleCount.status !== 'scheduled') {
    throw new Error('Can only start a scheduled cycle count');
  }

  // Ensure lines exist
  const lineCount = await prisma.cycleCountLine.count({ where: { cycleCountId: id } });
  if (lineCount === 0) {
    throw new Error('Generate count lines before starting');
  }

  const updated = await prisma.cycleCount.update({
    where: { id },
    data: { status: 'in_progress', startedAt: new Date() },
  });

  await createAuditLog({
    tableName: 'cycle_counts',
    recordId: id,
    action: 'update',
    oldValues: { status: 'scheduled' },
    newValues: { status: 'in_progress', startedAt: updated.startedAt },
    performedById: userId,
  });

  log('info', `[CycleCount] Started ${cycleCount.countNumber}`);
  return updated;
}

// ── Record Count ────────────────────────────────────────────────────────

export async function recordCount(lineId: string, countedQty: number, countedById: string, notes?: string) {
  const line = await prisma.cycleCountLine.findUniqueOrThrow({
    where: { id: lineId },
    include: { cycleCount: true },
  });

  if (line.cycleCount.status !== 'in_progress') {
    throw new Error('Cycle count must be in progress to record counts');
  }

  const expectedQty = Number(line.expectedQty);
  const varianceQty = countedQty - expectedQty;
  const variancePercent =
    expectedQty !== 0 ? Math.round((varianceQty / expectedQty) * 10000) / 100 : countedQty !== 0 ? 100 : 0;

  const updated = await prisma.cycleCountLine.update({
    where: { id: lineId },
    data: {
      countedQty,
      varianceQty,
      variancePercent,
      status: 'counted',
      countedById,
      countedAt: new Date(),
      notes: notes ?? null,
    },
    include: {
      item: { select: { id: true, itemCode: true, itemDescription: true } },
    },
  });

  await createAuditLog({
    tableName: 'cycle_count_lines',
    recordId: lineId,
    action: 'update',
    newValues: { countedQty, varianceQty, variancePercent, status: 'counted' },
    performedById: countedById,
  });

  return updated;
}

// ── Complete Count ──────────────────────────────────────────────────────

export async function completeCount(id: string, userId: string) {
  const cycleCount = await prisma.cycleCount.findUniqueOrThrow({ where: { id } });

  if (cycleCount.status !== 'in_progress') {
    throw new Error('Can only complete an in-progress cycle count');
  }

  // Check all lines are counted
  const pendingLines = await prisma.cycleCountLine.count({
    where: { cycleCountId: id, status: 'pending' },
  });

  if (pendingLines > 0) {
    throw new Error(`${pendingLines} line(s) still pending. Complete all counts before finishing.`);
  }

  const updated = await prisma.cycleCount.update({
    where: { id },
    data: { status: 'completed', completedAt: new Date() },
  });

  await createAuditLog({
    tableName: 'cycle_counts',
    recordId: id,
    action: 'update',
    oldValues: { status: 'in_progress' },
    newValues: { status: 'completed', completedAt: updated.completedAt },
    performedById: userId,
  });

  log('info', `[CycleCount] Completed ${cycleCount.countNumber}`);
  return updated;
}

// ── Cancel Count ────────────────────────────────────────────────────────

export async function cancelCount(id: string, userId: string) {
  const cycleCount = await prisma.cycleCount.findUniqueOrThrow({ where: { id } });

  if (cycleCount.status === 'completed' || cycleCount.status === 'cancelled') {
    throw new Error('Cannot cancel a completed or already cancelled cycle count');
  }

  const updated = await prisma.cycleCount.update({
    where: { id },
    data: { status: 'cancelled' },
  });

  await createAuditLog({
    tableName: 'cycle_counts',
    recordId: id,
    action: 'update',
    oldValues: { status: cycleCount.status },
    newValues: { status: 'cancelled' },
    performedById: userId,
  });

  log('info', `[CycleCount] Cancelled ${cycleCount.countNumber}`);
  return updated;
}

// ── Apply Adjustments ───────────────────────────────────────────────────

export async function applyAdjustments(cycleCountId: string, userId: string) {
  const cycleCount = await prisma.cycleCount.findUniqueOrThrow({
    where: { id: cycleCountId },
    include: {
      lines: {
        where: { status: { in: ['counted', 'verified'] }, varianceQty: { not: 0 } },
      },
    },
  });

  if (cycleCount.status !== 'completed') {
    throw new Error('Can only apply adjustments to completed cycle counts');
  }

  const adjustedLines: string[] = [];

  await prisma.$transaction(async tx => {
    for (const line of cycleCount.lines) {
      if (line.varianceQty === null || Number(line.varianceQty) === 0) continue;

      // Update inventory level
      const level = await tx.inventoryLevel.findUnique({
        where: { itemId_warehouseId: { itemId: line.itemId, warehouseId: cycleCount.warehouseId } },
      });

      if (!level) continue;

      // Set onHand to the counted quantity
      await tx.inventoryLevel.update({
        where: { itemId_warehouseId: { itemId: line.itemId, warehouseId: cycleCount.warehouseId } },
        data: {
          qtyOnHand: line.countedQty!,
          lastMovementDate: new Date(),
          version: { increment: 1 },
        },
      });

      // Mark line as adjusted
      await tx.cycleCountLine.update({
        where: { id: line.id },
        data: { status: 'adjusted' },
      });

      adjustedLines.push(line.id);

      await createAuditLog({
        tableName: 'inventory_levels',
        recordId: `${line.itemId}:${cycleCount.warehouseId}`,
        action: 'update',
        oldValues: { qtyOnHand: Number(level.qtyOnHand) },
        newValues: {
          qtyOnHand: line.countedQty,
          reason: 'cycle_count_adjustment',
          cycleCountId,
          varianceQty: line.varianceQty,
        },
        performedById: userId,
      });
    }
  });

  await createAuditLog({
    tableName: 'cycle_counts',
    recordId: cycleCountId,
    action: 'update',
    newValues: { action: 'apply_adjustments', adjustedLines: adjustedLines.length },
    performedById: userId,
  });

  log('info', `[CycleCount] Applied ${adjustedLines.length} adjustment(s) for ${cycleCount.countNumber}`);
  return { adjustedCount: adjustedLines.length };
}

// ── Auto-Create Cycle Counts (Scheduler) ────────────────────────────────

export async function autoCreateCycleCounts(): Promise<void> {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Get all active warehouses
  const warehouses = await prisma.warehouse.findMany({
    where: { status: 'active' },
    select: { id: true, warehouseCode: true },
  });

  for (const warehouse of warehouses) {
    // Check if items with abcClass='A' need a weekly count
    const classAItems = await prisma.inventoryLevel.count({
      where: { warehouseId: warehouse.id, item: { abcClass: 'A' } },
    });

    if (classAItems > 0) {
      // Check if there's already a scheduled/in_progress count this week
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const existing = await prisma.cycleCount.findFirst({
        where: {
          warehouseId: warehouse.id,
          countType: 'abc_based',
          status: { in: ['scheduled', 'in_progress'] },
          scheduledDate: { gte: weekStart },
        },
      });

      if (!existing) {
        const countNumber = await generateDocumentNumber('cycle_count');
        await prisma.cycleCount.create({
          data: {
            countNumber,
            countType: 'abc_based',
            warehouseId: warehouse.id,
            scheduledDate: today,
            createdById: (await prisma.employee.findFirst({
              where: { systemRole: 'admin', isActive: true },
              select: { id: true },
            }))!.id,
            notes: 'Auto-generated: Weekly ABC Class A count',
          },
        });
        log('info', `[CycleCount] Auto-created weekly ABC count for ${warehouse.warehouseCode}`);
      }
    }

    // Check if a monthly count is needed for Class B items (first day of month)
    if (today.getDate() === 1) {
      const classBItems = await prisma.inventoryLevel.count({
        where: { warehouseId: warehouse.id, item: { abcClass: 'B' } },
      });

      if (classBItems > 0) {
        const countNumber = await generateDocumentNumber('cycle_count');
        await prisma.cycleCount.create({
          data: {
            countNumber,
            countType: 'random',
            warehouseId: warehouse.id,
            scheduledDate: today,
            createdById: (await prisma.employee.findFirst({
              where: { systemRole: 'admin', isActive: true },
              select: { id: true },
            }))!.id,
            notes: 'Auto-generated: Monthly Class B random sample count',
          },
        });
        log('info', `[CycleCount] Auto-created monthly count for ${warehouse.warehouseCode}`);
      }
    }

    // Quarterly count for Class C (first day of Jan, Apr, Jul, Oct)
    if (today.getDate() === 1 && [0, 3, 6, 9].includes(today.getMonth())) {
      const classCItems = await prisma.inventoryLevel.count({
        where: { warehouseId: warehouse.id, item: { abcClass: 'C' } },
      });

      if (classCItems > 0) {
        const countNumber = await generateDocumentNumber('cycle_count');
        await prisma.cycleCount.create({
          data: {
            countNumber,
            countType: 'full',
            warehouseId: warehouse.id,
            scheduledDate: today,
            createdById: (await prisma.employee.findFirst({
              where: { systemRole: 'admin', isActive: true },
              select: { id: true },
            }))!.id,
            notes: 'Auto-generated: Quarterly full count (Class C)',
          },
        });
        log('info', `[CycleCount] Auto-created quarterly count for ${warehouse.warehouseCode}`);
      }
    }
  }
}
