import type { PrismaMock, PrismaModelMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('../config/logger.js', () => ({ log: vi.fn() }));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import {
  createParallelApproval,
  respondToApproval,
  evaluateGroupCompletion,
  getGroupStatus,
  getPendingForApprover,
} from './parallel-approval.service.js';

// ── Helpers ──────────────────────────────────────────────────────────────

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

function makeGroup(overrides: Record<string, unknown> = {}) {
  return {
    id: 'group-1',
    documentType: 'mirv',
    documentId: 'doc-1',
    approvalLevel: 1,
    mode: 'all',
    status: 'pending',
    createdAt: new Date('2026-01-15T10:00:00Z'),
    completedAt: null,
    responses: [],
    ...overrides,
  };
}

function makeResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 'resp-1',
    groupId: 'group-1',
    approverId: 'approver-1',
    decision: 'approved',
    comments: null,
    decidedAt: new Date('2026-01-15T11:00:00Z'),
    approver: {
      id: 'approver-1',
      fullName: 'John Doe',
      email: 'john@example.com',
      role: 'warehouse_manager',
    },
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════════

describe('parallel-approval.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    // Add models not in the standard PrismaMock
    (mockPrisma as Record<string, unknown>).parallelApprovalGroup = createModelMock();
    (mockPrisma as Record<string, unknown>).parallelApprovalResponse = createModelMock();
    vi.clearAllMocks();
  });

  // Typed accessors for the additional models
  function groupModel() {
    return (mockPrisma as Record<string, PrismaModelMock>).parallelApprovalGroup;
  }
  function responseModel() {
    return (mockPrisma as Record<string, PrismaModelMock>).parallelApprovalResponse;
  }

  // ─── createParallelApproval ─────────────────────────────────────────

  describe('createParallelApproval', () => {
    const defaultParams = {
      documentType: 'mirv',
      documentId: 'doc-1',
      level: 1,
      mode: 'all' as const,
      approverIds: ['approver-1', 'approver-2'],
    };

    it('throws when no approvers are provided', async () => {
      await expect(createParallelApproval({ ...defaultParams, approverIds: [] })).rejects.toThrow(
        'At least one approver is required',
      );
    });

    it('throws when some approvers are not found', async () => {
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'approver-1' }]);

      await expect(createParallelApproval(defaultParams)).rejects.toThrow(
        'Approver(s) not found or inactive: approver-2',
      );
    });

    it('throws when some approvers are inactive', async () => {
      // Only one active approver returned, the other is inactive (not in results)
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'approver-1' }]);

      await expect(createParallelApproval(defaultParams)).rejects.toThrow(
        'Approver(s) not found or inactive: approver-2',
      );

      expect(mockPrisma.employee.findMany).toHaveBeenCalledWith({
        where: { id: { in: ['approver-1', 'approver-2'] }, isActive: true },
        select: { id: true },
      });
    });

    it('creates a group with mode=all and returns it', async () => {
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'approver-1' }, { id: 'approver-2' }]);
      const createdGroup = makeGroup();
      groupModel().create.mockResolvedValue(createdGroup);

      const result = await createParallelApproval(defaultParams);

      expect(groupModel().create).toHaveBeenCalledWith({
        data: {
          documentType: 'mirv',
          documentId: 'doc-1',
          approvalLevel: 1,
          mode: 'all',
          status: 'pending',
        },
        include: expect.objectContaining({
          responses: expect.any(Object),
        }),
      });
      expect(result).toEqual(createdGroup);
    });

    it('creates a group with mode=any', async () => {
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'approver-1' }]);
      const createdGroup = makeGroup({ mode: 'any' });
      groupModel().create.mockResolvedValue(createdGroup);

      const result = await createParallelApproval({
        ...defaultParams,
        mode: 'any',
        approverIds: ['approver-1'],
      });

      expect(groupModel().create).toHaveBeenCalledWith({
        data: expect.objectContaining({ mode: 'any' }),
        include: expect.any(Object),
      });
      expect(result.mode).toBe('any');
    });

    it('creates a group with a single approver', async () => {
      mockPrisma.employee.findMany.mockResolvedValue([{ id: 'approver-1' }]);
      const createdGroup = makeGroup();
      groupModel().create.mockResolvedValue(createdGroup);

      await createParallelApproval({
        ...defaultParams,
        approverIds: ['approver-1'],
      });

      expect(groupModel().create).toHaveBeenCalledTimes(1);
    });

    it('reports all missing approver IDs in error message', async () => {
      mockPrisma.employee.findMany.mockResolvedValue([]);

      await expect(
        createParallelApproval({
          ...defaultParams,
          approverIds: ['missing-1', 'missing-2', 'missing-3'],
        }),
      ).rejects.toThrow('Approver(s) not found or inactive: missing-1, missing-2, missing-3');
    });
  });

  // ─── respondToApproval — mode='all' ─────────────────────────────────

  describe('respondToApproval — mode=all', () => {
    it('throws when group is not found', async () => {
      groupModel().findUnique.mockResolvedValue(null);

      await expect(
        respondToApproval({
          groupId: 'nonexistent',
          approverId: 'approver-1',
          decision: 'approved',
        }),
      ).rejects.toThrow('Parallel approval group nonexistent not found');
    });

    it('throws when group is already resolved', async () => {
      groupModel().findUnique.mockResolvedValue(makeGroup({ status: 'approved' }));

      await expect(
        respondToApproval({
          groupId: 'group-1',
          approverId: 'approver-1',
          decision: 'approved',
        }),
      ).rejects.toThrow('Group group-1 is already approved');
    });

    it('throws when approver has already responded', async () => {
      groupModel().findUnique.mockResolvedValue(
        makeGroup({
          responses: [makeResponse({ approverId: 'approver-1' })],
        }),
      );

      await expect(
        respondToApproval({
          groupId: 'group-1',
          approverId: 'approver-1',
          decision: 'approved',
        }),
      ).rejects.toThrow('Approver approver-1 has already responded to this group');
    });

    it('records approval but stays pending when not all have responded (mode=all)', async () => {
      groupModel()
        .findUnique.mockResolvedValueOnce(makeGroup({ mode: 'all', responses: [] }))
        .mockResolvedValueOnce(makeGroup({ mode: 'all', status: 'pending' }));

      responseModel().create.mockResolvedValue({});
      // After recording, only 1 approval — not enough for mode=all
      responseModel().findMany.mockResolvedValue([{ decision: 'approved', groupId: 'group-1' }]);

      const result = await respondToApproval({
        groupId: 'group-1',
        approverId: 'approver-1',
        decision: 'approved',
      });

      // Response should be created
      expect(responseModel().create).toHaveBeenCalledWith({
        data: {
          groupId: 'group-1',
          approverId: 'approver-1',
          decision: 'approved',
          comments: null,
        },
      });

      // Group should NOT be updated (still pending)
      expect(groupModel().update).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('rejects immediately when any approver rejects (mode=all)', async () => {
      groupModel()
        .findUnique.mockResolvedValueOnce(makeGroup({ mode: 'all', responses: [] }))
        .mockResolvedValueOnce(makeGroup({ mode: 'all', status: 'rejected' }));

      responseModel().create.mockResolvedValue({});
      responseModel().findMany.mockResolvedValue([{ decision: 'rejected', groupId: 'group-1' }]);
      groupModel().update.mockResolvedValue({});

      await respondToApproval({
        groupId: 'group-1',
        approverId: 'approver-1',
        decision: 'rejected',
        comments: 'Not acceptable',
      });

      expect(responseModel().create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          decision: 'rejected',
          comments: 'Not acceptable',
        }),
      });

      expect(groupModel().update).toHaveBeenCalledWith({
        where: { id: 'group-1' },
        data: {
          status: 'rejected',
          completedAt: expect.any(Date),
        },
      });
    });

    it('rejects even when there are prior approvals but one rejection (mode=all)', async () => {
      groupModel()
        .findUnique.mockResolvedValueOnce(
          makeGroup({
            mode: 'all',
            responses: [makeResponse({ approverId: 'approver-1', decision: 'approved' })],
          }),
        )
        .mockResolvedValueOnce(makeGroup({ status: 'rejected' }));

      responseModel().create.mockResolvedValue({});
      responseModel().findMany.mockResolvedValue([
        { decision: 'approved', groupId: 'group-1' },
        { decision: 'rejected', groupId: 'group-1' },
      ]);
      groupModel().update.mockResolvedValue({});

      await respondToApproval({
        groupId: 'group-1',
        approverId: 'approver-2',
        decision: 'rejected',
      });

      expect(groupModel().update).toHaveBeenCalledWith({
        where: { id: 'group-1' },
        data: expect.objectContaining({ status: 'rejected' }),
      });
    });

    it('throws when group is already rejected', async () => {
      groupModel().findUnique.mockResolvedValue(makeGroup({ status: 'rejected' }));

      await expect(
        respondToApproval({
          groupId: 'group-1',
          approverId: 'approver-1',
          decision: 'approved',
        }),
      ).rejects.toThrow('Group group-1 is already rejected');
    });

    it('stores comments as null when not provided', async () => {
      groupModel()
        .findUnique.mockResolvedValueOnce(makeGroup({ mode: 'all', responses: [] }))
        .mockResolvedValueOnce(makeGroup());

      responseModel().create.mockResolvedValue({});
      responseModel().findMany.mockResolvedValue([{ decision: 'approved', groupId: 'group-1' }]);

      await respondToApproval({
        groupId: 'group-1',
        approverId: 'approver-1',
        decision: 'approved',
      });

      expect(responseModel().create).toHaveBeenCalledWith({
        data: expect.objectContaining({ comments: null }),
      });
    });
  });

  // ─── respondToApproval — mode='any' ─────────────────────────────────

  describe('respondToApproval — mode=any', () => {
    it('approves immediately on first approval (mode=any)', async () => {
      groupModel()
        .findUnique.mockResolvedValueOnce(makeGroup({ mode: 'any', responses: [] }))
        .mockResolvedValueOnce(makeGroup({ mode: 'any', status: 'approved' }));

      responseModel().create.mockResolvedValue({});
      responseModel().findMany.mockResolvedValue([{ decision: 'approved', groupId: 'group-1' }]);
      groupModel().update.mockResolvedValue({});

      await respondToApproval({
        groupId: 'group-1',
        approverId: 'approver-1',
        decision: 'approved',
      });

      expect(groupModel().update).toHaveBeenCalledWith({
        where: { id: 'group-1' },
        data: {
          status: 'approved',
          completedAt: expect.any(Date),
        },
      });
    });

    it('stays pending on first rejection (mode=any) when more approvers remain', async () => {
      groupModel()
        .findUnique.mockResolvedValueOnce(makeGroup({ mode: 'any', responses: [] }))
        .mockResolvedValueOnce(makeGroup({ mode: 'any', status: 'pending' }));

      responseModel().create.mockResolvedValue({});
      // One rejection, no approvals — not enough for mode=any to resolve
      responseModel().findMany.mockResolvedValue([{ decision: 'rejected', groupId: 'group-1' }]);

      await respondToApproval({
        groupId: 'group-1',
        approverId: 'approver-1',
        decision: 'rejected',
      });

      // Group should NOT be updated (stays pending — more approvers may still approve)
      expect(groupModel().update).not.toHaveBeenCalled();
    });

    it('approves even when there are prior rejections (mode=any)', async () => {
      groupModel()
        .findUnique.mockResolvedValueOnce(
          makeGroup({
            mode: 'any',
            responses: [makeResponse({ approverId: 'approver-1', decision: 'rejected' })],
          }),
        )
        .mockResolvedValueOnce(makeGroup({ mode: 'any', status: 'approved' }));

      responseModel().create.mockResolvedValue({});
      responseModel().findMany.mockResolvedValue([
        { decision: 'rejected', groupId: 'group-1' },
        { decision: 'approved', groupId: 'group-1' },
      ]);
      groupModel().update.mockResolvedValue({});

      await respondToApproval({
        groupId: 'group-1',
        approverId: 'approver-2',
        decision: 'approved',
      });

      expect(groupModel().update).toHaveBeenCalledWith({
        where: { id: 'group-1' },
        data: expect.objectContaining({ status: 'approved' }),
      });
    });
  });

  // ─── evaluateGroupCompletion ────────────────────────────────────────

  describe('evaluateGroupCompletion', () => {
    it('throws when group is not found', async () => {
      groupModel().findUnique.mockResolvedValue(null);

      await expect(evaluateGroupCompletion('nonexistent', 3)).rejects.toThrow(
        'Parallel approval group nonexistent not found',
      );
    });

    it('returns group unchanged when already resolved', async () => {
      const resolved = makeGroup({ status: 'approved' });
      groupModel().findUnique.mockResolvedValue(resolved);

      const result = await evaluateGroupCompletion('group-1', 2);

      expect(result).toEqual(resolved);
      expect(groupModel().update).not.toHaveBeenCalled();
    });

    it('approves group when all approvers approved (mode=all)', async () => {
      groupModel()
        .findUnique.mockResolvedValueOnce(
          makeGroup({
            mode: 'all',
            responses: [
              makeResponse({ approverId: 'a1', decision: 'approved' }),
              makeResponse({ approverId: 'a2', decision: 'approved' }),
              makeResponse({ approverId: 'a3', decision: 'approved' }),
            ],
          }),
        )
        .mockResolvedValueOnce(makeGroup({ status: 'approved' }));

      groupModel().update.mockResolvedValue({});

      await evaluateGroupCompletion('group-1', 3);

      expect(groupModel().update).toHaveBeenCalledWith({
        where: { id: 'group-1' },
        data: {
          status: 'approved',
          completedAt: expect.any(Date),
        },
      });
    });

    it('rejects group when any approver rejected (mode=all)', async () => {
      groupModel()
        .findUnique.mockResolvedValueOnce(
          makeGroup({
            mode: 'all',
            responses: [
              makeResponse({ approverId: 'a1', decision: 'approved' }),
              makeResponse({ approverId: 'a2', decision: 'rejected' }),
            ],
          }),
        )
        .mockResolvedValueOnce(makeGroup({ status: 'rejected' }));

      groupModel().update.mockResolvedValue({});

      await evaluateGroupCompletion('group-1', 3);

      expect(groupModel().update).toHaveBeenCalledWith({
        where: { id: 'group-1' },
        data: expect.objectContaining({ status: 'rejected' }),
      });
    });

    it('stays pending when not all approvers have responded (mode=all)', async () => {
      groupModel()
        .findUnique.mockResolvedValueOnce(
          makeGroup({
            mode: 'all',
            responses: [makeResponse({ approverId: 'a1', decision: 'approved' })],
          }),
        )
        .mockResolvedValueOnce(makeGroup({ status: 'pending' }));

      const result = await evaluateGroupCompletion('group-1', 3);

      expect(groupModel().update).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('approves group on first approval (mode=any)', async () => {
      groupModel()
        .findUnique.mockResolvedValueOnce(
          makeGroup({
            mode: 'any',
            responses: [makeResponse({ approverId: 'a1', decision: 'approved' })],
          }),
        )
        .mockResolvedValueOnce(makeGroup({ mode: 'any', status: 'approved' }));

      groupModel().update.mockResolvedValue({});

      await evaluateGroupCompletion('group-1', 3);

      expect(groupModel().update).toHaveBeenCalledWith({
        where: { id: 'group-1' },
        data: expect.objectContaining({ status: 'approved' }),
      });
    });

    it('rejects group when all approvers rejected (mode=any)', async () => {
      groupModel()
        .findUnique.mockResolvedValueOnce(
          makeGroup({
            mode: 'any',
            responses: [
              makeResponse({ approverId: 'a1', decision: 'rejected' }),
              makeResponse({ approverId: 'a2', decision: 'rejected' }),
              makeResponse({ approverId: 'a3', decision: 'rejected' }),
            ],
          }),
        )
        .mockResolvedValueOnce(makeGroup({ mode: 'any', status: 'rejected' }));

      groupModel().update.mockResolvedValue({});

      await evaluateGroupCompletion('group-1', 3);

      expect(groupModel().update).toHaveBeenCalledWith({
        where: { id: 'group-1' },
        data: expect.objectContaining({ status: 'rejected' }),
      });
    });

    it('stays pending when not all have rejected (mode=any) and no approvals', async () => {
      groupModel()
        .findUnique.mockResolvedValueOnce(
          makeGroup({
            mode: 'any',
            responses: [makeResponse({ approverId: 'a1', decision: 'rejected' })],
          }),
        )
        .mockResolvedValueOnce(makeGroup({ mode: 'any', status: 'pending' }));

      await evaluateGroupCompletion('group-1', 3);

      expect(groupModel().update).not.toHaveBeenCalled();
    });

    it('approves mode=all when approvedCount equals expectedCount exactly', async () => {
      groupModel()
        .findUnique.mockResolvedValueOnce(
          makeGroup({
            mode: 'all',
            responses: [
              makeResponse({ approverId: 'a1', decision: 'approved' }),
              makeResponse({ approverId: 'a2', decision: 'approved' }),
            ],
          }),
        )
        .mockResolvedValueOnce(makeGroup({ status: 'approved' }));

      groupModel().update.mockResolvedValue({});

      await evaluateGroupCompletion('group-1', 2);

      expect(groupModel().update).toHaveBeenCalledWith({
        where: { id: 'group-1' },
        data: expect.objectContaining({ status: 'approved' }),
      });
    });

    it('rejects mode=any when rejectedCount equals expectedCount exactly', async () => {
      groupModel()
        .findUnique.mockResolvedValueOnce(
          makeGroup({
            mode: 'any',
            responses: [
              makeResponse({ approverId: 'a1', decision: 'rejected' }),
              makeResponse({ approverId: 'a2', decision: 'rejected' }),
            ],
          }),
        )
        .mockResolvedValueOnce(makeGroup({ mode: 'any', status: 'rejected' }));

      groupModel().update.mockResolvedValue({});

      await evaluateGroupCompletion('group-1', 2);

      expect(groupModel().update).toHaveBeenCalledWith({
        where: { id: 'group-1' },
        data: expect.objectContaining({ status: 'rejected' }),
      });
    });
  });

  // ─── getGroupStatus ─────────────────────────────────────────────────

  describe('getGroupStatus', () => {
    it('returns all groups for a document ordered by level', async () => {
      const groups = [makeGroup({ id: 'g1', approvalLevel: 1 }), makeGroup({ id: 'g2', approvalLevel: 2 })];
      groupModel().findMany.mockResolvedValue(groups);

      const result = await getGroupStatus('mirv', 'doc-1');

      expect(result).toEqual(groups);
      expect(groupModel().findMany).toHaveBeenCalledWith({
        where: { documentType: 'mirv', documentId: 'doc-1' },
        include: expect.objectContaining({
          responses: expect.any(Object),
        }),
        orderBy: { approvalLevel: 'asc' },
      });
    });

    it('returns empty array when no groups exist', async () => {
      groupModel().findMany.mockResolvedValue([]);

      const result = await getGroupStatus('mirv', 'nonexistent');

      expect(result).toEqual([]);
    });

    it('includes response details with approver info', async () => {
      const groups = [
        makeGroup({
          responses: [
            makeResponse({
              approver: {
                id: 'approver-1',
                fullName: 'John Doe',
                email: 'john@example.com',
                role: 'warehouse_manager',
              },
            }),
          ],
        }),
      ];
      groupModel().findMany.mockResolvedValue(groups);

      const result = await getGroupStatus('mirv', 'doc-1');

      expect(result[0].responses).toHaveLength(1);
      expect(result[0].responses[0].approver.fullName).toBe('John Doe');
    });
  });

  // ─── getPendingForApprover ──────────────────────────────────────────

  describe('getPendingForApprover', () => {
    it('returns pending groups where approver has not responded', async () => {
      const pendingGroups = [makeGroup({ id: 'g1' }), makeGroup({ id: 'g2', documentType: 'mrf' })];
      groupModel().findMany.mockResolvedValue(pendingGroups);

      const result = await getPendingForApprover('approver-1');

      expect(result).toEqual(pendingGroups);
      expect(groupModel().findMany).toHaveBeenCalledWith({
        where: {
          status: 'pending',
          NOT: {
            responses: {
              some: { approverId: 'approver-1' },
            },
          },
        },
        include: expect.objectContaining({
          responses: expect.any(Object),
        }),
        orderBy: { createdAt: 'desc' },
      });
    });

    it('returns empty array when no pending groups exist', async () => {
      groupModel().findMany.mockResolvedValue([]);

      const result = await getPendingForApprover('approver-1');

      expect(result).toEqual([]);
    });

    it('excludes groups where approver already responded', async () => {
      // The query itself filters these out via NOT clause;
      // verify the filter is passed correctly
      groupModel().findMany.mockResolvedValue([]);

      await getPendingForApprover('approver-99');

      expect(groupModel().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            NOT: {
              responses: {
                some: { approverId: 'approver-99' },
              },
            },
          }),
        }),
      );
    });

    it('only returns groups with pending status', async () => {
      groupModel().findMany.mockResolvedValue([]);

      await getPendingForApprover('approver-1');

      expect(groupModel().findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'pending',
          }),
        }),
      );
    });
  });
});
