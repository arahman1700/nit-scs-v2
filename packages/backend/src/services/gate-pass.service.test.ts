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
import { list, getById, create, update, submit, approve, release, returnPass, cancel } from './gate-pass.service.js';
import { generateDocumentNumber } from './document-number.service.js';
import { NotFoundError, BusinessRuleError, assertTransition } from '@nit-scs-v2/shared';

const mockedGenDoc = generateDocumentNumber as ReturnType<typeof vi.fn>;
const mockedAssertTransition = assertTransition as ReturnType<typeof vi.fn>;

// ── helpers ──────────────────────────────────────────────────────────
const USER_ID = 'user-1';
const GP_ID = 'gp-1';

function makeGatePass(overrides: Record<string, unknown> = {}) {
  return {
    id: GP_ID,
    gatePassNumber: 'GP-0001',
    status: 'draft',
    passType: 'outgoing',
    warehouseId: 'wh-1',
    issuedById: USER_ID,
    driverName: 'John',
    vehicleNumber: 'ABC-123',
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
    const passes = [makeGatePass()];
    mockPrisma.gatePass.findMany.mockResolvedValue(passes);
    mockPrisma.gatePass.count.mockResolvedValue(1);

    const result = await list(baseListParams);

    expect(result).toEqual({ data: passes, total: 1 });
  });

  it('applies search filter on gatePassNumber, driverName, vehicleNumber', async () => {
    mockPrisma.gatePass.findMany.mockResolvedValue([]);
    mockPrisma.gatePass.count.mockResolvedValue(0);

    await list({ ...baseListParams, search: 'abc' });

    const call = mockPrisma.gatePass.findMany.mock.calls[0][0];
    expect(call.where.OR).toEqual([
      { gatePassNumber: { contains: 'abc', mode: 'insensitive' } },
      { driverName: { contains: 'abc', mode: 'insensitive' } },
      { vehicleNumber: { contains: 'abc', mode: 'insensitive' } },
    ]);
  });

  it('applies status filter', async () => {
    mockPrisma.gatePass.findMany.mockResolvedValue([]);
    mockPrisma.gatePass.count.mockResolvedValue(0);

    await list({ ...baseListParams, status: 'approved' });

    const call = mockPrisma.gatePass.findMany.mock.calls[0][0];
    expect(call.where.status).toBe('approved');
  });

  it('applies passType filter', async () => {
    mockPrisma.gatePass.findMany.mockResolvedValue([]);
    mockPrisma.gatePass.count.mockResolvedValue(0);

    await list({ ...baseListParams, passType: 'incoming' });

    const call = mockPrisma.gatePass.findMany.mock.calls[0][0];
    expect(call.where.passType).toBe('incoming');
  });

  it('applies scope filters (warehouseId, projectId, issuedById)', async () => {
    mockPrisma.gatePass.findMany.mockResolvedValue([]);
    mockPrisma.gatePass.count.mockResolvedValue(0);

    await list({
      ...baseListParams,
      warehouseId: 'wh-2',
      projectId: 'proj-1',
      issuedById: 'user-5',
    });

    const call = mockPrisma.gatePass.findMany.mock.calls[0][0];
    expect(call.where.warehouseId).toBe('wh-2');
    expect(call.where.projectId).toBe('proj-1');
    expect(call.where.issuedById).toBe('user-5');
  });
});

// ── getById ──────────────────────────────────────────────────────────
describe('getById', () => {
  it('returns Gate Pass when found', async () => {
    const gp = makeGatePass();
    mockPrisma.gatePass.findUnique.mockResolvedValue(gp);

    const result = await getById(GP_ID);

    expect(result).toEqual(gp);
    expect(mockPrisma.gatePass.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: GP_ID } }));
  });

  it('throws NotFoundError when Gate Pass does not exist', async () => {
    mockPrisma.gatePass.findUnique.mockResolvedValue(null);

    await expect(getById('nonexistent')).rejects.toThrow(NotFoundError);
  });
});

