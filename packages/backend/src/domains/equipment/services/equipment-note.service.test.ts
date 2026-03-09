import type { PrismaMock } from '../../../test-utils/prisma-mock.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';

// ── Hoisted mock container ──────────────────────────────────────────────
const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

// ── mocks ────────────────────────────────────────────────────────────
vi.mock('../../../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../system/services/document-number.service.js', () => ({ generateDocumentNumber: vi.fn() }));
vi.mock('../../../events/event-bus.js', () => ({ eventBus: { publish: vi.fn() } }));
vi.mock('../../../config/logger.js', () => ({ log: vi.fn() }));
vi.mock('@nit-scs-v2/shared', async importOriginal => {
  const actual = await importOriginal<typeof import('@nit-scs-v2/shared')>();
  return { ...actual, assertTransition: vi.fn() };
});
vi.mock('../../../utils/safe-status-transition.js', () => ({
  safeStatusUpdate: vi.fn().mockResolvedValue(1),
  safeStatusUpdateTx: vi.fn().mockResolvedValue(1),
}));

import { createPrismaMock } from '../../../test-utils/prisma-mock.js';
import {
  listDeliveryNotes,
  getDeliveryNoteById,
  createDeliveryNote,
  updateDeliveryNote,
  confirmDeliveryNote,
  cancelDeliveryNote,
  listReturnNotes,
  getReturnNoteById,
  createReturnNote,
  updateReturnNote,
  inspectReturnNote,
  confirmReturnNote,
  disputeReturnNote,
} from './equipment-note.service.js';
import { generateDocumentNumber } from '../../system/services/document-number.service.js';
import { assertTransition } from '@nit-scs-v2/shared';
import { eventBus } from '../../../events/event-bus.js';

// ── helpers ──────────────────────────────────────────────────────────
const USER_ID = 'user-1';
const DN_ID = 'dn-1';
const RN_ID = 'rn-1';

