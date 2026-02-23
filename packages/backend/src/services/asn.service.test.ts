import type { PrismaMock, PrismaModelMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('./document-number.service.js', () => ({
  generateDocumentNumber: vi.fn().mockResolvedValue('ASN-2026-001'),
}));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { generateDocumentNumber } from './document-number.service.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import {
  getAsns,
  getAsnById,
  createAsn,
  updateAsn,
  markInTransit,
  markArrived,
  receiveAsn,
  cancelAsn,
  getVarianceReport,
} from './asn.service.js';

const mockedGenDoc = generateDocumentNumber as ReturnType<typeof vi.fn>;

// ── Local createModelMock (not exported from prisma-mock) ────────────────

function createModelMock(): PrismaModelMock {
  return {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    upsert: vi.fn(),
    aggregate: vi.fn(),
  };
}

// ── Test data helpers ────────────────────────────────────────────────────

function makeAsn(overrides: Record<string, unknown> = {}) {
  return {
    id: 'asn-1',
    asnNumber: 'ASN-2026-001',
    supplierId: 'sup-1',
    warehouseId: 'wh-1',
    expectedArrival: new Date('2026-03-15'),
    actualArrival: null,
    carrierName: 'DHL',
    trackingNumber: 'TRK-001',
    purchaseOrderRef: 'PO-001',
    notes: 'Test ASN',
    status: 'pending',
    grnId: null,
    createdAt: new Date('2026-02-20'),
    updatedAt: new Date('2026-02-20'),
    supplier: { id: 'sup-1', supplierName: 'Acme Corp', supplierCode: 'SUP-001' },
    warehouse: { id: 'wh-1', warehouseName: 'Main Warehouse', warehouseCode: 'WH-001' },
    lines: [],
    _count: { lines: 0 },
    ...overrides,
  };
}

function makeAsnLine(overrides: Record<string, unknown> = {}) {
  return {
    id: 'line-1',
    asnId: 'asn-1',
    itemId: 'item-1',
    qtyExpected: 100,
    qtyReceived: null,
    lotNumber: 'LOT-001',
    expiryDate: new Date('2027-01-01'),
    item: { id: 'item-1', itemCode: 'ITM-001', itemDescription: 'Steel Pipe' },
    ...overrides,
  };
}

const defaultCreateDto = {
  supplierId: 'sup-1',
  warehouseId: 'wh-1',
  expectedArrival: '2026-03-15',
  carrierName: 'DHL',
  trackingNumber: 'TRK-001',
  purchaseOrderRef: 'PO-001',
  notes: 'Test ASN',
  lines: [
    { itemId: 'item-1', qtyExpected: 100, lotNumber: 'LOT-001', expiryDate: '2027-01-01' },
    { itemId: 'item-2', qtyExpected: 50 },
  ],
};

// ═════════════════════════════════════════════════════════════════════════

