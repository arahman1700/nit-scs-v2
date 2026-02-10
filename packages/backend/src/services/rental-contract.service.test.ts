import type { PrismaMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

// ── mocks ────────────────────────────────────────────────────────────
vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('./document-number.service.js', () => ({ generateDocumentNumber: vi.fn() }));
vi.mock('../config/logger.js', () => ({ log: vi.fn() }));
vi.mock('@nit-scs-v2/shared', async importOriginal => {
  const actual = await importOriginal<typeof import('@nit-scs-v2/shared')>();
  return { ...actual, assertTransition: vi.fn() };
});

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import {
  list,
  getById,
  create,
  update,
  submit,
  approve,
  activate,
  extend,
  terminate,
} from './rental-contract.service.js';
import { generateDocumentNumber } from './document-number.service.js';
import { NotFoundError, BusinessRuleError, assertTransition } from '@nit-scs-v2/shared';

// ── helpers ──────────────────────────────────────────────────────────
const USER_ID = 'user-1';
const RC_ID = 'rc-1';

function makeRentalContract(overrides: Record<string, unknown> = {}) {
  return {
    id: RC_ID,
    contractNumber: 'RC-0001',
    status: 'draft',
    supplierId: 'supplier-1',
    equipmentType: 'crane',
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-06-30'),
    monthlyRate: 5000,
    dailyRate: null,
    insuranceValue: null,
    insuranceExpiry: null,
    notes: null,
    createdById: USER_ID,
    rentalLines: [],
    ...overrides,
  };
}

function makeLines() {
  return [
    { equipmentDescription: 'Crane A', qty: 2, unitRate: 1000, totalRate: 2000 },
    { equipmentDescription: 'Crane B', qty: 1, unitRate: 1500, totalRate: 1500 },
  ];
}

const baseListParams = {
  sortBy: 'createdAt',
  sortDir: 'desc' as const,
  skip: 0,
  pageSize: 20,
};

// ── setup ────────────────────────────────────────────────────────────
beforeEach(() => {
  vi.resetAllMocks();
  Object.assign(mockPrisma, createPrismaMock());
});

// ── list ─────────────────────────────────────────────────────────────
describe('list', () => {
  it('returns data and total count', async () => {
    const contracts = [makeRentalContract()];
    mockPrisma.rentalContract.findMany.mockResolvedValue(contracts);
    mockPrisma.rentalContract.count.mockResolvedValue(1);

    const result = await list(baseListParams);

    expect(result).toEqual({ data: contracts, total: 1 });
    expect(mockPrisma.rentalContract.findMany).toHaveBeenCalledOnce();
    expect(mockPrisma.rentalContract.count).toHaveBeenCalledOnce();
  });

  it('applies search filter on contractNumber and supplier.supplierName', async () => {
    mockPrisma.rentalContract.findMany.mockResolvedValue([]);
    mockPrisma.rentalContract.count.mockResolvedValue(0);

    await list({ ...baseListParams, search: 'RC-00' });

    const call = mockPrisma.rentalContract.findMany.mock.calls[0][0];
    expect(call.where.OR).toEqual([
      { contractNumber: { contains: 'RC-00', mode: 'insensitive' } },
      { supplier: { supplierName: { contains: 'RC-00', mode: 'insensitive' } } },
    ]);
  });

  it('applies status filter', async () => {
    mockPrisma.rentalContract.findMany.mockResolvedValue([]);
    mockPrisma.rentalContract.count.mockResolvedValue(0);

    await list({ ...baseListParams, status: 'active' });

    const call = mockPrisma.rentalContract.findMany.mock.calls[0][0];
    expect(call.where.status).toBe('active');
  });

  it('applies supplierId filter', async () => {
    mockPrisma.rentalContract.findMany.mockResolvedValue([]);
    mockPrisma.rentalContract.count.mockResolvedValue(0);

    await list({ ...baseListParams, supplierId: 'supplier-1' });

    const call = mockPrisma.rentalContract.findMany.mock.calls[0][0];
    expect(call.where.supplierId).toBe('supplier-1');
  });
});

// ── getById ──────────────────────────────────────────────────────────
describe('getById', () => {
  it('returns Rental Contract when found', async () => {
    const contract = makeRentalContract();
    mockPrisma.rentalContract.findUnique.mockResolvedValue(contract);

    const result = await getById(RC_ID);

    expect(result).toEqual(contract);
    expect(mockPrisma.rentalContract.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: RC_ID } }),
    );
  });

  it('throws NotFoundError when Rental Contract does not exist', async () => {
    mockPrisma.rentalContract.findUnique.mockResolvedValue(null);

    await expect(getById('nonexistent')).rejects.toThrow(NotFoundError);
  });
});

