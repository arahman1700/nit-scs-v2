/**
 * Customs Document Service — SOW M9
 * Prisma model: CustomsDocument (table: customs_documents)
 * Status flow: pending → received → verified
 *              pending → received → rejected
 *
 * Manages import/export documentation required for shipment customs clearance.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../../utils/prisma.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import { eventBus } from '../../../events/event-bus.js';
import type { CustomsDocumentCreateDto, CustomsDocumentUpdateDto } from '../../../types/dto.js';

// ── Required document types for import clearance ────────────────────────
const REQUIRED_IMPORT_DOCS = [
  'bill_of_lading',
  'commercial_invoice',
  'packing_list',
  'certificate_of_origin',
  'customs_declaration',
] as const;

// ── Prisma includes ─────────────────────────────────────────────────────

const LIST_INCLUDE = {
  shipment: { select: { id: true, shipmentNumber: true, status: true } },
  verifiedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.CustomsDocumentInclude;

const DETAIL_INCLUDE = {
  shipment: {
    select: {
      id: true,
      shipmentNumber: true,
      status: true,
      supplierId: true,
      originCountry: true,
      modeOfShipment: true,
    },
  },
  verifiedBy: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.CustomsDocumentInclude;

// ── List by shipment (paginated) ────────────────────────────────────────

export interface CustomsDocListParams {
  page: number;
  pageSize: number;
  shipmentId: string;
  status?: string;
  documentType?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export async function listByShipment(params: CustomsDocListParams) {
  const where: Prisma.CustomsDocumentWhereInput = {
    shipmentId: params.shipmentId,
  };

  if (params.status) where.status = params.status;
  if (params.documentType) where.documentType = params.documentType;

  const sortBy = params.sortBy || 'createdAt';
  const sortDir = params.sortDir || 'desc';
  const skip = (params.page - 1) * params.pageSize;

  const [data, total] = await Promise.all([
    prisma.customsDocument.findMany({
      where,
      orderBy: { [sortBy]: sortDir },
      skip,
      take: params.pageSize,
      include: LIST_INCLUDE,
    }),
    prisma.customsDocument.count({ where }),
  ]);

  return { data, total };
}

// ── Get by ID ───────────────────────────────────────────────────────────

export async function getById(id: string) {
  const record = await prisma.customsDocument.findUnique({
    where: { id },
    include: DETAIL_INCLUDE,
  });
  if (!record) throw new NotFoundError('CustomsDocument', id);
  return record;
}

// ── Create ──────────────────────────────────────────────────────────────

export async function create(data: CustomsDocumentCreateDto, userId: string) {
  // Verify the shipment exists
  const shipment = await prisma.shipment.findUnique({
    where: { id: data.shipmentId },
    select: { id: true, shipmentNumber: true },
  });
  if (!shipment) throw new NotFoundError('Shipment', data.shipmentId);

  const doc = await prisma.customsDocument.create({
    data: {
      shipmentId: data.shipmentId,
      documentType: data.documentType,
      documentNumber: data.documentNumber ?? null,
      issueDate: data.issueDate ? new Date(data.issueDate) : null,
      expiryDate: data.expiryDate ? new Date(data.expiryDate) : null,
      status: 'pending',
      filePath: data.filePath ?? null,
      notes: data.notes ?? null,
    },
    include: LIST_INCLUDE,
  });

  eventBus.publish({
    type: 'document:created',
    entityType: 'customs_document',
    entityId: doc.id,
    action: 'create',
    payload: {
      shipmentId: data.shipmentId,
      documentType: data.documentType,
      shipmentNumber: shipment.shipmentNumber,
    },
    performedById: userId,
    timestamp: new Date().toISOString(),
  });

  return doc;
}

// ── Update ──────────────────────────────────────────────────────────────

export async function update(id: string, data: CustomsDocumentUpdateDto) {
  const existing = await prisma.customsDocument.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('CustomsDocument', id);

  if (existing.status === 'verified') {
    throw new BusinessRuleError('Cannot update a verified customs document');
  }

  const updateData: Prisma.CustomsDocumentUpdateInput = {};

  if (data.documentType !== undefined) updateData.documentType = data.documentType;
  if (data.documentNumber !== undefined) updateData.documentNumber = data.documentNumber;
  if (data.issueDate !== undefined) updateData.issueDate = data.issueDate ? new Date(data.issueDate) : null;
  if (data.expiryDate !== undefined) updateData.expiryDate = data.expiryDate ? new Date(data.expiryDate) : null;
  if (data.status !== undefined) updateData.status = data.status;
  if (data.filePath !== undefined) updateData.filePath = data.filePath;
  if (data.notes !== undefined) updateData.notes = data.notes;

  return prisma.customsDocument.update({
    where: { id },
    data: updateData,
    include: LIST_INCLUDE,
  });
}

// ── Verify ──────────────────────────────────────────────────────────────

export async function verify(id: string, userId: string) {
  const record = await prisma.customsDocument.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('CustomsDocument', id);

  if (record.status !== 'pending' && record.status !== 'received') {
    throw new BusinessRuleError(
      `Cannot verify a customs document with status "${record.status}". Only "pending" or "received" documents can be verified.`,
    );
  }

  const updated = await prisma.customsDocument.update({
    where: { id },
    data: {
      status: 'verified',
      verifiedById: userId,
      verifiedAt: new Date(),
    },
    include: DETAIL_INCLUDE,
  });

  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'customs_document',
    entityId: id,
    action: 'status_change',
    payload: {
      from: record.status,
      to: 'verified',
      documentType: record.documentType,
      shipmentId: record.shipmentId,
    },
    performedById: userId,
    timestamp: new Date().toISOString(),
  });

  return updated;
}

// ── Reject ──────────────────────────────────────────────────────────────

export async function reject(id: string, userId: string, reason?: string) {
  const record = await prisma.customsDocument.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('CustomsDocument', id);

  if (record.status !== 'pending' && record.status !== 'received') {
    throw new BusinessRuleError(
      `Cannot reject a customs document with status "${record.status}". Only "pending" or "received" documents can be rejected.`,
    );
  }

  const updated = await prisma.customsDocument.update({
    where: { id },
    data: {
      status: 'rejected',
      verifiedById: userId,
      verifiedAt: new Date(),
      ...(reason ? { notes: reason } : {}),
    },
    include: DETAIL_INCLUDE,
  });

  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'customs_document',
    entityId: id,
    action: 'status_change',
    payload: {
      from: record.status,
      to: 'rejected',
      documentType: record.documentType,
      shipmentId: record.shipmentId,
      reason,
    },
    performedById: userId,
    timestamp: new Date().toISOString(),
  });

  return updated;
}

// ── Document Completeness Check ─────────────────────────────────────────

export interface DocumentCompleteness {
  shipmentId: string;
  total: number;
  verified: number;
  pending: number;
  received: number;
  rejected: number;
  isComplete: boolean;
  requiredDocuments: {
    type: string;
    label: string;
    present: boolean;
    status: string | null;
  }[];
}

const DOC_TYPE_LABELS: Record<string, string> = {
  bill_of_lading: 'Bill of Lading',
  commercial_invoice: 'Commercial Invoice',
  packing_list: 'Packing List',
  certificate_of_origin: 'Certificate of Origin',
  customs_declaration: 'Customs Declaration',
  insurance_certificate: 'Insurance Certificate',
  import_permit: 'Import Permit',
  phytosanitary: 'Phytosanitary Certificate',
  conformity_certificate: 'Conformity Certificate',
  other: 'Other',
};

export async function getCompleteness(shipmentId: string): Promise<DocumentCompleteness> {
  // Verify the shipment exists
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    select: { id: true },
  });
  if (!shipment) throw new NotFoundError('Shipment', shipmentId);

  const documents = await prisma.customsDocument.findMany({
    where: { shipmentId },
    select: { documentType: true, status: true },
  });

  // Build a map of doc type → best status
  const docMap = new Map<string, string>();
  for (const doc of documents) {
    const existing = docMap.get(doc.documentType);
    // Prefer verified > received > pending > rejected
    const priority: Record<string, number> = { verified: 4, received: 3, pending: 2, rejected: 1 };
    if (!existing || (priority[doc.status] ?? 0) > (priority[existing] ?? 0)) {
      docMap.set(doc.documentType, doc.status);
    }
  }

  const requiredDocuments = REQUIRED_IMPORT_DOCS.map(type => ({
    type,
    label: DOC_TYPE_LABELS[type] || type,
    present: docMap.has(type),
    status: docMap.get(type) ?? null,
  }));

  const statusCounts = { verified: 0, pending: 0, received: 0, rejected: 0 };
  for (const doc of documents) {
    if (doc.status in statusCounts) {
      statusCounts[doc.status as keyof typeof statusCounts]++;
    }
  }

  // Complete means all required docs are present and verified
  const isComplete = requiredDocuments.every(d => d.present && d.status === 'verified');

  return {
    shipmentId,
    total: documents.length,
    verified: statusCounts.verified,
    pending: statusCounts.pending,
    received: statusCounts.received,
    rejected: statusCounts.rejected,
    isComplete,
    requiredDocuments,
  };
}
