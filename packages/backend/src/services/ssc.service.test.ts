import type { PrismaMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

// ── mocks ────────────────────────────────────────────────────────────
vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../config/logger.js', () => ({ log: vi.fn() }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { listBids, getById, createBid, acceptBid, rejectBid, signMemo, notifyFinance } from './ssc.service.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';

// ── helpers ──────────────────────────────────────────────────────────
const USER_ID = 'user-1';
const BID_ID = 'bid-1';

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

// ── listBids ─────────────────────────────────────────────────────────
describe('listBids', () => {
  it('returns data and total count', async () => {
    const rows = [{ id: BID_ID }];
    mockPrisma.sscBid.findMany.mockResolvedValue(rows);
    mockPrisma.sscBid.count.mockResolvedValue(1);

    const result = await listBids(baseListParams);

    expect(result).toEqual({ data: rows, total: 1 });
  });

  it('applies search filter with OR clause on bidderName', async () => {
    mockPrisma.sscBid.findMany.mockResolvedValue([]);
    mockPrisma.sscBid.count.mockResolvedValue(0);

    await listBids({ ...baseListParams, search: 'Acme' });

    const where = mockPrisma.sscBid.findMany.mock.calls[0][0].where;
    expect(where.OR).toBeDefined();
    expect(where.OR).toHaveLength(1);
  });

  it('applies status filter', async () => {
    mockPrisma.sscBid.findMany.mockResolvedValue([]);
    mockPrisma.sscBid.count.mockResolvedValue(0);

    await listBids({ ...baseListParams, status: 'submitted' });

    const where = mockPrisma.sscBid.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('submitted');
  });

  it('applies scrapItemId filter', async () => {
    mockPrisma.sscBid.findMany.mockResolvedValue([]);
    mockPrisma.sscBid.count.mockResolvedValue(0);

    await listBids({ ...baseListParams, scrapItemId: 'scrap-1' });

    const where = mockPrisma.sscBid.findMany.mock.calls[0][0].where;
    expect(where.scrapItemId).toBe('scrap-1');
  });
});

// ── getById ──────────────────────────────────────────────────────────
describe('getById', () => {
  it('returns the SscBid when found', async () => {
    const bid = { id: BID_ID, status: 'submitted' };
    mockPrisma.sscBid.findUnique.mockResolvedValue(bid);

    const result = await getById(BID_ID);

    expect(result).toEqual(bid);
    expect(mockPrisma.sscBid.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: BID_ID } }));
  });

  it('throws NotFoundError when SscBid does not exist', async () => {
    mockPrisma.sscBid.findUnique.mockResolvedValue(null);

    await expect(getById('nonexistent')).rejects.toThrow(NotFoundError);
  });
});

// ── createBid ────────────────────────────────────────────────────────
describe('createBid', () => {
  const data = {
    scrapItemId: 'scrap-1',
    bidderName: 'Acme Corp',
    bidderContact: '123-456',
    bidAmount: 5000,
  };

  it('creates a bid with status submitted', async () => {
    mockPrisma.scrapItem.findUnique.mockResolvedValue({ id: 'scrap-1', status: 'in_ssc' });
    mockPrisma.sscBid.create.mockResolvedValue({ id: BID_ID, status: 'submitted' });

    const result = await createBid(data, USER_ID);

    expect(result).toEqual({ id: BID_ID, status: 'submitted' });
    const createArgs = mockPrisma.sscBid.create.mock.calls[0][0];
    expect(createArgs.data.status).toBe('submitted');
    expect(createArgs.data.bidDate).toBeInstanceOf(Date);
    expect(createArgs.data.bidderName).toBe('Acme Corp');
  });

  it('throws NotFoundError when scrap item does not exist', async () => {
    mockPrisma.scrapItem.findUnique.mockResolvedValue(null);

    await expect(createBid(data, USER_ID)).rejects.toThrow(NotFoundError);
  });

  it('throws BusinessRuleError when scrap item is not in_ssc status', async () => {
    mockPrisma.scrapItem.findUnique.mockResolvedValue({ id: 'scrap-1', status: 'identified' });

    await expect(createBid(data, USER_ID)).rejects.toThrow(
      'Bids can only be placed on scrap items with "in_ssc" status',
    );
  });
});

// ── acceptBid ────────────────────────────────────────────────────────
describe('acceptBid', () => {
  it('accepts the bid and rejects all other submitted bids for the same scrap item', async () => {
    const bid = { id: BID_ID, status: 'submitted', scrapItemId: 'scrap-1' };
    mockPrisma.sscBid.findUnique.mockResolvedValue(bid);
    mockPrisma.sscBid.update.mockResolvedValue({ ...bid, status: 'accepted' });
    mockPrisma.sscBid.updateMany.mockResolvedValue({ count: 2 });

    const result = await acceptBid(BID_ID, USER_ID);

    expect(result.status).toBe('accepted');
    expect(mockPrisma.sscBid.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BID_ID },
        data: { status: 'accepted' },
      }),
    );
    expect(mockPrisma.sscBid.updateMany).toHaveBeenCalledWith({
      where: {
        scrapItemId: 'scrap-1',
        id: { not: BID_ID },
        status: 'submitted',
      },
      data: { status: 'rejected' },
    });
  });

  it('throws NotFoundError when SscBid does not exist', async () => {
    mockPrisma.sscBid.findUnique.mockResolvedValue(null);

    await expect(acceptBid('bad-id', USER_ID)).rejects.toThrow(NotFoundError);
  });

  it('throws BusinessRuleError when bid is not in submitted status', async () => {
    mockPrisma.sscBid.findUnique.mockResolvedValue({
      id: BID_ID,
      status: 'rejected',
      scrapItemId: 'scrap-1',
    });

    await expect(acceptBid(BID_ID, USER_ID)).rejects.toThrow('Only bids in "submitted" status can be accepted');
  });
});

