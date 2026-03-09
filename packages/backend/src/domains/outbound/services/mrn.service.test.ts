import type { PrismaMock } from '../../../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

// ── mocks ────────────────────────────────────────────────────────────
vi.mock('../../../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../../system/services/document-number.service.js', () => ({ generateDocumentNumber: vi.fn() }));
vi.mock('../../inventory/services/inventory.service.js', () => ({ addStockBatch: vi.fn() }));
vi.mock('../../../config/logger.js', () => ({ log: vi.fn() }));
vi.mock('../../../events/event-bus.js', () => ({ eventBus: { publish: vi.fn() } }));
vi.mock('../../../utils/safe-status-transition.js', () => ({ safeStatusUpdate: vi.fn(), safeStatusUpdateTx: vi.fn() }));
vi.mock('@nit-scs-v2/shared', async importOriginal => {
  const actual = await importOriginal<typeof import('@nit-scs-v2/shared')>();
  return { ...actual, assertTransition: vi.fn() };
});

import { createPrismaMock } from '../../../test-utils/prisma-mock.js';
import { list, getById, create, update, submit, receive, complete } from './mrn.service.js';
import { generateDocumentNumber } from '../../system/services/document-number.service.js';
import { addStockBatch } from '../../inventory/services/inventory.service.js';
import { safeStatusUpdate, safeStatusUpdateTx } from '../../../utils/safe-status-transition.js';
import { eventBus } from '../../../events/event-bus.js';
import { NotFoundError, BusinessRuleError, assertTransition } from '@nit-scs-v2/shared';

const _mockedGenDoc = generateDocumentNumber as ReturnType<typeof vi.fn>;
const mockedAddStockBatch = addStockBatch as ReturnType<typeof vi.fn>;
const _mockedAssertTransition = assertTransition as ReturnType<typeof vi.fn>;
const mockedSafeStatusUpdate = safeStatusUpdate as ReturnType<typeof vi.fn>;
const mockedSafeStatusUpdateTx = safeStatusUpdateTx as ReturnType<typeof vi.fn>;
const mockedEventBus = eventBus as { publish: ReturnType<typeof vi.fn> };

// ── helpers ──────────────────────────────────────────────────────────
const USER_ID = 'user-1';
const MRN_ID = 'mrv-1';

function makeMrn(overrides: Record<string, unknown> = {}) {
  return {
    id: MRN_ID,
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
    const mrns = [makeMrn()];
    mockPrisma.mrv.findMany.mockResolvedValue(mrns);
    mockPrisma.mrv.count.mockResolvedValue(1);

    const result = await list(baseListParams);

    expect(result).toEqual({ data: mrns, total: 1 });
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
  it('returns MRN when found', async () => {
    const mrn = makeMrn();
    mockPrisma.mrv.findUnique.mockResolvedValue(mrn);

    const result = await getById(MRN_ID);

    expect(result).toEqual(mrn);
    expect(mockPrisma.mrv.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: MRN_ID } }));
  });

  it('throws NotFoundError when MRN does not exist', async () => {
    mockPrisma.mrv.findUnique.mockResolvedValue(null);

    await expect(getById('nonexistent')).rejects.toThrow(NotFoundError);
  });
});

