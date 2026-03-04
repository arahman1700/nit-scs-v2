/**
 * Tariff Service — V2 (SOW M3 — VAT & Duties Calculation)
 * Prisma model: TariffRate (table: tariff_rates)
 *
 * Manages HS-code-based tariff rates and calculates customs duties + VAT
 * for shipment line items. Saudi Arabia standard VAT rate: 15%.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import type { ListParams } from '../types/dto.js';

// ── Types ───────────────────────────────────────────────────────────────────

export interface TariffRateCreateDto {
  hsCode: string;
  description: string;
  dutyRate: number;
  vatRate: number;
  exemptionCode?: string;
  exemptionDescription?: string;
  country?: string;
  effectiveFrom: string;
  effectiveUntil?: string;
  isActive?: boolean;
}

export interface TariffRateUpdateDto {
  hsCode?: string;
  description?: string;
  dutyRate?: number;
  vatRate?: number;
  exemptionCode?: string | null;
  exemptionDescription?: string | null;
  country?: string;
  effectiveFrom?: string;
  effectiveUntil?: string | null;
  isActive?: boolean;
}

export interface LineBreakdown {
  shipmentLineId: string;
  description: string;
  hsCode: string | null;
  lineValue: number;
  dutyRate: number;
  vatRate: number;
  dutyAmount: number;
  vatAmount: number;
  totalAmount: number;
  exemptionCode: string | null;
  tariffRateId: string | null;
}

export interface DutyCalculationResult {
  shipmentId: string;
  shipmentNumber: string;
  lineBreakdown: LineBreakdown[];
  totalDuties: number;
  totalVat: number;
  grandTotal: number;
}

// ── Constants ───────────────────────────────────────────────────────────────

/** Saudi Arabia standard VAT rate — 15% */
const DEFAULT_VAT_RATE = new Prisma.Decimal('0.1500');

// ── List ────────────────────────────────────────────────────────────────────

