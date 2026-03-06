/**
 * Rate Card Service — V2 (SOW M2-F06)
 * Prisma model: SupplierEquipmentRate (table: supplier_equipment_rates)
 * Standalone master data: Supplier x Equipment Type x Capacity → Rates
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../../../utils/prisma.js';
import { NotFoundError } from '@nit-scs-v2/shared';
import type { RateCardCreateDto, RateCardUpdateDto, ListParams } from '../../../types/dto.js';

const LIST_INCLUDE = {
  supplier: { select: { id: true, supplierName: true, supplierCode: true } },
  equipmentType: { select: { id: true, typeName: true } },
} satisfies Prisma.SupplierEquipmentRateInclude;

const DETAIL_INCLUDE = {
  supplier: { select: { id: true, supplierName: true, supplierCode: true, phone: true, email: true } },
  equipmentType: { select: { id: true, typeName: true, categoryId: true } },
} satisfies Prisma.SupplierEquipmentRateInclude;

export async function list(params: ListParams) {
  const where: Record<string, unknown> = {};

  if (params.search) {
    where.OR = [
      { supplier: { supplierName: { contains: params.search, mode: 'insensitive' } } },
      { equipmentType: { typeName: { contains: params.search, mode: 'insensitive' } } },
      { capacity: { contains: params.search, mode: 'insensitive' } },
      { notes: { contains: params.search, mode: 'insensitive' } },
    ];
  }
  if (params.status) where.status = params.status;
  if (params.supplierId) where.supplierId = params.supplierId;
  if (params.equipmentTypeId) where.equipmentTypeId = params.equipmentTypeId;

  const [data, total] = await Promise.all([
    prisma.supplierEquipmentRate.findMany({
      where,
      orderBy: { [params.sortBy]: params.sortDir },
      skip: params.skip,
      take: params.pageSize,
      include: LIST_INCLUDE,
    }),
    prisma.supplierEquipmentRate.count({ where }),
  ]);
  return { data, total };
}

export async function getById(id: string) {
  const rateCard = await prisma.supplierEquipmentRate.findUnique({
    where: { id },
    include: DETAIL_INCLUDE,
  });
  if (!rateCard) throw new NotFoundError('RateCard', id);
  return rateCard;
}

export async function create(body: RateCardCreateDto, _userId: string) {
  const data: Prisma.SupplierEquipmentRateCreateInput = {
    supplier: { connect: { id: body.supplierId } },
    equipmentType: { connect: { id: body.equipmentTypeId } },
    capacity: body.capacity ?? null,
    dailyRate: body.dailyRate ?? null,
    weeklyRate: body.weeklyRate ?? null,
    monthlyRate: body.monthlyRate ?? null,
    withOperatorSurcharge: body.withOperatorSurcharge ?? null,
    operatorIncluded: body.operatorIncluded ?? false,
    fuelIncluded: body.fuelIncluded ?? false,
    insuranceIncluded: body.insuranceIncluded ?? false,
    validFrom: new Date(body.validFrom),
    validUntil: body.validUntil ? new Date(body.validUntil) : null,
    status: body.status ?? 'active',
    notes: body.notes ?? null,
  };

  const created = await prisma.supplierEquipmentRate.create({
    data,
    include: LIST_INCLUDE,
  });
  return created;
}

export async function update(id: string, body: RateCardUpdateDto) {
  const existing = await prisma.supplierEquipmentRate.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('RateCard', id);

  const updateData: Record<string, unknown> = { ...body };
  if (body.validFrom) updateData.validFrom = new Date(body.validFrom);
  if (body.validUntil) updateData.validUntil = new Date(body.validUntil);

  const updated = await prisma.supplierEquipmentRate.update({
    where: { id },
    data: updateData,
    include: LIST_INCLUDE,
  });
  return { existing, updated };
}

/**
 * Auto-pull: find the active rate card for a given supplier + equipment type.
 * Used by Job Order creation to auto-populate rate fields.
 * Returns null if no matching active rate card is found.
 */
export async function getActiveRateForEquipment(
  supplierId: string,
  equipmentTypeId: string,
): Promise<Prisma.SupplierEquipmentRateGetPayload<{ include: typeof DETAIL_INCLUDE }> | null> {
  const now = new Date();

  const rateCard = await prisma.supplierEquipmentRate.findFirst({
    where: {
      supplierId,
      equipmentTypeId,
      status: 'active',
      validFrom: { lte: now },
      OR: [{ validUntil: null }, { validUntil: { gte: now } }],
    },
    orderBy: { validFrom: 'desc' },
    include: DETAIL_INCLUDE,
  });

  return rateCard;
}
