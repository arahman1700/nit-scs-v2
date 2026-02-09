import type { PrismaMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

// ── mocks ────────────────────────────────────────────────────────────
vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('./document-number.service.js', () => ({ generateDocumentNumber: vi.fn() }));
vi.mock('./inventory.service.js', () => ({ addStockBatch: vi.fn(), deductStockBatch: vi.fn() }));
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
  ship,
  receive,
  complete,
  cancel,
} from './stock-transfer.service.js';
import { generateDocumentNumber } from './document-number.service.js';
import { addStockBatch, deductStockBatch } from './inventory.service.js';
import { NotFoundError, BusinessRuleError, assertTransition } from '@nit-scs-v2/shared';

const mockedGenDoc = generateDocumentNumber as ReturnType<typeof vi.fn>;
const mockedAddStockBatch = addStockBatch as ReturnType<typeof vi.fn>;
const mockedDeductStockBatch = deductStockBatch as ReturnType<typeof vi.fn>;
const mockedAssertTransition = assertTransition as ReturnType<typeof vi.fn>;

// ── helpers ──────────────────────────────────────────────────────────
const USER_ID = 'user-1';
const ST_ID = 'st-1';

function makeStockTransfer(overrides: Record<string, unknown> = {}) {
  return {
    id: ST_ID,
    transferNumber: 'ST-0001',
    status: 'draft',
    transferType: 'inter_warehouse',
    fromWarehouseId: 'wh-from',
    toWarehouseId: 'wh-to',
    requestedById: USER_ID,
    stockTransferLines: [],
    ...overrides,
  };
}

function makeLines() {
  return [
    { id: 'line-1', itemId: 'item-1', quantity: 10, uomId: 'uom-1', condition: 'good' },
    { id: 'line-2', itemId: 'item-2', quantity: 5, uomId: 'uom-2', condition: 'good' },
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
    const transfers = [makeStockTransfer()];
    mockPrisma.stockTransfer.findMany.mockResolvedValue(transfers);
    mockPrisma.stockTransfer.count.mockResolvedValue(1);

    const result = await list(baseListParams);

    expect(result).toEqual({ data: transfers, total: 1 });
  });

  it('applies search filter on transferNumber', async () => {
    mockPrisma.stockTransfer.findMany.mockResolvedValue([]);
    mockPrisma.stockTransfer.count.mockResolvedValue(0);

    await list({ ...baseListParams, search: 'ST-00' });

    const call = mockPrisma.stockTransfer.findMany.mock.calls[0][0];
    expect(call.where.AND).toEqual(
      expect.arrayContaining([{ OR: [{ transferNumber: { contains: 'ST-00', mode: 'insensitive' } }] }]),
    );
  });

  it('applies status filter', async () => {
    mockPrisma.stockTransfer.findMany.mockResolvedValue([]);
    mockPrisma.stockTransfer.count.mockResolvedValue(0);

    await list({ ...baseListParams, status: 'pending' });

    const call = mockPrisma.stockTransfer.findMany.mock.calls[0][0];
    expect(call.where.status).toBe('pending');
  });

  it('applies transferType filter', async () => {
    mockPrisma.stockTransfer.findMany.mockResolvedValue([]);
    mockPrisma.stockTransfer.count.mockResolvedValue(0);

    await list({ ...baseListParams, transferType: 'inter_project' });

    const call = mockPrisma.stockTransfer.findMany.mock.calls[0][0];
    expect(call.where.transferType).toBe('inter_project');
  });

  it('applies warehouse scope filter with OR (fromWarehouseId OR toWarehouseId)', async () => {
    mockPrisma.stockTransfer.findMany.mockResolvedValue([]);
    mockPrisma.stockTransfer.count.mockResolvedValue(0);

    await list({ ...baseListParams, fromWarehouseId: 'wh-1' });

    const call = mockPrisma.stockTransfer.findMany.mock.calls[0][0];
    expect(call.where.AND).toEqual(
      expect.arrayContaining([{ OR: [{ fromWarehouseId: 'wh-1' }, { toWarehouseId: 'wh-1' }] }]),
    );
  });

  it('applies requestedById filter', async () => {
    mockPrisma.stockTransfer.findMany.mockResolvedValue([]);
    mockPrisma.stockTransfer.count.mockResolvedValue(0);

    await list({ ...baseListParams, requestedById: 'user-3' });

    const call = mockPrisma.stockTransfer.findMany.mock.calls[0][0];
    expect(call.where.requestedById).toBe('user-3');
  });

  it('does not set AND when no search or warehouse scope provided', async () => {
    mockPrisma.stockTransfer.findMany.mockResolvedValue([]);
    mockPrisma.stockTransfer.count.mockResolvedValue(0);

    await list(baseListParams);

    const call = mockPrisma.stockTransfer.findMany.mock.calls[0][0];
    expect(call.where.AND).toBeUndefined();
  });
});

