/**
 * Rental Contract Service — V2
 * Prisma model: RentalContract (table: rental_contracts)
 * State flow: draft → pending_approval → active → extended/terminated
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { generateDocumentNumber } from './document-number.service.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import { assertTransition } from '@nit-scs-v2/shared';
import { eventBus } from '../events/event-bus.js';
import type {
  RentalContractCreateDto,
  RentalContractUpdateDto,
  RentalContractLineDto,
  ListParams,
} from '../types/dto.js';

/** Helper to emit EventBus events for rental contracts */
function emitEvent(action: string, entityId: string, payload: Record<string, unknown>, performedById?: string) {
  eventBus.publish({
    type: action === 'create' ? 'document:created' : 'document:status_changed',
    entityType: 'rental_contract',
    entityId,
    action,
    payload,
    performedById,
    timestamp: new Date().toISOString(),
  });
}

const DOC_TYPE = 'rental_contract';

const LIST_INCLUDE = {
  supplier: { select: { id: true, supplierName: true, supplierCode: true } },
  createdBy: { select: { id: true, fullName: true } },
  _count: { select: { rentalLines: true } },
} satisfies Prisma.RentalContractInclude;

const DETAIL_INCLUDE = {
  rentalLines: true,
  supplier: true,
  createdBy: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.RentalContractInclude;

export async function list(params: ListParams) {
  const where: Record<string, unknown> = {};
  if (params.search) {
    where.OR = [
      { contractNumber: { contains: params.search, mode: 'insensitive' } },
      { supplier: { supplierName: { contains: params.search, mode: 'insensitive' } } },
    ];
  }
  if (params.status) where.status = params.status;
  if (params.supplierId) where.supplierId = params.supplierId;

  const [data, total] = await Promise.all([
    prisma.rentalContract.findMany({
      where,
      orderBy: { [params.sortBy]: params.sortDir },
      skip: params.skip,
      take: params.pageSize,
      include: LIST_INCLUDE,
    }),
    prisma.rentalContract.count({ where }),
  ]);
  return { data, total };
}

export async function getById(id: string) {
  const contract = await prisma.rentalContract.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!contract) throw new NotFoundError('RentalContract', id);
  return contract;
}

export async function create(
  headerData: Omit<RentalContractCreateDto, 'lines'>,
  lines: RentalContractLineDto[],
  userId: string,
) {
  return prisma.$transaction(async tx => {
    const contractNumber = await generateDocumentNumber('rental_contract');
    const created = await tx.rentalContract.create({
      data: {
        contractNumber,
        supplierId: headerData.supplierId,
        equipmentType: headerData.equipmentType,
        startDate: new Date(headerData.startDate),
        endDate: new Date(headerData.endDate),
        monthlyRate: headerData.monthlyRate ?? null,
        dailyRate: headerData.dailyRate ?? null,
        insuranceValue: headerData.insuranceValue ?? null,
        insuranceExpiry: headerData.insuranceExpiry ? new Date(headerData.insuranceExpiry) : null,
        status: 'draft',
        notes: headerData.notes ?? null,
        createdById: userId,
        rentalLines: {
          create: lines.map(line => ({
            equipmentDescription: line.equipmentDescription,
            qty: line.qty,
            unitRate: line.unitRate,
            totalRate: line.totalRate,
          })),
        },
      },
      include: {
        rentalLines: true,
        supplier: { select: { id: true, supplierName: true } },
      },
    });

    emitEvent('create', created.id, { contractNumber, supplierId: headerData.supplierId }, userId);

    return created;
  });
}

export async function update(id: string, data: RentalContractUpdateDto) {
  const existing = await prisma.rentalContract.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('RentalContract', id);
  if (existing.status !== 'draft') {
    throw new BusinessRuleError('Only draft rental contracts can be updated');
  }

  const updated = await prisma.rentalContract.update({
    where: { id },
    data: {
      ...data,
      ...(data.endDate ? { endDate: new Date(data.endDate) } : {}),
      ...(data.insuranceExpiry ? { insuranceExpiry: new Date(data.insuranceExpiry) } : {}),
    },
  });
  return { existing, updated };
}

export async function submit(id: string) {
  const contract = await prisma.rentalContract.findUnique({
    where: { id },
    include: { rentalLines: true },
  });
  if (!contract) throw new NotFoundError('RentalContract', id);
  assertTransition(DOC_TYPE, contract.status, 'pending_approval');

  if (contract.rentalLines.length === 0) {
    throw new BusinessRuleError('Cannot submit rental contract with no line items');
  }

  const updated = await prisma.rentalContract.update({
    where: { id: contract.id },
    data: { status: 'pending_approval' },
  });

  emitEvent('status_change', contract.id, { from: contract.status, to: 'pending_approval' });

  return updated;
}

export async function approve(id: string) {
  const contract = await prisma.rentalContract.findUnique({ where: { id } });
  if (!contract) throw new NotFoundError('RentalContract', id);
  assertTransition(DOC_TYPE, contract.status, 'active');

  const updated = await prisma.rentalContract.update({
    where: { id: contract.id },
    data: { status: 'active' },
  });

  emitEvent('status_change', contract.id, { from: contract.status, to: 'active' });

  return updated;
}

export async function activate(id: string) {
  const contract = await prisma.rentalContract.findUnique({ where: { id } });
  if (!contract) throw new NotFoundError('RentalContract', id);
  assertTransition(DOC_TYPE, contract.status, 'active');

  const updated = await prisma.rentalContract.update({
    where: { id: contract.id },
    data: { status: 'active' },
  });

  emitEvent('status_change', contract.id, { from: contract.status, to: 'active' });

  return updated;
}

export async function extend(id: string, newEndDate: string) {
  const contract = await prisma.rentalContract.findUnique({ where: { id } });
  if (!contract) throw new NotFoundError('RentalContract', id);
  assertTransition(DOC_TYPE, contract.status, 'extended');

  const updated = await prisma.rentalContract.update({
    where: { id: contract.id },
    data: { status: 'extended', endDate: new Date(newEndDate) },
  });

  emitEvent('status_change', contract.id, { from: contract.status, to: 'extended', newEndDate });

  return updated;
}

export async function terminate(id: string) {
  const contract = await prisma.rentalContract.findUnique({ where: { id } });
  if (!contract) throw new NotFoundError('RentalContract', id);
  assertTransition(DOC_TYPE, contract.status, 'terminated');

  const updated = await prisma.rentalContract.update({
    where: { id: contract.id },
    data: { status: 'terminated' },
  });

  emitEvent('status_change', contract.id, { from: contract.status, to: 'terminated' });

  return updated;
}