describe('asn.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    // Add models not in PrismaMock
    (mockPrisma as Record<string, unknown>).advanceShippingNotice = createModelMock();
    (mockPrisma as Record<string, unknown>).asnLine = createModelMock();
    // Re-wire $transaction to pass mockPrisma as tx
    mockPrisma.$transaction.mockImplementation(async (arg: unknown) => {
      if (typeof arg === 'function') return (arg as (tx: PrismaMock) => Promise<unknown>)(mockPrisma as PrismaMock);
      return Promise.all(arg as Promise<unknown>[]);
    });
    vi.clearAllMocks();
  });

  // ─── getAsns ──────────────────────────────────────────────────────────

  describe('getAsns', () => {
    const baseParams = { page: 1, pageSize: 10 };

    it('returns data and total', async () => {
      const rows = [makeAsn()];
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findMany.mockResolvedValue(rows);
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.count.mockResolvedValue(1);

      const result = await getAsns(baseParams);

      expect(result).toEqual({ data: rows, total: 1 });
    });

    it('applies status filter', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findMany.mockResolvedValue([]);
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.count.mockResolvedValue(0);

      await getAsns({ ...baseParams, status: 'pending' });

      const call = (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findMany.mock.calls[0][0];
      expect(call.where.status).toBe('pending');
    });

    it('applies warehouseId filter', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findMany.mockResolvedValue([]);
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.count.mockResolvedValue(0);

      await getAsns({ ...baseParams, warehouseId: 'wh-1' });

      const call = (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findMany.mock.calls[0][0];
      expect(call.where.warehouseId).toBe('wh-1');
    });

    it('applies supplierId filter', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findMany.mockResolvedValue([]);
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.count.mockResolvedValue(0);

      await getAsns({ ...baseParams, supplierId: 'sup-1' });

      const call = (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findMany.mock.calls[0][0];
      expect(call.where.supplierId).toBe('sup-1');
    });

    it('applies search filter to asnNumber, supplierName, trackingNumber, purchaseOrderRef', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findMany.mockResolvedValue([]);
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.count.mockResolvedValue(0);

      await getAsns({ ...baseParams, search: 'test' });

      const call = (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findMany.mock.calls[0][0];
      expect(call.where.OR).toEqual([
        { asnNumber: { contains: 'test', mode: 'insensitive' } },
        { supplier: { supplierName: { contains: 'test', mode: 'insensitive' } } },
        { trackingNumber: { contains: 'test', mode: 'insensitive' } },
        { purchaseOrderRef: { contains: 'test', mode: 'insensitive' } },
      ]);
    });

    it('applies pagination correctly', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findMany.mockResolvedValue([]);
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.count.mockResolvedValue(0);

      await getAsns({ page: 3, pageSize: 20 });

      const call = (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findMany.mock.calls[0][0];
      expect(call.skip).toBe(40); // (3-1) * 20
      expect(call.take).toBe(20);
    });

    it('does not set filters when not provided', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findMany.mockResolvedValue([]);
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.count.mockResolvedValue(0);

      await getAsns(baseParams);

      const call = (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findMany.mock.calls[0][0];
      expect(call.where.status).toBeUndefined();
      expect(call.where.warehouseId).toBeUndefined();
      expect(call.where.supplierId).toBeUndefined();
      expect(call.where.OR).toBeUndefined();
    });

    it('orders by createdAt descending', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findMany.mockResolvedValue([]);
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.count.mockResolvedValue(0);

      await getAsns(baseParams);

      const call = (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual({ createdAt: 'desc' });
    });
  });

  // ─── getAsnById ───────────────────────────────────────────────────────

  describe('getAsnById', () => {
    it('returns ASN with detail includes', async () => {
      const asn = makeAsn({ lines: [makeAsnLine()] });
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(asn);

      const result = await getAsnById('asn-1');

      expect(result).toEqual(asn);
      expect((mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'asn-1' } }),
      );
    });

    it('throws NotFoundError when ASN does not exist', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(null);

      await expect(getAsnById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─── createAsn ────────────────────────────────────────────────────────

  describe('createAsn', () => {
    it('creates an ASN with nested lines and status pending', async () => {
      const created = makeAsn({ lines: [makeAsnLine(), makeAsnLine({ id: 'line-2', itemId: 'item-2' })] });
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.create.mockResolvedValue(created);

      const result = await createAsn(defaultCreateDto);

      expect(result).toEqual(created);
      const call = (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.create.mock.calls[0][0];
      expect(call.data.status).toBe('pending');
      expect(call.data.lines.create).toHaveLength(2);
    });

    it('generates a document number', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.create.mockResolvedValue(makeAsn());

      await createAsn(defaultCreateDto);

      expect(mockedGenDoc).toHaveBeenCalledWith('asn');
    });

    it('converts expectedArrival to Date', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.create.mockResolvedValue(makeAsn());

      await createAsn(defaultCreateDto);

      const call = (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.create.mock.calls[0][0];
      expect(call.data.expectedArrival).toEqual(new Date('2026-03-15'));
    });

    it('converts line expiryDate to Date when provided', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.create.mockResolvedValue(makeAsn());

      await createAsn(defaultCreateDto);

      const call = (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.create.mock.calls[0][0];
      const lineWithExpiry = call.data.lines.create[0];
      expect(lineWithExpiry.expiryDate).toEqual(new Date('2027-01-01'));
    });

    it('sets expiryDate to null when not provided on a line', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.create.mockResolvedValue(makeAsn());

      await createAsn(defaultCreateDto);

      const call = (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.create.mock.calls[0][0];
      const lineWithoutExpiry = call.data.lines.create[1];
      expect(lineWithoutExpiry.expiryDate).toBeNull();
    });

    it('sets optional header fields to null when not provided', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.create.mockResolvedValue(makeAsn());

      await createAsn({
        supplierId: 'sup-1',
        warehouseId: 'wh-1',
        expectedArrival: '2026-03-15',
        lines: [{ itemId: 'item-1', qtyExpected: 10 }],
      });

      const call = (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.create.mock.calls[0][0];
      expect(call.data.carrierName).toBeNull();
      expect(call.data.trackingNumber).toBeNull();
      expect(call.data.purchaseOrderRef).toBeNull();
      expect(call.data.notes).toBeNull();
    });

    it('throws BusinessRuleError when lines array is empty', async () => {
      await expect(createAsn({ ...defaultCreateDto, lines: [] })).rejects.toThrow(BusinessRuleError);
      await expect(createAsn({ ...defaultCreateDto, lines: [] })).rejects.toThrow(
        'ASN must have at least one line item',
      );
    });

    it('sets lotNumber to null when not provided on a line', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.create.mockResolvedValue(makeAsn());

      await createAsn(defaultCreateDto);

      const call = (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.create.mock.calls[0][0];
      const lineWithoutLot = call.data.lines.create[1];
      expect(lineWithoutLot.lotNumber).toBeNull();
    });
  });

  // ─── updateAsn ────────────────────────────────────────────────────────

  describe('updateAsn', () => {
    it('updates a pending ASN successfully', async () => {
      const existing = makeAsn({ status: 'pending' });
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(existing);
      const updated = makeAsn({ notes: 'Updated notes' });
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.update.mockResolvedValue(updated);

      const result = await updateAsn('asn-1', { notes: 'Updated notes' });

      expect(result).toEqual(updated);
    });

    it('throws NotFoundError when ASN does not exist', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(null);

      await expect(updateAsn('nonexistent', { notes: 'x' })).rejects.toThrow(NotFoundError);
    });

    it('throws BusinessRuleError when ASN is not pending', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(
        makeAsn({ status: 'in_transit' }),
      );

      await expect(updateAsn('asn-1', { notes: 'x' })).rejects.toThrow(BusinessRuleError);
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(
        makeAsn({ status: 'in_transit' }),
      );
      await expect(updateAsn('asn-1', { notes: 'x' })).rejects.toThrow('Only pending ASNs can be updated');
    });

    it('deletes old lines and creates new ones when lines are provided', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(
        makeAsn({ status: 'pending' }),
      );
      (mockPrisma as Record<string, PrismaModelMock>).asnLine.deleteMany.mockResolvedValue({ count: 1 });
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.update.mockResolvedValue(makeAsn());

      const newLines = [{ itemId: 'item-3', qtyExpected: 200 }];
      await updateAsn('asn-1', { lines: newLines });

      expect((mockPrisma as Record<string, PrismaModelMock>).asnLine.deleteMany).toHaveBeenCalledWith({
        where: { asnId: 'asn-1' },
      });
      const updateCall = (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.update.mock.calls[0][0];
      expect(updateCall.data.lines.create).toHaveLength(1);
      expect(updateCall.data.lines.create[0].itemId).toBe('item-3');
    });

    it('does not delete old lines when lines are not provided', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(
        makeAsn({ status: 'pending' }),
      );
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.update.mockResolvedValue(makeAsn());

      await updateAsn('asn-1', { notes: 'Updated' });

      expect((mockPrisma as Record<string, PrismaModelMock>).asnLine.deleteMany).not.toHaveBeenCalled();
    });

    it('only spreads provided header fields into update data', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(
        makeAsn({ status: 'pending' }),
      );
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.update.mockResolvedValue(makeAsn());

      await updateAsn('asn-1', { carrierName: 'FedEx', trackingNumber: 'TRK-NEW' });

      const updateCall = (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.update.mock.calls[0][0];
      expect(updateCall.data.carrierName).toBe('FedEx');
      expect(updateCall.data.trackingNumber).toBe('TRK-NEW');
      // Fields not provided should not be in data
      expect(updateCall.data.supplierId).toBeUndefined();
      expect(updateCall.data.warehouseId).toBeUndefined();
    });

    it('converts expectedArrival to Date when provided', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(
        makeAsn({ status: 'pending' }),
      );
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.update.mockResolvedValue(makeAsn());

      await updateAsn('asn-1', { expectedArrival: '2026-06-01' });

      const updateCall = (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.update.mock.calls[0][0];
      expect(updateCall.data.expectedArrival).toEqual(new Date('2026-06-01'));
    });
  });

  // ─── markInTransit ────────────────────────────────────────────────────

  describe('markInTransit', () => {
    it('transitions pending ASN to in_transit', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(
        makeAsn({ status: 'pending' }),
      );
      const updated = makeAsn({ status: 'in_transit' });
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.update.mockResolvedValue(updated);

      const result = await markInTransit('asn-1');

      expect(result.status).toBe('in_transit');
      expect((mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'asn-1' },
          data: { status: 'in_transit' },
        }),
      );
    });

    it('throws NotFoundError when ASN does not exist', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(null);

      await expect(markInTransit('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('throws BusinessRuleError when ASN is not pending', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(
        makeAsn({ status: 'arrived' }),
      );

      await expect(markInTransit('asn-1')).rejects.toThrow(BusinessRuleError);
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(
        makeAsn({ status: 'arrived' }),
      );
      await expect(markInTransit('asn-1')).rejects.toThrow('Only pending ASNs can be marked as in transit');
    });

    it('throws BusinessRuleError when ASN is in_transit already', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(
        makeAsn({ status: 'in_transit' }),
      );

      await expect(markInTransit('asn-1')).rejects.toThrow(BusinessRuleError);
    });
  });

  // ─── markArrived ──────────────────────────────────────────────────────

  describe('markArrived', () => {
    it('transitions in_transit ASN to arrived', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(
        makeAsn({ status: 'in_transit' }),
      );
      const updated = makeAsn({ status: 'arrived', actualArrival: new Date() });
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.update.mockResolvedValue(updated);

      const result = await markArrived('asn-1');

      expect(result.status).toBe('arrived');
      const updateCall = (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.update.mock.calls[0][0];
      expect(updateCall.data.status).toBe('arrived');
      expect(updateCall.data.actualArrival).toBeInstanceOf(Date);
    });

    it('throws NotFoundError when ASN does not exist', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(null);

      await expect(markArrived('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('throws BusinessRuleError when ASN is not in_transit', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(
        makeAsn({ status: 'pending' }),
      );

      await expect(markArrived('asn-1')).rejects.toThrow(BusinessRuleError);
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(
        makeAsn({ status: 'pending' }),
      );
      await expect(markArrived('asn-1')).rejects.toThrow('Only in-transit ASNs can be marked as arrived');
    });

    it('throws BusinessRuleError when ASN is already arrived', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(
        makeAsn({ status: 'arrived' }),
      );

      await expect(markArrived('asn-1')).rejects.toThrow(BusinessRuleError);
    });
  });

  // ─── receiveAsn ───────────────────────────────────────────────────────

  describe('receiveAsn', () => {
    const asnWithLines = makeAsn({
      status: 'arrived',
      asnNumber: 'ASN-2026-001',
      lines: [
        makeAsnLine({ id: 'line-1', itemId: 'item-1', qtyExpected: 100 }),
        makeAsnLine({ id: 'line-2', itemId: 'item-2', qtyExpected: 50, lotNumber: null }),
      ],
    });

    beforeEach(() => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(asnWithLines);
      mockPrisma.item.findMany.mockResolvedValue([
        { id: 'item-1', uomId: 'uom-1' },
        { id: 'item-2', uomId: 'uom-2' },
      ]);
      mockPrisma.mrrv.create.mockResolvedValue({ id: 'grn-1' });
      (mockPrisma as Record<string, PrismaModelMock>).asnLine.updateMany.mockResolvedValue({ count: 2 });
      (mockPrisma as Record<string, PrismaModelMock>).asnLine.update.mockResolvedValue({});
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.update.mockResolvedValue(
        makeAsn({ status: 'received', grnId: 'grn-1' }),
      );
      mockedGenDoc.mockResolvedValue('GRN-2026-001');
    });

    it('creates a GRN (mrrv) from ASN lines', async () => {
      await receiveAsn('asn-1', 'user-1');

      expect(mockPrisma.mrrv.create).toHaveBeenCalledTimes(1);
      const call = mockPrisma.mrrv.create.mock.calls[0][0];
      expect(call.data.mrrvNumber).toBe('GRN-2026-001');
      expect(call.data.supplierId).toBe('sup-1');
      expect(call.data.warehouseId).toBe('wh-1');
      expect(call.data.receivedById).toBe('user-1');
      expect(call.data.status).toBe('draft');
      expect(call.data.poNumber).toBe('PO-001');
      expect(call.data.notes).toBe('Auto-created from ASN ASN-2026-001');
    });

    it('maps ASN lines to GRN lines with correct UOM', async () => {
      await receiveAsn('asn-1', 'user-1');

      const call = mockPrisma.mrrv.create.mock.calls[0][0];
      const grnLines = call.data.mrrvLines.create;
      expect(grnLines).toHaveLength(2);
      expect(grnLines[0]).toEqual(
        expect.objectContaining({
          itemId: 'item-1',
          qtyOrdered: 100,
          qtyReceived: 100,
          uomId: 'uom-1',
          condition: 'good',
          lotNumber: 'LOT-001',
        }),
      );
      expect(grnLines[1]).toEqual(
        expect.objectContaining({
          itemId: 'item-2',
          qtyOrdered: 50,
          qtyReceived: 50,
          uomId: 'uom-2',
          condition: 'good',
          lotNumber: null,
        }),
      );
    });

    it('generates a GRN document number', async () => {
      await receiveAsn('asn-1', 'user-1');

      expect(mockedGenDoc).toHaveBeenCalledWith('grn');
    });

    it('updates each ASN line qtyReceived to match qtyExpected', async () => {
      await receiveAsn('asn-1', 'user-1');

      expect((mockPrisma as Record<string, PrismaModelMock>).asnLine.update).toHaveBeenCalledTimes(2);
      expect((mockPrisma as Record<string, PrismaModelMock>).asnLine.update).toHaveBeenCalledWith({
        where: { id: 'line-1' },
        data: { qtyReceived: 100 },
      });
      expect((mockPrisma as Record<string, PrismaModelMock>).asnLine.update).toHaveBeenCalledWith({
        where: { id: 'line-2' },
        data: { qtyReceived: 50 },
      });
    });

    it('updates ASN status to received with grnId', async () => {
      await receiveAsn('asn-1', 'user-1');

      expect((mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'asn-1' },
          data: { status: 'received', grnId: 'grn-1' },
        }),
      );
    });

    it('returns asn, grnId, and grnNumber', async () => {
      const result = await receiveAsn('asn-1', 'user-1');

      expect(result.grnId).toBe('grn-1');
      expect(result.grnNumber).toBe('GRN-2026-001');
      expect(result.asn).toBeDefined();
    });

    it('throws NotFoundError when ASN does not exist', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(null);

      await expect(receiveAsn('nonexistent', 'user-1')).rejects.toThrow(NotFoundError);
    });

    it('throws BusinessRuleError when ASN is not arrived', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(
        makeAsn({ status: 'pending', lines: [makeAsnLine()] }),
      );

      await expect(receiveAsn('asn-1', 'user-1')).rejects.toThrow(BusinessRuleError);
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(
        makeAsn({ status: 'pending', lines: [makeAsnLine()] }),
      );
      await expect(receiveAsn('asn-1', 'user-1')).rejects.toThrow('Only arrived ASNs can be received');
    });

    it('falls back to itemId when item UOM is not found', async () => {
      mockPrisma.item.findMany.mockResolvedValue([]);

      await receiveAsn('asn-1', 'user-1');

      const call = mockPrisma.mrrv.create.mock.calls[0][0];
      const grnLines = call.data.mrrvLines.create;
      // When item not found in map, uomId falls back to line.itemId
      expect(grnLines[0].uomId).toBe('item-1');
      expect(grnLines[1].uomId).toBe('item-2');
    });

    it('sets poNumber to null when purchaseOrderRef is not set', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(
        makeAsn({
          status: 'arrived',
          purchaseOrderRef: null,
          lines: [makeAsnLine()],
        }),
      );

      await receiveAsn('asn-1', 'user-1');

      const call = mockPrisma.mrrv.create.mock.calls[0][0];
      expect(call.data.poNumber).toBeNull();
    });
  });

  // ─── cancelAsn ────────────────────────────────────────────────────────

  describe('cancelAsn', () => {
    it('cancels a pending ASN', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(
        makeAsn({ status: 'pending' }),
      );
      const updated = makeAsn({ status: 'cancelled' });
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.update.mockResolvedValue(updated);

      const result = await cancelAsn('asn-1');

      expect(result.status).toBe('cancelled');
    });

    it('cancels an in_transit ASN', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(
        makeAsn({ status: 'in_transit' }),
      );
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.update.mockResolvedValue(
        makeAsn({ status: 'cancelled' }),
      );

      const result = await cancelAsn('asn-1');

      expect(result.status).toBe('cancelled');
    });

    it('cancels an arrived ASN', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(
        makeAsn({ status: 'arrived' }),
      );
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.update.mockResolvedValue(
        makeAsn({ status: 'cancelled' }),
      );

      const result = await cancelAsn('asn-1');

      expect(result.status).toBe('cancelled');
    });

    it('throws NotFoundError when ASN does not exist', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(null);

      await expect(cancelAsn('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('throws BusinessRuleError when ASN is already received', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(
        makeAsn({ status: 'received' }),
      );

      await expect(cancelAsn('asn-1')).rejects.toThrow(BusinessRuleError);
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(
        makeAsn({ status: 'received' }),
      );
      await expect(cancelAsn('asn-1')).rejects.toThrow('Cannot cancel ASN in received status');
    });

    it('throws BusinessRuleError when ASN is already cancelled', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(
        makeAsn({ status: 'cancelled' }),
      );

      await expect(cancelAsn('asn-1')).rejects.toThrow(BusinessRuleError);
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(
        makeAsn({ status: 'cancelled' }),
      );
      await expect(cancelAsn('asn-1')).rejects.toThrow('Cannot cancel ASN in cancelled status');
    });
  });

  // ─── getVarianceReport ────────────────────────────────────────────────

  describe('getVarianceReport', () => {
    it('returns variance report with line-level calculations', async () => {
      const asn = makeAsn({
        asnNumber: 'ASN-2026-001',
        status: 'received',
        lines: [
          makeAsnLine({ id: 'line-1', qtyExpected: 100, qtyReceived: 90, lotNumber: 'LOT-A' }),
          makeAsnLine({
            id: 'line-2',
            itemId: 'item-2',
            qtyExpected: 50,
            qtyReceived: 55,
            lotNumber: null,
            item: { id: 'item-2', itemCode: 'ITM-002', itemDescription: 'Copper Wire' },
          }),
        ],
      });
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(asn);

      const result = await getVarianceReport('asn-1');

      expect(result.asnNumber).toBe('ASN-2026-001');
      expect(result.status).toBe('received');
      expect(result.lines).toHaveLength(2);

      // Line 1: received 90 of 100 = -10 variance, -10%
      expect(result.lines[0].qtyExpected).toBe(100);
      expect(result.lines[0].qtyReceived).toBe(90);
      expect(result.lines[0].variance).toBe(-10);
      expect(result.lines[0].variancePercent).toBe(-10);

      // Line 2: received 55 of 50 = +5 variance, +10%
      expect(result.lines[1].qtyExpected).toBe(50);
      expect(result.lines[1].qtyReceived).toBe(55);
      expect(result.lines[1].variance).toBe(5);
      expect(result.lines[1].variancePercent).toBe(10);
    });

    it('returns summary totals', async () => {
      const asn = makeAsn({
        status: 'received',
        lines: [
          makeAsnLine({ qtyExpected: 100, qtyReceived: 90 }),
          makeAsnLine({ id: 'line-2', qtyExpected: 200, qtyReceived: 210 }),
        ],
      });
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(asn);

      const result = await getVarianceReport('asn-1');

      expect(result.summary.totalExpected).toBe(300);
      expect(result.summary.totalReceived).toBe(300);
      expect(result.summary.totalVariance).toBe(0);
      expect(result.summary.totalVariancePercent).toBe(0);
    });

    it('treats null qtyReceived as 0', async () => {
      const asn = makeAsn({
        status: 'pending',
        lines: [makeAsnLine({ qtyExpected: 100, qtyReceived: null })],
      });
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(asn);

      const result = await getVarianceReport('asn-1');

      expect(result.lines[0].qtyReceived).toBe(0);
      expect(result.lines[0].variance).toBe(-100);
      expect(result.lines[0].variancePercent).toBe(-100);
      expect(result.summary.totalReceived).toBe(0);
      expect(result.summary.totalVariance).toBe(-100);
    });

    it('handles zero expected quantity without division error', async () => {
      const asn = makeAsn({
        lines: [makeAsnLine({ qtyExpected: 0, qtyReceived: 0 })],
      });
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(asn);

      const result = await getVarianceReport('asn-1');

      expect(result.lines[0].variancePercent).toBe(0);
      expect(result.summary.totalVariancePercent).toBe(0);
    });

    it('rounds variancePercent to 2 decimal places', async () => {
      const asn = makeAsn({
        lines: [makeAsnLine({ qtyExpected: 3, qtyReceived: 1 })],
      });
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(asn);

      const result = await getVarianceReport('asn-1');

      // (1 - 3) / 3 * 100 = -66.6666... => rounded to -66.67
      expect(result.lines[0].variancePercent).toBe(-66.67);
    });

    it('includes supplier and warehouse in report', async () => {
      const asn = makeAsn({
        supplier: { id: 'sup-1', supplierName: 'Acme Corp' },
        warehouse: { id: 'wh-1', warehouseName: 'Main Warehouse' },
        lines: [],
      });
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(asn);

      const result = await getVarianceReport('asn-1');

      expect(result.supplier).toEqual({ id: 'sup-1', supplierName: 'Acme Corp' });
      expect(result.warehouse).toEqual({ id: 'wh-1', warehouseName: 'Main Warehouse' });
    });

    it('throws NotFoundError when ASN does not exist', async () => {
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(null);

      await expect(getVarianceReport('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('includes lotNumber in line results', async () => {
      const asn = makeAsn({
        lines: [
          makeAsnLine({ qtyExpected: 10, qtyReceived: 10, lotNumber: 'BATCH-X' }),
          makeAsnLine({ id: 'line-2', qtyExpected: 5, qtyReceived: 5, lotNumber: null }),
        ],
      });
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(asn);

      const result = await getVarianceReport('asn-1');

      expect(result.lines[0].lotNumber).toBe('BATCH-X');
      expect(result.lines[1].lotNumber).toBeNull();
    });
  });

  // ─── Full state machine transitions ───────────────────────────────────

  describe('state machine', () => {
    it('supports full lifecycle: pending -> in_transit -> arrived -> received', async () => {
      // Step 1: pending -> in_transit
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(
        makeAsn({ status: 'pending' }),
      );
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.update.mockResolvedValue(
        makeAsn({ status: 'in_transit' }),
      );
      const r1 = await markInTransit('asn-1');
      expect(r1.status).toBe('in_transit');

      // Step 2: in_transit -> arrived
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(
        makeAsn({ status: 'in_transit' }),
      );
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.update.mockResolvedValue(
        makeAsn({ status: 'arrived' }),
      );
      const r2 = await markArrived('asn-1');
      expect(r2.status).toBe('arrived');

      // Step 3: arrived -> received
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(
        makeAsn({ status: 'arrived', lines: [makeAsnLine()] }),
      );
      mockPrisma.item.findMany.mockResolvedValue([{ id: 'item-1', uomId: 'uom-1' }]);
      mockPrisma.mrrv.create.mockResolvedValue({ id: 'grn-1' });
      (mockPrisma as Record<string, PrismaModelMock>).asnLine.updateMany.mockResolvedValue({ count: 1 });
      (mockPrisma as Record<string, PrismaModelMock>).asnLine.update.mockResolvedValue({});
      (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.update.mockResolvedValue(
        makeAsn({ status: 'received', grnId: 'grn-1' }),
      );
      const r3 = await receiveAsn('asn-1', 'user-1');
      expect(r3.asn.status).toBe('received');
      expect(r3.grnId).toBe('grn-1');
    });

    it('allows cancel from any non-terminal status', async () => {
      for (const status of ['pending', 'in_transit', 'arrived']) {
        (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(
          makeAsn({ status }),
        );
        (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.update.mockResolvedValue(
          makeAsn({ status: 'cancelled' }),
        );

        const result = await cancelAsn('asn-1');
        expect(result.status).toBe('cancelled');
      }
    });

    it('blocks cancel from terminal statuses', async () => {
      for (const status of ['received', 'cancelled']) {
        (mockPrisma as Record<string, PrismaModelMock>).advanceShippingNotice.findUnique.mockResolvedValue(
          makeAsn({ status }),
        );

        await expect(cancelAsn('asn-1')).rejects.toThrow(BusinessRuleError);
      }
    });
  });
});