// ── getById ──────────────────────────────────────────────────────────
describe('getById', () => {
  it('returns Stock Transfer when found', async () => {
    const st = makeStockTransfer();
    mockPrisma.stockTransfer.findUnique.mockResolvedValue(st);

    const result = await getById(ST_ID);

    expect(result).toEqual(st);
    expect(mockPrisma.stockTransfer.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: ST_ID } }));
  });

  it('throws NotFoundError when Stock Transfer does not exist', async () => {
    mockPrisma.stockTransfer.findUnique.mockResolvedValue(null);

    await expect(getById('nonexistent')).rejects.toThrow(NotFoundError);
  });
});

// ── create ───────────────────────────────────────────────────────────
describe('create', () => {
  it('generates doc number and creates Stock Transfer with lines in a transaction', async () => {
    vi.mocked(generateDocumentNumber).mockResolvedValue('ST-0001');
    const created = makeStockTransfer({ stockTransferLines: makeLines() });
    mockPrisma.stockTransfer.create.mockResolvedValue(created);

    const header = {
      transferType: 'inter_warehouse',
      fromWarehouseId: 'wh-from',
      toWarehouseId: 'wh-to',
      transferDate: '2026-01-15',
    };
    const lines = [{ itemId: 'item-1', quantity: 10, uomId: 'uom-1' }];

    const result = await create(header as any, lines as any, USER_ID);

    expect(generateDocumentNumber).toHaveBeenCalledWith('stock_transfer');
    expect(mockPrisma.stockTransfer.create).toHaveBeenCalledOnce();
    expect(result).toEqual(created);
  });

  it('sets status to draft', async () => {
    vi.mocked(generateDocumentNumber).mockResolvedValue('ST-0002');
    mockPrisma.stockTransfer.create.mockResolvedValue(makeStockTransfer());

    await create(
      {
        transferType: 'inter_warehouse',
        fromWarehouseId: 'wh-a',
        toWarehouseId: 'wh-b',
        transferDate: '2026-01-01',
      } as any,
      [],
      USER_ID,
    );

    const createCall = mockPrisma.stockTransfer.create.mock.calls[0][0];
    expect(createCall.data.status).toBe('draft');
  });
});

// ── update ───────────────────────────────────────────────────────────
describe('update', () => {
  it('updates a draft Stock Transfer and returns existing + updated', async () => {
    const existing = makeStockTransfer({ status: 'draft' });
    const updated = { ...existing, notes: 'updated' };
    mockPrisma.stockTransfer.findUnique.mockResolvedValue(existing);
    mockPrisma.stockTransfer.update.mockResolvedValue(updated);

    const result = await update(ST_ID, { notes: 'updated' } as any);

    expect(result).toEqual({ existing, updated });
  });

  it('throws NotFoundError when Stock Transfer does not exist', async () => {
    mockPrisma.stockTransfer.findUnique.mockResolvedValue(null);

    await expect(update('bad-id', {} as any)).rejects.toThrow(NotFoundError);
  });

  it('throws BusinessRuleError when Stock Transfer is not draft', async () => {
    mockPrisma.stockTransfer.findUnique.mockResolvedValue(makeStockTransfer({ status: 'approved' }));

    await expect(update(ST_ID, {} as any)).rejects.toThrow(BusinessRuleError);
    await expect(update(ST_ID, {} as any)).rejects.toThrow('Only draft Stock Transfers can be updated');
  });
});

