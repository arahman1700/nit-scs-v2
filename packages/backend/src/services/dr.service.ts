/**
 * DR Service — V2 rename of OSD (Over/Short/Damage Report)
 * Prisma model: osdReport (unchanged)
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { generateDocumentNumber } from './document-number.service.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import type {
  OsdCreateDto as DrCreateDto,
  OsdUpdateDto as DrUpdateDto,
  OsdLineDto as DrLineDto,
  ListParams,
} from '../types/dto.js';

const LIST_INCLUDE = {
  mrrv: { select: { id: true, mrrvNumber: true } },
  supplier: { select: { id: true, supplierName: true, supplierCode: true } },
  warehouse: { select: { id: true, warehouseName: true } },
  _count: { select: { osdLines: true } },
} satisfies Prisma.OsdReportInclude;

const DETAIL_INCLUDE = {
  osdLines: {
    include: {
      item: { select: { id: true, itemCode: true, itemDescription: true } },
      uom: { select: { id: true, uomCode: true, uomName: true } },
      mrrvLine: { select: { id: true, qtyOrdered: true, qtyReceived: true } },
    },
  },
  mrrv: {
    select: {
      id: true,
      mrrvNumber: true,
      supplierId: true,
      poNumber: true,
      supplier: { select: { id: true, supplierName: true } },
    },
  },
  supplier: true,
  warehouse: true,
  resolvedBy: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.OsdReportInclude;

export async function list(params: ListParams) {
  const where: Record<string, unknown> = {};
  if (params.search) {
    where.OR = [{ osdNumber: { contains: params.search, mode: 'insensitive' } }];
  }
  if (params.status) where.status = params.status;
  // Row-level security scope filters
  if (params.warehouseId) where.warehouseId = params.warehouseId;

  const [data, total] = await Promise.all([
    prisma.osdReport.findMany({
      where,
      orderBy: { [params.sortBy]: params.sortDir },
      skip: params.skip,
      take: params.pageSize,
      include: LIST_INCLUDE,
    }),
    prisma.osdReport.count({ where }),
  ]);
  return { data, total };
}

export async function getById(id: string) {
  const dr = await prisma.osdReport.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!dr) throw new NotFoundError('DR', id);
  return dr;
}

export async function create(headerData: Omit<DrCreateDto, 'lines'>, lines: DrLineDto[]) {
  return prisma.$transaction(async tx => {
    const osdNumber = await generateDocumentNumber('osd');

    let totalOverValue = 0;
    let totalShortValue = 0;
    let totalDamageValue = 0;

    for (const line of lines) {
      const unitCost = line.unitCost ?? 0;
      const qtyInvoice = line.qtyInvoice;
      const qtyReceived = line.qtyReceived;
      const qtyDamaged = line.qtyDamaged ?? 0;

      if (qtyReceived > qtyInvoice) totalOverValue += (qtyReceived - qtyInvoice) * unitCost;
      else if (qtyReceived < qtyInvoice) totalShortValue += (qtyInvoice - qtyReceived) * unitCost;
      totalDamageValue += qtyDamaged * unitCost;
    }

    return tx.osdReport.create({
      data: {
        osdNumber,
        mrrvId: headerData.grnId ?? null,
        poNumber: headerData.poNumber ?? null,
        supplierId: headerData.supplierId ?? null,
        warehouseId: headerData.warehouseId ?? null,
        reportDate: new Date(headerData.reportDate),
        reportTypes: headerData.reportTypes,
        status: 'draft',
        totalOverValue,
        totalShortValue,
        totalDamageValue,
        osdLines: {
          create: lines.map(line => ({
            itemId: line.itemId,
            uomId: line.uomId,
            mrrvLineId: line.grnLineId ?? null,
            qtyInvoice: line.qtyInvoice,
            qtyReceived: line.qtyReceived,
            qtyDamaged: line.qtyDamaged ?? 0,
            damageType: line.damageType ?? null,
            unitCost: line.unitCost ?? null,
            notes: line.notes ?? null,
          })),
        },
      },
      include: {
        osdLines: true,
        mrrv: { select: { id: true, mrrvNumber: true } },
        supplier: { select: { id: true, supplierName: true } },
      },
    });
  });
}

export async function update(id: string, data: DrUpdateDto) {
  const existing = await prisma.osdReport.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('DR', id);

  const updated = await prisma.osdReport.update({
    where: { id },
    data: {
      ...data,
      ...(data.reportDate ? { reportDate: new Date(data.reportDate) } : {}),
    },
  });
  return { existing, updated };
}

export async function sendClaim(id: string, claimReference?: string) {
  const dr = await prisma.osdReport.findUnique({ where: { id } });
  if (!dr) throw new NotFoundError('DR', id);
  if (dr.status !== 'draft' && dr.status !== 'under_review') {
    throw new BusinessRuleError('DR must be draft or under review to send claim');
  }

  return prisma.osdReport.update({
    where: { id: dr.id },
    data: { status: 'claim_sent', claimSentDate: new Date(), claimReference: claimReference ?? null },
  });
}

export async function resolve(
  id: string,
  userId: string,
  params: { resolutionType?: string; resolutionAmount?: number; supplierResponse?: string },
) {
  const dr = await prisma.osdReport.findUnique({ where: { id } });
  if (!dr) throw new NotFoundError('DR', id);

  const validStatuses = ['claim_sent', 'awaiting_response', 'negotiating'];
  if (!validStatuses.includes(dr.status)) {
    throw new BusinessRuleError(`DR cannot be resolved from status: ${dr.status}`);
  }

  return prisma.osdReport.update({
    where: { id: dr.id },
    data: {
      status: 'resolved',
      resolutionType: params.resolutionType ?? null,
      resolutionAmount: params.resolutionAmount ?? null,
      resolutionDate: new Date(),
      resolvedById: userId,
      supplierResponse: params.supplierResponse ?? null,
      responseDate: params.supplierResponse ? new Date() : null,
    },
  });
}