// ── create ───────────────────────────────────────────────────────────
describe('create', () => {
  it('generates doc number and creates MRN with lines in a transaction', async () => {
    vi.mocked(generateDocumentNumber).mockResolvedValue('MRV-0001');
    const created = makeMrn({ mrvLines: [{ id: 'line-1' }] });
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
    mockPrisma.mrv.create.mockResolvedValue(makeMrn());

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
  it('updates a draft MRN and returns existing + updated', async () => {
    const existing = makeMrn({ status: 'draft' });
    const updated = { ...existing, notes: 'updated' };
    mockPrisma.mrv.findUnique.mockResolvedValue(existing);
    mockPrisma.mrv.update.mockResolvedValue(updated);

    const result = await update(MRN_ID, { notes: 'updated' } as any);

    expect(result).toEqual({ existing, updated });
  });

  it('throws NotFoundError when MRN does not exist', async () => {
    mockPrisma.mrv.findUnique.mockResolvedValue(null);

    await expect(update('bad-id', {} as any)).rejects.toThrow(NotFoundError);
  });

  it('throws BusinessRuleError when MRN is not draft', async () => {
    mockPrisma.mrv.findUnique.mockResolvedValue(makeMrn({ status: 'pending' }));

    await expect(update(MRN_ID, {} as any)).rejects.toThrow(BusinessRuleError);
    await expect(update(MRN_ID, {} as any)).rejects.toThrow('Only draft MRNs can be updated');
  });
});

// ── submit ───────────────────────────────────────────────────────────
describe('submit', () => {
  it('transitions MRN to pending', async () => {
    const mrn = makeMrn({ status: 'draft' });
    mockPrisma.mrv.findUnique.mockResolvedValueOnce(mrn).mockResolvedValueOnce({ ...mrn, status: 'pending' });

    const result = await submit(MRN_ID);

    expect(assertTransition).toHaveBeenCalledWith('mrn', 'draft', 'pending');
    expect(safeStatusUpdate).toHaveBeenCalledWith(mockPrisma.mrv, MRN_ID, 'draft', { status: 'pending' });
    expect(result.status).toBe('pending');
  });

  it('throws NotFoundError when MRN does not exist', async () => {
    mockPrisma.mrv.findUnique.mockResolvedValue(null);

    await expect(submit('bad-id')).rejects.toThrow(NotFoundError);
  });

  it('calls assertTransition which may throw on invalid transition', async () => {
    const mrn = makeMrn({ status: 'completed' });
    mockPrisma.mrv.findUnique.mockResolvedValue(mrn);
    vi.mocked(assertTransition).mockImplementation(() => {
      throw new BusinessRuleError('Invalid transition');
    });

    await expect(submit(MRN_ID)).rejects.toThrow('Invalid transition');
  });
});

// ── receive ──────────────────────────────────────────────────────────
describe('receive', () => {
  it('transitions MRN to received with receivedById and receivedDate', async () => {
    const mrn = makeMrn({ status: 'pending' });
    const received = { ...mrn, status: 'received', receivedById: USER_ID };
    mockPrisma.mrv.findUnique.mockResolvedValueOnce(mrn).mockResolvedValueOnce(received);

    const result = await receive(MRN_ID, USER_ID);

    expect(assertTransition).toHaveBeenCalledWith('mrn', 'pending', 'received');
    expect(safeStatusUpdate).toHaveBeenCalledWith(
      mockPrisma.mrv,
      MRN_ID,
      'pending',
      expect.objectContaining({
        status: 'received',
        receivedById: USER_ID,
        receivedDate: expect.any(Date),
      }),
    );
    expect(result).toEqual(received);
  });

  it('throws NotFoundError when MRN does not exist', async () => {
    mockPrisma.mrv.findUnique.mockResolvedValue(null);

    await expect(receive('bad-id', USER_ID)).rejects.toThrow(NotFoundError);
  });
});

// ── complete ─────────────────────────────────────────────────────────
describe('complete', () => {
  it('restocks good-condition lines as active and damaged lines as blocked, returns summary', async () => {
    const lines = [
      { id: 'l1', itemId: 'item-1', qtyReturned: 5, condition: 'good' },
      { id: 'l2', itemId: 'item-2', qtyReturned: 3, condition: 'damaged' },
      { id: 'l3', itemId: 'item-3', qtyReturned: 2, condition: 'good' },
    ];
    const mrn = makeMrn({ status: 'received', mrvLines: lines });
    mockPrisma.mrv.findUnique.mockResolvedValue(mrn);

    const result = await complete(MRN_ID, USER_ID);

    expect(assertTransition).toHaveBeenCalledWith('mrn', 'received', 'completed');

    // complete() uses $transaction which passes the mock as tx
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
    expect(safeStatusUpdateTx).toHaveBeenCalledWith(mockPrisma.mrv, MRN_ID, 'received', { status: 'completed' });

    // addStockBatch receives both good (active) and damaged (blocked) items, plus the tx
    expect(addStockBatch).toHaveBeenCalledTimes(1);
    const batchArg = mockedAddStockBatch.mock.calls[0][0];
    expect(batchArg).toHaveLength(3);
    // Good items (no lotStatus)
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
    // Damaged item (lotStatus: 'blocked')
    expect(batchArg[2]).toEqual(
      expect.objectContaining({
        itemId: 'item-2',
        warehouseId: 'wh-1',
        qty: 3,
        performedById: USER_ID,
        lotStatus: 'blocked',
      }),
    );
    // addStockBatch called with tx (the prisma mock passed by $transaction)
    expect(mockedAddStockBatch.mock.calls[0][1]).toBeDefined();

    expect(result).toEqual({
      id: MRN_ID,
      toWarehouseId: 'wh-1',
      goodLinesRestocked: 2,
      blockedLinesRestocked: 1,
      totalLines: 3,
    });

    // Publishes document:status_changed event
    expect(mockedEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'document:status_changed',
        entityType: 'mrv',
        entityId: MRN_ID,
      }),
    );
    // Publishes inventory:blocked_lots_created event for damaged items
    expect(mockedEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'inventory:blocked_lots_created',
        entityType: 'mrv',
        entityId: MRN_ID,
      }),
    );
  });

  it('calls addStockBatch with only blocked items when there are no good-condition lines', async () => {
    const lines = [{ id: 'l1', itemId: 'item-1', qtyReturned: 5, condition: 'damaged' }];
    const mrn = makeMrn({ status: 'received', mrvLines: lines });
    mockPrisma.mrv.findUnique.mockResolvedValue(mrn);
    mockedAddStockBatch.mockResolvedValue(undefined);

    const result = await complete(MRN_ID, USER_ID);

    // Only the damaged/blocked item is in the batch
    const batchArg = mockedAddStockBatch.mock.calls[0][0];
    expect(batchArg).toHaveLength(1);
    expect(batchArg[0]).toEqual(
      expect.objectContaining({
        itemId: 'item-1',
        qty: 5,
        lotStatus: 'blocked',
      }),
    );
    expect(result.goodLinesRestocked).toBe(0);
    expect(result.blockedLinesRestocked).toBe(1);
    expect(result.totalLines).toBe(1);
  });

  it('throws NotFoundError when MRN does not exist', async () => {
    mockPrisma.mrv.findUnique.mockResolvedValue(null);

    await expect(complete('bad-id', USER_ID)).rejects.toThrow(NotFoundError);
  });

  it('calls assertTransition which may throw on invalid transition', async () => {
    const mrn = makeMrn({ status: 'draft', mrvLines: [] });
    mockPrisma.mrv.findUnique.mockResolvedValue(mrn);
    vi.mocked(assertTransition).mockImplementation(() => {
      throw new BusinessRuleError('Invalid transition');
    });

    await expect(complete(MRN_ID, USER_ID)).rejects.toThrow('Invalid transition');
    expect(addStockBatch).not.toHaveBeenCalled();
  });
});