// ── submit ───────────────────────────────────────────────────────────
describe('submit', () => {
  it('transitions Stock Transfer to pending', async () => {
    const st = makeStockTransfer({ status: 'draft' });
    mockPrisma.stockTransfer.findUnique.mockResolvedValue(st);
    mockPrisma.stockTransfer.update.mockResolvedValue({ ...st, status: 'pending' });

    const result = await submit(ST_ID);

    expect(assertTransition).toHaveBeenCalledWith('stock_transfer', 'draft', 'pending');
    expect(result.status).toBe('pending');
  });

  it('throws NotFoundError when Stock Transfer does not exist', async () => {
    mockPrisma.stockTransfer.findUnique.mockResolvedValue(null);

    await expect(submit('bad-id')).rejects.toThrow(NotFoundError);
  });
});

// ── approve ──────────────────────────────────────────────────────────
describe('approve', () => {
  it('transitions Stock Transfer to approved', async () => {
    const st = makeStockTransfer({ status: 'pending' });
    mockPrisma.stockTransfer.findUnique.mockResolvedValue(st);
    mockPrisma.stockTransfer.update.mockResolvedValue({ ...st, status: 'approved' });

    const result = await approve(ST_ID);

    expect(assertTransition).toHaveBeenCalledWith('stock_transfer', 'pending', 'approved');
    expect(result.status).toBe('approved');
  });

  it('throws NotFoundError when Stock Transfer does not exist', async () => {
    mockPrisma.stockTransfer.findUnique.mockResolvedValue(null);

    await expect(approve('bad-id')).rejects.toThrow(NotFoundError);
  });
});

// ── ship ─────────────────────────────────────────────────────────────
describe('ship', () => {
  it('deducts stock via batch call and transitions to shipped', async () => {
    const lines = makeLines();
    const st = makeStockTransfer({ status: 'approved', stockTransferLines: lines });
    mockPrisma.stockTransfer.findUnique.mockResolvedValue(st);
    mockPrisma.stockTransfer.update.mockResolvedValue({ ...st, status: 'shipped' });

    const result = await ship(ST_ID);

    expect(assertTransition).toHaveBeenCalledWith('stock_transfer', 'approved', 'shipped');
    expect(deductStockBatch).toHaveBeenCalledTimes(1);
    expect(deductStockBatch).toHaveBeenCalledWith([
      {
        itemId: 'item-1',
        warehouseId: 'wh-from',
        qty: 10,
        ref: { referenceType: 'stock_transfer_line', referenceId: 'line-1' },
      },
      {
        itemId: 'item-2',
        warehouseId: 'wh-from',
        qty: 5,
        ref: { referenceType: 'stock_transfer_line', referenceId: 'line-2' },
      },
    ]);
    expect(mockPrisma.stockTransfer.update).toHaveBeenCalledWith({
      where: { id: ST_ID },
      data: expect.objectContaining({
        status: 'shipped',
        shippedDate: expect.any(Date),
      }),
    });
    expect(result).toEqual({ updated: expect.any(Object), fromWarehouseId: 'wh-from' });
  });

  it('throws NotFoundError when Stock Transfer does not exist', async () => {
    mockPrisma.stockTransfer.findUnique.mockResolvedValue(null);

    await expect(ship('bad-id')).rejects.toThrow(NotFoundError);
  });

  it('calls assertTransition which may throw on invalid transition', async () => {
    const st = makeStockTransfer({ status: 'draft', stockTransferLines: [] });
    mockPrisma.stockTransfer.findUnique.mockResolvedValue(st);
    vi.mocked(assertTransition).mockImplementation(() => {
      throw new BusinessRuleError('Invalid transition');
    });

    await expect(ship(ST_ID)).rejects.toThrow('Invalid transition');
    expect(deductStockBatch).not.toHaveBeenCalled();
  });
});