// ── create ───────────────────────────────────────────────────────────
describe('create', () => {
  it('generates doc number and creates Rental Contract with lines in a transaction', async () => {
    vi.mocked(generateDocumentNumber).mockResolvedValue('RC-0001');
    const lines = makeLines();
    const created = makeRentalContract({ rentalLines: lines });
    mockPrisma.rentalContract.create.mockResolvedValue(created);

    const header = {
      supplierId: 'supplier-1',
      equipmentType: 'crane',
      startDate: '2026-01-01',
      endDate: '2026-06-30',
      monthlyRate: 5000,
    };

    const result = await create(header as any, lines as any, USER_ID);

    expect(generateDocumentNumber).toHaveBeenCalledWith('rental_contract');
    expect(mockPrisma.rentalContract.create).toHaveBeenCalledOnce();
    expect(result).toEqual(created);
  });

  it('sets status to draft', async () => {
    vi.mocked(generateDocumentNumber).mockResolvedValue('RC-0002');
    mockPrisma.rentalContract.create.mockResolvedValue(makeRentalContract());

    await create(
      {
        supplierId: 'supplier-1',
        equipmentType: 'crane',
        startDate: '2026-01-01',
        endDate: '2026-06-30',
      } as any,
      [],
      USER_ID,
    );

    const createCall = mockPrisma.rentalContract.create.mock.calls[0][0];
    expect(createCall.data.status).toBe('draft');
  });

  it('creates rental lines within the contract', async () => {
    vi.mocked(generateDocumentNumber).mockResolvedValue('RC-0003');
    mockPrisma.rentalContract.create.mockResolvedValue(makeRentalContract());

    const lines = makeLines();
    await create(
      {
        supplierId: 'supplier-1',
        equipmentType: 'crane',
        startDate: '2026-01-01',
        endDate: '2026-06-30',
      } as any,
      lines as any,
      USER_ID,
    );

    const createCall = mockPrisma.rentalContract.create.mock.calls[0][0];
    expect(createCall.data.rentalLines.create).toHaveLength(2);
    expect(createCall.data.rentalLines.create[0]).toEqual(
      expect.objectContaining({
        equipmentDescription: 'Crane A',
        qty: 2,
        unitRate: 1000,
        totalRate: 2000,
      }),
    );
  });
});

// ── update ───────────────────────────────────────────────────────────
describe('update', () => {
  it('updates a draft Rental Contract and returns existing + updated', async () => {
    const existing = makeRentalContract({ status: 'draft' });
    const updated = { ...existing, notes: 'updated' };
    mockPrisma.rentalContract.findUnique.mockResolvedValue(existing);
    mockPrisma.rentalContract.update.mockResolvedValue(updated);

    const result = await update(RC_ID, { notes: 'updated' } as any);

    expect(result).toEqual({ existing, updated });
  });

  it('throws NotFoundError when Rental Contract does not exist', async () => {
    mockPrisma.rentalContract.findUnique.mockResolvedValue(null);

    await expect(update('bad-id', {} as any)).rejects.toThrow(NotFoundError);
  });

  it('throws BusinessRuleError when Rental Contract is not draft', async () => {
    mockPrisma.rentalContract.findUnique.mockResolvedValue(makeRentalContract({ status: 'active' }));

    await expect(update(RC_ID, {} as any)).rejects.toThrow(BusinessRuleError);
    await expect(update(RC_ID, {} as any)).rejects.toThrow('Only draft rental contracts can be updated');
  });
});

// ── submit ───────────────────────────────────────────────────────────
describe('submit', () => {
  it('transitions Rental Contract to pending_approval', async () => {
    const contract = makeRentalContract({
      status: 'draft',
      rentalLines: [{ id: 'line-1', equipmentDescription: 'Crane A', qty: 1, unitRate: 1000, totalRate: 1000 }],
    });
    mockPrisma.rentalContract.findUnique.mockResolvedValue(contract);
    mockPrisma.rentalContract.update.mockResolvedValue({ ...contract, status: 'pending_approval' });

    const result = await submit(RC_ID);

    expect(assertTransition).toHaveBeenCalledWith('rental_contract', 'draft', 'pending_approval');
    expect(mockPrisma.rentalContract.update).toHaveBeenCalledWith({
      where: { id: RC_ID },
      data: { status: 'pending_approval' },
    });
    expect(result.status).toBe('pending_approval');
  });

  it('throws NotFoundError when Rental Contract does not exist', async () => {
    mockPrisma.rentalContract.findUnique.mockResolvedValue(null);

    await expect(submit('bad-id')).rejects.toThrow(NotFoundError);
  });

  it('throws BusinessRuleError when contract has no line items', async () => {
    const contract = makeRentalContract({ status: 'draft', rentalLines: [] });
    mockPrisma.rentalContract.findUnique.mockResolvedValue(contract);

    await expect(submit(RC_ID)).rejects.toThrow(BusinessRuleError);
    await expect(submit(RC_ID)).rejects.toThrow('Cannot submit rental contract with no line items');
  });

  it('calls assertTransition which may throw on invalid transition', async () => {
    const contract = makeRentalContract({
      status: 'active',
      rentalLines: [{ id: 'line-1' }],
    });
    mockPrisma.rentalContract.findUnique.mockResolvedValue(contract);
    vi.mocked(assertTransition).mockImplementation(() => {
      throw new BusinessRuleError('Invalid transition');
    });

    await expect(submit(RC_ID)).rejects.toThrow('Invalid transition');
  });
});

