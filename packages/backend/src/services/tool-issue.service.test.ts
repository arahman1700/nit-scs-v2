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
import { list, getById, create, update, returnTool } from './tool-issue.service.js';
import { NotFoundError, BusinessRuleError, assertTransition } from '@nit-scs-v2/shared';

const mockedAssertTransition = assertTransition as ReturnType<typeof vi.fn>;

// ── helpers ──────────────────────────────────────────────────────────
const USER_ID = 'user-1';
const ISSUE_ID = 'issue-1';

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
    const rows = [{ id: ISSUE_ID }];
    mockPrisma.toolIssue.findMany.mockResolvedValue(rows);
    mockPrisma.toolIssue.count.mockResolvedValue(1);

    const result = await list(baseListParams);

    expect(result).toEqual({ data: rows, total: 1 });
  });

  it('applies search filter with OR clause on tool.toolCode, tool.toolName, issuedTo.fullName', async () => {
    mockPrisma.toolIssue.findMany.mockResolvedValue([]);
    mockPrisma.toolIssue.count.mockResolvedValue(0);

    await list({ ...baseListParams, search: 'wrench' });

    const where = mockPrisma.toolIssue.findMany.mock.calls[0][0].where;
    expect(where.OR).toBeDefined();
    expect(where.OR).toHaveLength(3);
  });

  it('applies status filter', async () => {
    mockPrisma.toolIssue.findMany.mockResolvedValue([]);
    mockPrisma.toolIssue.count.mockResolvedValue(0);

    await list({ ...baseListParams, status: 'issued' });

    const where = mockPrisma.toolIssue.findMany.mock.calls[0][0].where;
    expect(where.status).toBe('issued');
  });

  it('applies toolId filter', async () => {
    mockPrisma.toolIssue.findMany.mockResolvedValue([]);
    mockPrisma.toolIssue.count.mockResolvedValue(0);

    await list({ ...baseListParams, toolId: 'tool-1' });

    const where = mockPrisma.toolIssue.findMany.mock.calls[0][0].where;
    expect(where.toolId).toBe('tool-1');
  });
});

// ── getById ──────────────────────────────────────────────────────────
describe('getById', () => {
  it('returns the ToolIssue when found', async () => {
    const issue = { id: ISSUE_ID, status: 'issued' };
    mockPrisma.toolIssue.findUnique.mockResolvedValue(issue);

    const result = await getById(ISSUE_ID);

    expect(result).toEqual(issue);
    expect(mockPrisma.toolIssue.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: ISSUE_ID } }));
  });

  it('throws NotFoundError when ToolIssue does not exist', async () => {
    mockPrisma.toolIssue.findUnique.mockResolvedValue(null);

    await expect(getById('nonexistent')).rejects.toThrow(NotFoundError);
  });
});

// ── create ───────────────────────────────────────────────────────────
describe('create', () => {
  const data = {
    toolId: 'tool-1',
    issuedToId: 'emp-1',
    expectedReturnDate: '2026-02-20',
  };

  it('creates a tool issue with status issued', async () => {
    mockPrisma.tool.findUnique.mockResolvedValue({ id: 'tool-1' });
    mockPrisma.toolIssue.findFirst.mockResolvedValue(null);
    mockPrisma.toolIssue.create.mockResolvedValue({ id: ISSUE_ID, status: 'issued' });

    const result = await create(data as any, USER_ID);

    expect(result).toEqual({ id: ISSUE_ID, status: 'issued' });
    const createArgs = mockPrisma.toolIssue.create.mock.calls[0][0];
    expect(createArgs.data.status).toBe('issued');
    expect(createArgs.data.issuedById).toBe(USER_ID);
    expect(createArgs.data.issuedDate).toBeInstanceOf(Date);
  });

  it('throws NotFoundError when tool does not exist', async () => {
    mockPrisma.tool.findUnique.mockResolvedValue(null);

    await expect(create(data as any, USER_ID)).rejects.toThrow(NotFoundError);
  });

  it('throws BusinessRuleError when tool is already issued', async () => {
    mockPrisma.tool.findUnique.mockResolvedValue({ id: 'tool-1' });
    mockPrisma.toolIssue.findFirst.mockResolvedValue({ id: 'existing-issue', status: 'issued' });

    await expect(create(data as any, USER_ID)).rejects.toThrow('Tool is already issued and has not been returned');
  });
});

