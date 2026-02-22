import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { generateDocumentNumber } from './document-number.service.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import { assertTransition } from '@nit-scs-v2/shared';
import { eventBus } from '../events/event-bus.js';
import type { GatePassCreateDto, GatePassUpdateDto, GatePassItemDto, ListParams } from '../types/dto.js';

const DOC_TYPE = 'gate_pass';

const LIST_INCLUDE = {
  warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
  project: { select: { id: true, projectName: true, projectCode: true } },
  issuedBy: { select: { id: true, fullName: true } },
  _count: { select: { gatePassItems: true } },
} satisfies Prisma.GatePassInclude;

const DETAIL_INCLUDE = {
  gatePassItems: {
    include: {
      item: { select: { id: true, itemCode: true, itemDescription: true } },
      uom: { select: { id: true, uomCode: true, uomName: true } },
    },
  },
  warehouse: true,
  mirv: { select: { id: true, mirvNumber: true, status: true } },
  project: true,
  issuedBy: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.GatePassInclude;

export async function list(params: ListParams) {
  const where: Record<string, unknown> = {};
  if (params.search) {
    where.OR = [
      { gatePassNumber: { contains: params.search, mode: 'insensitive' } },
      { driverName: { contains: params.search, mode: 'insensitive' } },
      { vehicleNumber: { contains: params.search, mode: 'insensitive' } },
    ];
  }
  if (params.status) where.status = params.status;
  if (params.passType) where.passType = params.passType;
  // Row-level security scope filters
  if (params.warehouseId) where.warehouseId = params.warehouseId;
  if (params.projectId) where.projectId = params.projectId;
  if (params.issuedById) where.issuedById = params.issuedById;

  const [data, total] = await Promise.all([
    prisma.gatePass.findMany({
      where,
      orderBy: { [params.sortBy]: params.sortDir },
      skip: params.skip,
      take: params.pageSize,
      include: LIST_INCLUDE,
    }),
    prisma.gatePass.count({ where }),
  ]);
  return { data, total };
}

export async function getById(id: string) {
  const gp = await prisma.gatePass.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!gp) throw new NotFoundError('Gate Pass', id);
  return gp;
}

export async function create(headerData: Omit<GatePassCreateDto, 'items'>, items: GatePassItemDto[], userId: string) {
  return prisma.$transaction(async tx => {
    const gatePassNumber = await generateDocumentNumber('gatepass');
    return tx.gatePass.create({
      data: {
        gatePassNumber,
        passType: headerData.passType,
        mirvId: headerData.mirvId ?? null,
        projectId: headerData.projectId ?? null,
        warehouseId: headerData.warehouseId,
        vehicleNumber: headerData.vehicleNumber,
        driverName: headerData.driverName,
        driverIdNumber: headerData.driverIdNumber ?? null,
        destination: headerData.destination,
        purpose: headerData.purpose ?? null,
        issueDate: new Date(headerData.issueDate),
        validUntil: headerData.validUntil ? new Date(headerData.validUntil) : null,
        status: 'draft',
        issuedById: userId,
        notes: headerData.notes ?? null,
        gatePassItems: {
          create: items.map(item => ({
            itemId: item.itemId,
            quantity: item.quantity,
            uomId: item.uomId,
            description: item.description ?? null,
          })),
        },
      },
      include: {
        gatePassItems: true,
        warehouse: { select: { id: true, warehouseName: true } },
      },
    });
  });
}

export async function update(id: string, data: GatePassUpdateDto) {
  const existing = await prisma.gatePass.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Gate Pass', id);
  if (existing.status !== 'draft') throw new BusinessRuleError('Only draft Gate Passes can be updated');

  const updated = await prisma.gatePass.update({
    where: { id },
    data: {
      ...data,
      ...(data.issueDate ? { issueDate: new Date(data.issueDate) } : {}),
      ...(data.validUntil ? { validUntil: new Date(data.validUntil) } : {}),
    },
  });
  return { existing, updated };
}

export async function submit(id: string) {
  const gp = await prisma.gatePass.findUnique({ where: { id } });
  if (!gp) throw new NotFoundError('Gate Pass', id);
  assertTransition(DOC_TYPE, gp.status, 'pending');
  const updated = await prisma.gatePass.update({ where: { id: gp.id }, data: { status: 'pending' } });

  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'gate_pass',
    entityId: gp.id,
    action: 'status_change',
    payload: { from: gp.status, to: 'pending', passType: gp.passType },
    timestamp: new Date().toISOString(),
  });

  return updated;
}

export async function approve(id: string) {
  const gp = await prisma.gatePass.findUnique({ where: { id } });
  if (!gp) throw new NotFoundError('Gate Pass', id);
  assertTransition(DOC_TYPE, gp.status, 'approved');
  const updated = await prisma.gatePass.update({ where: { id: gp.id }, data: { status: 'approved' } });

  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'gate_pass',
    entityId: gp.id,
    action: 'status_change',
    payload: { from: gp.status, to: 'approved', passType: gp.passType },
    timestamp: new Date().toISOString(),
  });

  return updated;
}

export async function release(id: string, securityOfficer?: string) {
  const gp = await prisma.gatePass.findUnique({ where: { id } });
  if (!gp) throw new NotFoundError('Gate Pass', id);
  assertTransition(DOC_TYPE, gp.status, 'released');

  const updated = await prisma.gatePass.update({
    where: { id: gp.id },
    data: { status: 'released', exitTime: new Date(), securityOfficer: securityOfficer ?? null },
  });

  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'gate_pass',
    entityId: gp.id,
    action: 'status_change',
    payload: { from: gp.status, to: 'released', passType: gp.passType },
    timestamp: new Date().toISOString(),
  });

  return updated;
}

export async function returnPass(id: string) {
  const gp = await prisma.gatePass.findUnique({ where: { id } });
  if (!gp) throw new NotFoundError('Gate Pass', id);
  assertTransition(DOC_TYPE, gp.status, 'returned');

  const updated = await prisma.gatePass.update({
    where: { id: gp.id },
    data: { status: 'returned', returnTime: new Date() },
  });

  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'gate_pass',
    entityId: gp.id,
    action: 'status_change',
    payload: { from: gp.status, to: 'returned', passType: gp.passType },
    timestamp: new Date().toISOString(),
  });

  return updated;
}

export async function cancel(id: string) {
  const gp = await prisma.gatePass.findUnique({ where: { id } });
  if (!gp) throw new NotFoundError('Gate Pass', id);

  const nonCancellable = ['released', 'returned', 'cancelled'];
  if (nonCancellable.includes(gp.status)) {
    throw new BusinessRuleError(`Gate Pass cannot be cancelled from status: ${gp.status}`);
  }

  const updated = await prisma.gatePass.update({ where: { id: gp.id }, data: { status: 'cancelled' } });

  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'gate_pass',
    entityId: gp.id,
    action: 'status_change',
    payload: { from: gp.status, to: 'cancelled', passType: gp.passType },
    timestamp: new Date().toISOString(),
  });

  return updated;
}
