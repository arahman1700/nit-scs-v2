/**
 * GRN (Goods Receipt Note) Service — V2 rename of MRRV
 * Prisma model: Mrrv (table: mrrv) — kept for DB compatibility
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { generateDocumentNumber } from './document-number.service.js';
import { addStockBatch } from './inventory.service.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import { assertTransition } from '@nit-scs-v2/shared';
import { eventBus } from '../events/event-bus.js';
import type { GrnCreateDto, GrnUpdateDto, GrnLineDto, ListParams } from '../types/dto.js';

const DOC_TYPE = 'grn';

const LIST_INCLUDE = {
  supplier: { select: { id: true, supplierName: true, supplierCode: true } },
  warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
  project: { select: { id: true, projectName: true, projectCode: true } },
  receivedBy: { select: { id: true, fullName: true } },
  _count: { select: { mrrvLines: true } },
} satisfies Prisma.MrrvInclude;

const DETAIL_INCLUDE = {
  mrrvLines: {
    include: {
      item: { select: { id: true, itemCode: true, itemDescription: true } },
      uom: { select: { id: true, uomCode: true, uomName: true } },
    },
  },
  supplier: true,
  warehouse: true,
  project: true,
  receivedBy: { select: { id: true, fullName: true, email: true } },
  qcInspector: { select: { id: true, fullName: true, email: true } },
  rfims: true,
  osdReports: true,
} satisfies Prisma.MrrvInclude;

export async function list(params: ListParams) {
  const where: Record<string, unknown> = {};
  if (params.search) {
    where.OR = [
      { mrrvNumber: { contains: params.search, mode: 'insensitive' } },
      { supplier: { supplierName: { contains: params.search, mode: 'insensitive' } } },
    ];
  }
  if (params.status) where.status = params.status;
  if (params.warehouseId) where.warehouseId = params.warehouseId;
  if (params.projectId) where.projectId = params.projectId;
  if (params.receivedById) where.receivedById = params.receivedById;

  const [data, total] = await Promise.all([
    prisma.mrrv.findMany({
      where,
      orderBy: { [params.sortBy]: params.sortDir },
      skip: params.skip,
      take: params.pageSize,
      include: LIST_INCLUDE,
    }),
    prisma.mrrv.count({ where }),
  ]);

  return { data, total };
}

export async function getById(id: string) {
  const grn = await prisma.mrrv.findUnique({
    where: { id },
    include: DETAIL_INCLUDE,
  });
  if (!grn) throw new NotFoundError('GRN', id);
  return grn;
}

export async function create(headerData: Omit<GrnCreateDto, 'lines'>, lines: GrnLineDto[], userId: string) {
  const grn = await prisma.$transaction(async tx => {
    const grnNumber = await generateDocumentNumber('grn');

    let totalValue = 0;
    for (const line of lines) {
      if (line.unitCost && line.qtyReceived) {
        totalValue += line.unitCost * line.qtyReceived;
      }
    }

    const hasDr = lines.some(l => l.qtyDamaged && l.qtyDamaged > 0);

    const created = await tx.mrrv.create({
      data: {
        mrrvNumber: grnNumber,
        supplierId: headerData.supplierId,
        poNumber: headerData.poNumber ?? null,
        warehouseId: headerData.warehouseId,
        projectId: headerData.projectId ?? null,
        receivedById: userId,
        receiveDate: new Date(headerData.receiveDate),
        invoiceNumber: headerData.invoiceNumber ?? null,
        deliveryNote: headerData.deliveryNote ?? null,
        rfimRequired: headerData.qciRequired ?? false,
        binLocation: headerData.binLocation ?? null,
        receivingDock: headerData.receivingDock ?? null,
        hasOsd: hasDr,
        totalValue,
        status: 'draft',
        notes: headerData.notes ?? null,
        mrrvLines: {
          create: lines.map(line => ({
            itemId: line.itemId,
            qtyOrdered: line.qtyOrdered ?? null,
            qtyReceived: line.qtyReceived,
            qtyDamaged: line.qtyDamaged ?? 0,
            uomId: line.uomId,
            unitCost: line.unitCost ?? null,
            condition: line.condition ?? 'good',
            storageLocation: line.storageLocation ?? null,
            expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
            notes: line.notes ?? null,
          })),
        },
      },
      include: {
        mrrvLines: true,
        supplier: { select: { id: true, supplierName: true } },
        warehouse: { select: { id: true, warehouseName: true } },
      },
    });

    return created;
  });

  return grn;
}

export async function update(id: string, data: GrnUpdateDto) {
  const existing = await prisma.mrrv.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('GRN', id);
  if (existing.status !== 'draft') {
    throw new BusinessRuleError('Only draft GRNs can be updated');
  }

  const updated = await prisma.mrrv.update({
    where: { id },
    data: {
      ...data,
      ...(data.receiveDate ? { receiveDate: new Date(data.receiveDate) } : {}),
    },
  });

  return { existing, updated };
}

export async function submit(id: string) {
  const grn = await prisma.mrrv.findUnique({
    where: { id },
    include: { mrrvLines: true },
  });
  if (!grn) throw new NotFoundError('GRN', id);
  assertTransition(DOC_TYPE, grn.status, 'pending_qc');

  await prisma.$transaction(async tx => {
    await tx.mrrv.update({
      where: { id: grn.id },
      data: { status: 'pending_qc' },
    });

    // Auto-create QCI if required
    if (grn.rfimRequired) {
      const qciNumber = await generateDocumentNumber('qci');
      await tx.rfim.create({
        data: {
          rfimNumber: qciNumber,
          mrrvId: grn.id,
          requestDate: new Date(),
          status: 'pending',
        },
      });
    }

    // Auto-create DR if damaged items found
    const damagedLines = grn.mrrvLines.filter(l => Number(l.qtyDamaged ?? 0) > 0);
    if (damagedLines.length > 0) {
      const drNumber = await generateDocumentNumber('dr');
      await tx.osdReport.create({
        data: {
          osdNumber: drNumber,
          mrrvId: grn.id,
          poNumber: grn.poNumber,
          supplierId: grn.supplierId,
          warehouseId: grn.warehouseId,
          reportDate: new Date(),
          reportTypes: ['damage'],
          status: 'draft',
          osdLines: {
            create: damagedLines.map(line => ({
              itemId: line.itemId,
              uomId: line.uomId,
              mrrvLineId: line.id,
              qtyInvoice: line.qtyOrdered ?? line.qtyReceived,
              qtyReceived: line.qtyReceived,
              qtyDamaged: line.qtyDamaged ?? 0,
              damageType: 'physical',
              unitCost: line.unitCost,
            })),
          },
        },
      });
      await tx.mrrv.update({
        where: { id: grn.id },
        data: { hasOsd: true },
      });
    }
  });

  const hasDamage = grn.mrrvLines.some(l => Number(l.qtyDamaged ?? 0) > 0);
  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'mrrv',
    entityId: grn.id,
    action: 'status_change',
    payload: { from: 'draft', to: 'pending_qc', qciRequired: !!grn.rfimRequired, hasDamage },
    timestamp: new Date().toISOString(),
  });

  return { id: grn.id, qciRequired: !!grn.rfimRequired };
}

export async function approveQc(id: string, userId: string) {
  const grn = await prisma.mrrv.findUnique({ where: { id } });
  if (!grn) throw new NotFoundError('GRN', id);
  assertTransition(DOC_TYPE, grn.status, 'qc_approved');

  const updated = await prisma.mrrv.update({
    where: { id: grn.id },
    data: {
      status: 'qc_approved',
      qcInspectorId: userId,
      qcApprovedDate: new Date(),
    },
  });

  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'mrrv',
    entityId: grn.id,
    action: 'status_change',
    payload: { from: grn.status, to: 'qc_approved' },
    performedById: userId,
    timestamp: new Date().toISOString(),
  });

  return updated;
}

export async function receive(id: string, userId?: string) {
  const grn = await prisma.mrrv.findUnique({ where: { id } });
  if (!grn) throw new NotFoundError('GRN', id);
  assertTransition(DOC_TYPE, grn.status, 'received');

  const updated = await prisma.mrrv.update({
    where: { id: grn.id },
    data: { status: 'received' },
  });

  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'mrrv',
    entityId: grn.id,
    action: 'status_change',
    payload: { from: grn.status, to: 'received' },
    performedById: userId,
    timestamp: new Date().toISOString(),
  });

  return updated;
}

export async function store(id: string, userId: string) {
  const grn = await prisma.mrrv.findUnique({
    where: { id },
    include: { mrrvLines: true },
  });
  if (!grn) throw new NotFoundError('GRN', id);
  assertTransition(DOC_TYPE, grn.status, 'stored');

  await prisma.mrrv.update({
    where: { id: grn.id },
    data: { status: 'stored' },
  });

  const stockItems = grn.mrrvLines
    .map(line => ({
      itemId: line.itemId,
      warehouseId: grn.warehouseId,
      qty: Number(line.qtyReceived) - Number(line.qtyDamaged ?? 0),
      unitCost: line.unitCost ? Number(line.unitCost) : undefined,
      supplierId: grn.supplierId,
      mrrvLineId: line.id,
      expiryDate: line.expiryDate ?? undefined,
      performedById: userId,
    }))
    .filter(item => item.qty > 0);

  await addStockBatch(stockItems);

  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'mrrv',
    entityId: grn.id,
    action: 'status_change',
    payload: { from: grn.status, to: 'stored', warehouseId: grn.warehouseId, linesStored: grn.mrrvLines.length },
    performedById: userId,
    timestamp: new Date().toISOString(),
  });

  return { id: grn.id, warehouseId: grn.warehouseId, linesStored: grn.mrrvLines.length };
}
