import type { PrismaMock } from '../../../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../../../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../config/logger.js', () => ({ log: vi.fn() }));

import { Prisma } from '@prisma/client';
import { createPrismaMock } from '../../../test-utils/prisma-mock.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import {
  listTariffRates,
  getTariffRateById,
  createTariffRate,
  updateTariffRate,
  calculateDuties,
  applyToShipment,
} from './tariff.service.js';

// ── Helpers ──────────────────────────────────────────────────────────────

const USER_ID = 'user-1';
const TARIFF_ID = 'tariff-1';
const SHIPMENT_ID = 'ship-1';

function makeTariffRate(overrides: Record<string, unknown> = {}) {
  return {
    id: TARIFF_ID,
    hsCode: '7308.90',
    description: 'Steel structures',
    dutyRate: new Prisma.Decimal('0.05'),
    vatRate: new Prisma.Decimal('0.15'),
    exemptionCode: null,
    exemptionDescription: null,
    country: 'Saudi Arabia',
    effectiveFrom: new Date('2024-01-01'),
    effectiveUntil: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeShipment(overrides: Record<string, unknown> = {}) {
  return {
    id: SHIPMENT_ID,
    shipmentNumber: 'SHP-2025-0001',
    status: 'in_transit',
    shipmentLines: [],
    ...overrides,
  };
}

function makeShipmentLine(overrides: Record<string, unknown> = {}) {
  return {
    id: 'line-1',
    description: 'Steel plates',
    hsCode: '7308.90',
    quantity: 100,
    unitValue: new Prisma.Decimal('50'),
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════════

describe('tariff.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    vi.clearAllMocks();
  });

  // ─── listTariffRates ────────────────────────────────────────────────

  describe('listTariffRates', () => {
    const baseParams = { skip: 0, pageSize: 10, sortBy: 'updatedAt', sortDir: 'desc' as const };

    it('returns data and total', async () => {
      const rows = [makeTariffRate()];
      mockPrisma.tariffRate.findMany.mockResolvedValue(rows);
      mockPrisma.tariffRate.count.mockResolvedValue(1);

      const result = await listTariffRates(baseParams);

      expect(result).toEqual({ data: rows, total: 1 });
    });

    it('applies search filter across hsCode, description, exemptionCode, country', async () => {
      mockPrisma.tariffRate.findMany.mockResolvedValue([]);
      mockPrisma.tariffRate.count.mockResolvedValue(0);

      await listTariffRates({ ...baseParams, search: '7308' });

      const call = mockPrisma.tariffRate.findMany.mock.calls[0][0];
      expect(call.where.OR).toHaveLength(4);
      expect(call.where.OR[0]).toEqual({ hsCode: { contains: '7308', mode: 'insensitive' } });
    });

    it('applies isActive filter as boolean from string', async () => {
      mockPrisma.tariffRate.findMany.mockResolvedValue([]);
      mockPrisma.tariffRate.count.mockResolvedValue(0);

      await listTariffRates({ ...baseParams, isActive: 'true' });

      const call = mockPrisma.tariffRate.findMany.mock.calls[0][0];
      expect(call.where.isActive).toBe(true);
    });

    it('applies country filter', async () => {
      mockPrisma.tariffRate.findMany.mockResolvedValue([]);
      mockPrisma.tariffRate.count.mockResolvedValue(0);

      await listTariffRates({ ...baseParams, country: 'Saudi Arabia' });

      const call = mockPrisma.tariffRate.findMany.mock.calls[0][0];
      expect(call.where.country).toBe('Saudi Arabia');
    });

    it('applies hsCode prefix filter with startsWith', async () => {
      mockPrisma.tariffRate.findMany.mockResolvedValue([]);
      mockPrisma.tariffRate.count.mockResolvedValue(0);

      await listTariffRates({ ...baseParams, hsCode: '7308' });

      const call = mockPrisma.tariffRate.findMany.mock.calls[0][0];
      expect(call.where.hsCode).toEqual({ startsWith: '7308' });
    });

    it('applies pagination and sorting', async () => {
      mockPrisma.tariffRate.findMany.mockResolvedValue([]);
      mockPrisma.tariffRate.count.mockResolvedValue(0);

      await listTariffRates({ skip: 20, pageSize: 5, sortBy: 'hsCode', sortDir: 'asc' });

      const call = mockPrisma.tariffRate.findMany.mock.calls[0][0];
      expect(call.skip).toBe(20);
      expect(call.take).toBe(5);
      expect(call.orderBy).toEqual({ hsCode: 'asc' });
    });
  });

  // ─── getTariffRateById ──────────────────────────────────────────────

  describe('getTariffRateById', () => {
    it('returns the tariff rate', async () => {
      const rate = makeTariffRate();
      mockPrisma.tariffRate.findUnique.mockResolvedValue(rate);

      const result = await getTariffRateById(TARIFF_ID);

      expect(result).toEqual(rate);
    });

    it('throws NotFoundError when not found', async () => {
      mockPrisma.tariffRate.findUnique.mockResolvedValue(null);

      await expect(getTariffRateById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─── createTariffRate ───────────────────────────────────────────────

  describe('createTariffRate', () => {
    const createDto = {
      hsCode: '7308.90',
      description: 'Steel structures',
      dutyRate: 0.05,
      vatRate: 0.15,
      effectiveFrom: '2024-01-01',
    };

    it('creates a tariff rate with correct data', async () => {
      const created = makeTariffRate();
      mockPrisma.tariffRate.create.mockResolvedValue(created);

      const result = await createTariffRate(createDto, USER_ID);

      expect(result).toEqual(created);
      const call = mockPrisma.tariffRate.create.mock.calls[0][0];
      expect(call.data.hsCode).toBe('7308.90');
      expect(call.data.effectiveFrom).toEqual(new Date('2024-01-01'));
    });

    it('defaults country to Saudi Arabia when not provided', async () => {
      mockPrisma.tariffRate.create.mockResolvedValue(makeTariffRate());

      await createTariffRate(createDto, USER_ID);

      const call = mockPrisma.tariffRate.create.mock.calls[0][0];
      expect(call.data.country).toBe('Saudi Arabia');
    });

    it('defaults isActive to true when not provided', async () => {
      mockPrisma.tariffRate.create.mockResolvedValue(makeTariffRate());

      await createTariffRate(createDto, USER_ID);

      const call = mockPrisma.tariffRate.create.mock.calls[0][0];
      expect(call.data.isActive).toBe(true);
    });

    it('sets optional fields to null when not provided', async () => {
      mockPrisma.tariffRate.create.mockResolvedValue(makeTariffRate());

      await createTariffRate(createDto, USER_ID);

      const call = mockPrisma.tariffRate.create.mock.calls[0][0];
      expect(call.data.exemptionCode).toBeNull();
      expect(call.data.exemptionDescription).toBeNull();
      expect(call.data.effectiveUntil).toBeNull();
    });

    it('converts effectiveUntil to Date when provided', async () => {
      mockPrisma.tariffRate.create.mockResolvedValue(makeTariffRate());

      await createTariffRate({ ...createDto, effectiveUntil: '2025-12-31' }, USER_ID);

      const call = mockPrisma.tariffRate.create.mock.calls[0][0];
      expect(call.data.effectiveUntil).toEqual(new Date('2025-12-31'));
    });
  });

  // ─── updateTariffRate ───────────────────────────────────────────────

  describe('updateTariffRate', () => {
    it('updates an existing tariff rate', async () => {
      mockPrisma.tariffRate.findUnique.mockResolvedValue(makeTariffRate());
      const updated = makeTariffRate({ description: 'Updated' });
      mockPrisma.tariffRate.update.mockResolvedValue(updated);

      const result = await updateTariffRate(TARIFF_ID, { description: 'Updated' });

      expect(result).toEqual(updated);
    });

    it('throws NotFoundError when not found', async () => {
      mockPrisma.tariffRate.findUnique.mockResolvedValue(null);

      await expect(updateTariffRate('nonexistent', { description: 'x' })).rejects.toThrow(NotFoundError);
    });

    it('converts effectiveFrom date string', async () => {
      mockPrisma.tariffRate.findUnique.mockResolvedValue(makeTariffRate());
      mockPrisma.tariffRate.update.mockResolvedValue(makeTariffRate());

      await updateTariffRate(TARIFF_ID, { effectiveFrom: '2025-06-01' });

      const call = mockPrisma.tariffRate.update.mock.calls[0][0];
      expect(call.data.effectiveFrom).toEqual(new Date('2025-06-01'));
    });

    it('sets effectiveUntil to null when explicitly null', async () => {
      mockPrisma.tariffRate.findUnique.mockResolvedValue(makeTariffRate());
      mockPrisma.tariffRate.update.mockResolvedValue(makeTariffRate());

      await updateTariffRate(TARIFF_ID, { effectiveUntil: null });

      const call = mockPrisma.tariffRate.update.mock.calls[0][0];
      expect(call.data.effectiveUntil).toBeNull();
    });
  });

  // ─── calculateDuties ────────────────────────────────────────────────

  describe('calculateDuties', () => {
    it('calculates duties and VAT for shipment lines with matching tariff', async () => {
      const line = makeShipmentLine({
        id: 'line-1',
        hsCode: '7308.90',
        quantity: 100,
        unitValue: new Prisma.Decimal('50'),
      });
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment({ shipmentLines: [line] }));
      mockPrisma.tariffRate.findMany.mockResolvedValue([makeTariffRate()]);

      const result = await calculateDuties(SHIPMENT_ID);

      expect(result.shipmentId).toBe(SHIPMENT_ID);
      expect(result.lineBreakdown).toHaveLength(1);
      // lineValue = 100 * 50 = 5000
      // dutyAmount = 5000 * 0.05 = 250
      // vatAmount = (5000 + 250) * 0.15 = 787.5
      expect(result.lineBreakdown[0].lineValue).toBe(5000);
      expect(result.lineBreakdown[0].dutyAmount).toBe(250);
      expect(result.lineBreakdown[0].vatAmount).toBe(787.5);
      expect(result.totalDuties).toBe(250);
      expect(result.totalVat).toBe(787.5);
      expect(result.grandTotal).toBe(1037.5);
    });

    it('applies default 15% VAT for lines without matching tariff', async () => {
      const line = makeShipmentLine({ hsCode: '9999.99', quantity: 10, unitValue: new Prisma.Decimal('100') });
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment({ shipmentLines: [line] }));
      mockPrisma.tariffRate.findMany.mockResolvedValue([]); // no matching tariff

      const result = await calculateDuties(SHIPMENT_ID);

      // lineValue = 10 * 100 = 1000
      // dutyAmount = 0 (no tariff)
      // vatAmount = 1000 * 0.15 = 150
      expect(result.lineBreakdown[0].dutyRate).toBe(0);
      expect(result.lineBreakdown[0].vatRate).toBe(0.15);
      expect(result.lineBreakdown[0].dutyAmount).toBe(0);
      expect(result.lineBreakdown[0].vatAmount).toBe(150);
    });

    it('applies default VAT for lines without hsCode', async () => {
      const line = makeShipmentLine({ hsCode: null, quantity: 5, unitValue: new Prisma.Decimal('200') });
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment({ shipmentLines: [line] }));
      mockPrisma.tariffRate.findMany.mockResolvedValue([]);

      const result = await calculateDuties(SHIPMENT_ID);

      // lineValue = 5 * 200 = 1000
      expect(result.lineBreakdown[0].lineValue).toBe(1000);
      expect(result.lineBreakdown[0].dutyAmount).toBe(0);
      expect(result.lineBreakdown[0].vatRate).toBe(0.15);
    });

    it('throws NotFoundError when shipment does not exist', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(null);

      await expect(calculateDuties('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('throws BusinessRuleError when shipment has no line items', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment({ shipmentLines: [] }));

      await expect(calculateDuties(SHIPMENT_ID)).rejects.toThrow(BusinessRuleError);
    });

    it('handles multiple lines with different HS codes', async () => {
      const line1 = makeShipmentLine({
        id: 'line-1',
        hsCode: '7308.90',
        quantity: 10,
        unitValue: new Prisma.Decimal('100'),
      });
      const line2 = makeShipmentLine({
        id: 'line-2',
        hsCode: '8501.10',
        quantity: 5,
        unitValue: new Prisma.Decimal('200'),
      });
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment({ shipmentLines: [line1, line2] }));
      mockPrisma.tariffRate.findMany.mockResolvedValue([
        makeTariffRate({
          id: 't1',
          hsCode: '7308.90',
          dutyRate: new Prisma.Decimal('0.05'),
          vatRate: new Prisma.Decimal('0.15'),
        }),
        makeTariffRate({
          id: 't2',
          hsCode: '8501.10',
          dutyRate: new Prisma.Decimal('0.10'),
          vatRate: new Prisma.Decimal('0.15'),
        }),
      ]);

      const result = await calculateDuties(SHIPMENT_ID);

      expect(result.lineBreakdown).toHaveLength(2);
      expect(result.lineBreakdown[0].tariffRateId).toBe('t1');
      expect(result.lineBreakdown[1].tariffRateId).toBe('t2');
    });

    it('handles lines with zero unitValue', async () => {
      const line = makeShipmentLine({ unitValue: null, quantity: 10 });
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment({ shipmentLines: [line] }));
      mockPrisma.tariffRate.findMany.mockResolvedValue([]);

      const result = await calculateDuties(SHIPMENT_ID);

      expect(result.lineBreakdown[0].lineValue).toBe(0);
      expect(result.lineBreakdown[0].dutyAmount).toBe(0);
      expect(result.lineBreakdown[0].vatAmount).toBe(0);
      expect(result.grandTotal).toBe(0);
    });

    it('does not query tariff rates when no lines have HS codes', async () => {
      const line = makeShipmentLine({ hsCode: null });
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment({ shipmentLines: [line] }));

      await calculateDuties(SHIPMENT_ID);

      expect(mockPrisma.tariffRate.findMany).not.toHaveBeenCalled();
    });

    it('includes exemptionCode from tariff in line breakdown', async () => {
      const line = makeShipmentLine({ hsCode: '7308.90' });
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment({ shipmentLines: [line] }));
      mockPrisma.tariffRate.findMany.mockResolvedValue([makeTariffRate({ exemptionCode: 'EXM-001' })]);

      const result = await calculateDuties(SHIPMENT_ID);

      expect(result.lineBreakdown[0].exemptionCode).toBe('EXM-001');
    });
  });

  // ─── applyToShipment ────────────────────────────────────────────────

  describe('applyToShipment', () => {
    it('calculates duties and persists grandTotal to shipment', async () => {
      const line = makeShipmentLine({ quantity: 10, unitValue: new Prisma.Decimal('100') });
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment({ shipmentLines: [line] }));
      mockPrisma.tariffRate.findMany.mockResolvedValue([makeTariffRate()]);
      mockPrisma.shipment.update.mockResolvedValue({});

      const result = await applyToShipment(SHIPMENT_ID);

      expect(mockPrisma.shipment.update).toHaveBeenCalledWith({
        where: { id: SHIPMENT_ID },
        data: { dutiesEstimated: result.grandTotal },
      });
      expect(result.grandTotal).toBeGreaterThan(0);
    });
  });
});
