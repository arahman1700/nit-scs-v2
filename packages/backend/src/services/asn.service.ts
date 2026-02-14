import { prisma } from '../utils/prisma.js';
import { generateDocumentNumber } from './document-number.service.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';

type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// ── Types ───────────────────────────────────────────────────────────────

export interface AsnLineDto {
  itemId: string;
  qtyExpected: number;
  lotNumber?: string;
  expiryDate?: string;
}

export interface AsnCreateDto {
  supplierId: string;
  warehouseId: string;
  expectedArrival: string;
  carrierName?: string;
  trackingNumber?: string;
  purchaseOrderRef?: string;
  notes?: string;
  lines: AsnLineDto[];
}

export interface AsnUpdateDto {
  supplierId?: string;
  warehouseId?: string;
  expectedArrival?: string;
  carrierName?: string;
  trackingNumber?: string;
  purchaseOrderRef?: string;
  notes?: string;
  lines?: AsnLineDto[];
}

export interface AsnListParams {
  page: number;
  pageSize: number;
  status?: string;
  warehouseId?: string;
  supplierId?: string;
  search?: string;
}

// ── Includes ────────────────────────────────────────────────────────────

const LIST_INCLUDE = {
  supplier: { select: { id: true, supplierName: true, supplierCode: true } },
  warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
  _count: { select: { lines: true } },
};

const DETAIL_INCLUDE = {
  supplier: { select: { id: true, supplierName: true, supplierCode: true } },
  warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
  lines: {
    include: {
      item: { select: { id: true, itemCode: true, itemDescription: true } },
    },
    orderBy: { id: 'asc' as const },
  },
};

// ── List ────────────────────────────────────────────────────────────────

export async function getAsns(params: AsnListParams) {
  const where: Record<string, unknown> = {};
  if (params.status) where.status = params.status;
  if (params.warehouseId) where.warehouseId = params.warehouseId;
  if (params.supplierId) where.supplierId = params.supplierId;
  if (params.search) {
    where.OR = [
      { asnNumber: { contains: params.search, mode: 'insensitive' } },
      { supplier: { supplierName: { contains: params.search, mode: 'insensitive' } } },
      { trackingNumber: { contains: params.search, mode: 'insensitive' } },
      { purchaseOrderRef: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const skip = (params.page - 1) * params.pageSize;

  const [data, total] = await Promise.all([
    prisma.advanceShippingNotice.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: params.pageSize,
      include: LIST_INCLUDE,
    }),
    prisma.advanceShippingNotice.count({ where }),
  ]);

  return { data, total };
}

// ── Get by ID ───────────────────────────────────────────────────────────

export async function getAsnById(id: string) {
  const asn = await prisma.advanceShippingNotice.findUnique({
    where: { id },
    include: DETAIL_INCLUDE,
  });
  if (!asn) throw new NotFoundError('ASN', id);
  return asn;
}

// ── Create ──────────────────────────────────────────────────────────────

export async function createAsn(data: AsnCreateDto) {
  const { lines, ...header } = data;

  if (!lines || lines.length === 0) {
    throw new BusinessRuleError('ASN must have at least one line item');
  }

  const asn = await prisma.$transaction(async (tx: TransactionClient) => {
    const asnNumber = await generateDocumentNumber('asn');

    return tx.advanceShippingNotice.create({
      data: {
        asnNumber,
        supplierId: header.supplierId,
        warehouseId: header.warehouseId,
        expectedArrival: new Date(header.expectedArrival),
        carrierName: header.carrierName || null,
        trackingNumber: header.trackingNumber || null,
        purchaseOrderRef: header.purchaseOrderRef || null,
        notes: header.notes || null,
        status: 'pending',
        lines: {
          create: lines.map(line => ({
            itemId: line.itemId,
            qtyExpected: line.qtyExpected,
            lotNumber: line.lotNumber || null,
            expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
          })),
        },
      },
      include: DETAIL_INCLUDE,
    });
  });

  return asn;
}

// ── Update ──────────────────────────────────────────────────────────────

export async function updateAsn(id: string, data: AsnUpdateDto) {
  const existing = await prisma.advanceShippingNotice.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('ASN', id);
  if (existing.status !== 'pending') {
    throw new BusinessRuleError('Only pending ASNs can be updated');
  }

  const { lines, ...header } = data;

  const asn = await prisma.$transaction(async (tx: TransactionClient) => {
    if (lines) {
      await tx.asnLine.deleteMany({ where: { asnId: id } });
    }

    return tx.advanceShippingNotice.update({
      where: { id },
      data: {
        ...(header.supplierId && { supplierId: header.supplierId }),
        ...(header.warehouseId && { warehouseId: header.warehouseId }),
        ...(header.expectedArrival && { expectedArrival: new Date(header.expectedArrival) }),
        ...(header.carrierName !== undefined && { carrierName: header.carrierName || null }),
        ...(header.trackingNumber !== undefined && { trackingNumber: header.trackingNumber || null }),
        ...(header.purchaseOrderRef !== undefined && { purchaseOrderRef: header.purchaseOrderRef || null }),
        ...(header.notes !== undefined && { notes: header.notes || null }),
        ...(lines && {
          lines: {
            create: lines.map(line => ({
              itemId: line.itemId,
              qtyExpected: line.qtyExpected,
              lotNumber: line.lotNumber || null,
              expiryDate: line.expiryDate ? new Date(line.expiryDate) : null,
            })),
          },
        }),
      },
      include: DETAIL_INCLUDE,
    });
  });

  return asn;
}

// ── Mark In Transit ─────────────────────────────────────────────────────

export async function markInTransit(id: string) {
  const existing = await prisma.advanceShippingNotice.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('ASN', id);
  if (existing.status !== 'pending') {
    throw new BusinessRuleError('Only pending ASNs can be marked as in transit');
  }

  return prisma.advanceShippingNotice.update({
    where: { id },
    data: { status: 'in_transit' },
    include: DETAIL_INCLUDE,
  });
}

// ── Mark Arrived ────────────────────────────────────────────────────────

export async function markArrived(id: string) {
  const existing = await prisma.advanceShippingNotice.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('ASN', id);
  if (existing.status !== 'in_transit') {
    throw new BusinessRuleError('Only in-transit ASNs can be marked as arrived');
  }

  return prisma.advanceShippingNotice.update({
    where: { id },
    data: { status: 'arrived', actualArrival: new Date() },
    include: DETAIL_INCLUDE,
  });
}

// ── Receive ASN (create GRN from ASN lines) ─────────────────────────────

export async function receiveAsn(id: string, userId: string) {
  const existing = await prisma.advanceShippingNotice.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!existing) throw new NotFoundError('ASN', id);
  if (existing.status !== 'arrived') {
    throw new BusinessRuleError('Only arrived ASNs can be received');
  }

  const result = await prisma.$transaction(async (tx: TransactionClient) => {
    const grnNumber = await generateDocumentNumber('grn');

    const grn = await tx.mrrv.create({
      data: {
        mrrvNumber: grnNumber,
        supplierId: existing.supplierId,
        warehouseId: existing.warehouseId,
        receivedById: userId,
        receiveDate: new Date(),
        status: 'draft',
        poNumber: existing.purchaseOrderRef || null,
        notes: `Auto-created from ASN ${existing.asnNumber}`,
        mrrvLines: {
          create: existing.lines.map(line => ({
            itemId: line.itemId,
            qtyOrdered: Number(line.qtyExpected),
            qtyReceived: Number(line.qtyExpected),
            uomId: line.itemId, // placeholder — resolved by item's default UOM
            condition: 'good',
            lotNumber: line.lotNumber || null,
          })),
        },
      },
    });

    await tx.asnLine.updateMany({
      where: { asnId: id },
      data: { qtyReceived: undefined },
    });

    for (const line of existing.lines) {
      await tx.asnLine.update({
        where: { id: line.id },
        data: { qtyReceived: line.qtyExpected },
      });
    }

    const updatedAsn = await tx.advanceShippingNotice.update({
      where: { id },
      data: { status: 'received', grnId: grn.id },
      include: DETAIL_INCLUDE,
    });

    return { asn: updatedAsn, grnId: grn.id, grnNumber };
  });

  return result;
}

