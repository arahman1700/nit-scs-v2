import { prisma } from '../utils/prisma.js';
import { NotFoundError } from '@nit-scs-v2/shared';

const VALID_ENTITY_TYPES = new Set([
  'mrrv',
  'mirv',
  'mrv',
  'shipment',
  'job-order',
  'rfim',
  'osd',
  'gate-pass',
  'stock-transfer',
  'mrf',
  'project',
  'supplier',
  'employee',
  'fleet',
  'generator',
  'warehouse',
  'customs',
]);

export function validateEntityType(entityType: string): void {
  if (!VALID_ENTITY_TYPES.has(entityType)) {
    throw new Error(`Invalid entity type: ${entityType}`);
  }
}

export async function listByEntity(entityType: string, recordId: string) {
  return prisma.attachment.findMany({
    where: { entityType, recordId, deletedAt: null },
    orderBy: { uploadedAt: 'desc' },
    select: {
      id: true,
      fileName: true,
      originalName: true,
      fileSize: true,
      mimeType: true,
      uploadedAt: true,
      uploadedBy: { select: { id: true, fullName: true } },
    },
  });
}

export async function create(data: {
  entityType: string;
  recordId: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  uploadedById: string;
}) {
  return prisma.attachment.create({
    data,
    select: {
      id: true,
      fileName: true,
      originalName: true,
      fileSize: true,
      mimeType: true,
      uploadedAt: true,
    },
  });
}

export async function getById(id: string) {
  const attachment = await prisma.attachment.findFirst({
    where: { id, deletedAt: null },
  });
  if (!attachment) throw new NotFoundError('Attachment', id);
  return attachment;
}

export async function softDelete(id: string) {
  const attachment = await prisma.attachment.findFirst({
    where: { id, deletedAt: null },
  });
  if (!attachment) throw new NotFoundError('Attachment', id);

  return prisma.attachment.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}
