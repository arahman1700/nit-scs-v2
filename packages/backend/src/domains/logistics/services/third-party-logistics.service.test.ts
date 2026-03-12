import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PrismaMock, PrismaModelMock } from '../../../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => ({ mockPrisma: {} as PrismaMock }));
vi.mock('../../../utils/prisma.js', () => ({ prisma: mockPrisma }));

import { createPrismaMock } from '../../../test-utils/prisma-mock.js';
import { NotFoundError } from '@nit-scs-v2/shared';
import {
  createContract,
  getContractById,
  getContracts,
  activateContract,
  suspendContract,
  terminateContract,
  createCharge,
  getCharges,
  approveCharge,
  invoiceCharge,
  payCharge,
  disputeCharge,
  getContractSummary,
} from './third-party-logistics.service.js';

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
// Helpers
// ---------------------------------------------------------------------------

function makeContractRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'contract-001',
    contractCode: '3PL-001',
    supplierId: 'sup-001',
    serviceType: 'warehousing',
    startDate: new Date('2026-01-01'),
    endDate: null,
    status: 'draft',
    rateSchedule: { storage_per_pallet_day: 5.0 },
    slaTerms: null,
    notes: null,
    createdAt: new Date('2026-01-01T10:00:00Z'),
    updatedAt: new Date('2026-01-01T10:00:00Z'),
    supplier: { id: 'sup-001', supplierName: 'ACME Logistics', supplierCode: 'SUP-001' },
    charges: [],
    ...overrides,
  };
}

function makeChargeRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'charge-001',
    contractId: 'contract-001',
    warehouseId: 'wh-001',
    chargeType: 'storage',
    description: 'Monthly storage',
    quantity: 100,
    unitRate: 5.0,
    totalAmount: 500,
    currency: 'SAR',
    refDocType: null,
    refDocId: null,
    status: 'draft',
    periodFrom: new Date('2026-01-01'),
    periodTo: new Date('2026-01-31'),
    approvedById: null,
    approvedAt: null,
    createdAt: new Date('2026-02-01T10:00:00Z'),
    updatedAt: new Date('2026-02-01T10:00:00Z'),
    contract: {
      id: 'contract-001',
      contractCode: '3PL-001',
      supplier: { id: 'sup-001', supplierName: 'ACME Logistics' },
    },
    warehouse: { id: 'wh-001', warehouseName: 'Main WH', warehouseCode: 'WH-01' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('third-party-logistics.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mockPrisma, createPrismaMock());
    (mockPrisma as Record<string, unknown>).thirdPartyContract = createModelMock();
    (mockPrisma as Record<string, unknown>).thirdPartyCharge = createModelMock();
  });

  const contract = () => (mockPrisma as unknown as { thirdPartyContract: PrismaModelMock }).thirdPartyContract;
  const charge = () => (mockPrisma as unknown as { thirdPartyCharge: PrismaModelMock }).thirdPartyCharge;

  // ########################################################################
  // Contract CRUD
  // ########################################################################

  describe('createContract', () => {
    it('should create a contract record', async () => {
      const input = {
        contractCode: '3PL-001',
        supplierId: 'sup-001',
        serviceType: 'warehousing',
        startDate: new Date('2026-01-01'),
        rateSchedule: { storage_per_pallet_day: 5.0 },
      };
      const created = makeContractRecord();
      contract().create.mockResolvedValue(created);

      const result = await createContract(input as never);

      expect(contract().create).toHaveBeenCalledWith({
        data: input,
        include: expect.objectContaining({ supplier: expect.any(Object) }),
      });
      expect(result).toEqual(created);
    });
  });

  describe('getContractById', () => {
    it('should return the contract when found', async () => {
      const record = makeContractRecord();
      contract().findUnique.mockResolvedValue(record);

      const result = await getContractById('contract-001');

      expect(contract().findUnique).toHaveBeenCalledWith({
        where: { id: 'contract-001' },
        include: expect.objectContaining({ supplier: expect.any(Object) }),
      });
      expect(result).toEqual(record);
    });

    it('should throw NotFoundError when not found', async () => {
      contract().findUnique.mockResolvedValue(null);
      await expect(getContractById('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  describe('getContracts', () => {
    it('should return paginated results with defaults', async () => {
      const records = [makeContractRecord()];
      contract().findMany.mockResolvedValue(records);
      contract().count.mockResolvedValue(1);

      const result = await getContracts({});

      expect(result).toEqual({ data: records, total: 1, page: 1, pageSize: 25 });
    });

    it('should apply supplierId and status filters', async () => {
      contract().findMany.mockResolvedValue([]);
      contract().count.mockResolvedValue(0);

      await getContracts({ supplierId: 'sup-001', status: 'active' });

      expect(contract().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ supplierId: 'sup-001', status: 'active' }),
        }),
      );
    });

    it('should apply serviceType filter', async () => {
      contract().findMany.mockResolvedValue([]);
      contract().count.mockResolvedValue(0);

      await getContracts({ serviceType: 'transportation' });

      expect(contract().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ serviceType: 'transportation' }),
        }),
      );
    });
  });

  // ########################################################################
  // Contract State Transitions
  // ########################################################################

  describe('activateContract', () => {
    it('should activate a draft contract', async () => {
      contract().findUnique.mockResolvedValue(makeContractRecord({ status: 'draft' }));
      contract().update.mockResolvedValue(makeContractRecord({ status: 'active' }));

      const result = await activateContract('contract-001');

      expect(contract().update).toHaveBeenCalledWith({
        where: { id: 'contract-001' },
        data: { status: 'active' },
        include: expect.objectContaining({ supplier: expect.any(Object) }),
      });
      expect(result.status).toBe('active');
    });

    it('should throw NotFoundError when not found', async () => {
      contract().findUnique.mockResolvedValue(null);
      await expect(activateContract('nonexistent')).rejects.toThrow(NotFoundError);
    });

    it('should throw error when status is not draft', async () => {
      contract().findUnique.mockResolvedValue(makeContractRecord({ status: 'active' }));
      await expect(activateContract('contract-001')).rejects.toThrow(
        "Cannot activate contract in status 'active'. Must be 'draft'.",
      );
    });
  });

  describe('suspendContract', () => {
    it('should suspend an active contract', async () => {
      contract().findUnique.mockResolvedValue(makeContractRecord({ status: 'active' }));
      contract().update.mockResolvedValue(makeContractRecord({ status: 'suspended' }));

      const result = await suspendContract('contract-001');
      expect(result.status).toBe('suspended');
    });

    it('should throw error when status is not active', async () => {
      contract().findUnique.mockResolvedValue(makeContractRecord({ status: 'draft' }));
      await expect(suspendContract('contract-001')).rejects.toThrow(
        "Cannot suspend contract in status 'draft'. Must be 'active'.",
      );
    });
  });

  describe('terminateContract', () => {
    it('should terminate a draft contract', async () => {
      contract().findUnique.mockResolvedValue(makeContractRecord({ status: 'draft' }));
      contract().update.mockResolvedValue(makeContractRecord({ status: 'terminated' }));

      const result = await terminateContract('contract-001');
      expect(result.status).toBe('terminated');
    });

    it('should terminate an active contract', async () => {
      contract().findUnique.mockResolvedValue(makeContractRecord({ status: 'active' }));
      contract().update.mockResolvedValue(makeContractRecord({ status: 'terminated' }));

      const result = await terminateContract('contract-001');
      expect(result.status).toBe('terminated');
    });

    it('should throw error when already terminated', async () => {
      contract().findUnique.mockResolvedValue(makeContractRecord({ status: 'terminated' }));
      await expect(terminateContract('contract-001')).rejects.toThrow('Contract is already terminated.');
    });

    it('should throw NotFoundError when not found', async () => {
      contract().findUnique.mockResolvedValue(null);
      await expect(terminateContract('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ########################################################################
  // Charge CRUD
  // ########################################################################

  describe('createCharge', () => {
    it('should create a charge record', async () => {
      const input = {
        contractId: 'contract-001',
        warehouseId: 'wh-001',
        chargeType: 'storage',
        quantity: 100,
        unitRate: 5.0,
        totalAmount: 500,
      };
      const created = makeChargeRecord();
      charge().create.mockResolvedValue(created);

      const result = await createCharge(input as never);

      expect(charge().create).toHaveBeenCalledWith({
        data: input,
        include: expect.objectContaining({ contract: expect.any(Object) }),
      });
      expect(result).toEqual(created);
    });
  });

  describe('getCharges', () => {
    it('should return paginated results with defaults', async () => {
      const records = [makeChargeRecord()];
      charge().findMany.mockResolvedValue(records);
      charge().count.mockResolvedValue(1);

      const result = await getCharges({});

      expect(result).toEqual({ data: records, total: 1, page: 1, pageSize: 25 });
    });

    it('should apply contractId and chargeType filters', async () => {
      charge().findMany.mockResolvedValue([]);
      charge().count.mockResolvedValue(0);

      await getCharges({ contractId: 'contract-001', chargeType: 'storage' });

      expect(charge().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contractId: 'contract-001',
            chargeType: 'storage',
          }),
        }),
      );
    });
  });

  // ########################################################################
  // Charge State Transitions
  // ########################################################################

  describe('approveCharge', () => {
    it('should approve a draft charge', async () => {
      charge().findUnique.mockResolvedValue(makeChargeRecord({ status: 'draft' }));
      charge().update.mockResolvedValue(makeChargeRecord({ status: 'approved', approvedById: 'approver-001' }));

      const result = await approveCharge('charge-001', 'approver-001');

      expect(charge().update).toHaveBeenCalledWith({
        where: { id: 'charge-001' },
        data: {
          status: 'approved',
          approvedById: 'approver-001',
          approvedAt: expect.any(Date),
        },
        include: expect.objectContaining({ contract: expect.any(Object) }),
      });
      expect(result.status).toBe('approved');
    });

    it('should throw error when status is not draft', async () => {
      charge().findUnique.mockResolvedValue(makeChargeRecord({ status: 'approved' }));
      await expect(approveCharge('charge-001', 'approver-001')).rejects.toThrow(
        "Cannot approve charge in status 'approved'. Must be 'draft'.",
      );
    });

    it('should throw NotFoundError when not found', async () => {
      charge().findUnique.mockResolvedValue(null);
      await expect(approveCharge('nonexistent', 'approver-001')).rejects.toThrow(NotFoundError);
    });
  });

  describe('invoiceCharge', () => {
    it('should invoice an approved charge', async () => {
      charge().findUnique.mockResolvedValue(makeChargeRecord({ status: 'approved' }));
      charge().update.mockResolvedValue(makeChargeRecord({ status: 'invoiced' }));

      const result = await invoiceCharge('charge-001');
      expect(result.status).toBe('invoiced');
    });

    it('should throw error when status is not approved', async () => {
      charge().findUnique.mockResolvedValue(makeChargeRecord({ status: 'draft' }));
      await expect(invoiceCharge('charge-001')).rejects.toThrow(
        "Cannot invoice charge in status 'draft'. Must be 'approved'.",
      );
    });
  });

  describe('payCharge', () => {
    it('should pay an invoiced charge', async () => {
      charge().findUnique.mockResolvedValue(makeChargeRecord({ status: 'invoiced' }));
      charge().update.mockResolvedValue(makeChargeRecord({ status: 'paid' }));

      const result = await payCharge('charge-001');
      expect(result.status).toBe('paid');
    });

    it('should throw error when status is not invoiced', async () => {
      charge().findUnique.mockResolvedValue(makeChargeRecord({ status: 'approved' }));
      await expect(payCharge('charge-001')).rejects.toThrow(
        "Cannot pay charge in status 'approved'. Must be 'invoiced'.",
      );
    });
  });

  describe('disputeCharge', () => {
    it('should dispute a draft charge', async () => {
      charge().findUnique.mockResolvedValue(makeChargeRecord({ status: 'draft' }));
      charge().update.mockResolvedValue(makeChargeRecord({ status: 'disputed' }));

      const result = await disputeCharge('charge-001');
      expect(result.status).toBe('disputed');
    });

    it('should dispute an approved charge', async () => {
      charge().findUnique.mockResolvedValue(makeChargeRecord({ status: 'approved' }));
      charge().update.mockResolvedValue(makeChargeRecord({ status: 'disputed' }));

      const result = await disputeCharge('charge-001');
      expect(result.status).toBe('disputed');
    });

    it('should throw error when already disputed', async () => {
      charge().findUnique.mockResolvedValue(makeChargeRecord({ status: 'disputed' }));
      await expect(disputeCharge('charge-001')).rejects.toThrow('Charge is already disputed.');
    });

    it('should throw error when charge is paid', async () => {
      charge().findUnique.mockResolvedValue(makeChargeRecord({ status: 'paid' }));
      await expect(disputeCharge('charge-001')).rejects.toThrow('Cannot dispute a paid charge.');
    });

    it('should throw NotFoundError when not found', async () => {
      charge().findUnique.mockResolvedValue(null);
      await expect(disputeCharge('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ########################################################################
  // Contract Summary
  // ########################################################################

  describe('getContractSummary', () => {
    it('should compute correct totals by charge status', async () => {
      contract().findUnique.mockResolvedValue(makeContractRecord());
      charge().findMany.mockResolvedValue([
        { status: 'draft', totalAmount: 100 },
        { status: 'approved', totalAmount: 200 },
        { status: 'invoiced', totalAmount: 300 },
        { status: 'paid', totalAmount: 400 },
        { status: 'disputed', totalAmount: 50 },
      ]);

      const summary = await getContractSummary('contract-001');

      expect(summary).toEqual({
        contractId: 'contract-001',
        draft: 100,
        approved: 200,
        invoiced: 300,
        paid: 400,
        disputed: 50,
        totalAmount: 1050,
      });
    });

    it('should return zeros when no charges exist', async () => {
      contract().findUnique.mockResolvedValue(makeContractRecord());
      charge().findMany.mockResolvedValue([]);

      const summary = await getContractSummary('contract-001');

      expect(summary).toEqual({
        contractId: 'contract-001',
        draft: 0,
        approved: 0,
        invoiced: 0,
        paid: 0,
        disputed: 0,
        totalAmount: 0,
      });
    });

    it('should throw NotFoundError when contract not found', async () => {
      contract().findUnique.mockResolvedValue(null);
      await expect(getContractSummary('nonexistent')).rejects.toThrow(NotFoundError);
    });
  });

  // ########################################################################
  // Full lifecycle
  // ########################################################################

  describe('full charge lifecycle', () => {
    it('should transition through draft -> approved -> invoiced -> paid', async () => {
      // draft -> approved
      charge().findUnique.mockResolvedValue(makeChargeRecord({ status: 'draft' }));
      charge().update.mockResolvedValue(makeChargeRecord({ status: 'approved' }));
      const r1 = await approveCharge('charge-001', 'approver-001');
      expect(r1.status).toBe('approved');

      // approved -> invoiced
      charge().findUnique.mockResolvedValue(makeChargeRecord({ status: 'approved' }));
      charge().update.mockResolvedValue(makeChargeRecord({ status: 'invoiced' }));
      const r2 = await invoiceCharge('charge-001');
      expect(r2.status).toBe('invoiced');

      // invoiced -> paid
      charge().findUnique.mockResolvedValue(makeChargeRecord({ status: 'invoiced' }));
      charge().update.mockResolvedValue(makeChargeRecord({ status: 'paid' }));
      const r3 = await payCharge('charge-001');
      expect(r3.status).toBe('paid');
    });
  });

  describe('full contract lifecycle', () => {
    it('should transition through draft -> active -> suspended -> terminated', async () => {
      // draft -> active
      contract().findUnique.mockResolvedValue(makeContractRecord({ status: 'draft' }));
      contract().update.mockResolvedValue(makeContractRecord({ status: 'active' }));
      const r1 = await activateContract('contract-001');
      expect(r1.status).toBe('active');

      // active -> suspended
      contract().findUnique.mockResolvedValue(makeContractRecord({ status: 'active' }));
      contract().update.mockResolvedValue(makeContractRecord({ status: 'suspended' }));
      const r2 = await suspendContract('contract-001');
      expect(r2.status).toBe('suspended');

      // suspended -> terminated
      contract().findUnique.mockResolvedValue(makeContractRecord({ status: 'suspended' }));
      contract().update.mockResolvedValue(makeContractRecord({ status: 'terminated' }));
      const r3 = await terminateContract('contract-001');
      expect(r3.status).toBe('terminated');
    });
  });
});