// ── create ───────────────────────────────────────────────────────────
describe('create', () => {
  it('generates doc number and creates Gate Pass with items in a transaction', async () => {
    vi.mocked(generateDocumentNumber).mockResolvedValue('GP-0001');
    const created = makeGatePass({ gatePassItems: [{ id: 'item-1' }] });
    mockPrisma.gatePass.create.mockResolvedValue(created);

    const header = {
      passType: 'outgoing',
      warehouseId: 'wh-1',
      vehicleNumber: 'ABC-123',
      driverName: 'John',
      destination: 'Site A',
      issueDate: '2026-01-15',
    };
    const items = [{ itemId: 'item-1', quantity: 5, uomId: 'uom-1' }];

    const result = await create(header as any, items as any, USER_ID);

    expect(generateDocumentNumber).toHaveBeenCalledWith('gatepass');
    expect(mockPrisma.gatePass.create).toHaveBeenCalledOnce();
    expect(result).toEqual(created);
  });

  it('sets status to draft', async () => {
    vi.mocked(generateDocumentNumber).mockResolvedValue('GP-0002');
    mockPrisma.gatePass.create.mockResolvedValue(makeGatePass());

    await create(
      {
        passType: 'outgoing',
        warehouseId: 'wh-1',
        vehicleNumber: 'X',
        driverName: 'Y',
        destination: 'Z',
        issueDate: '2026-01-01',
      } as any,
      [],
      USER_ID,
    );

    const createCall = mockPrisma.gatePass.create.mock.calls[0][0];
    expect(createCall.data.status).toBe('draft');
  });
});

// ── update ───────────────────────────────────────────────────────────
describe('update', () => {
  it('updates a draft Gate Pass and returns existing + updated', async () => {
    const existing = makeGatePass({ status: 'draft' });
    const updated = { ...existing, destination: 'Site B' };
    mockPrisma.gatePass.findUnique.mockResolvedValue(existing);
    mockPrisma.gatePass.update.mockResolvedValue(updated);

    const result = await update(GP_ID, { destination: 'Site B' } as any);

    expect(result).toEqual({ existing, updated });
  });

  it('throws NotFoundError when Gate Pass does not exist', async () => {
    mockPrisma.gatePass.findUnique.mockResolvedValue(null);

    await expect(update('bad-id', {} as any)).rejects.toThrow(NotFoundError);
  });

  it('throws BusinessRuleError when Gate Pass is not draft', async () => {
    mockPrisma.gatePass.findUnique.mockResolvedValue(makeGatePass({ status: 'pending' }));

    await expect(update(GP_ID, {} as any)).rejects.toThrow(BusinessRuleError);
    await expect(update(GP_ID, {} as any)).rejects.toThrow('Only draft Gate Passes can be updated');
  });
});

// ── submit ───────────────────────────────────────────────────────────
describe('submit', () => {
  it('transitions Gate Pass to pending', async () => {
    const gp = makeGatePass({ status: 'draft' });
    mockPrisma.gatePass.findUnique.mockResolvedValue(gp);
    mockPrisma.gatePass.update.mockResolvedValue({ ...gp, status: 'pending' });

    const result = await submit(GP_ID);

    expect(assertTransition).toHaveBeenCalledWith('gate_pass', 'draft', 'pending');
    expect(result.status).toBe('pending');
  });

  it('throws NotFoundError when Gate Pass does not exist', async () => {
    mockPrisma.gatePass.findUnique.mockResolvedValue(null);

    await expect(submit('bad-id')).rejects.toThrow(NotFoundError);
  });
});

// ── approve ──────────────────────────────────────────────────────────
describe('approve', () => {
  it('transitions Gate Pass to approved', async () => {
    const gp = makeGatePass({ status: 'pending' });
    mockPrisma.gatePass.findUnique.mockResolvedValue(gp);
    mockPrisma.gatePass.update.mockResolvedValue({ ...gp, status: 'approved' });

    const result = await approve(GP_ID);

    expect(assertTransition).toHaveBeenCalledWith('gate_pass', 'pending', 'approved');
    expect(result.status).toBe('approved');
  });

  it('throws NotFoundError when Gate Pass does not exist', async () => {
    mockPrisma.gatePass.findUnique.mockResolvedValue(null);

    await expect(approve('bad-id')).rejects.toThrow(NotFoundError);
  });
});