// ── approve ──────────────────────────────────────────────────────────
describe('approve', () => {
  it('transitions Rental Contract to active', async () => {
    const contract = makeRentalContract({ status: 'pending_approval' });
    mockPrisma.rentalContract.findUnique.mockResolvedValue(contract);
    mockPrisma.rentalContract.update.mockResolvedValue({ ...contract, status: 'active' });

    const result = await approve(RC_ID);

    expect(assertTransition).toHaveBeenCalledWith('rental_contract', 'pending_approval', 'active');
    expect(mockPrisma.rentalContract.update).toHaveBeenCalledWith({
      where: { id: RC_ID },
      data: { status: 'active' },
    });
    expect(result.status).toBe('active');
  });

  it('throws NotFoundError when Rental Contract does not exist', async () => {
    mockPrisma.rentalContract.findUnique.mockResolvedValue(null);

    await expect(approve('bad-id')).rejects.toThrow(NotFoundError);
  });
});

// ── activate ─────────────────────────────────────────────────────────
describe('activate', () => {
  it('transitions Rental Contract to active', async () => {
    const contract = makeRentalContract({ status: 'pending_approval' });
    mockPrisma.rentalContract.findUnique.mockResolvedValue(contract);
    mockPrisma.rentalContract.update.mockResolvedValue({ ...contract, status: 'active' });

    const result = await activate(RC_ID);

    expect(assertTransition).toHaveBeenCalledWith('rental_contract', 'pending_approval', 'active');
    expect(result.status).toBe('active');
  });

  it('throws NotFoundError when Rental Contract does not exist', async () => {
    mockPrisma.rentalContract.findUnique.mockResolvedValue(null);

    await expect(activate('bad-id')).rejects.toThrow(NotFoundError);
  });
});

// ── extend ───────────────────────────────────────────────────────────
describe('extend', () => {
  it('transitions Rental Contract to extended with new end date', async () => {
    const contract = makeRentalContract({ status: 'active' });
    const newEndDate = '2026-12-31';
    mockPrisma.rentalContract.findUnique.mockResolvedValue(contract);
    mockPrisma.rentalContract.update.mockResolvedValue({
      ...contract,
      status: 'extended',
      endDate: new Date(newEndDate),
    });

    const result = await extend(RC_ID, newEndDate);

    expect(assertTransition).toHaveBeenCalledWith('rental_contract', 'active', 'extended');
    expect(mockPrisma.rentalContract.update).toHaveBeenCalledWith({
      where: { id: RC_ID },
      data: { status: 'extended', endDate: new Date(newEndDate) },
    });
    expect(result.status).toBe('extended');
  });

  it('throws NotFoundError when Rental Contract does not exist', async () => {
    mockPrisma.rentalContract.findUnique.mockResolvedValue(null);

    await expect(extend('bad-id', '2026-12-31')).rejects.toThrow(NotFoundError);
  });
});

// ── terminate ────────────────────────────────────────────────────────
describe('terminate', () => {
  it('transitions Rental Contract to terminated', async () => {
    const contract = makeRentalContract({ status: 'active' });
    mockPrisma.rentalContract.findUnique.mockResolvedValue(contract);
    mockPrisma.rentalContract.update.mockResolvedValue({ ...contract, status: 'terminated' });

    const result = await terminate(RC_ID);

    expect(assertTransition).toHaveBeenCalledWith('rental_contract', 'active', 'terminated');
    expect(mockPrisma.rentalContract.update).toHaveBeenCalledWith({
      where: { id: RC_ID },
      data: { status: 'terminated' },
    });
    expect(result.status).toBe('terminated');
  });

  it('throws NotFoundError when Rental Contract does not exist', async () => {
    mockPrisma.rentalContract.findUnique.mockResolvedValue(null);

    await expect(terminate('bad-id')).rejects.toThrow(NotFoundError);
  });
});
