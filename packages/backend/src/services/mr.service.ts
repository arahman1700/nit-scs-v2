/**
 * MR Service — V2 rename of MRF (Material Requisition Form)
 * Prisma model: materialRequisition (unchanged)
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { generateDocumentNumber } from './document-number.service.js';
import { getStockLevel } from './inventory.service.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import { assertTransition } from '@nit-scs-v2/shared';
import type {
  MrfCreateDto as MrCreateDto,
  MrfUpdateDto as MrUpdateDto,
  MrfLineDto as MrLineDto,
  ListParams,
} from '../types/dto.js';

const DOC_TYPE = 'mr';

const LIST_INCLUDE = {
  project: { select: { id: true, projectName: true, projectCode: true } },
  requestedBy: { select: { id: true, fullName: true } },
  reviewedBy: { select: { id: true, fullName: true } },
  approvedBy: { select: { id: true, fullName: true } },
  _count: { select: { mrfLines: true } },
} satisfies Prisma.MaterialRequisitionInclude;

const DETAIL_INCLUDE = {
  mrfLines: {
    include: {
      item: { select: { id: true, itemCode: true, itemDescription: true } },
      uom: { select: { id: true, uomCode: true, uomName: true } },
      mirvLine: { select: { id: true, qtyIssued: true } },
    },
  },
  project: true,
  requestedBy: { select: { id: true, fullName: true, email: true } },
  reviewedBy: { select: { id: true, fullName: true, email: true } },
  approvedBy: { select: { id: true, fullName: true, email: true } },
  mirv: { select: { id: true, mirvNumber: true, status: true } },
} satisfies Prisma.MaterialRequisitionInclude;

export async function list(params: ListParams) {
  const where: Record<string, unknown> = {};
  if (params.search) {
    where.OR = [
      { mrfNumber: { contains: params.search, mode: 'insensitive' } },
      { project: { projectName: { contains: params.search, mode: 'insensitive' } } },
    ];
  }
  if (params.status) where.status = params.status;
  if (params.projectId) where.projectId = params.projectId;
  // Row-level security scope filters
  if (params.requestedById) where.requestedById = params.requestedById;

  const [data, total] = await Promise.all([
    prisma.materialRequisition.findMany({
      where,
      orderBy: { [params.sortBy]: params.sortDir },
      skip: params.skip,
      take: params.pageSize,
      include: LIST_INCLUDE,
    }),
    prisma.materialRequisition.count({ where }),
  ]);
  return { data, total };
}

export async function getById(id: string) {
  const mr = await prisma.materialRequisition.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!mr) throw new NotFoundError('MR', id);
  return mr;
}

export async function create(headerData: Omit<MrCreateDto, 'lines'>, lines: MrLineDto[], userId: string) {
  return prisma.$transaction(async tx => {
    const mrfNumber = await generateDocumentNumber('mrf');

    // Batch-fetch item costs to avoid N+1 queries
    const itemIds = lines.filter(l => l.itemId).map(l => l.itemId as string);
    const items =
      itemIds.length > 0
        ? await tx.item.findMany({
            where: { id: { in: itemIds } },
            select: { id: true, standardCost: true },
          })
        : [];
    const costMap = new Map(items.map(i => [i.id, Number(i.standardCost ?? 0)]));

    let totalEstimatedValue = 0;
    for (const line of lines) {
      if (line.itemId) {
        const cost = costMap.get(line.itemId) ?? 0;
        if (cost > 0) {
          totalEstimatedValue += cost * line.qtyRequested;
        }
      }
    }

    return tx.materialRequisition.create({
      data: {
        mrfNumber,
        requestDate: new Date(headerData.requestDate),
        requiredDate: headerData.requiredDate ? new Date(headerData.requiredDate) : null,
        projectId: headerData.projectId,
        department: headerData.department ?? null,
        requestedById: userId,
        deliveryPoint: headerData.deliveryPoint ?? null,
        workOrder: headerData.workOrder ?? null,
        drawingReference: headerData.drawingReference ?? null,
        priority: headerData.priority ?? 'medium',
        totalEstimatedValue,
        status: 'draft',
        notes: headerData.notes ?? null,
        mrfLines: {
          create: lines.map(line => ({
            itemId: line.itemId ?? null,
            itemDescription: line.itemDescription ?? null,
            category: line.category ?? null,
            qtyRequested: line.qtyRequested,
            uomId: line.uomId ?? null,
            source: line.source ?? 'tbd',
            notes: line.notes ?? null,
          })),
        },
      },
      include: {
        mrfLines: true,
        project: { select: { id: true, projectName: true } },
      },
    });
  });
}

export async function update(id: string, data: MrUpdateDto) {
  const existing = await prisma.materialRequisition.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('MR', id);
  if (existing.status !== 'draft') throw new BusinessRuleError('Only draft MRs can be updated');

  const updated = await prisma.materialRequisition.update({
    where: { id },
    data: {
      ...data,
      ...(data.requestDate ? { requestDate: new Date(data.requestDate) } : {}),
      ...(data.requiredDate ? { requiredDate: new Date(data.requiredDate) } : {}),
    },
  });
  return { existing, updated };
}

export async function submit(id: string) {
  const mr = await prisma.materialRequisition.findUnique({ where: { id } });
  if (!mr) throw new NotFoundError('MR', id);
  assertTransition(DOC_TYPE, mr.status, 'submitted');
  return prisma.materialRequisition.update({ where: { id: mr.id }, data: { status: 'submitted' } });
}

export async function review(id: string, userId: string) {
  const mr = await prisma.materialRequisition.findUnique({ where: { id } });
  if (!mr) throw new NotFoundError('MR', id);
  assertTransition(DOC_TYPE, mr.status, 'under_review');

  return prisma.materialRequisition.update({
    where: { id: mr.id },
    data: { status: 'under_review', reviewedById: userId, reviewDate: new Date() },
  });
}

export async function approve(id: string, userId: string) {
  const mr = await prisma.materialRequisition.findUnique({ where: { id } });
  if (!mr) throw new NotFoundError('MR', id);
  assertTransition(DOC_TYPE, mr.status, 'approved');

  return prisma.materialRequisition.update({
    where: { id: mr.id },
    data: {
      status: 'approved',
      approvedById: userId,
      approvalDate: new Date(),
      stockVerificationSla: new Date(Date.now() + 4 * 60 * 60 * 1000),
    },
  });
}

export async function checkStock(id: string) {
  const mr = await prisma.materialRequisition.findUnique({
    where: { id },
    include: {
      mrfLines: true,
      project: { select: { id: true, warehouses: { select: { id: true } } } },
    },
  });
  if (!mr) throw new NotFoundError('MR', id);
  if (mr.status !== 'approved') throw new BusinessRuleError('MR must be approved to check stock');

  const stockResults: Array<{
    lineId: string;
    itemId: string | null;
    available: number;
    source: string;
    otherProjectId?: string;
  }> = [];

  for (const line of mr.mrfLines) {
    if (!line.itemId) {
      stockResults.push({ lineId: line.id, itemId: null, available: 0, source: 'purchase_required' });
      continue;
    }

    let totalAvailable = 0;
    const projectWarehouses = mr.project?.warehouses ?? [];
    for (const wh of projectWarehouses) {
      const stock = await getStockLevel(line.itemId, wh.id);
      totalAvailable += stock.available;
    }

    const qtyNeeded = Number(line.qtyRequested);
    const source = totalAvailable >= qtyNeeded ? 'from_stock' : totalAvailable > 0 ? 'both' : 'purchase_required';

    await prisma.mrfLine.update({
      where: { id: line.id },
      data: {
        source,
        qtyFromStock: Math.min(totalAvailable, qtyNeeded),
        qtyFromPurchase: Math.max(0, qtyNeeded - totalAvailable),
      },
    });

    stockResults.push({ lineId: line.id, itemId: line.itemId, available: totalAvailable, source });
  }

  // Cross-project stock check: if ALL lines are 'purchase_required', check other projects
  const allPurchaseRequired = stockResults.every(r => r.source === 'purchase_required');
  let suggestImsf = false;

  if (allPurchaseRequired) {
    const otherProjects = await prisma.project.findMany({
      where: { id: { not: mr.projectId }, status: 'active' },
      select: { id: true, warehouses: { select: { id: true } } },
    });

    for (const result of stockResults) {
      if (!result.itemId) continue;

      for (const project of otherProjects) {
        let otherAvailable = 0;
        for (const wh of project.warehouses) {
          const stock = await getStockLevel(result.itemId, wh.id);
          otherAvailable += stock.available;
        }

        if (otherAvailable > 0) {
          result.source = 'available_other_project';
          result.otherProjectId = project.id;
          suggestImsf = true;

          await prisma.mrfLine.update({
            where: { id: result.lineId },
            data: { source: 'available_other_project' },
          });
          break; // found stock in another project for this line
        }
      }
    }
  }

  const updated = await prisma.materialRequisition.update({
    where: { id: mr.id },
    data: { status: 'checking_stock' },
  });

  return { id: mr.id, status: updated.status, stockResults, suggestImsf };
}

export async function convertToImsf(id: string, userId: string, receiverProjectId: string) {
  const mr = await prisma.materialRequisition.findUnique({
    where: { id },
    include: {
      mrfLines: {
        include: {
          item: { select: { id: true, itemCode: true, itemDescription: true } },
          uom: { select: { id: true } },
        },
      },
    },
  });
  if (!mr) throw new NotFoundError('MR', id);
  if (mr.status !== 'checking_stock' && mr.status !== 'not_available_locally') {
    throw new BusinessRuleError('MR must be in checking_stock or not_available_locally status to convert to IMSF');
  }

  // Get lines that need procurement (purchase_required or available_other_project)
  const eligibleLines = mr.mrfLines.filter(
    l => l.source === 'purchase_required' || l.source === 'available_other_project' || !l.source || l.source === 'tbd',
  );

  if (eligibleLines.length === 0) {
    throw new BusinessRuleError('No lines eligible for IMSF conversion');
  }

  // Filter to lines with valid itemId and uomId (required for IMSF lines)
  const validLines = eligibleLines.filter(l => l.itemId && l.uomId);
  if (validLines.length === 0) {
    throw new BusinessRuleError('No lines with valid item and UOM for IMSF conversion');
  }

  const result = await prisma.$transaction(async tx => {
    const imsfNumber = await generateDocumentNumber('imsf');
    const imsf = await tx.imsf.create({
      data: {
        imsfNumber,
        senderProjectId: mr.projectId,
        receiverProjectId,
        materialType: 'normal',
        status: 'created',
        originMrId: mr.id,
        notes: `Auto-created from MR ${mr.mrfNumber}`,
        createdById: userId,
        imsfLines: {
          create: validLines.map(line => ({
            itemId: line.itemId!,
            description: line.item?.itemDescription ?? line.itemDescription ?? null,
            qty: line.qtyRequested,
            uomId: line.uomId!,
            mrfNumber: mr.mrfNumber,
          })),
        },
      },
      include: {
        imsfLines: true,
        senderProject: { select: { id: true, projectName: true } },
        receiverProject: { select: { id: true, projectName: true } },
      },
    });

    await tx.materialRequisition.update({
      where: { id: mr.id },
      data: { status: 'not_available_locally', convertedToImsfId: imsf.id },
    });

    return imsf;
  });

  return result;
}

export async function convertToMirv(id: string, userId: string, warehouseIdOverride?: string) {
  const mr = await prisma.materialRequisition.findUnique({
    where: { id },
    include: {
      mrfLines: true,
      project: { select: { id: true, warehouses: { select: { id: true }, take: 1 } } },
    },
  });
  if (!mr) throw new NotFoundError('MR', id);
  if (mr.status !== 'checking_stock' && mr.status !== 'approved') {
    throw new BusinessRuleError('MR must be in checking_stock or approved status to convert to MI');
  }

  const fromStockLines = mr.mrfLines.filter(l => l.source === 'from_stock' || l.source === 'both');

  if (fromStockLines.length === 0) {
    const updated = await prisma.materialRequisition.update({
      where: { id: mr.id },
      data: { status: 'needs_purchase' },
    });
    return { id: mr.id, status: updated.status, mirv: null };
  }

  const warehouseId = warehouseIdOverride ?? mr.project?.warehouses[0]?.id;
  if (!warehouseId) throw new BusinessRuleError('No warehouse specified and project has no warehouses');

  const result = await prisma.$transaction(async tx => {
    const mirvNumber = await generateDocumentNumber('mirv');
    const mirv = await tx.mirv.create({
      data: {
        mirvNumber,
        projectId: mr.projectId,
        warehouseId,
        requestedById: userId,
        requestDate: new Date(),
        priority: mr.priority === 'urgent' ? 'urgent' : 'normal',
        status: 'draft',
        mrfId: mr.id,
        notes: `Auto-created from MR ${mr.mrfNumber}`,
        mirvLines: {
          create: fromStockLines.map(line => ({
            itemId: line.itemId!,
            qtyRequested: line.qtyFromStock && Number(line.qtyFromStock) > 0 ? line.qtyFromStock : line.qtyRequested,
            notes: line.notes ?? null,
          })),
        },
      },
      include: { mirvLines: true },
    });

    for (let i = 0; i < fromStockLines.length; i++) {
      const mrfLine = fromStockLines[i];
      const mirvLine = mirv.mirvLines[i];
      if (mrfLine && mirvLine) {
        await tx.mrfLine.update({ where: { id: mrfLine.id }, data: { mirvLineId: mirvLine.id } });
      }
    }

    const allFromStock = mr.mrfLines.every(l => l.source === 'from_stock');
    const newStatus = allFromStock ? 'from_stock' : 'needs_purchase';
    await tx.materialRequisition.update({
      where: { id: mr.id },
      data: { status: newStatus, mirvId: mirv.id },
    });

    return { mirv, newStatus };
  });

  return {
    id: mr.id,
    status: result.newStatus,
    mirv: { id: result.mirv.id, mirvNumber: result.mirv.mirvNumber },
  };
}

export async function fulfill(id: string) {
  const mr = await prisma.materialRequisition.findUnique({ where: { id } });
  if (!mr) throw new NotFoundError('MR', id);

  const fulfillable = ['from_stock', 'needs_purchase', 'partially_fulfilled'];
  if (!fulfillable.includes(mr.status)) {
    throw new BusinessRuleError(`MR cannot be fulfilled from status: ${mr.status}`);
  }

  return prisma.materialRequisition.update({
    where: { id: mr.id },
    data: { status: 'fulfilled', fulfillmentDate: new Date() },
  });
}

export async function reject(id: string) {
  const mr = await prisma.materialRequisition.findUnique({ where: { id } });
  if (!mr) throw new NotFoundError('MR', id);

  const rejectable = ['submitted', 'under_review'];
  if (!rejectable.includes(mr.status)) {
    throw new BusinessRuleError(`MR cannot be rejected from status: ${mr.status}`);
  }

  return prisma.materialRequisition.update({ where: { id: mr.id }, data: { status: 'rejected' } });
}

export async function cancel(id: string) {
  const mr = await prisma.materialRequisition.findUnique({ where: { id } });
  if (!mr) throw new NotFoundError('MR', id);

  const nonCancellable = ['fulfilled', 'cancelled'];
  if (nonCancellable.includes(mr.status)) {
    throw new BusinessRuleError(`MR cannot be cancelled from status: ${mr.status}`);
  }

  return prisma.materialRequisition.update({ where: { id: mr.id }, data: { status: 'cancelled' } });
}
