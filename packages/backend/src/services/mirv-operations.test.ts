import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaMock, PrismaModelMock } from '../test-utils/prisma-mock.js';

// ── Hoisted mock container ──────────────────────────────────────────────
const { mockPrisma, mockGenerateDocNumber, mockConsumeReservationBatch, mockReleaseReservation } = vi.hoisted(() => ({
  mockPrisma: {} as PrismaMock,
  mockGenerateDocNumber: vi.fn(),
  mockConsumeReservationBatch: vi.fn(),
  mockReleaseReservation: vi.fn(),
}));

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('./document-number.service.js', () => ({ generateDocumentNumber: mockGenerateDocNumber }));
vi.mock('./inventory.service.js', () => ({
  consumeReservationBatch: mockConsumeReservationBatch,
  releaseReservation: mockReleaseReservation,
}));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { signQcForMirv, issueMirv, cancelMirv } from './mirv-operations.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';

// ── Helpers ─────────────────────────────────────────────────────────────

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

/** Factory for a minimal MIRV record */
function makeMirv(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mirv-001',
    mirvNumber: 'MIRV-2026-0001',
    status: 'approved',
    warehouseId: 'wh-001',
    projectId: 'proj-001',
    locationOfWork: 'Site Alpha',
    reservationStatus: 'reserved',
    qcSignatureId: null,
    gatePassAutoCreated: false,
    mirvLines: [],
    ...overrides,
  };
}

/**
 * Prisma Decimal mock — supports Number() coercion via valueOf().
 * The source code uses `Number(line.qtyApproved)`, which calls valueOf().
 */
function decimal(n: number) {
  return { valueOf: () => n, toNumber: () => n, toString: () => String(n) };
}

/** Factory for a MIRV line */
function makeLine(overrides: Record<string, unknown> = {}) {
  return {
    id: 'line-001',
    itemId: 'item-001',
    qtyRequested: decimal(10),
    qtyApproved: decimal(10),
    qtyIssued: null,
    ...overrides,
  };
}

 
const tx = () => mockPrisma as any;