function makeDeliveryNote(overrides: Record<string, unknown> = {}) {
  return {
    id: DN_ID,
    noteNumber: 'EDN-001',
    jobOrderId: 'jo-1',
    rentalContractId: 'rc-1',
    deliveryDate: new Date('2026-02-01'),
    receivedById: 'emp-1',
    equipmentDescription: 'Excavator CAT 320',
    serialNumber: 'EX-SN-001',
    hoursOnDelivery: 500,
    mileageOnDelivery: null,
    conditionOnDelivery: 'good',
    conditionNotes: null,
    safetyCertificateVerified: true,
    status: 'draft',
    notes: null,
    confirmedAt: null,
    confirmedById: null,
    returnNotes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeReturnNote(overrides: Record<string, unknown> = {}) {
  return {
    id: RN_ID,
    noteNumber: 'ERN-001',
    jobOrderId: 'jo-1',
    deliveryNoteId: DN_ID,
    returnDate: new Date('2026-03-01'),
    returnedById: 'emp-1',
    hoursOnReturn: 800,
    mileageOnReturn: null,
    conditionOnReturn: 'fair',
    conditionNotes: null,
    damageDescription: null,
    damageEstimatedCost: null,
    fuelLevel: null,
    actualDays: null,
    actualCost: null,
    status: 'draft',
    notes: null,
    inspectedAt: null,
    inspectedById: null,
    confirmedAt: null,
    confirmedById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const baseListParams = { sortBy: 'createdAt', sortDir: 'desc' as const, skip: 0, pageSize: 20 };

// ── setup ────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(mockPrisma, createPrismaMock());
});

describe('equipment-note.service', () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // DELIVERY NOTE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // ─────────────────────────────────────────────────────────────────────────
  // listDeliveryNotes
  // ─────────────────────────────────────────────────────────────────────────
  describe('listDeliveryNotes', () => {
    it('should return data and total', async () => {
      const rows = [makeDeliveryNote()];
      mockPrisma.equipmentDeliveryNote.findMany.mockResolvedValue(rows);
      mockPrisma.equipmentDeliveryNote.count.mockResolvedValue(1);

      const result = await listDeliveryNotes(baseListParams);

      expect(result).toEqual({ data: rows, total: 1 });
    });

    it('should apply search filter with OR clause', async () => {
      mockPrisma.equipmentDeliveryNote.findMany.mockResolvedValue([]);
      mockPrisma.equipmentDeliveryNote.count.mockResolvedValue(0);

      await listDeliveryNotes({ ...baseListParams, search: 'excavator' });

      const where = mockPrisma.equipmentDeliveryNote.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
      expect(where.OR).toHaveLength(3);
    });

    it('should apply status filter', async () => {
      mockPrisma.equipmentDeliveryNote.findMany.mockResolvedValue([]);
      mockPrisma.equipmentDeliveryNote.count.mockResolvedValue(0);

      await listDeliveryNotes({ ...baseListParams, status: 'confirmed' });

      const where = mockPrisma.equipmentDeliveryNote.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('confirmed');
    });

    it('should apply jobOrderId filter', async () => {
      mockPrisma.equipmentDeliveryNote.findMany.mockResolvedValue([]);
      mockPrisma.equipmentDeliveryNote.count.mockResolvedValue(0);

      await listDeliveryNotes({ ...baseListParams, jobOrderId: 'jo-1' });

      const where = mockPrisma.equipmentDeliveryNote.findMany.mock.calls[0][0].where;
      expect(where.jobOrderId).toBe('jo-1');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getDeliveryNoteById
  // ─────────────────────────────────────────────────────────────────────────
  describe('getDeliveryNoteById', () => {
    it('should return the delivery note when found', async () => {
      const dn = makeDeliveryNote();
      mockPrisma.equipmentDeliveryNote.findUnique.mockResolvedValue(dn);

      const result = await getDeliveryNoteById(DN_ID);

      expect(result).toEqual(dn);
    });

    it('should throw NotFoundError when not found', async () => {
      mockPrisma.equipmentDeliveryNote.findUnique.mockResolvedValue(null);

      await expect(getDeliveryNoteById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // createDeliveryNote
  // ─────────────────────────────────────────────────────────────────────────
  describe('createDeliveryNote', () => {
    const dto = {
      jobOrderId: 'jo-1',
      deliveryDate: '2026-02-01',
      receivedById: 'emp-1',
      equipmentDescription: 'Excavator CAT 320',
      conditionOnDelivery: 'good',
    };

    it('should verify job order exists and create the note', async () => {
      mockPrisma.jobOrder.findUnique.mockResolvedValue({ id: 'jo-1' });
      vi.mocked(generateDocumentNumber).mockResolvedValue('EDN-001');
      mockPrisma.equipmentDeliveryNote.create.mockResolvedValue(makeDeliveryNote());

      const result = await createDeliveryNote(dto as any, USER_ID);

      expect(mockPrisma.jobOrder.findUnique).toHaveBeenCalledWith({ where: { id: 'jo-1' } });
      expect(result.noteNumber).toBe('EDN-001');
    });

    it('should throw NotFoundError when job order does not exist', async () => {
      mockPrisma.jobOrder.findUnique.mockResolvedValue(null);

      await expect(createDeliveryNote(dto as any, USER_ID)).rejects.toThrow(NotFoundError);
    });

    it('should verify rental contract when provided', async () => {
      mockPrisma.jobOrder.findUnique.mockResolvedValue({ id: 'jo-1' });
      mockPrisma.rentalContract.findUnique.mockResolvedValue(null);
      const dtoWithRental = { ...dto, rentalContractId: 'rc-bad' };

      await expect(createDeliveryNote(dtoWithRental as any, USER_ID)).rejects.toThrow(NotFoundError);
    });

    it('should set status to draft', async () => {
      mockPrisma.jobOrder.findUnique.mockResolvedValue({ id: 'jo-1' });
      vi.mocked(generateDocumentNumber).mockResolvedValue('EDN-002');
      mockPrisma.equipmentDeliveryNote.create.mockResolvedValue(makeDeliveryNote());

      await createDeliveryNote(dto as any, USER_ID);

      const createArgs = mockPrisma.equipmentDeliveryNote.create.mock.calls[0][0];
      expect(createArgs.data.status).toBe('draft');
    });

    it('should publish event on creation', async () => {
      mockPrisma.jobOrder.findUnique.mockResolvedValue({ id: 'jo-1' });
      vi.mocked(generateDocumentNumber).mockResolvedValue('EDN-003');
      mockPrisma.equipmentDeliveryNote.create.mockResolvedValue(makeDeliveryNote({ id: 'dn-new' }));

      await createDeliveryNote(dto as any, USER_ID);

      expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'document:created',
          entityType: 'equipment_delivery_note',
        }),
      );
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // updateDeliveryNote
  // ─────────────────────────────────────────────────────────────────────────
  describe('updateDeliveryNote', () => {
    it('should update a draft delivery note', async () => {
      const existing = makeDeliveryNote({ status: 'draft' });
      const updated = makeDeliveryNote({ conditionNotes: 'Minor scratches' });
      mockPrisma.equipmentDeliveryNote.findUnique.mockResolvedValue(existing);
      mockPrisma.equipmentDeliveryNote.update.mockResolvedValue(updated);

      const result = await updateDeliveryNote(DN_ID, { conditionNotes: 'Minor scratches' } as any);

      expect(result).toEqual({ existing, updated });
    });

    it('should throw NotFoundError when not found', async () => {
      mockPrisma.equipmentDeliveryNote.findUnique.mockResolvedValue(null);

      await expect(updateDeliveryNote('nonexistent', {} as any)).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when not in draft status', async () => {
      const existing = makeDeliveryNote({ status: 'confirmed' });
      mockPrisma.equipmentDeliveryNote.findUnique.mockResolvedValue(existing);

      await expect(updateDeliveryNote(DN_ID, {} as any)).rejects.toThrow(BusinessRuleError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // confirmDeliveryNote
  // ─────────────────────────────────────────────────────────────────────────
  describe('confirmDeliveryNote', () => {
    it('should confirm a draft delivery note', async () => {
      const note = makeDeliveryNote({ status: 'draft' });
      const confirmed = makeDeliveryNote({ status: 'confirmed' });
      mockPrisma.equipmentDeliveryNote.findUnique.mockResolvedValueOnce(note).mockResolvedValueOnce(confirmed);
      mockPrisma.equipmentDeliveryNote.updateMany.mockResolvedValue({ count: 1 });

      const result = await confirmDeliveryNote(DN_ID, USER_ID);

      expect(assertTransition).toHaveBeenCalledWith('equipment_delivery_note', 'draft', 'confirmed');
      expect(result.status).toBe('confirmed');
    });

    it('should throw NotFoundError when not found', async () => {
      mockPrisma.equipmentDeliveryNote.findUnique.mockResolvedValue(null);

      await expect(confirmDeliveryNote('nonexistent', USER_ID)).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // cancelDeliveryNote
  // ─────────────────────────────────────────────────────────────────────────
  describe('cancelDeliveryNote', () => {
    it('should cancel a draft delivery note with no active return notes', async () => {
      const note = makeDeliveryNote({ status: 'draft', returnNotes: [] });
      const cancelled = makeDeliveryNote({ status: 'cancelled' });
      mockPrisma.equipmentDeliveryNote.findUnique.mockResolvedValueOnce(note).mockResolvedValueOnce(cancelled);
      mockPrisma.equipmentDeliveryNote.updateMany.mockResolvedValue({ count: 1 });

      const result = await cancelDeliveryNote(DN_ID, USER_ID);

      expect(assertTransition).toHaveBeenCalledWith('equipment_delivery_note', 'draft', 'cancelled');
      expect(result.status).toBe('cancelled');
    });

    it('should throw NotFoundError when not found', async () => {
      mockPrisma.equipmentDeliveryNote.findUnique.mockResolvedValue(null);

      await expect(cancelDeliveryNote('nonexistent', USER_ID)).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when delivery note has active return notes', async () => {
      const note = makeDeliveryNote({
        status: 'draft',
        returnNotes: [{ id: 'rn-1', status: 'draft' }],
      });
      mockPrisma.equipmentDeliveryNote.findUnique.mockResolvedValue(note);

      await expect(cancelDeliveryNote(DN_ID, USER_ID)).rejects.toThrow(BusinessRuleError);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // RETURN NOTE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  // ─────────────────────────────────────────────────────────────────────────
  // listReturnNotes
  // ─────────────────────────────────────────────────────────────────────────
  describe('listReturnNotes', () => {
    it('should return data and total', async () => {
      const rows = [makeReturnNote()];
      mockPrisma.equipmentReturnNote.findMany.mockResolvedValue(rows);
      mockPrisma.equipmentReturnNote.count.mockResolvedValue(1);

      const result = await listReturnNotes(baseListParams);

      expect(result).toEqual({ data: rows, total: 1 });
    });

    it('should apply search filter', async () => {
      mockPrisma.equipmentReturnNote.findMany.mockResolvedValue([]);
      mockPrisma.equipmentReturnNote.count.mockResolvedValue(0);

      await listReturnNotes({ ...baseListParams, search: 'ERN' });

      const where = mockPrisma.equipmentReturnNote.findMany.mock.calls[0][0].where;
      expect(where.OR).toBeDefined();
      expect(where.OR).toHaveLength(2);
    });

    it('should apply status filter', async () => {
      mockPrisma.equipmentReturnNote.findMany.mockResolvedValue([]);
      mockPrisma.equipmentReturnNote.count.mockResolvedValue(0);

      await listReturnNotes({ ...baseListParams, status: 'inspected' });

      const where = mockPrisma.equipmentReturnNote.findMany.mock.calls[0][0].where;
      expect(where.status).toBe('inspected');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // getReturnNoteById
  // ─────────────────────────────────────────────────────────────────────────
  describe('getReturnNoteById', () => {
    it('should return the return note when found', async () => {
      const rn = makeReturnNote();
      mockPrisma.equipmentReturnNote.findUnique.mockResolvedValue(rn);

      const result = await getReturnNoteById(RN_ID);

      expect(result).toEqual(rn);
    });

    it('should throw NotFoundError when not found', async () => {
      mockPrisma.equipmentReturnNote.findUnique.mockResolvedValue(null);

      await expect(getReturnNoteById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // createReturnNote
  // ─────────────────────────────────────────────────────────────────────────
  describe('createReturnNote', () => {
    const dto = {
      jobOrderId: 'jo-1',
      deliveryNoteId: DN_ID,
      returnDate: '2026-03-01',
      returnedById: 'emp-1',
      conditionOnReturn: 'fair',
    };

    it('should verify delivery note is confirmed and create return note', async () => {
      const deliveryNote = makeDeliveryNote({ status: 'confirmed', jobOrderId: 'jo-1' });
      mockPrisma.equipmentDeliveryNote.findUnique.mockResolvedValue(deliveryNote);
      vi.mocked(generateDocumentNumber).mockResolvedValue('ERN-001');
      mockPrisma.equipmentReturnNote.create.mockResolvedValue(makeReturnNote());

      const result = await createReturnNote(dto as any, USER_ID);

      expect(result.noteNumber).toBe('ERN-001');
    });

    it('should throw NotFoundError when delivery note does not exist', async () => {
      mockPrisma.equipmentDeliveryNote.findUnique.mockResolvedValue(null);

      await expect(createReturnNote(dto as any, USER_ID)).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when delivery note is not confirmed', async () => {
      const deliveryNote = makeDeliveryNote({ status: 'draft', jobOrderId: 'jo-1' });
      mockPrisma.equipmentDeliveryNote.findUnique.mockResolvedValue(deliveryNote);

      await expect(createReturnNote(dto as any, USER_ID)).rejects.toThrow(BusinessRuleError);
    });

    it('should throw BusinessRuleError when job order IDs do not match', async () => {
      const deliveryNote = makeDeliveryNote({ status: 'confirmed', jobOrderId: 'jo-different' });
      mockPrisma.equipmentDeliveryNote.findUnique.mockResolvedValue(deliveryNote);

      await expect(createReturnNote(dto as any, USER_ID)).rejects.toThrow(BusinessRuleError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // updateReturnNote
  // ─────────────────────────────────────────────────────────────────────────
  describe('updateReturnNote', () => {
    it('should update a draft return note', async () => {
      const existing = makeReturnNote({ status: 'draft' });
      const updated = makeReturnNote({ conditionNotes: 'Scuffed paint' });
      mockPrisma.equipmentReturnNote.findUnique.mockResolvedValue(existing);
      mockPrisma.equipmentReturnNote.update.mockResolvedValue(updated);

      const result = await updateReturnNote(RN_ID, { conditionNotes: 'Scuffed paint' } as any);

      expect(result).toEqual({ existing, updated });
    });

    it('should throw NotFoundError when not found', async () => {
      mockPrisma.equipmentReturnNote.findUnique.mockResolvedValue(null);

      await expect(updateReturnNote('nonexistent', {} as any)).rejects.toThrow(NotFoundError);
    });

    it('should throw BusinessRuleError when not in draft status', async () => {
      const existing = makeReturnNote({ status: 'inspected' });
      mockPrisma.equipmentReturnNote.findUnique.mockResolvedValue(existing);

      await expect(updateReturnNote(RN_ID, {} as any)).rejects.toThrow(BusinessRuleError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // inspectReturnNote
  // ─────────────────────────────────────────────────────────────────────────
  describe('inspectReturnNote', () => {
    it('should transition return note to inspected', async () => {
      const note = makeReturnNote({ status: 'draft' });
      const inspected = makeReturnNote({ status: 'inspected' });
      mockPrisma.equipmentReturnNote.findUnique.mockResolvedValueOnce(note).mockResolvedValueOnce(inspected);
      mockPrisma.equipmentReturnNote.updateMany.mockResolvedValue({ count: 1 });

      const result = await inspectReturnNote(RN_ID, USER_ID);

      expect(assertTransition).toHaveBeenCalledWith('equipment_return_note', 'draft', 'inspected');
      expect(result.status).toBe('inspected');
    });

    it('should throw NotFoundError when not found', async () => {
      mockPrisma.equipmentReturnNote.findUnique.mockResolvedValue(null);

      await expect(inspectReturnNote('nonexistent', USER_ID)).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // confirmReturnNote
  // ─────────────────────────────────────────────────────────────────────────
  describe('confirmReturnNote', () => {
    it('should confirm an inspected return note and calculate costs', async () => {
      const note = makeReturnNote({
        status: 'inspected',
        actualDays: null,
        actualCost: null,
        returnDate: new Date('2026-03-01'),
        deliveryNote: {
          deliveryDate: new Date('2026-02-01'),
          rentalContract: { dailyRate: 500 },
        },
      });
      const confirmed = makeReturnNote({ status: 'confirmed' });
      mockPrisma.equipmentReturnNote.findUnique.mockResolvedValueOnce(note).mockResolvedValueOnce(confirmed);
      mockPrisma.equipmentReturnNote.updateMany.mockResolvedValue({ count: 1 });

      const result = await confirmReturnNote(RN_ID, USER_ID);

      expect(assertTransition).toHaveBeenCalledWith('equipment_return_note', 'inspected', 'confirmed');
      expect(result.status).toBe('confirmed');
    });

    it('should throw NotFoundError when not found', async () => {
      mockPrisma.equipmentReturnNote.findUnique.mockResolvedValue(null);

      await expect(confirmReturnNote('nonexistent', USER_ID)).rejects.toThrow(NotFoundError);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // disputeReturnNote
  // ─────────────────────────────────────────────────────────────────────────
  describe('disputeReturnNote', () => {
    it('should dispute an inspected return note with reason', async () => {
      const note = makeReturnNote({ status: 'inspected' });
      const disputed = makeReturnNote({ status: 'disputed' });
      mockPrisma.equipmentReturnNote.findUnique.mockResolvedValueOnce(note).mockResolvedValueOnce(disputed);
      mockPrisma.equipmentReturnNote.updateMany.mockResolvedValue({ count: 1 });

      const result = await disputeReturnNote(RN_ID, USER_ID, 'Damage not documented');

      expect(assertTransition).toHaveBeenCalledWith('equipment_return_note', 'inspected', 'disputed');
      expect(result.status).toBe('disputed');
    });

    it('should throw NotFoundError when not found', async () => {
      mockPrisma.equipmentReturnNote.findUnique.mockResolvedValue(null);

      await expect(disputeReturnNote('nonexistent', USER_ID)).rejects.toThrow(NotFoundError);
    });
  });
});
