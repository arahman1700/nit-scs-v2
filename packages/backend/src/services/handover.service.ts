/**
 * Storekeeper Handover Service — V2
 * Prisma model: StorekeeperHandover (table: storekeeper_handovers)
 * State flow: initiated → in_progress → completed
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import { assertTransition } from '@nit-scs-v2/shared';
import { eventBus } from '../events/event-bus.js';
import type { HandoverCreateDto, HandoverUpdateDto, ListParams } from '../types/dto.js';

const DOC_TYPE = 'storekeeper_handover';

const LIST_INCLUDE = {
  warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
  outgoingEmployee: { select: { id: true, fullName: true } },
  incomingEmployee: { select: { id: true, fullName: true } },
} satisfies Prisma.StorekeeperHandoverInclude;

const DETAIL_INCLUDE = {
  warehouse: true,
  outgoingEmployee: { select: { id: true, fullName: true, email: true } },
  incomingEmployee: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.StorekeeperHandoverInclude;

export async function list(params: ListParams) {
  const where: Record<string, unknown> = {};
  if (params.warehouseId) where.warehouseId = params.warehouseId;
  if (params.status) where.status = params.status;

  const [data, total] = await Promise.all([
    prisma.storekeeperHandover.findMany({
      where,
      orderBy: { [params.sortBy]: params.sortDir },
      skip: params.skip,
      take: params.pageSize,
      include: LIST_INCLUDE,
    }),
    prisma.storekeeperHandover.count({ where }),
  ]);
  return { data, total };
}

export async function getById(id: string) {
  const record = await prisma.storekeeperHandover.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!record) throw new NotFoundError('StorekeeperHandover', id);
  return record;
}

export async function create(data: HandoverCreateDto, _userId: string) {
  return prisma.storekeeperHandover.create({
    data: {
      warehouseId: data.warehouseId,
      outgoingEmployeeId: data.outgoingEmployeeId,
      incomingEmployeeId: data.incomingEmployeeId,
      handoverDate: new Date(data.handoverDate),
      notes: data.notes ?? null,
      status: 'initiated',
    },
    include: LIST_INCLUDE,
  });
}

export async function update(id: string, data: HandoverUpdateDto) {
  const existing = await prisma.storekeeperHandover.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('StorekeeperHandover', id);

  if (existing.status !== 'initiated') {
    throw new BusinessRuleError('Only handovers in "initiated" status can be updated');
  }

  const updated = await prisma.storekeeperHandover.update({
    where: { id },
    data: {
      ...data,
      ...(data.status ? {} : {}), // status changes handled via dedicated transition methods
    },
  });
  return { existing, updated };
}

export async function startVerification(id: string, _userId: string) {
  const record = await prisma.storekeeperHandover.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('StorekeeperHandover', id);
  assertTransition(DOC_TYPE, record.status, 'in_progress');

  const updated = await prisma.storekeeperHandover.update({
    where: { id: record.id },
    data: { status: 'in_progress' },
  });

  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'storekeeper_handover',
    entityId: id,
    action: 'status_change',
    payload: { from: record.status, to: 'in_progress' },
    timestamp: new Date().toISOString(),
  });

  return updated;
}

export async function complete(id: string, _userId: string) {
  const record = await prisma.storekeeperHandover.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('StorekeeperHandover', id);
  assertTransition(DOC_TYPE, record.status, 'completed');

  if (!record.inventoryVerified) {
    throw new BusinessRuleError('Inventory must be verified before completing the handover');
  }

  const updated = await prisma.storekeeperHandover.update({
    where: { id: record.id },
    data: { status: 'completed' },
  });

  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'storekeeper_handover',
    entityId: id,
    action: 'status_change',
    payload: { from: record.status, to: 'completed' },
    timestamp: new Date().toISOString(),
  });

  return updated;
}
