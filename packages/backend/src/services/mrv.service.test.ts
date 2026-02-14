import type { PrismaMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

// ── mocks ────────────────────────────────────────────────────────────
vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('./document-number.service.js', () => ({ generateDocumentNumber: vi.fn() }));
vi.mock('./inventory.service.js', () => ({ addStockBatch: vi.fn() }));
vi.mock('../config/logger.js', () => ({ log: vi.fn() }));
vi.mock('@nit-scs-v2/shared', async importOriginal => {
  const actual = await importOriginal<typeof import('@nit-scs-v2/shared')>();
  return { ...actual, assertTransition: vi.fn() };
});

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { list, getById, create, update, submit, receive, complete } from './mrv.service.js';
import { generateDocumentNumber } from './document-number.service.js';
import { addStockBatch } from './inventory.service.js';
import { NotFoundError, BusinessRuleError, assertTransition } from '@nit-scs-v2/shared';

const _mockedGenDoc = generateDocumentNumber as ReturnType<typeof vi.fn>;
const mockedAddStockBatch = addStockBatch as ReturnType<typeof vi.fn>;
const _mockedAssertTransition = assertTransition as ReturnType<typeof vi.fn>;

// ── helpers ──────────────────────────────────────────────────────────
const USER_ID = 'user-1';
const MRV_ID = 'mrv-1';

function makeMrv(overrides: Record<string, unknown> = {}) {
  return {
    id: MRV_ID,
    mrvNumber: 'MRV-0001',
    status: 'draft',
    toWarehouseId: 'wh-1',
    returnedById: USER_ID,
    mrvLines: [],
    ...overrides,
  };
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
    const mrvs = [makeMrv()];
    mockPrisma.mrv.findMany.mockResolvedValue(mrvs);
    mockPrisma.mrv.count.mockResolvedValue(1);

    const result = await list(baseListParams);

    expect(result).toEqual({ data: mrvs, total: 1 });
    expect(mockPrisma.mrv.findMany).toHaveBeenCalledOnce();
    expect(mockPrisma.mrv.count).toHaveBeenCalledOnce();
  });

  it('applies search filter on mrvNumber', async () => {
    mockPrisma.mrv.findMany.mockResolvedValue([]);
    mockPrisma.mrv.count.mockResolvedValue(0);

    await list({ ...baseListParams, search: 'MRV-00' });

    const call = mockPrisma.mrv.findMany.mock.calls[0][0];
    expect(call.where.OR).toEqual([{ mrvNumber: { contains: 'MRV-00', mode: 'insensitive' } }]);
  });

  it('applies status filter', async () => {
    mockPrisma.mrv.findMany.mockResolvedValue([]);
    mockPrisma.mrv.count.mockResolvedValue(0);

    await list({ ...baseListParams, status: 'pending' });

    const call = mockPrisma.mrv.findMany.mock.calls[0][0];
    expect(call.where.status).toBe('pending');
  });

  it('applies scope filters (toWarehouseId, projectId, returnedById)', async () => {
    mockPrisma.mrv.findMany.mockResolvedValue([]);
    mockPrisma.mrv.count.mockResolvedValue(0);

    await list({
      ...baseListParams,
      toWarehouseId: 'wh-1',
      projectId: 'proj-1',
      returnedById: 'user-2',
    });

    const call = mockPrisma.mrv.findMany.mock.calls[0][0];
    expect(call.where.toWarehouseId).toBe('wh-1');
    expect(call.where.projectId).toBe('proj-1');
    expect(call.where.returnedById).toBe('user-2');
  });
});

// ── getById ──────────────────────────────────────────────────────────
describe('getById', () => {
  it('returns MRV when found', async () => {
    const mrv = makeMrv();
    mockPrisma.mrv.findUnique.mockResolvedValue(mrv);

    const result = await getById(MRV_ID);

    expect(result).toEqual(mrv);
    expect(mockPrisma.mrv.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: MRV_ID } }));
  });

  it('throws NotFoundError when MRV does not exist', async () => {
    mockPrisma.mrv.findUnique.mockResolvedValue(null);

    await expect(getById('nonexistent')).rejects.toThrow(NotFoundError);
  });
});

