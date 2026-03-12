/**
 * P6 Edge-Case Tests — Workflow Constraint Validation
 *
 * Unit tests for edge-case enforcement across P6 logistics services:
 * LPN state machine, WMS task lifecycle, wave picking, stock allocation,
 * 3PL contract/charge guards, RFID scan restrictions, carrier rate lookups.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaMock, PrismaModelMock } from '../../../test-utils/prisma-mock.js';

// ---------------------------------------------------------------------------
// Prisma mock setup — hoisted so vi.mock sees it before imports
// ---------------------------------------------------------------------------

const { mockPrisma } = vi.hoisted(() => ({ mockPrisma: {} as PrismaMock }));
vi.mock('../../../utils/prisma.js', () => ({ prisma: mockPrisma }));

import { createPrismaMock } from '../../../test-utils/prisma-mock.js';

// ---------------------------------------------------------------------------
// Service imports
// ---------------------------------------------------------------------------

import { receiveLpn, storeLpn } from '../../warehouse-ops/services/lpn.service.js';
import { assignTask, completeTask } from '../../warehouse-ops/services/wms-task.service.js';
import { release as releaseWave, complete as completeWave } from '../../warehouse-ops/services/wave.service.js';
import { allocate, release as releaseAllocation } from '../../warehouse-ops/services/stock-allocation.service.js';
import { createCharge } from '../../logistics/services/third-party-logistics.service.js';
import { recordScan } from '../../warehouse-ops/services/rfid.service.js';
import { findBestRate } from '../../logistics/services/carrier.service.js';

// ---------------------------------------------------------------------------
// Model mock factory (for P6 models not in the shared createPrismaMock)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Typed model accessors (P6 models are added dynamically)
// ---------------------------------------------------------------------------

const lp = () => (mockPrisma as unknown as { licensePlate: PrismaModelMock }).licensePlate;
const wmsTask = () => (mockPrisma as unknown as { wmsTask: PrismaModelMock }).wmsTask;
const waveHeader = () => (mockPrisma as unknown as { waveHeader: PrismaModelMock }).waveHeader;
const waveLine = () => (mockPrisma as unknown as { waveLine: PrismaModelMock }).waveLine;
const stockAlloc = () => (mockPrisma as unknown as { stockAllocation: PrismaModelMock }).stockAllocation;
const tpContract = () => (mockPrisma as unknown as { thirdPartyContract: PrismaModelMock }).thirdPartyContract;
const tpCharge = () => (mockPrisma as unknown as { thirdPartyCharge: PrismaModelMock }).thirdPartyCharge;
const rfidTag = () => (mockPrisma as unknown as { rfidTag: PrismaModelMock }).rfidTag;
const carrierSvc = () => (mockPrisma as unknown as { carrierService: PrismaModelMock }).carrierService;
const employeeMock = () => mockPrisma.employee;

// ---------------------------------------------------------------------------
// Shared setup — fresh mocks before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(mockPrisma, createPrismaMock());
  // Add P6 models not in the base mock
  (mockPrisma as Record<string, unknown>).licensePlate = createModelMock();
  (mockPrisma as Record<string, unknown>).lpnContent = createModelMock();
  (mockPrisma as Record<string, unknown>).wmsTask = createModelMock();
  (mockPrisma as Record<string, unknown>).waveHeader = createModelMock();
  (mockPrisma as Record<string, unknown>).waveLine = createModelMock();
  (mockPrisma as Record<string, unknown>).stockAllocation = createModelMock();
  (mockPrisma as Record<string, unknown>).thirdPartyContract = createModelMock();
  (mockPrisma as Record<string, unknown>).thirdPartyCharge = createModelMock();
  (mockPrisma as Record<string, unknown>).rfidTag = createModelMock();
  (mockPrisma as Record<string, unknown>).carrierService = createModelMock();
});

// ###########################################################################
// 1. LPN State Machine — cannot skip states
// ###########################################################################

describe('LPN state machine — cannot skip states', () => {
  it('created -> stored should fail (must go created -> in_receiving first)', async () => {
    lp().findUnique.mockResolvedValue({ id: 'lpn-1', status: 'created' });

    await expect(storeLpn('lpn-1')).rejects.toThrow("Cannot store LPN in status 'created'. Must be 'in_receiving'.");
  });

  it('in_receiving -> in_receiving should fail (cannot re-receive)', async () => {
    lp().findUnique.mockResolvedValue({ id: 'lpn-1', status: 'in_receiving' });

    await expect(receiveLpn('lpn-1')).rejects.toThrow(
      "Cannot receive LPN in status 'in_receiving'. Must be 'created'.",
    );
  });

  it('stored -> in_receiving should fail (cannot go backwards)', async () => {
    lp().findUnique.mockResolvedValue({ id: 'lpn-1', status: 'stored' });

    await expect(receiveLpn('lpn-1')).rejects.toThrow("Cannot receive LPN in status 'stored'. Must be 'created'.");
  });
});

// ###########################################################################
// 2. WMS Task — cannot assign to non-existent employee, cannot complete
//    without starting
// ###########################################################################

describe('WMS Task — edge cases', () => {
  it('cannot assign task to a non-existent employee', async () => {
    wmsTask().findUnique.mockResolvedValue({ id: 'task-1', status: 'pending' });
    employeeMock().findUnique.mockResolvedValue(null);

    await expect(assignTask('task-1', 'ghost-emp')).rejects.toThrow('Employee');
  });

  it('cannot complete a task that has not been started (pending)', async () => {
    wmsTask().findUnique.mockResolvedValue({ id: 'task-1', status: 'pending' });

    await expect(completeTask('task-1')).rejects.toThrow(
      "Cannot complete task in status 'pending'. Must be 'in_progress'.",
    );
  });

  it('cannot complete a task that is only assigned (not started)', async () => {
    wmsTask().findUnique.mockResolvedValue({ id: 'task-1', status: 'assigned' });

    await expect(completeTask('task-1')).rejects.toThrow(
      "Cannot complete task in status 'assigned'. Must be 'in_progress'.",
    );
  });
});

// ###########################################################################
// 3. Wave — cannot release empty wave (0 lines), cannot complete with
//    unpicked lines
// ###########################################################################

describe('Wave — edge cases', () => {
  it('cannot release a wave with 0 lines', async () => {
    waveHeader().findUnique.mockResolvedValue({
      id: 'wave-1',
      status: 'planning',
      totalLines: 0,
    });

    await expect(releaseWave('wave-1')).rejects.toThrow('Cannot release wave with 0 lines.');
  });

  it('cannot release a wave with null totalLines (treated as 0)', async () => {
    waveHeader().findUnique.mockResolvedValue({
      id: 'wave-1',
      status: 'planning',
      totalLines: null,
    });

    await expect(releaseWave('wave-1')).rejects.toThrow('Cannot release wave with 0 lines.');
  });

  it('cannot complete a wave with unpicked (pending) lines', async () => {
    waveHeader().findUnique.mockResolvedValue({
      id: 'wave-1',
      status: 'picking',
      lines: [
        { id: 'line-1', status: 'picked' },
        { id: 'line-2', status: 'pending' },
      ],
    });

    await expect(completeWave('wave-1')).rejects.toThrow(
      'Cannot complete wave: 1 line(s) still in non-terminal status.',
    );
  });

  it('can complete a wave when all lines are in terminal status (picked/short/cancelled)', async () => {
    waveHeader().findUnique.mockResolvedValue({
      id: 'wave-1',
      status: 'picking',
      lines: [
        { id: 'line-1', status: 'picked' },
        { id: 'line-2', status: 'short' },
        { id: 'line-3', status: 'cancelled' },
      ],
    });
    waveHeader().update.mockResolvedValue({
      id: 'wave-1',
      status: 'completed',
      completedAt: new Date(),
    });

    const result = await completeWave('wave-1');
    expect(result.status).toBe('completed');
  });
});

// ###########################################################################
// 4. Stock Allocation — cannot allocate negative quantity, cannot
//    double-release
// ###########################################################################

describe('Stock Allocation — edge cases', () => {
  it('cannot allocate a negative quantity', async () => {
    await expect(
      allocate({
        warehouseId: 'wh-1',
        itemId: 'item-1',
        qtyAllocated: -5,
        allocType: 'hard',
        demandDocType: 'mi',
        demandDocId: 'mi-1',
      }),
    ).rejects.toThrow('Allocated quantity must be greater than zero.');
  });

  it('cannot allocate zero quantity', async () => {
    await expect(
      allocate({
        warehouseId: 'wh-1',
        itemId: 'item-1',
        qtyAllocated: 0,
        allocType: 'hard',
        demandDocType: 'mi',
        demandDocId: 'mi-1',
      }),
    ).rejects.toThrow('Allocated quantity must be greater than zero.');
  });

  it('cannot double-release an already released allocation', async () => {
    stockAlloc().findUnique.mockResolvedValue({
      id: 'alloc-1',
      status: 'released',
    });

    await expect(releaseAllocation('alloc-1')).rejects.toThrow(
      "Cannot release allocation in status 'released'. Must be 'active'.",
    );
  });

  it('cannot release a picked allocation', async () => {
    stockAlloc().findUnique.mockResolvedValue({
      id: 'alloc-1',
      status: 'picked',
    });

    await expect(releaseAllocation('alloc-1')).rejects.toThrow(
      "Cannot release allocation in status 'picked'. Must be 'active'.",
    );
  });
});

// ###########################################################################
// 5. 3PL — cannot create charge on terminated contract
// ###########################################################################

describe('3PL — edge cases', () => {
  it('cannot create a charge on a terminated contract', async () => {
    tpContract().findUnique.mockResolvedValue({
      id: 'contract-1',
      status: 'terminated',
    });

    await expect(
      createCharge({
        contractId: 'contract-1',
        chargeType: 'storage',
        totalAmount: 1000,
        currency: 'SAR',
      } as never),
    ).rejects.toThrow('Cannot create charge on a terminated contract.');
  });

  it('allows creating a charge on an active contract', async () => {
    tpContract().findUnique.mockResolvedValue({
      id: 'contract-1',
      status: 'active',
    });
    tpCharge().create.mockResolvedValue({
      id: 'charge-1',
      contractId: 'contract-1',
      status: 'draft',
      totalAmount: 500,
    });

    const result = await createCharge({
      contractId: 'contract-1',
      chargeType: 'storage',
      totalAmount: 500,
      currency: 'SAR',
    } as never);

    expect(result.id).toBe('charge-1');
    expect(tpCharge().create).toHaveBeenCalled();
  });
});

// ###########################################################################
// 6. RFID — cannot scan deactivated tag
// ###########################################################################

describe('RFID — edge cases', () => {
  it('cannot scan a deactivated tag', async () => {
    rfidTag().findUnique.mockResolvedValue({
      epc: 'E200-0001',
      isActive: false,
      tagType: 'lpn',
    });

    await expect(recordScan('E200-0001', 'reader-dock-01')).rejects.toThrow('Tag is deactivated');
  });

  it('allows scanning an active tag', async () => {
    rfidTag().findUnique.mockResolvedValue({
      epc: 'E200-0001',
      isActive: true,
      tagType: 'lpn',
    });
    rfidTag().update.mockResolvedValue({
      epc: 'E200-0001',
      isActive: true,
      lastSeenAt: new Date(),
      lastReaderId: 'reader-dock-01',
    });

    const result = await recordScan('E200-0001', 'reader-dock-01');
    expect(result.lastReaderId).toBe('reader-dock-01');
  });
});

// ###########################################################################
// 7. Carrier — findBestRate returns null for non-existent mode
// ###########################################################################

describe('Carrier — edge cases', () => {
  it('returns null when no carriers exist for the given mode', async () => {
    carrierSvc().findMany.mockResolvedValue([]);

    const result = await findBestRate('teleportation');
    expect(result).toBeNull();
  });

  it('returns ranked list when carriers exist for the mode', async () => {
    carrierSvc().findMany.mockResolvedValue([
      {
        id: 'c-1',
        carrierName: 'FastFreight',
        serviceName: 'Express',
        serviceCode: 'FF-EXP',
        transitDays: 2,
        ratePerUnit: 10,
        minCharge: 50,
        currency: 'SAR',
        mode: 'road',
        isActive: true,
      },
    ]);

    const result = await findBestRate('road', 100);
    expect(result).not.toBeNull();
    expect(result!.length).toBe(1);
    expect(result![0].carrierName).toBe('FastFreight');
    expect(result![0].estimatedCost).toBe(1000); // 10 * 100 = 1000 > 50 minCharge
  });
});
