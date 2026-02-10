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
import {
  list,
  getById,
  create,
  update,
  startProgress,
  complete,
  markOverdue,
} from './generator-maintenance.service.js';
import { NotFoundError, BusinessRuleError, assertTransition } from '@nit-scs-v2/shared';

// ── helpers ──────────────────────────────────────────────────────────
const USER_ID = 'user-1';
const GM_ID = 'gm-1';

function makeGeneratorMaintenance(overrides: Record<string, unknown> = {}) {
  return {
    id: GM_ID,
    generatorId: 'gen-1',
    maintenanceType: 'preventive',
    scheduledDate: new Date('2026-02-15'),
    findings: null,
    partsReplaced: null,
    cost: null,
    status: 'scheduled',
    performedById: null,
    completedDate: null,
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
    const records = [makeGeneratorMaintenance()];
    mockPrisma.generatorMaintenance.findMany.mockResolvedValue(records);
    mockPrisma.generatorMaintenance.count.mockResolvedValue(1);

    const result = await list(baseListParams);

    expect(result).toEqual({ data: records, total: 1 });
    expect(mockPrisma.generatorMaintenance.findMany).toHaveBeenCalledOnce();
    expect(mockPrisma.generatorMaintenance.count).toHaveBeenCalledOnce();
  });

  it('applies search filter on generator.generatorCode and generator.generatorName', async () => {
    mockPrisma.generatorMaintenance.findMany.mockResolvedValue([]);
    mockPrisma.generatorMaintenance.count.mockResolvedValue(0);

    await list({ ...baseListParams, search: 'GEN-00' });

    const call = mockPrisma.generatorMaintenance.findMany.mock.calls[0][0];
    expect(call.where.OR).toEqual([
      { generator: { generatorCode: { contains: 'GEN-00', mode: 'insensitive' } } },
      { generator: { generatorName: { contains: 'GEN-00', mode: 'insensitive' } } },
    ]);
  });

  it('applies status filter', async () => {
    mockPrisma.generatorMaintenance.findMany.mockResolvedValue([]);
    mockPrisma.generatorMaintenance.count.mockResolvedValue(0);

    await list({ ...baseListParams, status: 'scheduled' });

    const call = mockPrisma.generatorMaintenance.findMany.mock.calls[0][0];
    expect(call.where.status).toBe('scheduled');
  });

  it('applies generatorId filter', async () => {
    mockPrisma.generatorMaintenance.findMany.mockResolvedValue([]);
    mockPrisma.generatorMaintenance.count.mockResolvedValue(0);

    await list({ ...baseListParams, generatorId: 'gen-1' });

    const call = mockPrisma.generatorMaintenance.findMany.mock.calls[0][0];
    expect(call.where.generatorId).toBe('gen-1');
  });

  it('applies maintenanceType filter', async () => {
    mockPrisma.generatorMaintenance.findMany.mockResolvedValue([]);
    mockPrisma.generatorMaintenance.count.mockResolvedValue(0);

    await list({ ...baseListParams, maintenanceType: 'corrective' });

    const call = mockPrisma.generatorMaintenance.findMany.mock.calls[0][0];
    expect(call.where.maintenanceType).toBe('corrective');
  });
});

// ── getById ──────────────────────────────────────────────────────────
describe('getById', () => {
  it('returns Generator Maintenance when found', async () => {
    const record = makeGeneratorMaintenance();
    mockPrisma.generatorMaintenance.findUnique.mockResolvedValue(record);

    const result = await getById(GM_ID);

    expect(result).toEqual(record);
    expect(mockPrisma.generatorMaintenance.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: GM_ID } }),
    );
  });

  it('throws NotFoundError when Generator Maintenance does not exist', async () => {
    mockPrisma.generatorMaintenance.findUnique.mockResolvedValue(null);

    await expect(getById('nonexistent')).rejects.toThrow(NotFoundError);
  });
});

// ── create ───────────────────────────────────────────────────────────
describe('create', () => {
  it('verifies generator exists and creates maintenance record', async () => {
    const generator = { id: 'gen-1', generatorCode: 'GEN-001', generatorName: 'Main Generator' };
    mockPrisma.generator.findUnique.mockResolvedValue(generator);
    const created = makeGeneratorMaintenance();
    mockPrisma.generatorMaintenance.create.mockResolvedValue(created);

    const data = {
      generatorId: 'gen-1',
      maintenanceType: 'preventive',
      scheduledDate: '2026-02-15',
    };

    const result = await create(data as any, USER_ID);

    expect(mockPrisma.generator.findUnique).toHaveBeenCalledWith({ where: { id: 'gen-1' } });
    expect(mockPrisma.generatorMaintenance.create).toHaveBeenCalledOnce();
    expect(result).toEqual(created);
  });

  it('sets status to scheduled', async () => {
    mockPrisma.generator.findUnique.mockResolvedValue({ id: 'gen-1' });
    mockPrisma.generatorMaintenance.create.mockResolvedValue(makeGeneratorMaintenance());

    await create(
      {
        generatorId: 'gen-1',
        maintenanceType: 'preventive',
        scheduledDate: '2026-02-15',
      } as any,
      USER_ID,
    );

    const createCall = mockPrisma.generatorMaintenance.create.mock.calls[0][0];
    expect(createCall.data.status).toBe('scheduled');
  });

  it('throws NotFoundError when generator does not exist', async () => {
    mockPrisma.generator.findUnique.mockResolvedValue(null);

    await expect(
      create(
        {
          generatorId: 'bad-gen',
          maintenanceType: 'preventive',
          scheduledDate: '2026-02-15',
        } as any,
        USER_ID,
      ),
    ).rejects.toThrow(NotFoundError);
  });
});

