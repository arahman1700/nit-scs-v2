import type { PrismaMock } from '../../../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../../../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../../config/logger.js', () => ({ log: vi.fn() }));
vi.mock('../../../events/event-bus.js', () => ({ eventBus: { publish: vi.fn(), subscribe: vi.fn() } }));

import { createPrismaMock } from '../../../test-utils/prisma-mock.js';
import { eventBus } from '../../../events/event-bus.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import {
  listByShipment,
  getById,
  create,
  update,
  verify,
  reject,
  getCompleteness,
} from './customs-document.service.js';

const mockedEventBus = eventBus as { publish: ReturnType<typeof vi.fn> };

// ── Helpers ──────────────────────────────────────────────────────────────

const USER_ID = 'user-1';
const DOC_ID = 'cd-1';
const SHIPMENT_ID = 'ship-1';

function makeCustomsDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: DOC_ID,
    shipmentId: SHIPMENT_ID,
    documentType: 'bill_of_lading',
    documentNumber: 'BOL-001',
    issueDate: new Date('2025-01-15'),
    expiryDate: null,
    status: 'pending',
    filePath: null,
    notes: null,
    verifiedById: null,
    verifiedAt: null,
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
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════════

describe('customs-document.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    vi.clearAllMocks();
  });

  // ─── listByShipment ─────────────────────────────────────────────────

  describe('listByShipment', () => {
    const baseParams = { page: 1, pageSize: 10, shipmentId: SHIPMENT_ID };

    it('returns data and total for a shipment', async () => {
      const rows = [makeCustomsDoc()];
      mockPrisma.customsDocument.findMany.mockResolvedValue(rows);
      mockPrisma.customsDocument.count.mockResolvedValue(1);

      const result = await listByShipment(baseParams);

      expect(result).toEqual({ data: rows, total: 1 });
    });

    it('applies status filter when provided', async () => {
      mockPrisma.customsDocument.findMany.mockResolvedValue([]);
      mockPrisma.customsDocument.count.mockResolvedValue(0);

      await listByShipment({ ...baseParams, status: 'verified' });

      const call = mockPrisma.customsDocument.findMany.mock.calls[0][0];
      expect(call.where.status).toBe('verified');
    });

    it('applies documentType filter when provided', async () => {
      mockPrisma.customsDocument.findMany.mockResolvedValue([]);
      mockPrisma.customsDocument.count.mockResolvedValue(0);

      await listByShipment({ ...baseParams, documentType: 'commercial_invoice' });

      const call = mockPrisma.customsDocument.findMany.mock.calls[0][0];
      expect(call.where.documentType).toBe('commercial_invoice');
    });

    it('applies default sorting (createdAt desc) when not specified', async () => {
      mockPrisma.customsDocument.findMany.mockResolvedValue([]);
      mockPrisma.customsDocument.count.mockResolvedValue(0);

      await listByShipment(baseParams);

      const call = mockPrisma.customsDocument.findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual({ createdAt: 'desc' });
    });

    it('applies custom sorting', async () => {
      mockPrisma.customsDocument.findMany.mockResolvedValue([]);
      mockPrisma.customsDocument.count.mockResolvedValue(0);

      await listByShipment({ ...baseParams, sortBy: 'documentType', sortDir: 'asc' });

      const call = mockPrisma.customsDocument.findMany.mock.calls[0][0];
      expect(call.orderBy).toEqual({ documentType: 'asc' });
    });

    it('calculates correct skip for pagination', async () => {
      mockPrisma.customsDocument.findMany.mockResolvedValue([]);
      mockPrisma.customsDocument.count.mockResolvedValue(0);

      await listByShipment({ ...baseParams, page: 3, pageSize: 5 });

      const call = mockPrisma.customsDocument.findMany.mock.calls[0][0];
      expect(call.skip).toBe(10); // (3-1) * 5
      expect(call.take).toBe(5);
    });
  });

  // ─── getById ────────────────────────────────────────────────────────

  describe('getById', () => {
    it('returns the customs document with detail includes', async () => {
      const doc = makeCustomsDoc();
      mockPrisma.customsDocument.findUnique.mockResolvedValue(doc);

      const result = await getById(DOC_ID);

      expect(result).toEqual(doc);
      expect(mockPrisma.customsDocument.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: DOC_ID } }),
      );
    });

    it('throws NotFoundError when document does not exist', async () => {
      mockPrisma.customsDocument.findUnique.mockResolvedValue(null);

      await expect(getById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─── create ─────────────────────────────────────────────────────────

  describe('create', () => {
    const createDto = {
      shipmentId: SHIPMENT_ID,
      documentType: 'bill_of_lading',
      documentNumber: 'BOL-001',
      issueDate: '2025-01-15',
      notes: 'Test doc',
    };

    it('creates a customs document with status pending', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment());
      const created = makeCustomsDoc();
      mockPrisma.customsDocument.create.mockResolvedValue(created);

      const result = await create(createDto, USER_ID);

      expect(result).toEqual(created);
      const call = mockPrisma.customsDocument.create.mock.calls[0][0];
      expect(call.data.status).toBe('pending');
      expect(call.data.documentType).toBe('bill_of_lading');
    });

    it('throws NotFoundError when shipment does not exist', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(null);

      await expect(create(createDto, USER_ID)).rejects.toThrow(NotFoundError);
    });

    it('publishes document:created event', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment());
      mockPrisma.customsDocument.create.mockResolvedValue(makeCustomsDoc());

      await create(createDto, USER_ID);

      expect(mockedEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'document:created',
          entityType: 'customs_document',
          performedById: USER_ID,
        }),
      );
    });

    it('converts date strings to Date objects', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment());
      mockPrisma.customsDocument.create.mockResolvedValue(makeCustomsDoc());

      await create({ ...createDto, expiryDate: '2025-12-31' }, USER_ID);

      const call = mockPrisma.customsDocument.create.mock.calls[0][0];
      expect(call.data.issueDate).toEqual(new Date('2025-01-15'));
      expect(call.data.expiryDate).toEqual(new Date('2025-12-31'));
    });

    it('sets optional fields to null when not provided', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment());
      mockPrisma.customsDocument.create.mockResolvedValue(makeCustomsDoc());

      await create({ shipmentId: SHIPMENT_ID, documentType: 'packing_list' }, USER_ID);

      const call = mockPrisma.customsDocument.create.mock.calls[0][0];
      expect(call.data.documentNumber).toBeNull();
      expect(call.data.issueDate).toBeNull();
      expect(call.data.expiryDate).toBeNull();
      expect(call.data.filePath).toBeNull();
      expect(call.data.notes).toBeNull();
    });
  });

  // ─── update ─────────────────────────────────────────────────────────

  describe('update', () => {
    it('updates a pending customs document', async () => {
      const existing = makeCustomsDoc({ status: 'pending' });
      mockPrisma.customsDocument.findUnique.mockResolvedValue(existing);
      const updated = { ...existing, notes: 'Updated' };
      mockPrisma.customsDocument.update.mockResolvedValue(updated);

      const result = await update(DOC_ID, { notes: 'Updated' });

      expect(result).toEqual(updated);
    });

    it('throws NotFoundError when document does not exist', async () => {
      mockPrisma.customsDocument.findUnique.mockResolvedValue(null);

      await expect(update('nonexistent', { notes: 'x' })).rejects.toThrow(NotFoundError);
    });

    it('throws BusinessRuleError when updating a verified document', async () => {
      mockPrisma.customsDocument.findUnique.mockResolvedValue(makeCustomsDoc({ status: 'verified' }));

      await expect(update(DOC_ID, { notes: 'x' })).rejects.toThrow(BusinessRuleError);
    });

    it('allows updating a received document', async () => {
      const existing = makeCustomsDoc({ status: 'received' });
      mockPrisma.customsDocument.findUnique.mockResolvedValue(existing);
      mockPrisma.customsDocument.update.mockResolvedValue(existing);

      await expect(update(DOC_ID, { notes: 'Updated' })).resolves.toBeDefined();
    });

    it('only includes defined fields in update data', async () => {
      const existing = makeCustomsDoc({ status: 'pending' });
      mockPrisma.customsDocument.findUnique.mockResolvedValue(existing);
      mockPrisma.customsDocument.update.mockResolvedValue(existing);

      await update(DOC_ID, { documentNumber: 'NEW-001' });

      const call = mockPrisma.customsDocument.update.mock.calls[0][0];
      expect(call.data.documentNumber).toBe('NEW-001');
      expect(call.data.notes).toBeUndefined();
    });
  });

  // ─── verify ─────────────────────────────────────────────────────────

  describe('verify', () => {
    it('verifies a pending document', async () => {
      const pending = makeCustomsDoc({ status: 'pending' });
      const verified = makeCustomsDoc({ status: 'verified', verifiedById: USER_ID });
      mockPrisma.customsDocument.findUnique.mockResolvedValue(pending);
      mockPrisma.customsDocument.update.mockResolvedValue(verified);

      const result = await verify(DOC_ID, USER_ID);

      expect(result.status).toBe('verified');
      const call = mockPrisma.customsDocument.update.mock.calls[0][0];
      expect(call.data.status).toBe('verified');
      expect(call.data.verifiedById).toBe(USER_ID);
      expect(call.data.verifiedAt).toBeInstanceOf(Date);
    });

    it('verifies a received document', async () => {
      mockPrisma.customsDocument.findUnique.mockResolvedValue(makeCustomsDoc({ status: 'received' }));
      mockPrisma.customsDocument.update.mockResolvedValue(makeCustomsDoc({ status: 'verified' }));

      const result = await verify(DOC_ID, USER_ID);

      expect(result.status).toBe('verified');
    });

    it('throws NotFoundError when document does not exist', async () => {
      mockPrisma.customsDocument.findUnique.mockResolvedValue(null);

      await expect(verify('nonexistent', USER_ID)).rejects.toThrow(NotFoundError);
    });

    it('throws BusinessRuleError when verifying an already verified document', async () => {
      mockPrisma.customsDocument.findUnique.mockResolvedValue(makeCustomsDoc({ status: 'verified' }));

      await expect(verify(DOC_ID, USER_ID)).rejects.toThrow(BusinessRuleError);
    });

    it('throws BusinessRuleError when verifying a rejected document', async () => {
      mockPrisma.customsDocument.findUnique.mockResolvedValue(makeCustomsDoc({ status: 'rejected' }));

      await expect(verify(DOC_ID, USER_ID)).rejects.toThrow(BusinessRuleError);
    });

    it('publishes document:status_changed event on verify', async () => {
      mockPrisma.customsDocument.findUnique.mockResolvedValue(makeCustomsDoc({ status: 'pending' }));
      mockPrisma.customsDocument.update.mockResolvedValue(makeCustomsDoc({ status: 'verified' }));

      await verify(DOC_ID, USER_ID);

      expect(mockedEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'document:status_changed',
          payload: expect.objectContaining({ from: 'pending', to: 'verified' }),
        }),
      );
    });
  });

  // ─── reject ─────────────────────────────────────────────────────────

  describe('reject', () => {
    it('rejects a pending document with a reason', async () => {
      const pending = makeCustomsDoc({ status: 'pending' });
      const rejected = makeCustomsDoc({ status: 'rejected', notes: 'Bad quality' });
      mockPrisma.customsDocument.findUnique.mockResolvedValue(pending);
      mockPrisma.customsDocument.update.mockResolvedValue(rejected);

      const result = await reject(DOC_ID, USER_ID, 'Bad quality');

      expect(result.status).toBe('rejected');
      const call = mockPrisma.customsDocument.update.mock.calls[0][0];
      expect(call.data.notes).toBe('Bad quality');
    });

    it('rejects without a reason', async () => {
      mockPrisma.customsDocument.findUnique.mockResolvedValue(makeCustomsDoc({ status: 'received' }));
      mockPrisma.customsDocument.update.mockResolvedValue(makeCustomsDoc({ status: 'rejected' }));

      await reject(DOC_ID, USER_ID);

      const call = mockPrisma.customsDocument.update.mock.calls[0][0];
      expect(call.data.notes).toBeUndefined();
    });

    it('throws NotFoundError when document does not exist', async () => {
      mockPrisma.customsDocument.findUnique.mockResolvedValue(null);

      await expect(reject('nonexistent', USER_ID)).rejects.toThrow(NotFoundError);
    });

    it('throws BusinessRuleError when rejecting a verified document', async () => {
      mockPrisma.customsDocument.findUnique.mockResolvedValue(makeCustomsDoc({ status: 'verified' }));

      await expect(reject(DOC_ID, USER_ID)).rejects.toThrow(BusinessRuleError);
    });

    it('publishes document:status_changed event on reject', async () => {
      mockPrisma.customsDocument.findUnique.mockResolvedValue(makeCustomsDoc({ status: 'received' }));
      mockPrisma.customsDocument.update.mockResolvedValue(makeCustomsDoc({ status: 'rejected' }));

      await reject(DOC_ID, USER_ID, 'Expired');

      expect(mockedEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'document:status_changed',
          payload: expect.objectContaining({ from: 'received', to: 'rejected', reason: 'Expired' }),
        }),
      );
    });
  });

  // ─── getCompleteness ────────────────────────────────────────────────

  describe('getCompleteness', () => {
    it('returns completeness report for a shipment', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment());
      mockPrisma.customsDocument.findMany.mockResolvedValue([
        { documentType: 'bill_of_lading', status: 'verified' },
        { documentType: 'commercial_invoice', status: 'verified' },
        { documentType: 'packing_list', status: 'verified' },
        { documentType: 'certificate_of_origin', status: 'verified' },
        { documentType: 'customs_declaration', status: 'verified' },
      ]);

      const result = await getCompleteness(SHIPMENT_ID);

      expect(result.isComplete).toBe(true);
      expect(result.verified).toBe(5);
      expect(result.total).toBe(5);
    });

    it('returns isComplete=false when required documents are missing', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment());
      mockPrisma.customsDocument.findMany.mockResolvedValue([
        { documentType: 'bill_of_lading', status: 'verified' },
        { documentType: 'commercial_invoice', status: 'pending' },
      ]);

      const result = await getCompleteness(SHIPMENT_ID);

      expect(result.isComplete).toBe(false);
      expect(result.requiredDocuments.filter(d => !d.present)).toHaveLength(3);
    });

    it('returns isComplete=false when docs are present but not verified', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment());
      mockPrisma.customsDocument.findMany.mockResolvedValue([
        { documentType: 'bill_of_lading', status: 'verified' },
        { documentType: 'commercial_invoice', status: 'verified' },
        { documentType: 'packing_list', status: 'pending' },
        { documentType: 'certificate_of_origin', status: 'verified' },
        { documentType: 'customs_declaration', status: 'verified' },
      ]);

      const result = await getCompleteness(SHIPMENT_ID);

      expect(result.isComplete).toBe(false);
    });

    it('throws NotFoundError when shipment does not exist', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(null);

      await expect(getCompleteness('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('handles empty document list', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment());
      mockPrisma.customsDocument.findMany.mockResolvedValue([]);

      const result = await getCompleteness(SHIPMENT_ID);

      expect(result.total).toBe(0);
      expect(result.isComplete).toBe(false);
      expect(result.requiredDocuments.every(d => !d.present)).toBe(true);
    });

    it('prefers verified status over pending for duplicate document types', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment());
      mockPrisma.customsDocument.findMany.mockResolvedValue([
        { documentType: 'bill_of_lading', status: 'pending' },
        { documentType: 'bill_of_lading', status: 'verified' },
      ]);

      const result = await getCompleteness(SHIPMENT_ID);

      const bol = result.requiredDocuments.find(d => d.type === 'bill_of_lading');
      expect(bol?.status).toBe('verified');
    });

    it('counts status categories correctly', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment());
      mockPrisma.customsDocument.findMany.mockResolvedValue([
        { documentType: 'bill_of_lading', status: 'verified' },
        { documentType: 'commercial_invoice', status: 'pending' },
        { documentType: 'packing_list', status: 'received' },
        { documentType: 'customs_declaration', status: 'rejected' },
      ]);

      const result = await getCompleteness(SHIPMENT_ID);

      expect(result.verified).toBe(1);
      expect(result.pending).toBe(1);
      expect(result.received).toBe(1);
      expect(result.rejected).toBe(1);
      expect(result.total).toBe(4);
    });

    it('includes correct labels for required documents', async () => {
      mockPrisma.shipment.findUnique.mockResolvedValue(makeShipment());
      mockPrisma.customsDocument.findMany.mockResolvedValue([]);

      const result = await getCompleteness(SHIPMENT_ID);

      const bol = result.requiredDocuments.find(d => d.type === 'bill_of_lading');
      expect(bol?.label).toBe('Bill of Lading');

      const ci = result.requiredDocuments.find(d => d.type === 'commercial_invoice');
      expect(ci?.label).toBe('Commercial Invoice');
    });
  });
});