// ── Setup ───────────────────────────────────────────────────────────────
beforeEach(() => {
  const fresh = createPrismaMock();
  Object.assign(mockPrisma, fresh);
  // mirvLine is already in PrismaMock, but reassign to be safe
  (mockPrisma as Record<string, unknown>).mirvLine = createModelMock();
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════
// signQcForMirv
// ═══════════════════════════════════════════════════════════════════════
describe('signQcForMirv', () => {
  it('should set qcSignatureId on an approved MIRV', async () => {
    const mirv = makeMirv({ status: 'approved' });
    mockPrisma.mirv.findUnique.mockResolvedValue(mirv);
    mockPrisma.mirv.update.mockResolvedValue({ ...mirv, qcSignatureId: 'qc-user-001' });

    const result = await signQcForMirv(tx(), 'mirv-001', 'qc-user-001');

    expect(mockPrisma.mirv.findUnique).toHaveBeenCalledWith({ where: { id: 'mirv-001' } });
    expect(mockPrisma.mirv.update).toHaveBeenCalledWith({
      where: { id: 'mirv-001' },
      data: { qcSignatureId: 'qc-user-001' },
    });
    expect(result.qcSignatureId).toBe('qc-user-001');
  });

  it('should throw NotFoundError when MIRV does not exist', async () => {
    mockPrisma.mirv.findUnique.mockResolvedValue(null);

    await expect(signQcForMirv(tx(), 'no-such-mirv', 'qc-user-001')).rejects.toThrow(NotFoundError);
  });

  it('should throw BusinessRuleError when status is draft', async () => {
    mockPrisma.mirv.findUnique.mockResolvedValue(makeMirv({ status: 'draft' }));

    await expect(signQcForMirv(tx(), 'mirv-001', 'qc-user-001')).rejects.toThrow(BusinessRuleError);
  });

  it('should throw BusinessRuleError when status is issued', async () => {
    mockPrisma.mirv.findUnique.mockResolvedValue(makeMirv({ status: 'issued' }));

    await expect(signQcForMirv(tx(), 'mirv-001', 'qc-user-001')).rejects.toThrow(
      'MIRV must be approved for QC signature',
    );
  });

  it('should throw BusinessRuleError when status is cancelled', async () => {
    mockPrisma.mirv.findUnique.mockResolvedValue(makeMirv({ status: 'cancelled' }));

    await expect(signQcForMirv(tx(), 'mirv-001', 'qc-user-001')).rejects.toThrow(BusinessRuleError);
  });

  it('should throw BusinessRuleError when status is pending_approval', async () => {
    mockPrisma.mirv.findUnique.mockResolvedValue(makeMirv({ status: 'pending_approval' }));

    await expect(signQcForMirv(tx(), 'mirv-001', 'qc-user-001')).rejects.toThrow(BusinessRuleError);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// issueMirv
// ═══════════════════════════════════════════════════════════════════════
describe('issueMirv', () => {
  const userId = 'user-storekeeper';

  function setupFullIssueMirv(mirvOverrides: Record<string, unknown> = {}, lines = [makeLine()]) {
    const mirv = makeMirv({
      qcSignatureId: 'qc-user-001',
      mirvLines: lines,
      ...mirvOverrides,
    });
    mockPrisma.mirv.findUnique.mockResolvedValue(mirv);
    mockPrisma.mirv.update.mockResolvedValue({ ...mirv, status: 'issued' });
    mockPrisma.mirvLine.update.mockResolvedValue({});
    mockPrisma.gatePass.create.mockResolvedValue({ id: 'gp-001' });
    mockGenerateDocNumber.mockResolvedValue('GP-2026-0001');
    mockConsumeReservationBatch.mockResolvedValue({
      totalCost: 500,
      lineCosts: new Map([['line-001', 500]]),
    });
    return mirv;
  }

  // ── Full issuance ──────────────────────────────────────────────────

  it('should perform full issuance for a single line', async () => {
    setupFullIssueMirv();

    const result = await issueMirv(tx(), 'mirv-001', userId);

    expect(result.status).toBe('issued');
    expect(result.totalCost).toBe(500);
    expect(result.warehouseId).toBe('wh-001');
    expect(mockConsumeReservationBatch).toHaveBeenCalledWith([
      { itemId: 'item-001', warehouseId: 'wh-001', qty: 10, mirvLineId: 'line-001' },
    ]);
  });

  it('should perform full issuance for multiple lines', async () => {
    const line1 = makeLine({ id: 'line-001', itemId: 'item-001' });
    const line2 = makeLine({ id: 'line-002', itemId: 'item-002', qtyApproved: decimal(5) });
    mockConsumeReservationBatch.mockResolvedValue({
      totalCost: 1000,
      lineCosts: new Map([
        ['line-001', 500],
        ['line-002', 250],
      ]),
    });
    setupFullIssueMirv({}, [line1, line2]);
    // Re-set consumeReservationBatch after setup (setup sets it too)
    mockConsumeReservationBatch.mockResolvedValue({
      totalCost: 1000,
      lineCosts: new Map([
        ['line-001', 500],
        ['line-002', 250],
      ]),
    });

    const result = await issueMirv(tx(), 'mirv-001', userId);

    expect(result.status).toBe('issued');
    expect(mockConsumeReservationBatch).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ itemId: 'item-001', qty: 10, mirvLineId: 'line-001' }),
        expect.objectContaining({ itemId: 'item-002', qty: 5, mirvLineId: 'line-002' }),
      ]),
    );
  });

  it('should update line costs and qtyIssued for each consumed line', async () => {
    setupFullIssueMirv();

    await issueMirv(tx(), 'mirv-001', userId);

    expect(mockPrisma.mirvLine.update).toHaveBeenCalledWith({
      where: { id: 'line-001' },
      data: {
        qtyIssued: 10,
        unitCost: 500 / 10,
      },
    });
  });

  it('should set status to issued and update mirv record', async () => {
    setupFullIssueMirv();

    await issueMirv(tx(), 'mirv-001', userId);

    expect(mockPrisma.mirv.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'mirv-001' },
        data: expect.objectContaining({
          status: 'issued',
          issuedById: userId,
          reservationStatus: 'released',
        }),
      }),
    );
  });

  it('should set issuedDate to current date on mirv update', async () => {
    setupFullIssueMirv();

    await issueMirv(tx(), 'mirv-001', userId);

    const updateCall = mockPrisma.mirv.update.mock.calls[0][0];
    expect(updateCall.data.issuedDate).toBeInstanceOf(Date);
  });

  // ── Partial issuance ───────────────────────────────────────────────

  it('should perform partial issuance when partialItems provided', async () => {
    const line1 = makeLine({ id: 'line-001', itemId: 'item-001' });
    const line2 = makeLine({ id: 'line-002', itemId: 'item-002' });
    setupFullIssueMirv({}, [line1, line2]);
    mockConsumeReservationBatch.mockResolvedValue({
      totalCost: 200,
      lineCosts: new Map([['line-001', 200]]),
    });

    const result = await issueMirv(tx(), 'mirv-001', userId, [{ lineId: 'line-001', qty: 5 }]);

    expect(result.status).toBe('partially_issued');
    expect(mockConsumeReservationBatch).toHaveBeenCalledWith([
      { itemId: 'item-001', warehouseId: 'wh-001', qty: 5, mirvLineId: 'line-001' },
    ]);
  });

  it('should cap partial qty at remaining when partial exceeds remaining', async () => {
    const line = makeLine({ id: 'line-001', qtyApproved: decimal(10), qtyIssued: decimal(7) });
    setupFullIssueMirv({}, [line]);
    // Only 3 remaining, but requesting 8
    mockConsumeReservationBatch.mockResolvedValue({
      totalCost: 150,
      lineCosts: new Map([['line-001', 150]]),
    });

    await issueMirv(tx(), 'mirv-001', userId, [{ lineId: 'line-001', qty: 8 }]);

    expect(mockConsumeReservationBatch).toHaveBeenCalledWith([expect.objectContaining({ qty: 3 })]);
  });

  it('should set status to partially_issued when not all lines are fully issued', async () => {
    const line1 = makeLine({ id: 'line-001', itemId: 'item-001', qtyApproved: decimal(10) });
    const line2 = makeLine({ id: 'line-002', itemId: 'item-002', qtyApproved: decimal(10) });
    setupFullIssueMirv({}, [line1, line2]);
    mockConsumeReservationBatch.mockResolvedValue({
      totalCost: 300,
      lineCosts: new Map([['line-001', 300]]),
    });

    const result = await issueMirv(tx(), 'mirv-001', userId, [
      { lineId: 'line-001', qty: 10 },
      // line-002 not included
    ]);

    expect(result.status).toBe('partially_issued');
  });

  it('should set status to issued when partial issue completes remaining quantities', async () => {
    // Line was partially issued before — 7 of 10 already done
    const line = makeLine({
      id: 'line-001',
      qtyApproved: decimal(10),
      qtyIssued: decimal(7),
    });
    setupFullIssueMirv({ status: 'partially_issued' }, [line]);
    mockConsumeReservationBatch.mockResolvedValue({
      totalCost: 150,
      lineCosts: new Map([['line-001', 150]]),
    });

    const result = await issueMirv(tx(), 'mirv-001', userId, [{ lineId: 'line-001', qty: 3 }]);

    expect(result.status).toBe('issued');
  });

  it('should skip lines with zero remaining quantity', async () => {
    const fullyIssuedLine = makeLine({
      id: 'line-001',
      qtyApproved: decimal(10),
      qtyIssued: decimal(10),
    });
    const pendingLine = makeLine({ id: 'line-002', itemId: 'item-002' });
    setupFullIssueMirv({}, [fullyIssuedLine, pendingLine]);
    mockConsumeReservationBatch.mockResolvedValue({
      totalCost: 200,
      lineCosts: new Map([['line-002', 200]]),
    });

    await issueMirv(tx(), 'mirv-001', userId);

    // Only the pending line should be consumed
    expect(mockConsumeReservationBatch).toHaveBeenCalledWith([expect.objectContaining({ mirvLineId: 'line-002' })]);
  });

  it('should use qtyRequested as fallback when qtyApproved is null', async () => {
    const line = makeLine({
      id: 'line-001',
      qtyApproved: null,
      qtyRequested: decimal(15),
    });
    setupFullIssueMirv({}, [line]);
    mockConsumeReservationBatch.mockResolvedValue({
      totalCost: 750,
      lineCosts: new Map([['line-001', 750]]),
    });

    await issueMirv(tx(), 'mirv-001', userId);

    expect(mockConsumeReservationBatch).toHaveBeenCalledWith([expect.objectContaining({ qty: 15 })]);
  });

  it('should not preserve reservationStatus when partial issue (not all fully issued)', async () => {
    const line = makeLine({ id: 'line-001', qtyApproved: decimal(20) });
    setupFullIssueMirv({ reservationStatus: 'reserved' }, [line]);
    mockConsumeReservationBatch.mockResolvedValue({
      totalCost: 100,
      lineCosts: new Map([['line-001', 100]]),
    });

    await issueMirv(tx(), 'mirv-001', userId, [{ lineId: 'line-001', qty: 5 }]);

    const updateCall = mockPrisma.mirv.update.mock.calls[0][0];
    // When not all fully issued, reservationStatus keeps original value
    expect(updateCall.data.reservationStatus).toBe('reserved');
  });

  // ── QC signature requirement ───────────────────────────────────────

  it('should throw BusinessRuleError when QC signature is missing', async () => {
    const mirv = makeMirv({
      status: 'approved',
      qcSignatureId: null,
      mirvLines: [makeLine()],
    });
    mockPrisma.mirv.findUnique.mockResolvedValue(mirv);

    await expect(issueMirv(tx(), 'mirv-001', userId)).rejects.toThrow(
      'QC counter-signature is required before issuing materials (V5 requirement)',
    );
  });

  // ── GatePass auto-creation ────────────────────────────────────────

  it('should auto-create outbound GatePass on first issuance', async () => {
    setupFullIssueMirv();

    await issueMirv(tx(), 'mirv-001', userId);

    expect(mockGenerateDocNumber).toHaveBeenCalledWith('gatepass');
    expect(mockPrisma.gatePass.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        gatePassNumber: 'GP-2026-0001',
        passType: 'outbound',
        mirvId: 'mirv-001',
        projectId: 'proj-001',
        warehouseId: 'wh-001',
        vehicleNumber: 'TBD',
        driverName: 'TBD',
        destination: 'Site Alpha',
        status: 'pending',
        issuedById: userId,
      }),
    });
    // Should mark gatePassAutoCreated = true
    expect(mockPrisma.mirv.update).toHaveBeenCalledWith({
      where: { id: 'mirv-001' },
      data: { gatePassAutoCreated: true },
    });
  });

  it('should use "Project Site" as destination when locationOfWork is null', async () => {
    setupFullIssueMirv({ locationOfWork: null });

    await issueMirv(tx(), 'mirv-001', userId);

    expect(mockPrisma.gatePass.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        destination: 'Project Site',
      }),
    });
  });

  it('should NOT create GatePass when gatePassAutoCreated is already true (idempotent)', async () => {
    setupFullIssueMirv({ gatePassAutoCreated: true });

    await issueMirv(tx(), 'mirv-001', userId);

    expect(mockGenerateDocNumber).not.toHaveBeenCalled();
    expect(mockPrisma.gatePass.create).not.toHaveBeenCalled();
  });

  it('should include auto-created note with MIRV number', async () => {
    setupFullIssueMirv({ mirvNumber: 'MIRV-2026-0042' });

    await issueMirv(tx(), 'mirv-001', userId);

    expect(mockPrisma.gatePass.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        notes: 'Auto-created from MI MIRV-2026-0042',
      }),
    });
  });

  // ── Error cases ────────────────────────────────────────────────────

  it('should throw NotFoundError when MIRV does not exist', async () => {
    mockPrisma.mirv.findUnique.mockResolvedValue(null);

    await expect(issueMirv(tx(), 'no-mirv', userId)).rejects.toThrow(NotFoundError);
  });

  it('should throw BusinessRuleError when status is draft', async () => {
    mockPrisma.mirv.findUnique.mockResolvedValue(
      makeMirv({ status: 'draft', qcSignatureId: 'qc', mirvLines: [makeLine()] }),
    );

    await expect(issueMirv(tx(), 'mirv-001', userId)).rejects.toThrow(
      'MIRV must be approved or partially issued to issue materials',
    );
  });

  it('should throw BusinessRuleError when status is cancelled', async () => {
    mockPrisma.mirv.findUnique.mockResolvedValue(
      makeMirv({ status: 'cancelled', qcSignatureId: 'qc', mirvLines: [makeLine()] }),
    );

    await expect(issueMirv(tx(), 'mirv-001', userId)).rejects.toThrow(BusinessRuleError);
  });

  it('should throw BusinessRuleError when no items remaining to issue', async () => {
    const fullyIssuedLine = makeLine({
      qtyApproved: decimal(10),
      qtyIssued: decimal(10),
    });
    mockPrisma.mirv.findUnique.mockResolvedValue(makeMirv({ qcSignatureId: 'qc', mirvLines: [fullyIssuedLine] }));

    await expect(issueMirv(tx(), 'mirv-001', userId)).rejects.toThrow('No items remaining to issue');
  });

  it('should throw when partial items specify zero qty for all lines', async () => {
    const line = makeLine({ id: 'line-001' });
    mockPrisma.mirv.findUnique.mockResolvedValue(makeMirv({ qcSignatureId: 'qc', mirvLines: [line] }));

    await expect(issueMirv(tx(), 'mirv-001', userId, [{ lineId: 'line-001', qty: 0 }])).rejects.toThrow(
      'No items remaining to issue',
    );
  });

  it('should accept partially_issued status for further issuance', async () => {
    const line = makeLine({
      id: 'line-001',
      qtyApproved: decimal(10),
      qtyIssued: decimal(5),
    });
    setupFullIssueMirv({ status: 'partially_issued', gatePassAutoCreated: true }, [line]);
    mockConsumeReservationBatch.mockResolvedValue({
      totalCost: 250,
      lineCosts: new Map([['line-001', 250]]),
    });

    const result = await issueMirv(tx(), 'mirv-001', userId);

    expect(result.status).toBe('issued');
    expect(mockConsumeReservationBatch).toHaveBeenCalledWith([expect.objectContaining({ qty: 5 })]);
  });

  it('should accumulate qtyIssued when issuing from partially_issued state', async () => {
    const line = makeLine({
      id: 'line-001',
      qtyApproved: decimal(20),
      qtyIssued: decimal(8),
    });
    setupFullIssueMirv({ status: 'partially_issued', gatePassAutoCreated: true }, [line]);
    mockConsumeReservationBatch.mockResolvedValue({
      totalCost: 300,
      lineCosts: new Map([['line-001', 300]]),
    });

    await issueMirv(tx(), 'mirv-001', userId, [{ lineId: 'line-001', qty: 5 }]);

    expect(mockPrisma.mirvLine.update).toHaveBeenCalledWith({
      where: { id: 'line-001' },
      data: {
        qtyIssued: 13, // 8 + 5
        unitCost: 300 / 5,
      },
    });
  });

  it('should exclude partial items not present in mirvLines', async () => {
    const line = makeLine({ id: 'line-001' });
    setupFullIssueMirv({}, [line]);
    mockConsumeReservationBatch.mockResolvedValue({
      totalCost: 500,
      lineCosts: new Map([['line-001', 500]]),
    });

    // 'line-999' does not exist; only line-001 should be consumed
    const result = await issueMirv(tx(), 'mirv-001', userId, [
      { lineId: 'line-001', qty: 10 },
      { lineId: 'line-999', qty: 5 },
    ]);

    expect(result.status).toBe('issued');
    expect(mockConsumeReservationBatch).toHaveBeenCalledWith([
      expect.objectContaining({ mirvLineId: 'line-001', qty: 10 }),
    ]);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// cancelMirv
// ═══════════════════════════════════════════════════════════════════════
describe('cancelMirv', () => {
  it('should cancel an approved MIRV with reserved stock and release reservations', async () => {
    const line1 = makeLine({ id: 'line-001', itemId: 'item-001', qtyApproved: decimal(10) });
    const line2 = makeLine({ id: 'line-002', itemId: 'item-002', qtyApproved: decimal(5) });
    const mirv = makeMirv({
      status: 'approved',
      reservationStatus: 'reserved',
      mirvLines: [line1, line2],
    });
    mockPrisma.mirv.findUnique.mockResolvedValue(mirv);
    const updatedMirv = { ...mirv, status: 'cancelled', reservationStatus: 'released' };
    mockPrisma.mirv.update.mockResolvedValue(updatedMirv);

    const result = await cancelMirv(tx(), 'mirv-001');

    expect(result.wasReserved).toBe(true);
    expect(result.warehouseId).toBe('wh-001');
    expect(mockReleaseReservation).toHaveBeenCalledTimes(2);
    expect(mockReleaseReservation).toHaveBeenCalledWith('item-001', 'wh-001', 10);
    expect(mockReleaseReservation).toHaveBeenCalledWith('item-002', 'wh-001', 5);
    expect(mockPrisma.mirv.update).toHaveBeenCalledWith({
      where: { id: 'mirv-001' },
      data: { status: 'cancelled', reservationStatus: 'released' },
    });
  });

  it('should cancel without releasing reservations when not reserved', async () => {
    const mirv = makeMirv({
      status: 'approved',
      reservationStatus: null,
      mirvLines: [makeLine()],
    });
    mockPrisma.mirv.findUnique.mockResolvedValue(mirv);
    mockPrisma.mirv.update.mockResolvedValue({ ...mirv, status: 'cancelled' });

    const result = await cancelMirv(tx(), 'mirv-001');

    expect(result.wasReserved).toBe(false);
    expect(mockReleaseReservation).not.toHaveBeenCalled();
  });

  it('should cancel a partially_issued MIRV', async () => {
    const mirv = makeMirv({
      status: 'partially_issued',
      reservationStatus: 'reserved',
      mirvLines: [makeLine()],
    });
    mockPrisma.mirv.findUnique.mockResolvedValue(mirv);
    mockPrisma.mirv.update.mockResolvedValue({ ...mirv, status: 'cancelled' });

    const result = await cancelMirv(tx(), 'mirv-001');

    expect(result.wasReserved).toBe(true);
    expect(result.updated.status).toBe('cancelled');
  });

  it('should cancel a pending_approval MIRV', async () => {
    const mirv = makeMirv({
      status: 'pending_approval',
      reservationStatus: null,
      mirvLines: [],
    });
    mockPrisma.mirv.findUnique.mockResolvedValue(mirv);
    mockPrisma.mirv.update.mockResolvedValue({ ...mirv, status: 'cancelled' });

    const result = await cancelMirv(tx(), 'mirv-001');

    expect(result.wasReserved).toBe(false);
    expect(mockPrisma.mirv.update).toHaveBeenCalled();
  });

  it('should use qtyRequested when qtyApproved is null for releasing reservations', async () => {
    const line = makeLine({
      id: 'line-001',
      itemId: 'item-001',
      qtyApproved: null,
      qtyRequested: decimal(20),
    });
    const mirv = makeMirv({
      status: 'approved',
      reservationStatus: 'reserved',
      mirvLines: [line],
    });
    mockPrisma.mirv.findUnique.mockResolvedValue(mirv);
    mockPrisma.mirv.update.mockResolvedValue({ ...mirv, status: 'cancelled' });

    await cancelMirv(tx(), 'mirv-001');

    expect(mockReleaseReservation).toHaveBeenCalledWith('item-001', 'wh-001', 20);
  });

  it('should throw NotFoundError when MIRV does not exist', async () => {
    mockPrisma.mirv.findUnique.mockResolvedValue(null);

    await expect(cancelMirv(tx(), 'nonexistent')).rejects.toThrow(NotFoundError);
  });

  it('should throw BusinessRuleError when status is draft', async () => {
    mockPrisma.mirv.findUnique.mockResolvedValue(makeMirv({ status: 'draft', mirvLines: [] }));

    await expect(cancelMirv(tx(), 'mirv-001')).rejects.toThrow('MIRV cannot be cancelled from status: draft');
  });

  it('should throw BusinessRuleError when status is issued', async () => {
    mockPrisma.mirv.findUnique.mockResolvedValue(makeMirv({ status: 'issued', mirvLines: [] }));

    await expect(cancelMirv(tx(), 'mirv-001')).rejects.toThrow('MIRV cannot be cancelled from status: issued');
  });

  it('should throw BusinessRuleError when status is cancelled (already cancelled)', async () => {
    mockPrisma.mirv.findUnique.mockResolvedValue(makeMirv({ status: 'cancelled', mirvLines: [] }));

    await expect(cancelMirv(tx(), 'mirv-001')).rejects.toThrow(BusinessRuleError);
  });

  it('should return the updated record from Prisma', async () => {
    const mirv = makeMirv({
      status: 'approved',
      reservationStatus: null,
      mirvLines: [],
    });
    mockPrisma.mirv.findUnique.mockResolvedValue(mirv);
    const updatedMirv = { ...mirv, status: 'cancelled', reservationStatus: 'released' };
    mockPrisma.mirv.update.mockResolvedValue(updatedMirv);

    const result = await cancelMirv(tx(), 'mirv-001');

    expect(result.updated).toEqual(updatedMirv);
  });
});