export async function listTariffRates(params: ListParams) {
  const where: Record<string, unknown> = {};

  if (params.search) {
    where.OR = [
      { hsCode: { contains: params.search, mode: 'insensitive' } },
      { description: { contains: params.search, mode: 'insensitive' } },
      { exemptionCode: { contains: params.search, mode: 'insensitive' } },
      { country: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  if (params.isActive !== undefined) {
    where.isActive = params.isActive === 'true' || params.isActive === true;
  }
  if (params.country) where.country = params.country;
  if (params.hsCode) where.hsCode = { startsWith: params.hsCode as string };

  const [data, total] = await Promise.all([
    prisma.tariffRate.findMany({
      where,
      orderBy: { [params.sortBy || 'updatedAt']: params.sortDir || 'desc' },
      skip: params.skip,
      take: params.pageSize,
    }),
    prisma.tariffRate.count({ where }),
  ]);

  return { data, total };
}

// ── Get By ID ───────────────────────────────────────────────────────────────

export async function getTariffRateById(id: string) {
  const tariffRate = await prisma.tariffRate.findUnique({ where: { id } });
  if (!tariffRate) throw new NotFoundError('TariffRate', id);
  return tariffRate;
}

// ── Create ──────────────────────────────────────────────────────────────────

export async function createTariffRate(dto: TariffRateCreateDto, _userId: string) {
  const data: Prisma.TariffRateCreateInput = {
    hsCode: dto.hsCode,
    description: dto.description,
    dutyRate: dto.dutyRate,
    vatRate: dto.vatRate,
    exemptionCode: dto.exemptionCode ?? null,
    exemptionDescription: dto.exemptionDescription ?? null,
    country: dto.country ?? 'Saudi Arabia',
    effectiveFrom: new Date(dto.effectiveFrom),
    effectiveUntil: dto.effectiveUntil ? new Date(dto.effectiveUntil) : null,
    isActive: dto.isActive ?? true,
  };

  return prisma.tariffRate.create({ data });
}

// ── Update ──────────────────────────────────────────────────────────────────

export async function updateTariffRate(id: string, dto: TariffRateUpdateDto) {
  const existing = await prisma.tariffRate.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('TariffRate', id);

  const updateData: Record<string, unknown> = { ...dto };
  if (dto.effectiveFrom) updateData.effectiveFrom = new Date(dto.effectiveFrom);
  if (dto.effectiveUntil !== undefined) {
    updateData.effectiveUntil = dto.effectiveUntil ? new Date(dto.effectiveUntil) : null;
  }

  const updated = await prisma.tariffRate.update({
    where: { id },
    data: updateData,
  });

  return updated;
}

// ── Calculate Duties ────────────────────────────────────────────────────────

/**
 * Calculate duties and VAT for all lines on a shipment.
 * Looks up each shipmentLine's hsCode against active tariff rates.
 * Lines without an hsCode or matching tariff use default Saudi VAT (15%).
 */
export async function calculateDuties(shipmentId: string): Promise<DutyCalculationResult> {
  const shipment = await prisma.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      shipmentLines: true,
    },
  });

  if (!shipment) throw new NotFoundError('Shipment', shipmentId);

  if (shipment.shipmentLines.length === 0) {
    throw new BusinessRuleError('Shipment has no line items to calculate duties for');
  }

  const now = new Date();

  // Collect unique HS codes from shipment lines
  const hsCodes = [
    ...new Set(
      shipment.shipmentLines.map(line => line.hsCode).filter((code): code is string => code !== null && code !== ''),
    ),
  ];

  // Batch-fetch active tariff rates for all HS codes
  const tariffRates =
    hsCodes.length > 0
      ? await prisma.tariffRate.findMany({
          where: {
            hsCode: { in: hsCodes },
            isActive: true,
            effectiveFrom: { lte: now },
            OR: [{ effectiveUntil: null }, { effectiveUntil: { gte: now } }],
          },
          orderBy: { effectiveFrom: 'desc' },
        })
      : [];

  // Build a map: hsCode -> most recent matching tariff rate
  const tariffMap = new Map<string, (typeof tariffRates)[number]>();
  for (const rate of tariffRates) {
    if (!tariffMap.has(rate.hsCode)) {
      tariffMap.set(rate.hsCode, rate);
    }
  }

  let totalDuties = new Prisma.Decimal(0);
  let totalVat = new Prisma.Decimal(0);

  const lineBreakdown: LineBreakdown[] = shipment.shipmentLines.map(line => {
    const lineValue = line.unitValue
      ? new Prisma.Decimal(line.unitValue).mul(new Prisma.Decimal(line.quantity))
      : new Prisma.Decimal(0);

    const tariff = line.hsCode ? tariffMap.get(line.hsCode) : undefined;

    const dutyRate = tariff ? new Prisma.Decimal(tariff.dutyRate) : new Prisma.Decimal(0);
    const vatRate = tariff ? new Prisma.Decimal(tariff.vatRate) : DEFAULT_VAT_RATE;

    const dutyAmount = lineValue.mul(dutyRate);
    // VAT is applied on (lineValue + duties) per Saudi customs rules
    const vatAmount = lineValue.add(dutyAmount).mul(vatRate);

    totalDuties = totalDuties.add(dutyAmount);
    totalVat = totalVat.add(vatAmount);

    return {
      shipmentLineId: line.id,
      description: line.description,
      hsCode: line.hsCode,
      lineValue: lineValue.toNumber(),
      dutyRate: dutyRate.toNumber(),
      vatRate: vatRate.toNumber(),
      dutyAmount: dutyAmount.toDP(2).toNumber(),
      vatAmount: vatAmount.toDP(2).toNumber(),
      totalAmount: dutyAmount.add(vatAmount).toDP(2).toNumber(),
      exemptionCode: tariff?.exemptionCode ?? null,
      tariffRateId: tariff?.id ?? null,
    };
  });

  const grandTotal = totalDuties.add(totalVat);

  return {
    shipmentId: shipment.id,
    shipmentNumber: shipment.shipmentNumber,
    lineBreakdown,
    totalDuties: totalDuties.toDP(2).toNumber(),
    totalVat: totalVat.toDP(2).toNumber(),
    grandTotal: grandTotal.toDP(2).toNumber(),
  };
}

// ── Apply to Shipment ───────────────────────────────────────────────────────

/**
 * Calculate duties and persist the total to the shipment's dutiesEstimated field.
 */
export async function applyToShipment(shipmentId: string): Promise<DutyCalculationResult> {
  const result = await calculateDuties(shipmentId);

  await prisma.shipment.update({
    where: { id: shipmentId },
    data: {
      dutiesEstimated: result.grandTotal,
    },
  });

  return result;
}
