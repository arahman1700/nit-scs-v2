/**
 * Equipment Delivery & Return Note Service — V2 (SOW M2-F02)
 *
 * Prisma models: EquipmentDeliveryNote / EquipmentReturnNote
 * Tables:        equipment_delivery_notes / equipment_return_notes
 *
 * Delivery:  draft → confirmed | cancelled
 * Return:    draft → inspected → confirmed | disputed
 *
 * On return confirm: actual cost = daily rate × actual days + damage cost
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../../../utils/prisma.js';
import { generateDocumentNumber } from '../../system/services/document-number.service.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import { assertTransition } from '@nit-scs-v2/shared';
import { safeStatusUpdate } from '../../../utils/safe-status-transition.js';
import { eventBus } from '../../../events/event-bus.js';
import type {
  EquipmentDeliveryNoteCreateDto,
  EquipmentDeliveryNoteUpdateDto,
  EquipmentReturnNoteCreateDto,
  EquipmentReturnNoteUpdateDto,
  ListParams,
} from '../../../types/dto.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function emitDeliveryEvent(action: string, entityId: string, payload: Record<string, unknown>, performedById?: string) {
  eventBus.publish({
    type: action === 'create' ? 'document:created' : 'document:status_changed',
    entityType: 'equipment_delivery_note',
    entityId,
    action,
    payload,
    performedById,
    timestamp: new Date().toISOString(),
  });
}

function emitReturnEvent(action: string, entityId: string, payload: Record<string, unknown>, performedById?: string) {
  eventBus.publish({
    type: action === 'create' ? 'document:created' : 'document:status_changed',
    entityType: 'equipment_return_note',
    entityId,
    action,
    payload,
    performedById,
    timestamp: new Date().toISOString(),
  });
}

// ── Delivery Note Includes ──────────────────────────────────────────────────

const DELIVERY_LIST_INCLUDE = {
  jobOrder: { select: { id: true, joNumber: true, joType: true } },
  rentalContract: { select: { id: true, contractNumber: true } },
  receivedBy: { select: { id: true, fullName: true } },
  confirmedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.EquipmentDeliveryNoteInclude;

const DELIVERY_DETAIL_INCLUDE = {
  jobOrder: { select: { id: true, joNumber: true, joType: true, projectId: true, supplierId: true } },
  rentalContract: { select: { id: true, contractNumber: true, dailyRate: true, monthlyRate: true } },
  receivedBy: { select: { id: true, fullName: true, email: true } },
  confirmedBy: { select: { id: true, fullName: true, email: true } },
  returnNotes: { select: { id: true, noteNumber: true, status: true, returnDate: true } },
} satisfies Prisma.EquipmentDeliveryNoteInclude;

// ── Return Note Includes ────────────────────────────────────────────────────

const RETURN_LIST_INCLUDE = {
  jobOrder: { select: { id: true, joNumber: true, joType: true } },
  deliveryNote: { select: { id: true, noteNumber: true, equipmentDescription: true } },
  returnedBy: { select: { id: true, fullName: true } },
  inspectedBy: { select: { id: true, fullName: true } },
  confirmedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.EquipmentReturnNoteInclude;

const RETURN_DETAIL_INCLUDE = {
  jobOrder: { select: { id: true, joNumber: true, joType: true, projectId: true, supplierId: true } },
  deliveryNote: {
    select: {
      id: true,
      noteNumber: true,
      equipmentDescription: true,
      serialNumber: true,
      hoursOnDelivery: true,
      mileageOnDelivery: true,
      conditionOnDelivery: true,
      deliveryDate: true,
      rentalContractId: true,
      rentalContract: { select: { id: true, contractNumber: true, dailyRate: true, monthlyRate: true } },
    },
  },
  returnedBy: { select: { id: true, fullName: true, email: true } },
  inspectedBy: { select: { id: true, fullName: true, email: true } },
  confirmedBy: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.EquipmentReturnNoteInclude;

// ═════════════════════════════════════════════════════════════════════════════
// DELIVERY NOTE OPERATIONS
// ═════════════════════════════════════════════════════════════════════════════

export async function listDeliveryNotes(params: ListParams) {
  const where: Record<string, unknown> = {};
  if (params.search) {
    where.OR = [
      { noteNumber: { contains: params.search, mode: 'insensitive' } },
      { equipmentDescription: { contains: params.search, mode: 'insensitive' } },
      { serialNumber: { contains: params.search, mode: 'insensitive' } },
    ];
  }
  if (params.status) where.status = params.status;
  if (params.jobOrderId) where.jobOrderId = params.jobOrderId;
  if (params.rentalContractId) where.rentalContractId = params.rentalContractId;

  const [data, total] = await Promise.all([
    prisma.equipmentDeliveryNote.findMany({
      where,
      orderBy: { [params.sortBy]: params.sortDir },
      skip: params.skip,
      take: params.pageSize,
      include: DELIVERY_LIST_INCLUDE,
    }),
    prisma.equipmentDeliveryNote.count({ where }),
  ]);
  return { data, total };
}

export async function getDeliveryNoteById(id: string) {
  const note = await prisma.equipmentDeliveryNote.findUnique({
    where: { id },
    include: DELIVERY_DETAIL_INCLUDE,
  });
  if (!note) throw new NotFoundError('EquipmentDeliveryNote', id);
  return note;
}

export async function createDeliveryNote(dto: EquipmentDeliveryNoteCreateDto, userId: string) {
  return prisma.$transaction(async tx => {
    // Verify job order exists
    const jo = await tx.jobOrder.findUnique({ where: { id: dto.jobOrderId } });
    if (!jo) throw new NotFoundError('JobOrder', dto.jobOrderId);

    // Verify rental contract if provided
    if (dto.rentalContractId) {
      const rc = await tx.rentalContract.findUnique({ where: { id: dto.rentalContractId } });
      if (!rc) throw new NotFoundError('RentalContract', dto.rentalContractId);
    }

    const noteNumber = await generateDocumentNumber('delivery_note');

    const created = await tx.equipmentDeliveryNote.create({
      data: {
        noteNumber,
        jobOrderId: dto.jobOrderId,
        rentalContractId: dto.rentalContractId ?? null,
        deliveryDate: new Date(dto.deliveryDate),
        receivedById: dto.receivedById,
        equipmentDescription: dto.equipmentDescription,
        serialNumber: dto.serialNumber ?? null,
        hoursOnDelivery: dto.hoursOnDelivery ?? null,
        mileageOnDelivery: dto.mileageOnDelivery ?? null,
        conditionOnDelivery: dto.conditionOnDelivery,
        conditionNotes: dto.conditionNotes ?? null,
        safetyCertificateVerified: dto.safetyCertificateVerified ?? false,
        status: 'draft',
        notes: dto.notes ?? null,
      },
      include: DELIVERY_DETAIL_INCLUDE,
    });

    emitDeliveryEvent('create', created.id, { noteNumber, jobOrderId: dto.jobOrderId }, userId);

    return created;
  });
}

export async function updateDeliveryNote(id: string, dto: EquipmentDeliveryNoteUpdateDto) {
  const existing = await prisma.equipmentDeliveryNote.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('EquipmentDeliveryNote', id);
  if (existing.status !== 'draft') {
    throw new BusinessRuleError('Only draft delivery notes can be updated');
  }

  const updated = await prisma.equipmentDeliveryNote.update({
    where: { id },
    data: {
      ...dto,
      ...(dto.deliveryDate ? { deliveryDate: new Date(dto.deliveryDate) } : {}),
    },
  });
  return { existing, updated };
}

export async function confirmDeliveryNote(id: string, userId: string) {
  const note = await prisma.equipmentDeliveryNote.findUnique({ where: { id } });
  if (!note) throw new NotFoundError('EquipmentDeliveryNote', id);
  assertTransition('equipment_delivery_note', note.status, 'confirmed');

  await safeStatusUpdate(
    prisma.equipmentDeliveryNote,
    id,
    note.status,
    {
      status: 'confirmed',
      confirmedAt: new Date(),
      confirmedById: userId,
    },
    note.version,
  );
  const updated = await prisma.equipmentDeliveryNote.findUnique({ where: { id } });

  emitDeliveryEvent('status_change', id, { from: note.status, to: 'confirmed' }, userId);

  return updated;
}

export async function cancelDeliveryNote(id: string, userId: string) {
  const note = await prisma.equipmentDeliveryNote.findUnique({
    where: { id },
    include: { returnNotes: { where: { status: { not: 'disputed' } } } },
  });
  if (!note) throw new NotFoundError('EquipmentDeliveryNote', id);
  assertTransition('equipment_delivery_note', note.status, 'cancelled');

  if (note.returnNotes.length > 0) {
    throw new BusinessRuleError('Cannot cancel delivery note that has active return notes');
  }

  await safeStatusUpdate(prisma.equipmentDeliveryNote, id, note.status, { status: 'cancelled' }, note.version);
  const updated = await prisma.equipmentDeliveryNote.findUnique({ where: { id } });

  emitDeliveryEvent('status_change', id, { from: note.status, to: 'cancelled' }, userId);

  return updated;
}

// ═════════════════════════════════════════════════════════════════════════════
// RETURN NOTE OPERATIONS
// ═════════════════════════════════════════════════════════════════════════════

export async function listReturnNotes(params: ListParams) {
  const where: Record<string, unknown> = {};
  if (params.search) {
    where.OR = [
      { noteNumber: { contains: params.search, mode: 'insensitive' } },
      { deliveryNote: { equipmentDescription: { contains: params.search, mode: 'insensitive' } } },
    ];
  }
  if (params.status) where.status = params.status;
  if (params.jobOrderId) where.jobOrderId = params.jobOrderId;
  if (params.deliveryNoteId) where.deliveryNoteId = params.deliveryNoteId;

  const [data, total] = await Promise.all([
    prisma.equipmentReturnNote.findMany({
      where,
      orderBy: { [params.sortBy]: params.sortDir },
      skip: params.skip,
      take: params.pageSize,
      include: RETURN_LIST_INCLUDE,
    }),
    prisma.equipmentReturnNote.count({ where }),
  ]);
  return { data, total };
}

export async function getReturnNoteById(id: string) {
  const note = await prisma.equipmentReturnNote.findUnique({
    where: { id },
    include: RETURN_DETAIL_INCLUDE,
  });
  if (!note) throw new NotFoundError('EquipmentReturnNote', id);
  return note;
}

export async function createReturnNote(dto: EquipmentReturnNoteCreateDto, userId: string) {
  return prisma.$transaction(async tx => {
    // Verify delivery note exists and is confirmed
    const deliveryNote = await tx.equipmentDeliveryNote.findUnique({
      where: { id: dto.deliveryNoteId },
    });
    if (!deliveryNote) throw new NotFoundError('EquipmentDeliveryNote', dto.deliveryNoteId);
    if (deliveryNote.status !== 'confirmed') {
      throw new BusinessRuleError('Delivery note must be confirmed before creating a return note');
    }

    // Verify job order matches
    if (deliveryNote.jobOrderId !== dto.jobOrderId) {
      throw new BusinessRuleError('Job order ID must match the delivery note job order');
    }

    const noteNumber = await generateDocumentNumber('return_note');

    const created = await tx.equipmentReturnNote.create({
      data: {
        noteNumber,
        jobOrderId: dto.jobOrderId,
        deliveryNoteId: dto.deliveryNoteId,
        returnDate: new Date(dto.returnDate),
        returnedById: dto.returnedById,
        hoursOnReturn: dto.hoursOnReturn ?? null,
        mileageOnReturn: dto.mileageOnReturn ?? null,
        conditionOnReturn: dto.conditionOnReturn,
        conditionNotes: dto.conditionNotes ?? null,
        damageDescription: dto.damageDescription ?? null,
        damageEstimatedCost: dto.damageEstimatedCost ?? null,
        fuelLevel: dto.fuelLevel ?? null,
        status: 'draft',
        notes: dto.notes ?? null,
      },
      include: RETURN_DETAIL_INCLUDE,
    });

    emitReturnEvent('create', created.id, { noteNumber, deliveryNoteId: dto.deliveryNoteId }, userId);

    return created;
  });
}

export async function updateReturnNote(id: string, dto: EquipmentReturnNoteUpdateDto) {
  const existing = await prisma.equipmentReturnNote.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('EquipmentReturnNote', id);
  if (existing.status !== 'draft') {
    throw new BusinessRuleError('Only draft return notes can be updated');
  }

  const updated = await prisma.equipmentReturnNote.update({
    where: { id },
    data: {
      ...dto,
      ...(dto.returnDate ? { returnDate: new Date(dto.returnDate) } : {}),
    },
  });
  return { existing, updated };
}

export async function inspectReturnNote(id: string, userId: string) {
  const note = await prisma.equipmentReturnNote.findUnique({ where: { id } });
  if (!note) throw new NotFoundError('EquipmentReturnNote', id);
  assertTransition('equipment_return_note', note.status, 'inspected');

  await safeStatusUpdate(
    prisma.equipmentReturnNote,
    id,
    note.status,
    {
      status: 'inspected',
      inspectedAt: new Date(),
      inspectedById: userId,
    },
    note.version,
  );
  const updated = await prisma.equipmentReturnNote.findUnique({ where: { id } });

  emitReturnEvent('status_change', id, { from: note.status, to: 'inspected' }, userId);

  return updated;
}

export async function confirmReturnNote(id: string, userId: string) {
  const note = await prisma.equipmentReturnNote.findUnique({
    where: { id },
    include: {
      deliveryNote: {
        include: {
          rentalContract: { select: { dailyRate: true, monthlyRate: true } },
        },
      },
    },
  });
  if (!note) throw new NotFoundError('EquipmentReturnNote', id);
  assertTransition('equipment_return_note', note.status, 'confirmed');

  // Calculate actual cost: daily rate × actual days + damage cost
  let actualDays = note.actualDays;
  if (!actualDays) {
    const deliveryDate = note.deliveryNote.deliveryDate;
    const returnDate = note.returnDate;
    const diffMs = returnDate.getTime() - deliveryDate.getTime();
    actualDays = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  let actualCost = note.actualCost;
  if (!actualCost) {
    const dailyRate = note.deliveryNote.rentalContract?.dailyRate;
    if (dailyRate) {
      const baseCost = Number(dailyRate) * actualDays;
      const damageCost = note.damageEstimatedCost ? Number(note.damageEstimatedCost) : 0;
      actualCost = new Prisma.Decimal(baseCost + damageCost);
    }
  }

  await safeStatusUpdate(
    prisma.equipmentReturnNote,
    id,
    note.status,
    {
      status: 'confirmed',
      confirmedAt: new Date(),
      confirmedById: userId,
      actualDays,
      ...(actualCost !== null && actualCost !== undefined ? { actualCost } : {}),
    },
    note.version,
  );
  const updated = await prisma.equipmentReturnNote.findUnique({ where: { id } });

  emitReturnEvent(
    'status_change',
    id,
    {
      from: note.status,
      to: 'confirmed',
      actualDays,
      actualCost: actualCost ? Number(actualCost) : null,
    },
    userId,
  );

  return updated;
}

export async function disputeReturnNote(id: string, userId: string, reason?: string) {
  const note = await prisma.equipmentReturnNote.findUnique({ where: { id } });
  if (!note) throw new NotFoundError('EquipmentReturnNote', id);
  assertTransition('equipment_return_note', note.status, 'disputed');

  await safeStatusUpdate(
    prisma.equipmentReturnNote,
    id,
    note.status,
    {
      status: 'disputed',
      ...(reason ? { notes: reason } : {}),
    },
    note.version,
  );
  const updated = await prisma.equipmentReturnNote.findUnique({ where: { id } });

  emitReturnEvent('status_change', id, { from: note.status, to: 'disputed', reason }, userId);

  return updated;
}
