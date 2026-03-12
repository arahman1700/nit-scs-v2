/**
 * Carrier Service — P6
 *
 * Manages shipping carrier service levels and rate lookups.
 */
import type { Prisma, CarrierService } from '@prisma/client';
import { prisma } from '../../../utils/prisma.js';
import { NotFoundError } from '@nit-scs-v2/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CarrierFilters {
  mode?: string;
  isActive?: boolean;
  carrierName?: string;
  page?: number;
  pageSize?: number;
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/** Creates a new carrier service record. */
export async function createCarrier(data: Prisma.CarrierServiceUncheckedCreateInput): Promise<CarrierService> {
  return prisma.carrierService.create({ data });
}

/** Retrieves a carrier service by ID or throws NotFoundError. */
export async function getCarrierById(id: string): Promise<CarrierService> {
  const carrier = await prisma.carrierService.findUnique({ where: { id } });
  if (!carrier) throw new NotFoundError('CarrierService', id);
  return carrier;
}

/** Lists carrier services with optional mode/active/name filters and pagination. */
export async function getCarriers(filters: CarrierFilters) {
  const where: Prisma.CarrierServiceWhereInput = {};
  if (filters.mode) where.mode = filters.mode;
  if (filters.isActive !== undefined) where.isActive = filters.isActive;
  if (filters.carrierName) where.carrierName = { contains: filters.carrierName, mode: 'insensitive' };

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const skip = (page - 1) * pageSize;

  const [data, total] = await Promise.all([
    prisma.carrierService.findMany({
      where,
      orderBy: { carrierName: 'asc' },
      skip,
      take: pageSize,
    }),
    prisma.carrierService.count({ where }),
  ]);

  return { data, total, page, pageSize };
}

/** Updates an existing carrier service by ID. */
export async function updateCarrier(
  id: string,
  data: Prisma.CarrierServiceUncheckedUpdateInput,
): Promise<CarrierService> {
  await getCarrierById(id);
  return prisma.carrierService.update({ where: { id }, data });
}

/** Deletes a carrier service by ID. */
export async function deleteCarrier(id: string): Promise<void> {
  await getCarrierById(id);
  await prisma.carrierService.delete({ where: { id } });
}

// ---------------------------------------------------------------------------
// Rate Lookup — find best carrier for a given mode
// ---------------------------------------------------------------------------

/** Finds active carriers for a given transport mode, sorted by lowest rate, with optional cost estimates. */
export async function findBestRate(mode: string, weightKg?: number) {
  const carriers = await prisma.carrierService.findMany({
    where: { mode, isActive: true },
    orderBy: { ratePerUnit: 'asc' },
  });

  if (carriers.length === 0) return null;

  return carriers.map(c => ({
    id: c.id,
    carrierName: c.carrierName,
    serviceName: c.serviceName,
    serviceCode: c.serviceCode,
    transitDays: c.transitDays,
    ratePerUnit: Number(c.ratePerUnit),
    minCharge: Number(c.minCharge ?? 0),
    estimatedCost:
      weightKg && c.ratePerUnit ? Math.max(Number(c.ratePerUnit) * weightKg, Number(c.minCharge ?? 0)) : null,
    currency: c.currency,
  }));
}