// ── release ──────────────────────────────────────────────────────────
describe('release', () => {
  it('transitions Gate Pass to released with exitTime', async () => {
    const gp = makeGatePass({ status: 'approved' });
    mockPrisma.gatePass.findUnique.mockResolvedValue(gp);
    mockPrisma.gatePass.update.mockResolvedValue({ ...gp, status: 'released' });

    await release(GP_ID);

    expect(assertTransition).toHaveBeenCalledWith('gate_pass', 'approved', 'released');
    expect(mockPrisma.gatePass.update).toHaveBeenCalledWith({
      where: { id: GP_ID },
      data: expect.objectContaining({
        status: 'released',
        exitTime: expect.any(Date),
        securityOfficer: null,
      }),
    });
  });

  it('stores securityOfficer when provided', async () => {
    const gp = makeGatePass({ status: 'approved' });
    mockPrisma.gatePass.findUnique.mockResolvedValue(gp);
    mockPrisma.gatePass.update.mockResolvedValue({ ...gp, status: 'released' });

    await release(GP_ID, 'Officer Smith');

    const updateCall = mockPrisma.gatePass.update.mock.calls[0][0];
    expect(updateCall.data.securityOfficer).toBe('Officer Smith');
  });

  it('throws NotFoundError when Gate Pass does not exist', async () => {
    mockPrisma.gatePass.findUnique.mockResolvedValue(null);

    await expect(release('bad-id')).rejects.toThrow(NotFoundError);
  });
});

// ── returnPass ───────────────────────────────────────────────────────
describe('returnPass', () => {
  it('transitions Gate Pass to returned with returnTime', async () => {
    const gp = makeGatePass({ status: 'released' });
    mockPrisma.gatePass.findUnique.mockResolvedValue(gp);
    mockPrisma.gatePass.update.mockResolvedValue({ ...gp, status: 'returned' });

    const result = await returnPass(GP_ID);

    expect(assertTransition).toHaveBeenCalledWith('gate_pass', 'released', 'returned');
    expect(mockPrisma.gatePass.update).toHaveBeenCalledWith({
      where: { id: GP_ID },
      data: expect.objectContaining({
        status: 'returned',
        returnTime: expect.any(Date),
      }),
    });
    expect(result.status).toBe('returned');
  });

  it('throws NotFoundError when Gate Pass does not exist', async () => {
    mockPrisma.gatePass.findUnique.mockResolvedValue(null);

    await expect(returnPass('bad-id')).rejects.toThrow(NotFoundError);
  });
});

// ── cancel ───────────────────────────────────────────────────────────
describe('cancel', () => {
  it('cancels a draft Gate Pass', async () => {
    const gp = makeGatePass({ status: 'draft' });
    mockPrisma.gatePass.findUnique.mockResolvedValue(gp);
    mockPrisma.gatePass.update.mockResolvedValue({ ...gp, status: 'cancelled' });

    const result = await cancel(GP_ID);

    expect(mockPrisma.gatePass.update).toHaveBeenCalledWith({
      where: { id: GP_ID },
      data: { status: 'cancelled' },
    });
    expect(result.status).toBe('cancelled');
  });

  it('cancels a pending Gate Pass', async () => {
    const gp = makeGatePass({ status: 'pending' });
    mockPrisma.gatePass.findUnique.mockResolvedValue(gp);
    mockPrisma.gatePass.update.mockResolvedValue({ ...gp, status: 'cancelled' });

    const result = await cancel(GP_ID);

    expect(result.status).toBe('cancelled');
  });

  it('cancels an approved Gate Pass', async () => {
    const gp = makeGatePass({ status: 'approved' });
    mockPrisma.gatePass.findUnique.mockResolvedValue(gp);
    mockPrisma.gatePass.update.mockResolvedValue({ ...gp, status: 'cancelled' });

    const result = await cancel(GP_ID);

    expect(result.status).toBe('cancelled');
  });

  it('throws NotFoundError when Gate Pass does not exist', async () => {
    mockPrisma.gatePass.findUnique.mockResolvedValue(null);

    await expect(cancel('bad-id')).rejects.toThrow(NotFoundError);
  });

  it.each(['released', 'returned', 'cancelled'])('throws BusinessRuleError when status is %s', async status => {
    mockPrisma.gatePass.findUnique.mockResolvedValue(makeGatePass({ status }));

    await expect(cancel(GP_ID)).rejects.toThrow(BusinessRuleError);
    await expect(cancel(GP_ID)).rejects.toThrow(`Gate Pass cannot be cancelled from status: ${status}`);
  });
});
