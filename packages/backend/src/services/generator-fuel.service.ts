/**
 * Generator Fuel Log Service — V2
 * Prisma model: GeneratorFuelLog (table: generator_fuel_logs)
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError } from '@nit-scs-v2/shared';
import type { GeneratorFuelLogCreateDto, ListParams } from '../types/dto.js';

const LIST_INCLUDE = {
  generator: { select: { id: true, generatorCode: true, generatorName: true } },
  loggedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.GeneratorFuelLogInclude;

const DETAIL_INCLUDE = {
  generator: true,
  loggedBy: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.GeneratorFuelLogInclude;

export async function list(params: ListParams) {
  const where: Record<string, unknown> = {};
  if (params.search) {
    where.OR = [
      { generator: { generatorCode: { contains: params.search, mode: 'insensitive' } } },
      { generator: { generatorName: { contains: params.search, mode: 'insensitive' } } },
    ];
  }
  if (params.generatorId) where.generatorId = params.generatorId;
  if (params.fromDate || params.toDate) {
    where.fuelDate = {
      ...(params.fromDate ? { gte: new Date(params.fromDate as string) } : {}),
      ...(params.toDate ? { lte: new Date(params.toDate as string) } : {}),
    };
  }

  const [data, total] = await Promise.all([
    prisma.generatorFuelLog.findMany({
      where,
      orderBy: { [params.sortBy]: params.sortDir },
      skip: params.skip,
      take: params.pageSize,
      include: LIST_INCLUDE,
    }),
    prisma.generatorFuelLog.count({ where }),
  ]);
  return { data, total };
}

export async function getById(id: string) {
  const record = await prisma.generatorFuelLog.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!record) throw new NotFoundError('GeneratorFuelLog', id);
  return record;
}

export async function create(data: GeneratorFuelLogCreateDto, userId: string) {
  // Verify generator exists
  const generator = await prisma.generator.findUnique({ where: { id: data.generatorId } });
  if (!generator) throw new NotFoundError('Generator', data.generatorId);

  // Calculate totalCost if both values are provided
  const totalCost =
    data.fuelQtyLiters != null && data.costPerLiter != null
      ? Number(data.fuelQtyLiters) * Number(data.costPerLiter)
      : (data.totalCost ?? null);

  return prisma.generatorFuelLog.create({
    data: {
      generatorId: data.generatorId,
      fuelDate: new Date(data.fuelDate),
      fuelQtyLiters: data.fuelQtyLiters,
      meterReading: data.meterReading ?? null,
      fuelSupplier: data.fuelSupplier ?? null,
      costPerLiter: data.costPerLiter ?? null,
      totalCost,
      loggedById: userId,
    },
    include: {
      generator: { select: { id: true, generatorCode: true, generatorName: true } },
    },
  });
}

export async function update(id: string, data: Record<string, unknown>) {
  const existing = await prisma.generatorFuelLog.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('GeneratorFuelLog', id);

  const updated = await prisma.generatorFuelLog.update({
    where: { id },
    data: {
      ...data,
      ...(data.fuelDate ? { fuelDate: new Date(data.fuelDate as string) } : {}),
    },
  });
  return { existing, updated };
}

export async function remove(id: string) {
  const existing = await prisma.generatorFuelLog.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('GeneratorFuelLog', id);

  await prisma.generatorFuelLog.delete({ where: { id } });
  return existing;
}
