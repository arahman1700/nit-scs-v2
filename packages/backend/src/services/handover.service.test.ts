import type { PrismaMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

// ── mocks ────────────────────────────────────────────────────────────
vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../config/logger.js', () => ({ log: vi.fn() }));
vi.mock('@nit-scs-v2/shared', async importOriginal => {
  const actual = await importOriginal<typeof import('@nit-scs-v2/shared')>();
  return { ...actual, assertTransition: vi.fn() };
});

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { list, getById, create, update, startVerification, complete } from './handover.service.js';
import { NotFoundError, BusinessRuleError, assertTransition } from '@nit-scs-v2/shared';

const mockedAssertTransition = assertTransition as ReturnType<typeof vi.fn>;

// ── helpers ──────────────────────────────────────────────────────────
const USER_ID = 'user-1';
const HANDOVER_ID = 'handover-1';

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
    const rows = [{ id: HANDOVER_ID }];
    mockPrisma.storekeeperHandover.findMany.mockResolvedValue(rows);
    mockPrisma.storekeeperHandover.count.mockResolvedValue(1);

    const result = await list(baseListParams);

    expect(result).toEqual({ data: rows, total: 1 });
  });

  it('applies warehouseId filter', async () => {
    mockPrisma.storekeeperHandover.findMany.mockResolvedValue([]);
    mockPrisma.storekeeperHandover.count.mockResolvedValue(0);

    await list({ ...baseListParams, warehouseId: 'wh-1' });

    const where = mockPrisma.storekeeperHandover.findMany.mock.calls[0][0].where;
    expect(where.warehouseId).toBe('wh-1');
  });

  it('applies status filter', async () => {
    mockPrisma.storekeeperHandover.findMany.mockResolvedValue([]);
    mockPrisma.storekeeperHandover.count.mockResolvedValue(0);

    await list({ ...baseListParams, status: 'initiated' });

    const where = mockPrisma.storekeeperHandover.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('initiated');
  });
});

// ── getById ──────────────────────────────────────────────────────────
describe('getById', () => {
  it('returns the StorekeeperHandover when found', async () => {
    const record = { id: HANDOVER_ID, status: 'initiated' };
    mockPrisma.storekeeperHandover.findUnique.mockResolvedValue(record);

    const result = await getById(HANDOVER_ID);

    expect(result).toEqual(record);
    expect(mockPrisma.storekeeperHandover.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: HANDOVER_ID } }),
    );
  });

  it('throws NotFoundError when StorekeeperHandover does not exist', async () => {
    mockPrisma.storekeeperHandover.findUnique.mockResolvedValue(null);

    await expect(getById('nonexistent')).rejects.toThrow(NotFoundError);
  });
});

// ── create ───────────────────────────────────────────────────────────
describe('create', () => {
  const data = {
    warehouseId: 'wh-1',
    outgoingEmployeeId: 'emp-1',
    incomingEmployeeId: 'emp-2',
    handoverDate: '2026-02-15',
    notes: 'Test handover',
  };

  it('creates a handover with status initiated', async () => {
    mockPrisma.storekeeperHandover.create.mockResolvedValue({
      id: HANDOVER_ID,
      status: 'initiated',
    });

    const result = await create(data as any, USER_ID);

    expect(result).toEqual({ id: HANDOVER_ID, status: 'initiated' });
    const createArgs = mockPrisma.storekeeperHandover.create.mock.calls[0][0];
    expect(createArgs.data.status).toBe('initiated');
    expect(createArgs.data.handoverDate).toBeInstanceOf(Date);
  });
});