// ── receive ──────────────────────────────────────────────────────────
describe('receive', () => {
  it('adds stock via batch call and transitions to received', async () => {
    const lines = makeLines();
    const st = makeStockTransfer({ status: 'shipped', stockTransferLines: lines });
    mockPrisma.stockTransfer.findUnique.mockResolvedValue(st);
    mockPrisma.stockTransfer.update.mockResolvedValue({ ...st, status: 'received' });

    const result = await receive(ST_ID, USER_ID);

    expect(assertTransition).toHaveBeenCalledWith('stock_transfer', 'shipped', 'received');
    expect(addStockBatch).toHaveBeenCalledTimes(1);
    expect(addStockBatch).toHaveBeenCalledWith([
      { itemId: 'item-1', warehouseId: 'wh-to', qty: 10, performedById: USER_ID },
      { itemId: 'item-2', warehouseId: 'wh-to', qty: 5, performedById: USER_ID },
    ]);
    expect(mockPrisma.stockTransfer.update).toHaveBeenCalledWith({
      where: { id: ST_ID },
      data: expect.objectContaining({
        status: 'received',
        receivedDate: expect.any(Date),
      }),
    });
    expect(result).toEqual({ updated: expect.any(Object), toWarehouseId: 'wh-to' });
  });

  it('throws NotFoundError when Stock Transfer does not exist', async () => {
    mockPrisma.stockTransfer.findUnique.mockResolvedValue(null);

    await expect(receive('bad-id', USER_ID)).rejects.toThrow(NotFoundError);
  });

  it('calls assertTransition which may throw on invalid transition', async () => {
    const st = makeStockTransfer({ status: 'draft', stockTransferLines: [] });
    mockPrisma.stockTransfer.findUnique.mockResolvedValue(st);
    vi.mocked(assertTransition).mockImplementation(() => {
      throw new BusinessRuleError('Invalid transition');
    });

    await expect(receive(ST_ID, USER_ID)).rejects.toThrow('Invalid transition');
    expect(addStockBatch).not.toHaveBeenCalled();
  });
});

// ── complete ─────────────────────────────────────────────────────────
describe('complete', () => {
  it('transitions Stock Transfer to completed', async () => {
    const st = makeStockTransfer({ status: 'received' });
    mockPrisma.stockTransfer.findUnique.mockResolvedValue(st);
    mockPrisma.stockTransfer.update.mockResolvedValue({ ...st, status: 'completed' });

    const result = await complete(ST_ID);

    expect(assertTransition).toHaveBeenCalledWith('stock_transfer', 'received', 'completed');
    expect(result.status).toBe('completed');
  });

  it('throws NotFoundError when Stock Transfer does not exist', async () => {
    mockPrisma.stockTransfer.findUnique.mockResolvedValue(null);

    await expect(complete('bad-id')).rejects.toThrow(NotFoundError);
  });
});

// ── cancel ───────────────────────────────────────────────────────────
describe('cancel', () => {
  it('cancels a draft Stock Transfer', async () => {
    const st = makeStockTransfer({ status: 'draft' });
    mockPrisma.stockTransfer.findUnique.mockResolvedValue(st);
    mockPrisma.stockTransfer.update.mockResolvedValue({ ...st, status: 'cancelled' });

    const result = await cancel(ST_ID);

    expect(mockPrisma.stockTransfer.update).toHaveBeenCalledWith({
      where: { id: ST_ID },
      data: { status: 'cancelled' },
    });
    expect(result.status).toBe('cancelled');
  });

  it('cancels a pending Stock Transfer', async () => {
    const st = makeStockTransfer({ status: 'pending' });
    mockPrisma.stockTransfer.findUnique.mockResolvedValue(st);
    mockPrisma.stockTransfer.update.mockResolvedValue({ ...st, status: 'cancelled' });

    const result = await cancel(ST_ID);

    expect(result.status).toBe('cancelled');
  });

  it('cancels an approved Stock Transfer', async () => {
    const st = makeStockTransfer({ status: 'approved' });
    mockPrisma.stockTransfer.findUnique.mockResolvedValue(st);
    mockPrisma.stockTransfer.update.mockResolvedValue({ ...st, status: 'cancelled' });

    const result = await cancel(ST_ID);

    expect(result.status).toBe('cancelled');
  });

  it('throws NotFoundError when Stock Transfer does not exist', async () => {
    mockPrisma.stockTransfer.findUnique.mockResolvedValue(null);

    await expect(cancel('bad-id')).rejects.toThrow(NotFoundError);
  });

  it.each(['shipped', 'received', 'completed', 'cancelled'])(
    'throws BusinessRuleError when status is %s',
    async status => {
      mockPrisma.stockTransfer.findUnique.mockResolvedValue(makeStockTransfer({ status }));

      await expect(cancel(ST_ID)).rejects.toThrow(BusinessRuleError);
      await expect(cancel(ST_ID)).rejects.toThrow(`Stock Transfer cannot be cancelled from status: ${status}`);
    },
  );
});
