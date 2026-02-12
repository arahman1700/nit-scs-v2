import type { PrismaMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('./document-number.service.js', () => ({ generateDocumentNumber: vi.fn() }));
vi.mock('../config/logger.js', () => ({ log: vi.fn() }));
vi.mock('../events/event-bus.js', () => ({ eventBus: { publish: vi.fn(), subscribe: vi.fn() } }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { generateDocumentNumber } from './document-number.service.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import {
  list,
  getById,
  create,
  update,
  updateStatus,
  addCustomsStage,
  updateCustomsStage,
  deliver,
  cancel,
} from './shipment.service.js';

const mockedGenDoc = generateDocumentNumber as ReturnType<typeof vi.fn>;

// ── Helpers ──────────────────────────────────────────────────────────────

function makeShipment(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ship-1',
    shipmentNumber: 'SHP-2025-0001',
    poNumber: 'PO-001',
    supplierId: 'sup-1',
    freightForwarderId: null,
    projectId: 'proj-1',
    originCountry: 'China',
    modeOfShipment: 'sea',
    portOfLoading: null,
    portOfEntryId: null,
    destinationWarehouseId: 'wh-1',
    orderDate: new Date('2025-01-15'),
    expectedShipDate: null,
    actualShipDate: null,
    etaPort: null,
    actualArrivalDate: null,
    deliveryDate: null,
    status: 'draft',
    awbBlNumber: null,
    containerNumber: null,
    vesselFlight: null,
    trackingUrl: null,
    commercialValue: null,
    freightCost: null,
    insuranceCost: null,
    dutiesEstimated: null,
    description: null,
    notes: null,
    mrrvId: null,
    shipmentLines: [],
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════════

describe('shipment.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    vi.clearAllMocks();
  });

  // ─── list ────────────────────────────────────────────────────────────

  describe('list', () => {
    const baseParams = { skip: 0, pageSize: 10, sortBy: 'createdAt', sortDir: 'desc' as const };

    it('returns data and total', async () => {
      const rows = [makeShipment()];
      mockPrisma.shipment.findMany.mockResolvedValue(rows);
      mockPrisma.shipment.count.mockResolvedValue(1);

      const result = await list(baseParams);

      expect(result).toEqual({ data: rows, total: 1 });
    });

    it('applies search filter to shipmentNumber, awbBlNumber, containerNumber, supplierName', async () => {
      mockPrisma.shipment.findMany.mockResolvedValue([]);
      mockPrisma.shipment.count.mockResolvedValue(0);

      await list({ ...baseParams, search: 'test' });

      const call = mockPrisma.shipment.findMany.mock.calls[0][0];
      expect(call.where.OR).toEqual([
        { shipmentNumber: { contains: 'test', mode: 'insensitive' } },
        { awbBlNumber: { contains: 'test', mode: 'insensitive' } },
        { containerNumber: { contains: 'test', mode: 'insensitive' } },
        { supplier: { supplierName: { contains: 'test', mode: 'insensitive' } } },
      ]);
    });

    it('applies status filter', async () => {
      mockPrisma.shipment.findMany.mockResolvedValue([]);
      mockPrisma.shipment.count.mockResolvedValue(0);

      await list({ ...baseParams, status: 'in_transit' });

      const call = mockPrisma.shipment.findMany.mock.calls[0][0];
      expect(call.where.status).toBe('in_transit');
    });

    it('applies modeOfShipment filter', async () => {
      mockPrisma.shipment.findMany.mockResolvedValue([]);
      mockPrisma.shipment.count.mockResolvedValue(0);

      await list({ ...baseParams, modeOfShipment: 'air' });

      const call = mockPrisma.shipment.findMany.mock.calls[0][0];
      expect(call.where.modeOfShipment).toBe('air');
    });

    it('applies projectId scope filter', async () => {
      mockPrisma.shipment.findMany.mockResolvedValue([]);
      mockPrisma.shipment.count.mockResolvedValue(0);

      await list({ ...baseParams, projectId: 'proj-5' });

      const call = mockPrisma.shipment.findMany.mock.calls[0][0];
      expect(call.where.projectId).toBe('proj-5');
    });

    it('applies pagination and sorting', async () => {
      mockPrisma.shipment.findMany.mockResolvedValue([]);
      mockPrisma.shipment.count.mockResolvedValue(0);

      await list({ skip: 20, pageSize: 5, sortBy: 'shipmentNumber', sortDir: 'asc' });

      const call = mockPrisma.shipment.findMany.mock.calls[0][0];
      expect(call.skip).toBe(20);
      expect(call.take).toBe(5);
      expect(call.orderBy).toEqual({ shipmentNumber: 'asc' });
    });

    it('does not set search/status/projectId when not provided', async () => {
      mockPrisma.shipment.findMany.mockResolvedValue([]);
      mockPrisma.shipment.count.mockResolvedValue(0);

      await list(baseParams);

      const call = mockPrisma.shipment.findMany.mock.calls[0][0];
      expect(call.where.OR).toBeUndefined();
      expect(call.where.status).toBeUndefined();
      expect(call.where.projectId).toBeUndefined();
    });
  });

  // ─── getById ─────────────────────────────────────────────────────────

  describe('getById', () => {
    it('returns the shipment with detail includes', async () => {
      const shipment = makeShipment();
      mockPrisma.shipment.findUnique.mockResolvedValue(shipment);

      const result = await getById('ship-1');

      expect(result).toEqual(shipment);
      expect(mockPrisma.shipment.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'ship-1' } }));
    });

    it('throws NotFoundError when shipment does not exist', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(null);

      await expect(getById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─── create ──────────────────────────────────────────────────────────

  describe('create', () => {
    const headerData = {
      supplierId: 'sup-1',
      modeOfShipment: 'sea',
      poNumber: 'PO-100',
      originCountry: 'Germany',
    };

    const lines = [
      { description: 'Steel beams', quantity: 100, itemId: 'item-1', uomId: 'uom-1', unitValue: 50 },
      { description: 'Bolts', quantity: 500, unitValue: 2 },
    ];

    it('generates a document number', async () => {
      mockedGenDoc.mockResolvedValue('SHP-2025-0042');
      mockPrisma.shipment.create.mockResolvedValue(makeShipment({ shipmentNumber: 'SHP-2025-0042' }));

      await create(headerData, lines);

      expect(mockedGenDoc).toHaveBeenCalledWith('shipment');
    });

    it('creates shipment with nested shipmentLines', async () => {
      mockedGenDoc.mockResolvedValue('SHP-2025-0043');
      mockPrisma.shipment.create.mockResolvedValue(makeShipment());

      await create(headerData, lines);

      const call = mockPrisma.shipment.create.mock.calls[0][0];
      expect(call.data.shipmentLines.create).toHaveLength(2);
      expect(call.data.shipmentLines.create[0]).toEqual(
        expect.objectContaining({
          itemId: 'item-1',
          description: 'Steel beams',
          quantity: 100,
          uomId: 'uom-1',
          unitValue: 50,
        }),
      );
    });

    it('sets status to draft', async () => {
      mockedGenDoc.mockResolvedValue('SHP-2025-0044');
      mockPrisma.shipment.create.mockResolvedValue(makeShipment());

      await create(headerData, lines);

      const call = mockPrisma.shipment.create.mock.calls[0][0];
      expect(call.data.status).toBe('draft');
    });

    it('maps optional null fields correctly', async () => {
      mockedGenDoc.mockResolvedValue('SHP-2025-0045');
      mockPrisma.shipment.create.mockResolvedValue(makeShipment());

      await create({ supplierId: 'sup-1', modeOfShipment: 'air' }, lines);

      const call = mockPrisma.shipment.create.mock.calls[0][0];
      expect(call.data.poNumber).toBeNull();
      expect(call.data.freightForwarderId).toBeNull();
      expect(call.data.originCountry).toBeNull();
      expect(call.data.awbBlNumber).toBeNull();
      expect(call.data.containerNumber).toBeNull();
    });

    it('converts orderDate and expectedShipDate to Date objects', async () => {
      mockedGenDoc.mockResolvedValue('SHP-2025-0046');
      mockPrisma.shipment.create.mockResolvedValue(makeShipment());

      await create({ ...headerData, orderDate: '2025-03-01', expectedShipDate: '2025-04-01' }, lines);

      const call = mockPrisma.shipment.create.mock.calls[0][0];
      expect(call.data.orderDate).toEqual(new Date('2025-03-01'));
      expect(call.data.expectedShipDate).toEqual(new Date('2025-04-01'));
    });
  });

  // ─── update ──────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates a shipment successfully', async () => {
      const existing = makeShipment();
      mockPrisma.shipment.findUnique.mockResolvedValue(existing);
      const updated = { ...existing, notes: 'Updated' };
      mockPrisma.shipment.update.mockResolvedValue(updated);

      const result = await update('ship-1', { notes: 'Updated' });

      expect(result).toEqual({ existing, updated });
    });

    it('throws NotFoundError when shipment does not exist', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(null);

      await expect(update('nonexistent', { notes: 'x' })).rejects.toThrow(NotFoundError);
    });

    it('transforms date fields to Date objects', async () => {
      const existing = makeShipment();
      mockPrisma.shipment.findUnique.mockResolvedValue(existing);
      mockPrisma.shipment.update.mockResolvedValue(existing);

      await update('ship-1', {
        orderDate: '2025-03-01',
        expectedShipDate: '2025-04-01',
        actualShipDate: '2025-04-05',
        etaPort: '2025-05-01',
        actualArrivalDate: '2025-05-10',
      });

      const call = mockPrisma.shipment.update.mock.calls[0][0];
      expect(call.data.orderDate).toEqual(new Date('2025-03-01'));
      expect(call.data.expectedShipDate).toEqual(new Date('2025-04-01'));
      expect(call.data.actualShipDate).toEqual(new Date('2025-04-05'));
      expect(call.data.etaPort).toEqual(new Date('2025-05-01'));
      expect(call.data.actualArrivalDate).toEqual(new Date('2025-05-10'));
    });
  });

  // ─── updateStatus ────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('updates status on an existing shipment', async () => {
      const existing = makeShipment();
      mockPrisma.shipment.findUnique.mockResolvedValue(existing);
      const updated = { ...existing, status: 'in_transit' };
      mockPrisma.shipment.update.mockResolvedValue(updated);

      const result = await updateStatus('ship-1', 'in_transit', {});

      expect(result).toEqual({ existing, updated });
      expect(mockPrisma.shipment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ship-1' },
          data: { status: 'in_transit' },
        }),
      );
    });

    it('throws NotFoundError when shipment does not exist', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(null);

      await expect(updateStatus('nonexistent', 'in_transit', {})).rejects.toThrow(NotFoundError);
    });

    it('includes extra date fields when provided', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment());
      mockPrisma.shipment.update.mockResolvedValue(makeShipment());

      await updateStatus('ship-1', 'in_transit', {
        actualShipDate: '2025-04-05',
        etaPort: '2025-05-01',
        actualArrivalDate: '2025-05-10',
      });

      const call = mockPrisma.shipment.update.mock.calls[0][0];
      expect(call.data.actualShipDate).toEqual(new Date('2025-04-05'));
      expect(call.data.etaPort).toEqual(new Date('2025-05-01'));
      expect(call.data.actualArrivalDate).toEqual(new Date('2025-05-10'));
    });

    it('does not include date fields when not provided', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment());
      mockPrisma.shipment.update.mockResolvedValue(makeShipment());

      await updateStatus('ship-1', 'in_transit', {});

      const call = mockPrisma.shipment.update.mock.calls[0][0];
      expect(call.data.actualShipDate).toBeUndefined();
      expect(call.data.etaPort).toBeUndefined();
      expect(call.data.actualArrivalDate).toBeUndefined();
    });
  });

  // ─── addCustomsStage ─────────────────────────────────────────────────

  describe('addCustomsStage', () => {
    it('throws NotFoundError when shipment does not exist', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(null);

      await expect(
        addCustomsStage('nonexistent', { stage: 'docs_submitted', stageDate: '2025-05-01' }),
      ).rejects.toThrow(NotFoundError);
    });

    it('creates a customs tracking record', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: 'at_port' }));
      mockPrisma.customsTracking.create.mockResolvedValue({ id: 'ct-1' });
      mockPrisma.shipment.update.mockResolvedValue({});

      await addCustomsStage('ship-1', {
        stage: 'docs_submitted',
        stageDate: '2025-05-01',
        customsDeclaration: 'DEC-001',
      });

      const call = mockPrisma.customsTracking.create.mock.calls[0][0];
      expect(call.data.shipmentId).toBe('ship-1');
      expect(call.data.stage).toBe('docs_submitted');
      expect(call.data.stageDate).toEqual(new Date('2025-05-01'));
      expect(call.data.customsDeclaration).toBe('DEC-001');
    });

    it('updates shipment status to customs_clearing for clearing stages', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: 'at_port' }));
      mockPrisma.customsTracking.create.mockResolvedValue({ id: 'ct-1' });
      mockPrisma.shipment.update.mockResolvedValue({});

      await addCustomsStage('ship-1', { stage: 'docs_submitted', stageDate: '2025-05-01' });

      expect(mockPrisma.shipment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ship-1' },
          data: { status: 'customs_clearing' },
        }),
      );
    });

    it('updates shipment status to cleared when stage is released', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: 'customs_clearing' }));
      mockPrisma.customsTracking.create.mockResolvedValue({ id: 'ct-1' });
      mockPrisma.shipment.update.mockResolvedValue({});

      const result = await addCustomsStage('ship-1', { stage: 'released', stageDate: '2025-05-15' });

      expect(mockPrisma.shipment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'cleared' },
        }),
      );
      expect(result.newShipmentStatus).toBe('cleared');
    });

    it('does not update shipment status when already at the mapped status', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: 'customs_clearing' }));
      mockPrisma.customsTracking.create.mockResolvedValue({ id: 'ct-1' });

      await addCustomsStage('ship-1', { stage: 'under_inspection', stageDate: '2025-05-02' });

      expect(mockPrisma.shipment.update).not.toHaveBeenCalled();
    });

    it('does not update shipment status for unmapped stages', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: 'at_port' }));
      mockPrisma.customsTracking.create.mockResolvedValue({ id: 'ct-1' });

      await addCustomsStage('ship-1', { stage: 'some_unknown_stage', stageDate: '2025-05-02' });

      expect(mockPrisma.shipment.update).not.toHaveBeenCalled();
    });
  });

  // ─── updateCustomsStage ──────────────────────────────────────────────

  describe('updateCustomsStage', () => {
    it('throws NotFoundError when customs tracking not found', async () => {
      mockPrisma.customsTracking.findFirst.mockResolvedValue(null);

      await expect(updateCustomsStage('ship-1', 'ct-999', {})).rejects.toThrow(NotFoundError);
    });

    it('updates customs tracking with partial fields', async () => {
      const existing = { id: 'ct-1', shipmentId: 'ship-1', stage: 'docs_submitted' };
      mockPrisma.customsTracking.findFirst.mockResolvedValue(existing);
      const updated = { ...existing, customsRef: 'REF-123' };
      mockPrisma.customsTracking.update.mockResolvedValue(updated);

      const result = await updateCustomsStage('ship-1', 'ct-1', { customsRef: 'REF-123' });

      expect(result).toEqual({ existing, updated });
      expect(mockPrisma.customsTracking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ct-1' },
          data: expect.objectContaining({ customsRef: 'REF-123' }),
        }),
      );
    });

    it('sets stageEndDate when resolution is provided', async () => {
      const existing = { id: 'ct-1', shipmentId: 'ship-1', stage: 'under_inspection' };
      mockPrisma.customsTracking.findFirst.mockResolvedValue(existing);
      mockPrisma.customsTracking.update.mockResolvedValue(existing);

      await updateCustomsStage('ship-1', 'ct-1', { resolution: 'Resolved' });

      const call = mockPrisma.customsTracking.update.mock.calls[0][0];
      expect(call.data.resolution).toBe('Resolved');
      expect(call.data.stageEndDate).toBeInstanceOf(Date);
    });
  });

  // ─── deliver ─────────────────────────────────────────────────────────

  describe('deliver', () => {
    it('throws NotFoundError when shipment does not exist', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(null);

      await expect(deliver('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('throws BusinessRuleError when status is not deliverable', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: 'draft' }));

      await expect(deliver('ship-1')).rejects.toThrow(BusinessRuleError);
    });

    it('delivers from cleared status', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: 'cleared' }));
      const updated = makeShipment({ status: 'delivered' });
      mockPrisma.shipment.update.mockResolvedValue(updated);

      const result = await deliver('ship-1');

      expect(result.status).toBe('delivered');
      expect(mockPrisma.shipment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'delivered',
            deliveryDate: expect.any(Date),
          }),
        }),
      );
    });

    it('delivers from in_delivery status', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: 'in_delivery' }));
      mockPrisma.shipment.update.mockResolvedValue(makeShipment({ status: 'delivered' }));

      const result = await deliver('ship-1');

      expect(result.status).toBe('delivered');
    });

    it('updates MRRV to received when mrrvId is present', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: 'cleared', mrrvId: 'mrrv-1' }));
      mockPrisma.shipment.update.mockResolvedValue(makeShipment({ status: 'delivered' }));
      mockPrisma.mrrv.update.mockResolvedValue({});

      await deliver('ship-1');

      expect(mockPrisma.mrrv.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mrrv-1' },
          data: { status: 'received' },
        }),
      );
    });

    it('does not attempt MRRV update when mrrvId is null', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: 'cleared', mrrvId: null }));
      mockPrisma.shipment.update.mockResolvedValue(makeShipment({ status: 'delivered' }));

      await deliver('ship-1');

      expect(mockPrisma.mrrv.update).not.toHaveBeenCalled();
    });

    it('catches MRRV update errors silently', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: 'cleared', mrrvId: 'mrrv-1' }));
      mockPrisma.shipment.update.mockResolvedValue(makeShipment({ status: 'delivered' }));
      mockPrisma.mrrv.update.mockRejectedValue(new Error('MRRV not found'));

      await expect(deliver('ship-1')).resolves.toBeDefined();
    });
  });

  // ─── cancel ──────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('throws NotFoundError when shipment does not exist', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(null);

      await expect(cancel('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('throws BusinessRuleError when status is delivered', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: 'delivered' }));

      await expect(cancel('ship-1')).rejects.toThrow(BusinessRuleError);
    });

    it('throws BusinessRuleError when status is already cancelled', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: 'cancelled' }));

      await expect(cancel('ship-1')).rejects.toThrow(BusinessRuleError);
    });

    it('cancels from a valid status', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: 'draft' }));
      const updated = makeShipment({ status: 'cancelled' });
      mockPrisma.shipment.update.mockResolvedValue(updated);

      const result = await cancel('ship-1');

      expect(result.status).toBe('cancelled');
      expect(mockPrisma.shipment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ship-1' },
          data: { status: 'cancelled' },
        }),
      );
    });

    it('cancels from in_transit status', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment({ status: 'in_transit' }));
      mockPrisma.shipment.update.mockResolvedValue(makeShipment({ status: 'cancelled' }));

      const result = await cancel('ship-1');

      expect(result.status).toBe('cancelled');
    });
  });
});