// ── rejectBid ────────────────────────────────────────────────────────
describe('rejectBid', () => {
  it('rejects a submitted bid', async () => {
    const bid = { id: BID_ID, status: 'submitted' };
    mockPrisma.sscBid.findUnique.mockResolvedValue(bid);
    mockPrisma.sscBid.update.mockResolvedValue({ ...bid, status: 'rejected' });

    const result = await rejectBid(BID_ID, USER_ID);

    expect(result.status).toBe('rejected');
    expect(mockPrisma.sscBid.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BID_ID },
        data: { status: 'rejected' },
      }),
    );
  });

  it('throws NotFoundError when SscBid does not exist', async () => {
    mockPrisma.sscBid.findUnique.mockResolvedValue(null);

    await expect(rejectBid('bad-id', USER_ID)).rejects.toThrow(NotFoundError);
  });

  it('throws BusinessRuleError when bid is not in submitted status', async () => {
    mockPrisma.sscBid.findUnique.mockResolvedValue({ id: BID_ID, status: 'accepted' });

    await expect(rejectBid(BID_ID, USER_ID)).rejects.toThrow('Only bids in "submitted" status can be rejected');
  });
});

// ── signMemo ─────────────────────────────────────────────────────────
describe('signMemo', () => {
  it('signs the SSC memo for an accepted bid', async () => {
    const bid = { id: BID_ID, status: 'accepted', sscMemoSigned: false };
    mockPrisma.sscBid.findUnique.mockResolvedValue(bid);
    mockPrisma.sscBid.update.mockResolvedValue({ ...bid, sscMemoSigned: true });

    const result = await signMemo(BID_ID, USER_ID);

    expect(result.sscMemoSigned).toBe(true);
    expect(mockPrisma.sscBid.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: BID_ID },
        data: { sscMemoSigned: true },
      }),
    );
  });

  it('throws NotFoundError when SscBid does not exist', async () => {
    mockPrisma.sscBid.findUnique.mockResolvedValue(null);

    await expect(signMemo('bad-id', USER_ID)).rejects.toThrow(NotFoundError);
  });

  it('throws BusinessRuleError when bid is not in accepted status', async () => {
    mockPrisma.sscBid.findUnique.mockResolvedValue({
      id: BID_ID,
      status: 'submitted',
      sscMemoSigned: false,
    });

    await expect(signMemo(BID_ID, USER_ID)).rejects.toThrow('Only accepted bids can have their SSC memo signed');
  });

  it('throws BusinessRuleError when SSC memo is already signed', async () => {
    mockPrisma.sscBid.findUnique.mockResolvedValue({
      id: BID_ID,
      status: 'accepted',
      sscMemoSigned: true,
    });

    await expect(signMemo(BID_ID, USER_ID)).rejects.toThrow('SSC memo has already been signed for this bid');
  });
});

// ── notifyFinance ────────────────────────────────────────────────────
describe('notifyFinance', () => {
  it('sets financeCopyDate for an accepted bid with signed memo', async () => {
    const bid = {
      id: BID_ID,
      status: 'accepted',
      sscMemoSigned: true,
      financeCopyDate: null,
    };
    mockPrisma.sscBid.findUnique.mockResolvedValue(bid);
    mockPrisma.sscBid.update.mockResolvedValue({ ...bid, financeCopyDate: new Date() });

    const result = await notifyFinance(BID_ID);

    expect(result.financeCopyDate).toBeInstanceOf(Date);
    const updateArgs = mockPrisma.sscBid.update.mock.calls[0][0];
    expect(updateArgs.data.financeCopyDate).toBeInstanceOf(Date);
  });

  it('throws NotFoundError when SscBid does not exist', async () => {
    mockPrisma.sscBid.findUnique.mockResolvedValue(null);

    await expect(notifyFinance('bad-id')).rejects.toThrow(NotFoundError);
  });

  it('throws BusinessRuleError when bid is not in accepted status', async () => {
    mockPrisma.sscBid.findUnique.mockResolvedValue({
      id: BID_ID,
      status: 'submitted',
      sscMemoSigned: true,
      financeCopyDate: null,
    });

    await expect(notifyFinance(BID_ID)).rejects.toThrow('Only accepted bids can trigger finance notification');
  });

  it('throws BusinessRuleError when SSC memo is not signed', async () => {
    mockPrisma.sscBid.findUnique.mockResolvedValue({
      id: BID_ID,
      status: 'accepted',
      sscMemoSigned: false,
      financeCopyDate: null,
    });

    await expect(notifyFinance(BID_ID)).rejects.toThrow('SSC memo must be signed before notifying finance');
  });

  it('throws BusinessRuleError when finance has already been notified', async () => {
    mockPrisma.sscBid.findUnique.mockResolvedValue({
      id: BID_ID,
      status: 'accepted',
      sscMemoSigned: true,
      financeCopyDate: new Date('2026-01-01'),
    });

    await expect(notifyFinance(BID_ID)).rejects.toThrow('Finance has already been notified for this bid');
  });
});