// ── update ───────────────────────────────────────────────────────────
describe('update', () => {
  it('updates a handover in initiated status and returns existing + updated', async () => {
    const existing = { id: HANDOVER_ID, status: 'initiated' };
    const updated = { id: HANDOVER_ID, status: 'initiated', notes: 'Updated notes' };
    mockPrisma.storekeeperHandover.findUnique.mockResolvedValue(existing);
    mockPrisma.storekeeperHandover.update.mockResolvedValue(updated);

    const result = await update(HANDOVER_ID, { notes: 'Updated notes' } as any);

    expect(result).toEqual({ existing, updated });
  });

  it('throws NotFoundError when StorekeeperHandover does not exist', async () => {
    mockPrisma.storekeeperHandover.findUnique.mockResolvedValue(null);

    await expect(update('bad-id', {} as any)).rejects.toThrow(NotFoundError);
  });

  it('throws BusinessRuleError when handover is not in initiated status', async () => {
    mockPrisma.storekeeperHandover.findUnique.mockResolvedValue({
      id: HANDOVER_ID,
      status: 'in_progress',
    });

    await expect(update(HANDOVER_ID, {} as any)).rejects.toThrow(BusinessRuleError);
    await expect(update(HANDOVER_ID, {} as any)).rejects.toThrow('Only handovers in "initiated" status can be updated');
  });
});

// ── startVerification ────────────────────────────────────────────────
describe('startVerification', () => {
  it('transitions handover to in_progress', async () => {
    const record = { id: HANDOVER_ID, status: 'initiated' };
    mockPrisma.storekeeperHandover.findUnique.mockResolvedValue(record);
    mockedAssertTransition.mockReturnValue(undefined);
    mockPrisma.storekeeperHandover.update.mockResolvedValue({
      ...record,
      status: 'in_progress',
    });

    const result = await startVerification(HANDOVER_ID, USER_ID);

    expect(mockedAssertTransition).toHaveBeenCalledWith('storekeeper_handover', 'initiated', 'in_progress');
    expect(result.status).toBe('in_progress');
  });

  it('throws NotFoundError when StorekeeperHandover does not exist', async () => {
    mockPrisma.storekeeperHandover.findUnique.mockResolvedValue(null);

    await expect(startVerification('bad-id', USER_ID)).rejects.toThrow(NotFoundError);
  });

  it('throws when assertTransition rejects the transition', async () => {
    const record = { id: HANDOVER_ID, status: 'completed' };
    mockPrisma.storekeeperHandover.findUnique.mockResolvedValue(record);
    mockedAssertTransition.mockImplementation(() => {
      throw new BusinessRuleError('Invalid transition');
    });

    await expect(startVerification(HANDOVER_ID, USER_ID)).rejects.toThrow('Invalid transition');
    expect(mockPrisma.storekeeperHandover.update).not.toHaveBeenCalled();
  });
});

// ── complete ─────────────────────────────────────────────────────────
describe('complete', () => {
  it('transitions handover to completed when inventory is verified', async () => {
    const record = { id: HANDOVER_ID, status: 'in_progress', inventoryVerified: true };
    mockPrisma.storekeeperHandover.findUnique.mockResolvedValue(record);
    mockedAssertTransition.mockReturnValue(undefined);
    mockPrisma.storekeeperHandover.update.mockResolvedValue({
      ...record,
      status: 'completed',
    });

    const result = await complete(HANDOVER_ID, USER_ID);

    expect(mockedAssertTransition).toHaveBeenCalledWith('storekeeper_handover', 'in_progress', 'completed');
    expect(result.status).toBe('completed');
  });

  it('throws NotFoundError when StorekeeperHandover does not exist', async () => {
    mockPrisma.storekeeperHandover.findUnique.mockResolvedValue(null);

    await expect(complete('bad-id', USER_ID)).rejects.toThrow(NotFoundError);
  });

  it('throws BusinessRuleError when inventory is not verified', async () => {
    const record = { id: HANDOVER_ID, status: 'in_progress', inventoryVerified: false };
    mockPrisma.storekeeperHandover.findUnique.mockResolvedValue(record);
    mockedAssertTransition.mockReturnValue(undefined);

    await expect(complete(HANDOVER_ID, USER_ID)).rejects.toThrow(
      'Inventory must be verified before completing the handover',
    );
  });

  it('throws when assertTransition rejects the transition', async () => {
    const record = { id: HANDOVER_ID, status: 'initiated', inventoryVerified: true };
    mockPrisma.storekeeperHandover.findUnique.mockResolvedValue(record);
    mockedAssertTransition.mockImplementation(() => {
      throw new BusinessRuleError('Invalid transition');
    });

    await expect(complete(HANDOVER_ID, USER_ID)).rejects.toThrow('Invalid transition');
    expect(mockPrisma.storekeeperHandover.update).not.toHaveBeenCalled();
  });
});
