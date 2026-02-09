/**
 * Generator Maintenance Service — V2
 * Prisma model: GeneratorMaintenance (table: generator_maintenance)
 * State flow: scheduled → in_progress → completed (or overdue)
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import { assertTransition } from '@nit-scs-v2/shared';
import type { GeneratorMaintenanceCreateDto, GeneratorMaintenanceUpdateDto, ListParams } from '../types/dto.js';

const DOC_TYPE = 'generator_maintenance';

const LIST_INCLUDE = {
  generator: { select: { id: true, generatorCode: true, generatorName: true } },
  performedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.GeneratorMaintenanceInclude;

const DETAIL_INCLUDE = {
  generator: true,
  performedBy: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.GeneratorMaintenanceInclude;

export async function list(params: ListParams) {
  const where: Record<string, unknown> = {};
  if (params.search) {
    where.OR = [
      { generator: { generatorCode: { contains: params.search, mode: 'insensitive' } } },
      { generator: { generatorName: { contains: params.search, mode: 'insensitive' } } },
    ];
  }
  if (params.status) where.status = params.status;
  if (params.generatorId) where.generatorId = params.generatorId;
  if (params.maintenanceType) where.maintenanceType = params.maintenanceType;

  const [data, total] = await Promise.all([
    prisma.generatorMaintenance.findMany({
      where,
      orderBy: { [params.sortBy]: params.sortDir },
      skip: params.skip,
      take: params.pageSize,
      include: LIST_INCLUDE,
    }),
    prisma.generatorMaintenance.count({ where }),
  ]);
  return { data, total };
}

export async function getById(id: string) {
  const record = await prisma.generatorMaintenance.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!record) throw new NotFoundError('GeneratorMaintenance', id);
  return record;
}

export async function create(data: GeneratorMaintenanceCreateDto, userId: string) {
  // Verify generator exists
  const generator = await prisma.generator.findUnique({ where: { id: data.generatorId } });
  if (!generator) throw new NotFoundError('Generator', data.generatorId);

  return prisma.generatorMaintenance.create({
    data: {
      generatorId: data.generatorId,
      maintenanceType: data.maintenanceType,
      scheduledDate: new Date(data.scheduledDate),
      findings: data.findings ?? null,
      partsReplaced: data.partsReplaced ?? null,
      cost: data.cost ?? null,
      status: 'scheduled',
    },
    include: {
      generator: { select: { id: true, generatorCode: true, generatorName: true } },
    },
  });
}

export async function update(id: string, data: GeneratorMaintenanceUpdateDto) {
  const existing = await prisma.generatorMaintenance.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('GeneratorMaintenance', id);

  const updated = await prisma.generatorMaintenance.update({
    where: { id },
    data: {
      ...data,
      ...(data.completedDate ? { completedDate: new Date(data.completedDate) } : {}),
    },
  });
  return { existing, updated };
}

export async function startProgress(id: string, userId: string) {
  const record = await prisma.generatorMaintenance.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('GeneratorMaintenance', id);
  assertTransition(DOC_TYPE, record.status, 'in_progress');

  return prisma.generatorMaintenance.update({
    where: { id: record.id },
    data: { status: 'in_progress', performedById: userId },
  });
}

export async function complete(id: string, userId: string) {
  const record = await prisma.generatorMaintenance.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('GeneratorMaintenance', id);
  assertTransition(DOC_TYPE, record.status, 'completed');

  return prisma.generatorMaintenance.update({
    where: { id: record.id },
    data: {
      status: 'completed',
      completedDate: new Date(),
      performedById: userId,
    },
  });
}

export async function markOverdue(id: string) {
  const record = await prisma.generatorMaintenance.findUnique({ where: { id } });
  if (!record) throw new NotFoundError('GeneratorMaintenance', id);
  assertTransition(DOC_TYPE, record.status, 'overdue');

  return prisma.generatorMaintenance.update({
    where: { id: record.id },
    data: { status: 'overdue' },
  });
}