// ── create ───────────────────────────────────────────────────────────
describe('create', () => {
  it('generates doc number and creates MRV with lines in a transaction', async () => {
    vi.mocked(generateDocumentNumber).mockResolvedValue('MRV-0001');
    const created = makeMrv({ mrvLines: [{ id: 'line-1' }] });
    mockPrisma.mrv.create.mockResolvedValue(created);

    const header = {
      returnType: 'site_return',
      projectId: 'proj-1',
      toWarehouseId: 'wh-1',
      returnDate: '2026-01-15',
    };
    const lines = [{ itemId: 'item-1', qtyReturned: 10, uomId: 'uom-1', condition: 'good' }];

    const result = await create(header as any, lines as any, USER_ID);

    expect(generateDocumentNumber).toHaveBeenCalledWith('mrv');
    expect(mockPrisma.mrv.create).toHaveBeenCalledOnce();
    expect(result).toEqual(created);
  });

  it('sets status to draft', async () => {
    vi.mocked(generateDocumentNumber).mockResolvedValue('MRV-0002');
    mockPrisma.mrv.create.mockResolvedValue(makeMrv());

    await create(
      { returnType: 'site_return', projectId: 'p', toWarehouseId: 'w', returnDate: '2026-01-01' } as any,
      [],
      USER_ID,
    );

    const createCall = mockPrisma.mrv.create.mock.calls[0][0];
    expect(createCall.data.status).toBe('draft');
  });
});

// ── update ───────────────────────────────────────────────────────────
describe('update', () => {
  it('updates a draft MRV and returns existing + updated', async () => {
    const existing = makeMrv({ status: 'draft' });
    const updated = { ...existing, notes: 'updated' };
    mockPrisma.mrv.findUnique.mockResolvedValue(existing);
    mockPrisma.mrv.update.mockResolvedValue(updated);

    const result = await update(MRV_ID, { notes: 'updated' } as any);

    expect(result).toEqual({ existing, updated });
  });

  it('throws NotFoundError when MRV does not exist', async () => {
    mockPrisma.mrv.findUnique.mockResolvedValue(null);

    await expect(update('bad-id', {} as any)).rejects.toThrow(NotFoundError);
  });

  it('throws BusinessRuleError when MRV is not draft', async () => {
    mockPrisma.mrv.findUnique.mockResolvedValue(makeMrv({ status: 'pending' }));

    await expect(update(MRV_ID, {} as any)).rejects.toThrow(BusinessRuleError);
    await expect(update(MRV_ID, {} as any)).rejects.toThrow('Only draft MRVs can be updated');
  });
});

// ── submit ───────────────────────────────────────────────────────────
describe('submit', () => {
  it('transitions MRV to pending', async () => {
    const mrv = makeMrv({ status: 'draft' });
    mockPrisma.mrv.findUnique.mockResolvedValue(mrv);
    mockPrisma.mrv.update.mockResolvedValue({ ...mrv, status: 'pending' });

    const result = await submit(MRV_ID);

    expect(assertTransition).toHaveBeenCalledWith('mrv', 'draft', 'pending');
    expect(mockPrisma.mrv.update).toHaveBeenCalledWith({
      where: { id: MRV_ID },
      data: { status: 'pending' },
    });
    expect(result.status).toBe('pending');
  });

  it('throws NotFoundError when MRV does not exist', async () => {
    mockPrisma.mrv.findUnique.mockResolvedValue(null);

    await expect(submit('bad-id')).rejects.toThrow(NotFoundError);
  });

  it('calls assertTransition which may throw on invalid transition', async () => {
    const mrv = makeMrv({ status: 'completed' });
    mockPrisma.mrv.findUnique.mockResolvedValue(mrv);
    vi.mocked(assertTransition).mockImplementation(() => {
      throw new BusinessRuleError('Invalid transition');
    });

    await expect(submit(MRV_ID)).rejects.toThrow('Invalid transition');
  });
});