// ── update ───────────────────────────────────────────────────────────
describe('update', () => {
  it('updates a tool issue in issued status and returns existing + updated', async () => {
    const existing = { id: ISSUE_ID, status: 'issued' };
    const updated = { id: ISSUE_ID, status: 'issued', expectedReturnDate: new Date() };
    mockPrisma.toolIssue.findUnique.mockResolvedValue(existing);
    mockPrisma.toolIssue.update.mockResolvedValue(updated);

    const result = await update(ISSUE_ID, { expectedReturnDate: '2026-03-01' });

    expect(result).toEqual({ existing, updated });
  });

  it('throws NotFoundError when ToolIssue does not exist', async () => {
    mockPrisma.toolIssue.findUnique.mockResolvedValue(null);

    await expect(update('bad-id', {})).rejects.toThrow(NotFoundError);
  });

  it('throws BusinessRuleError when ToolIssue is not in issued status', async () => {
    mockPrisma.toolIssue.findUnique.mockResolvedValue({ id: ISSUE_ID, status: 'returned' });

    await expect(update(ISSUE_ID, {})).rejects.toThrow(BusinessRuleError);
    await expect(update(ISSUE_ID, {})).rejects.toThrow('Only tool issues in "issued" status can be updated');
  });
});

// ── returnTool ───────────────────────────────────────────────────────
describe('returnTool', () => {
  it('transitions to returned and sets return fields', async () => {
    const issue = { id: ISSUE_ID, status: 'issued', toolId: 'tool-1' };
    mockPrisma.toolIssue.findUnique.mockResolvedValue(issue);
    mockedAssertTransition.mockReturnValue(undefined);
    mockPrisma.toolIssue.update.mockResolvedValue({ ...issue, status: 'returned' });

    const result = await returnTool(ISSUE_ID, { returnCondition: 'good' } as any, USER_ID);

    expect(mockedAssertTransition).toHaveBeenCalledWith('tool_issue', 'issued', 'returned');
    expect(mockPrisma.toolIssue.update).toHaveBeenCalledWith({
      where: { id: ISSUE_ID },
      data: expect.objectContaining({
        status: 'returned',
        actualReturnDate: expect.any(Date),
        returnCondition: 'good',
        returnVerifiedById: USER_ID,
      }),
    });
    expect(result.status).toBe('returned');
  });

  it('updates tool condition to damaged when returnCondition is damaged', async () => {
    const issue = { id: ISSUE_ID, status: 'issued', toolId: 'tool-1' };
    mockPrisma.toolIssue.findUnique.mockResolvedValue(issue);
    mockedAssertTransition.mockReturnValue(undefined);
    mockPrisma.toolIssue.update.mockResolvedValue({ ...issue, status: 'returned' });

    await returnTool(ISSUE_ID, { returnCondition: 'damaged' } as any, USER_ID);

    expect(mockPrisma.tool.update).toHaveBeenCalledWith({
      where: { id: 'tool-1' },
      data: { condition: 'damaged' },
    });
  });

  it('does not update tool condition when returnCondition is not damaged', async () => {
    const issue = { id: ISSUE_ID, status: 'issued', toolId: 'tool-1' };
    mockPrisma.toolIssue.findUnique.mockResolvedValue(issue);
    mockedAssertTransition.mockReturnValue(undefined);
    mockPrisma.toolIssue.update.mockResolvedValue({ ...issue, status: 'returned' });

    await returnTool(ISSUE_ID, { returnCondition: 'good' } as any, USER_ID);

    expect(mockPrisma.tool.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundError when ToolIssue does not exist', async () => {
    mockPrisma.toolIssue.findUnique.mockResolvedValue(null);

    await expect(returnTool('bad-id', { returnCondition: 'good' } as any, USER_ID)).rejects.toThrow(NotFoundError);
  });

  it('throws when assertTransition rejects the transition', async () => {
    const issue = { id: ISSUE_ID, status: 'returned', toolId: 'tool-1' };
    mockPrisma.toolIssue.findUnique.mockResolvedValue(issue);
    mockedAssertTransition.mockImplementation(() => {
      throw new BusinessRuleError('Invalid transition');
    });

    await expect(returnTool(ISSUE_ID, { returnCondition: 'good' } as any, USER_ID)).rejects.toThrow(
      'Invalid transition',
    );
    expect(mockPrisma.toolIssue.update).not.toHaveBeenCalled();
  });
});