// ── update ───────────────────────────────────────────────────────────
describe('update', () => {
  it('updates a Generator Maintenance record and returns existing + updated', async () => {
    const existing = makeGeneratorMaintenance();
    const updated = { ...existing, findings: 'Oil leak detected' };
    mockPrisma.generatorMaintenance.findUnique.mockResolvedValue(existing);
    mockPrisma.generatorMaintenance.update.mockResolvedValue(updated);

    const result = await update(GM_ID, { findings: 'Oil leak detected' } as any);

    expect(result).toEqual({ existing, updated });
  });

  it('throws NotFoundError when Generator Maintenance does not exist', async () => {
    mockPrisma.generatorMaintenance.findUnique.mockResolvedValue(null);

    await expect(update('bad-id', {} as any)).rejects.toThrow(NotFoundError);
  });
});

// ── startProgress ────────────────────────────────────────────────────
describe('startProgress', () => {
  it('transitions Generator Maintenance to in_progress with performedById', async () => {
    const record = makeGeneratorMaintenance({ status: 'scheduled' });
    mockPrisma.generatorMaintenance.findUnique.mockResolvedValue(record);
    mockPrisma.generatorMaintenance.update.mockResolvedValue({
      ...record,
      status: 'in_progress',
      performedById: USER_ID,
    });

    const result = await startProgress(GM_ID, USER_ID);

    expect(assertTransition).toHaveBeenCalledWith('generator_maintenance', 'scheduled', 'in_progress');
    expect(mockPrisma.generatorMaintenance.update).toHaveBeenCalledWith({
      where: { id: GM_ID },
      data: { status: 'in_progress', performedById: USER_ID },
    });
    expect(result.status).toBe('in_progress');
    expect(result.performedById).toBe(USER_ID);
  });

  it('throws NotFoundError when Generator Maintenance does not exist', async () => {
    mockPrisma.generatorMaintenance.findUnique.mockResolvedValue(null);

    await expect(startProgress('bad-id', USER_ID)).rejects.toThrow(NotFoundError);
  });

  it('calls assertTransition which may throw on invalid transition', async () => {
    const record = makeGeneratorMaintenance({ status: 'completed' });
    mockPrisma.generatorMaintenance.findUnique.mockResolvedValue(record);
    vi.mocked(assertTransition).mockImplementation(() => {
      throw new BusinessRuleError('Invalid transition');
    });

    await expect(startProgress(GM_ID, USER_ID)).rejects.toThrow('Invalid transition');
  });
});

// ── complete ─────────────────────────────────────────────────────────
describe('complete', () => {
  it('transitions Generator Maintenance to completed with completedDate and performedById', async () => {
    const record = makeGeneratorMaintenance({ status: 'in_progress' });
    mockPrisma.generatorMaintenance.findUnique.mockResolvedValue(record);
    mockPrisma.generatorMaintenance.update.mockResolvedValue({
      ...record,
      status: 'completed',
      completedDate: new Date(),
      performedById: USER_ID,
    });

    const result = await complete(GM_ID, USER_ID);

    expect(assertTransition).toHaveBeenCalledWith('generator_maintenance', 'in_progress', 'completed');
    expect(mockPrisma.generatorMaintenance.update).toHaveBeenCalledWith({
      where: { id: GM_ID },
      data: expect.objectContaining({
        status: 'completed',
        completedDate: expect.any(Date),
        performedById: USER_ID,
      }),
    });
    expect(result.status).toBe('completed');
  });

  it('throws NotFoundError when Generator Maintenance does not exist', async () => {
    mockPrisma.generatorMaintenance.findUnique.mockResolvedValue(null);

    await expect(complete('bad-id', USER_ID)).rejects.toThrow(NotFoundError);
  });
});

// ── markOverdue ──────────────────────────────────────────────────────
describe('markOverdue', () => {
  it('transitions Generator Maintenance to overdue', async () => {
    const record = makeGeneratorMaintenance({ status: 'scheduled' });
    mockPrisma.generatorMaintenance.findUnique.mockResolvedValue(record);
    mockPrisma.generatorMaintenance.update.mockResolvedValue({ ...record, status: 'overdue' });

    const result = await markOverdue(GM_ID);

    expect(assertTransition).toHaveBeenCalledWith('generator_maintenance', 'scheduled', 'overdue');
    expect(mockPrisma.generatorMaintenance.update).toHaveBeenCalledWith({
      where: { id: GM_ID },
      data: { status: 'overdue' },
    });
    expect(result.status).toBe('overdue');
  });

  it('throws NotFoundError when Generator Maintenance does not exist', async () => {
    mockPrisma.generatorMaintenance.findUnique.mockResolvedValue(null);

    await expect(markOverdue('bad-id')).rejects.toThrow(NotFoundError);
  });
});