// ── Cancel ASN ──────────────────────────────────────────────────────────

export async function cancelAsn(id: string) {
  const existing = await prisma.advanceShippingNotice.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('ASN', id);
  if (existing.status === 'received' || existing.status === 'cancelled') {
    throw new BusinessRuleError(`Cannot cancel ASN in ${existing.status} status`);
  }

  return prisma.advanceShippingNotice.update({
    where: { id },
    data: { status: 'cancelled' },
    include: DETAIL_INCLUDE,
  });
}

// ── Variance Report ─────────────────────────────────────────────────────

export async function getVarianceReport(id: string) {
  const asn = await prisma.advanceShippingNotice.findUnique({
    where: { id },
    include: {
      lines: {
        include: {
          item: { select: { id: true, itemCode: true, itemDescription: true } },
        },
      },
      supplier: { select: { id: true, supplierName: true } },
      warehouse: { select: { id: true, warehouseName: true } },
    },
  });
  if (!asn) throw new NotFoundError('ASN', id);

  const lines = asn.lines.map(line => {
    const expected = Number(line.qtyExpected);
    const received = line.qtyReceived ? Number(line.qtyReceived) : 0;
    const variance = received - expected;
    const variancePercent = expected > 0 ? (variance / expected) * 100 : 0;

    return {
      id: line.id,
      item: line.item,
      qtyExpected: expected,
      qtyReceived: received,
      variance,
      variancePercent: Math.round(variancePercent * 100) / 100,
      lotNumber: line.lotNumber,
    };
  });

  const totalExpected = lines.reduce((sum, l) => sum + l.qtyExpected, 0);
  const totalReceived = lines.reduce((sum, l) => sum + l.qtyReceived, 0);

  return {
    asnNumber: asn.asnNumber,
    supplier: asn.supplier,
    warehouse: asn.warehouse,
    status: asn.status,
    lines,
    summary: {
      totalExpected,
      totalReceived,
      totalVariance: totalReceived - totalExpected,
      totalVariancePercent:
        totalExpected > 0 ? Math.round(((totalReceived - totalExpected) / totalExpected) * 10000) / 100 : 0,
    },
  };
}