// ── receive ──────────────────────────────────────────────────────────
describe('receive', () => {
  it('transitions MRV to received with receivedById and receivedDate', async () => {
    const mrv = makeMrv({ status: 'pending' });
    const received = { ...mrv, status: 'received', receivedById: USER_ID };
    mockPrisma.mrv.findUnique.mockResolvedValue(mrv);
    mockPrisma.mrv.update.mockResolvedValue(received);

    const result = await receive(MRV_ID, USER_ID);

    expect(assertTransition).toHaveBeenCalledWith('mrv', 'pending', 'received');
    expect(mockPrisma.mrv.update).toHaveBeenCalledWith({
      where: { id: MRV_ID },
      data: expect.objectContaining({
        status: 'received',
        receivedById: USER_ID,
        receivedDate: expect.any(Date),
      }),
    });
    expect(result).toEqual(received);
  });

  it('throws NotFoundError when MRV does not exist', async () => {
    mockPrisma.mrv.findUnique.mockResolvedValue(null);

    await expect(receive('bad-id', USER_ID)).rejects.toThrow(NotFoundError);
  });
});

// ── complete ─────────────────────────────────────────────────────────
describe('complete', () => {
  it('restocks only good-condition lines and returns summary', async () => {
    const lines = [
      { id: 'l1', itemId: 'item-1', qtyReturned: 5, condition: 'good' },
      { id: 'l2', itemId: 'item-2', qtyReturned: 3, condition: 'damaged' },
      { id: 'l3', itemId: 'item-3', qtyReturned: 2, condition: 'good' },
    ];
    const mrv = makeMrv({ status: 'received', mrvLines: lines });
    mockPrisma.mrv.findUnique.mockResolvedValue(mrv);
    mockPrisma.mrv.update.mockResolvedValue({ ...mrv, status: 'completed' });

    const result = await complete(MRV_ID, USER_ID);

    expect(assertTransition).toHaveBeenCalledWith('mrv', 'received', 'completed');
    expect(addStockBatch).toHaveBeenCalledTimes(1);
    const batchArg = mockedAddStockBatch.mock.calls[0][0];
    expect(batchArg).toHaveLength(2);
    expect(batchArg[0]).toEqual(
      expect.objectContaining({
        itemId: 'item-1',
        warehouseId: 'wh-1',
        qty: 5,
        performedById: USER_ID,
      }),
    );
    expect(batchArg[1]).toEqual(
      expect.objectContaining({
        itemId: 'item-3',
        warehouseId: 'wh-1',
        qty: 2,
        performedById: USER_ID,
      }),
    );
    expect(result).toEqual({
      id: MRV_ID,
      toWarehouseId: 'wh-1',
      goodLinesRestocked: 2,
      totalLines: 3,
      surplusItemId: null,
    });
  });

  it('calls addStockBatch with empty array when there are no good-condition lines', async () => {
    const lines = [{ id: 'l1', itemId: 'item-1', qtyReturned: 5, condition: 'damaged' }];
    const mrv = makeMrv({ status: 'received', mrvLines: lines });
    mockPrisma.mrv.findUnique.mockResolvedValue(mrv);
    mockPrisma.mrv.update.mockResolvedValue({ ...mrv, status: 'completed' });
    mockedAddStockBatch.mockResolvedValue(undefined);

    const result = await complete(MRV_ID, USER_ID);

    expect(addStockBatch).toHaveBeenCalledWith([]);
    expect(result.goodLinesRestocked).toBe(0);
    expect(result.totalLines).toBe(1);
  });

  it('throws NotFoundError when MRV does not exist', async () => {
    mockPrisma.mrv.findUnique.mockResolvedValue(null);

    await expect(complete('bad-id', USER_ID)).rejects.toThrow(NotFoundError);
  });

  it('calls assertTransition which may throw on invalid transition', async () => {
    const mrv = makeMrv({ status: 'draft', mrvLines: [] });
    mockPrisma.mrv.findUnique.mockResolvedValue(mrv);
    vi.mocked(assertTransition).mockImplementation(() => {
      throw new BusinessRuleError('Invalid transition');
    });

    await expect(complete(MRV_ID, USER_ID)).rejects.toThrow('Invalid transition');
    expect(addStockBatch).not.toHaveBeenCalled();
  });
});
