import type { PrismaMock } from '../test-utils/prisma-mock.js';

const { mockPrisma } = vi.hoisted(() => {
  return { mockPrisma: {} as PrismaMock };
});

vi.mock('../utils/prisma.js', () => ({ prisma: mockPrisma }));
vi.mock('./audit.service.js', () => ({ createAuditLog: vi.fn() }));
vi.mock('../socket/setup.js', () => ({
  emitToRole: vi.fn(),
  emitToUser: vi.fn(),
  emitToDocument: vi.fn(),
}));
vi.mock('../config/logger.js', () => ({ log: vi.fn() }));
vi.mock('../events/event-bus.js', () => ({
  eventBus: { publish: vi.fn() },
}));

import { createPrismaMock } from '../test-utils/prisma-mock.js';
import { createAuditLog } from './audit.service.js';
import {
  getApprovalChain,
  getRequiredApproval,
  submitForApproval,
  processApproval,
  getApprovalSteps,
} from './approval.service.js';

// ── Helpers ──────────────────────────────────────────────────────────────

function makeWorkflow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wf-1',
    documentType: 'mirv',
    approverRole: 'warehouse_manager',
    minAmount: 0,
    maxAmount: null,
    slaHours: 24,
    ...overrides,
  };
}

function makeApprovalStep(overrides: Record<string, unknown> = {}) {
  return {
    id: 'step-1',
    documentType: 'mirv',
    documentId: 'doc-1',
    level: 1,
    approverRole: 'warehouse_manager',
    status: 'pending',
    approverId: null,
    notes: null,
    decidedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

// ═════════════════════════════════════════════════════════════════════════

describe('approval.service', () => {
  beforeEach(() => {
    Object.assign(mockPrisma, createPrismaMock());
    vi.clearAllMocks();
  });

  // ─── getApprovalChain ─────────────────────────────────────────────────

  describe('getApprovalChain', () => {
    it('returns empty steps when no workflows match', async () => {
      mockPrisma.approvalWorkflow.findMany.mockResolvedValue([]);

      const chain = await getApprovalChain('mirv', 5000);

      expect(chain).toEqual({ steps: [] });
    });

    it('returns steps ordered by level from matching workflows', async () => {
      mockPrisma.approvalWorkflow.findMany.mockResolvedValue([
        makeWorkflow({ approverRole: 'warehouse_manager', minAmount: 0, slaHours: 24 }),
        makeWorkflow({ id: 'wf-2', approverRole: 'finance_manager', minAmount: 5000, slaHours: 48 }),
      ]);

      const chain = await getApprovalChain('mirv', 10000);

      expect(chain.steps).toHaveLength(2);
      expect(chain.steps[0]).toEqual({ level: 1, approverRole: 'warehouse_manager', slaHours: 24 });
      expect(chain.steps[1]).toEqual({ level: 2, approverRole: 'finance_manager', slaHours: 48 });
    });

    it('queries with correct where clause', async () => {
      mockPrisma.approvalWorkflow.findMany.mockResolvedValue([]);

      await getApprovalChain('jo', 50000);

      expect(mockPrisma.approvalWorkflow.findMany).toHaveBeenCalledWith({
        where: {
          documentType: 'jo',
          minAmount: { lte: 50000 },
          OR: [{ maxAmount: null }, { maxAmount: { gte: 50000 } }],
        },
        orderBy: { minAmount: 'asc' },
      });
    });
  });

  // ─── getRequiredApproval ──────────────────────────────────────────────

  describe('getRequiredApproval', () => {
    it('returns null when no workflows match', async () => {
      mockPrisma.approvalWorkflow.findMany.mockResolvedValue([]);

      const result = await getRequiredApproval('mirv', 5000);

      expect(result).toBeNull();
    });

    it('returns highest-level approval requirement', async () => {
      mockPrisma.approvalWorkflow.findMany.mockResolvedValue([
        makeWorkflow({ approverRole: 'warehouse_manager', slaHours: 24 }),
        makeWorkflow({ id: 'wf-2', approverRole: 'coo', slaHours: 72 }),
      ]);

      const result = await getRequiredApproval('mirv', 10000);

      expect(result).toEqual({ approverRole: 'coo', slaHours: 72 });
    });
  });

  // ─── submitForApproval ────────────────────────────────────────────────

  describe('submitForApproval', () => {
    const defaultParams = {
      documentType: 'mirv',
      documentId: 'doc-1',
      amount: 10000,
      submittedById: 'user-1',
    };

    it('throws when no workflow is configured', async () => {
      mockPrisma.approvalWorkflow.findMany.mockResolvedValue([]);

      await expect(submitForApproval(defaultParams)).rejects.toThrow(
        'No approval workflow configured for mirv with amount 10000',
      );
    });

    it('creates ApprovalStep records and updates document status', async () => {
      const workflow = makeWorkflow();
      mockPrisma.approvalWorkflow.findMany.mockResolvedValue([workflow]);
      mockPrisma.approvalStep.findMany.mockResolvedValue([]); // no existing steps
      mockPrisma.approvalStep.createMany.mockResolvedValue({ count: 1 });
      // Mock the delegate (mirv model) for document status update
      mockPrisma.mirv.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await submitForApproval(defaultParams);

      // Should update document status to pending_approval
      expect(mockPrisma.mirv.update).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: expect.objectContaining({
          status: 'pending_approval',
          slaDueDate: expect.any(Date),
        }),
      });

      // Should create approval step records
      expect(mockPrisma.approvalStep.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            documentType: 'mirv',
            documentId: 'doc-1',
            level: 1,
            approverRole: 'warehouse_manager',
            status: 'pending',
          }),
        ],
      });

      // Should create audit log
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          tableName: 'mirv',
          recordId: 'doc-1',
          action: 'update',
          performedById: 'user-1',
        }),
      );

      // Should return top-level approval info
      expect(result).toEqual({ approverRole: 'warehouse_manager', slaHours: 24 });
    });

    it('is idempotent — calling twice does not create duplicate steps', async () => {
      const workflow = makeWorkflow();
      mockPrisma.approvalWorkflow.findMany.mockResolvedValue([workflow]);
      mockPrisma.mirv.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      // First call: no existing steps
      mockPrisma.approvalStep.findMany.mockResolvedValueOnce([]);
      mockPrisma.approvalStep.createMany.mockResolvedValueOnce({ count: 1 });

      await submitForApproval(defaultParams);

      // Second call: step already exists at level 1
      mockPrisma.approvalStep.findMany.mockResolvedValueOnce([{ level: 1 }]);
      mockPrisma.approvalStep.createMany.mockResolvedValueOnce({ count: 0 });

      await submitForApproval(defaultParams);

      // First call creates steps, second call should not (filtered out by existing levels)
      const secondCallData = mockPrisma.approvalStep.createMany.mock.calls[1];
      // The second call should have an empty data array since level 1 already exists
      expect(secondCallData).toBeUndefined(); // createMany is not called at all when newSteps is empty
    });

    it('creates multi-level approval chain', async () => {
      mockPrisma.approvalWorkflow.findMany.mockResolvedValue([
        makeWorkflow({ approverRole: 'warehouse_manager', slaHours: 24 }),
        makeWorkflow({ id: 'wf-2', approverRole: 'finance_manager', minAmount: 5000, slaHours: 48 }),
      ]);
      mockPrisma.approvalStep.findMany.mockResolvedValue([]);
      mockPrisma.approvalStep.createMany.mockResolvedValue({ count: 2 });
      mockPrisma.mirv.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      const result = await submitForApproval(defaultParams);

      expect(mockPrisma.approvalStep.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ level: 1, approverRole: 'warehouse_manager' }),
          expect.objectContaining({ level: 2, approverRole: 'finance_manager' }),
        ]),
      });

      // Returns the highest-level approval
      expect(result).toEqual({ approverRole: 'finance_manager', slaHours: 48 });
    });
  });

  // ─── processApproval (approve) ────────────────────────────────────────

  describe('processApproval — approve', () => {
    const defaultParams = {
      documentType: 'mirv',
      documentId: 'doc-1',
      action: 'approve' as const,
      processedById: 'approver-1',
      comments: 'Looks good',
    };

    it('throws when no pending step exists', async () => {
      mockPrisma.approvalStep.findFirst.mockResolvedValue(null);

      await expect(processApproval(defaultParams)).rejects.toThrow('No pending approval step for mirv doc-1');
    });

    it('throws when user is not authorized', async () => {
      const step = makeApprovalStep();
      mockPrisma.approvalStep.findFirst.mockResolvedValue(step);
      // User not authorized: not matching role, not active, no delegation
      mockPrisma.employee.findUnique.mockResolvedValue({
        systemRole: 'viewer',
        isActive: true,
      });
      mockPrisma.delegationRule.findFirst.mockResolvedValue(null);

      await expect(processApproval(defaultParams)).rejects.toThrow('User is not authorized to approve this document');
    });

    it('approves current step and fully approves document when single level', async () => {
      const step = makeApprovalStep();
      mockPrisma.approvalStep.findFirst
        .mockResolvedValueOnce(step) // current pending step
        .mockResolvedValueOnce(null); // no next step
      mockPrisma.approvalStep.update.mockResolvedValue({});
      mockPrisma.mirv.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      // Authorize: admin role
      mockPrisma.employee.findUnique.mockResolvedValue({
        systemRole: 'admin',
        isActive: true,
      });

      await processApproval(defaultParams);

      // Step should be marked as approved
      expect(mockPrisma.approvalStep.update).toHaveBeenCalledWith({
        where: { id: 'step-1' },
        data: expect.objectContaining({
          status: 'approved',
          approverId: 'approver-1',
          notes: 'Looks good',
          decidedAt: expect.any(Date),
        }),
      });

      // Document should be marked as fully approved
      expect(mockPrisma.mirv.update).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: expect.objectContaining({
          status: 'approved',
          approvedById: 'approver-1',
          approvedDate: expect.any(Date),
        }),
      });

      // Audit log should be created
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          tableName: 'mirv',
          recordId: 'doc-1',
          action: 'update',
          newValues: expect.objectContaining({ status: 'approved' }),
          performedById: 'approver-1',
        }),
      );
    });

    it('advances to next level when more steps exist', async () => {
      const currentStep = makeApprovalStep({ level: 1 });
      const nextStep = makeApprovalStep({
        id: 'step-2',
        level: 2,
        approverRole: 'finance_manager',
      });

      mockPrisma.approvalStep.findFirst
        .mockResolvedValueOnce(currentStep) // current pending step
        .mockResolvedValueOnce(nextStep); // next pending step
      mockPrisma.approvalStep.update.mockResolvedValue({});
      mockPrisma.mirv.update.mockResolvedValue({});
      mockPrisma.approvalWorkflow.findFirst.mockResolvedValue(
        makeWorkflow({ approverRole: 'finance_manager', slaHours: 48 }),
      );

      // Authorize: direct role match
      mockPrisma.employee.findUnique.mockResolvedValue({
        systemRole: 'warehouse_manager',
        isActive: true,
      });

      await processApproval(defaultParams);

      // Current step approved
      expect(mockPrisma.approvalStep.update).toHaveBeenCalledWith({
        where: { id: 'step-1' },
        data: expect.objectContaining({ status: 'approved' }),
      });

      // Document should NOT be marked as fully approved (still more levels)
      const mirvUpdateCalls = mockPrisma.mirv.update.mock.calls;
      const fullyApprovedCall = mirvUpdateCalls.find(
        (c: unknown[]) =>
          (c[0] as Record<string, unknown>).data &&
          ((c[0] as Record<string, unknown>).data as Record<string, unknown>).status === 'approved',
      );
      expect(fullyApprovedCall).toBeUndefined();

      // Should update SLA for next step
      expect(mockPrisma.mirv.update).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: { slaDueDate: expect.any(Date) },
      });
    });

    it('allows admin to approve any step regardless of required role', async () => {
      const step = makeApprovalStep({ approverRole: 'coo' });
      mockPrisma.approvalStep.findFirst.mockResolvedValueOnce(step).mockResolvedValueOnce(null); // no next step
      mockPrisma.approvalStep.update.mockResolvedValue({});
      mockPrisma.mirv.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      // Admin user
      mockPrisma.employee.findUnique.mockResolvedValue({
        systemRole: 'admin',
        isActive: true,
      });

      // Should not throw
      await expect(processApproval(defaultParams)).resolves.toBeUndefined();
    });
  });

  // ─── processApproval (reject) ─────────────────────────────────────────

  describe('processApproval — reject', () => {
    const defaultParams = {
      documentType: 'mirv',
      documentId: 'doc-1',
      action: 'reject' as const,
      processedById: 'approver-1',
      comments: 'Insufficient documentation',
    };

    it('rejects current step and updates document status to rejected', async () => {
      const step = makeApprovalStep();
      mockPrisma.approvalStep.findFirst.mockResolvedValue(step);
      mockPrisma.approvalStep.update.mockResolvedValue({});
      mockPrisma.approvalStep.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.mirv.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      // Authorize
      mockPrisma.employee.findUnique.mockResolvedValue({
        systemRole: 'warehouse_manager',
        isActive: true,
      });

      await processApproval(defaultParams);

      // Step should be marked as rejected
      expect(mockPrisma.approvalStep.update).toHaveBeenCalledWith({
        where: { id: 'step-1' },
        data: expect.objectContaining({
          status: 'rejected',
          approverId: 'approver-1',
          notes: 'Insufficient documentation',
          decidedAt: expect.any(Date),
        }),
      });

      // Remaining steps should be skipped
      expect(mockPrisma.approvalStep.updateMany).toHaveBeenCalledWith({
        where: {
          documentType: 'mirv',
          documentId: 'doc-1',
          status: 'pending',
          level: { gt: 1 },
        },
        data: { status: 'skipped' },
      });

      // Document should be rejected
      expect(mockPrisma.mirv.update).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: {
          status: 'rejected',
          rejectionReason: 'Insufficient documentation',
        },
      });

      // Audit log
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          tableName: 'mirv',
          recordId: 'doc-1',
          action: 'update',
          newValues: expect.objectContaining({
            status: 'rejected',
            rejectedAtLevel: 1,
          }),
          performedById: 'approver-1',
        }),
      );
    });

    it('uses default rejection reason when no comments provided', async () => {
      const step = makeApprovalStep();
      mockPrisma.approvalStep.findFirst.mockResolvedValue(step);
      mockPrisma.approvalStep.update.mockResolvedValue({});
      mockPrisma.approvalStep.updateMany.mockResolvedValue({ count: 0 });
      mockPrisma.mirv.update.mockResolvedValue({});
      mockPrisma.auditLog.create.mockResolvedValue({});

      mockPrisma.employee.findUnique.mockResolvedValue({
        systemRole: 'admin',
        isActive: true,
      });

      await processApproval({ ...defaultParams, comments: undefined });

      // Document should have default rejection reason
      expect(mockPrisma.mirv.update).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: {
          status: 'rejected',
          rejectionReason: 'Rejected',
        },
      });
    });

    it('throws when user is not authorized to reject', async () => {
      const step = makeApprovalStep();
      mockPrisma.approvalStep.findFirst.mockResolvedValue(step);
      mockPrisma.employee.findUnique.mockResolvedValue({
        systemRole: 'viewer',
        isActive: true,
      });
      mockPrisma.delegationRule.findFirst.mockResolvedValue(null);

      await expect(processApproval(defaultParams)).rejects.toThrow('User is not authorized to reject this document');
    });
  });

  // ─── getApprovalSteps ─────────────────────────────────────────────────

  describe('getApprovalSteps', () => {
    it('returns all steps for a document ordered by level', async () => {
      const steps = [
        makeApprovalStep({ level: 1, status: 'approved' }),
        makeApprovalStep({ id: 'step-2', level: 2, status: 'pending' }),
      ];
      mockPrisma.approvalStep.findMany.mockResolvedValue(steps);

      const result = await getApprovalSteps('mirv', 'doc-1');

      expect(result).toEqual(steps);
      expect(mockPrisma.approvalStep.findMany).toHaveBeenCalledWith({
        where: { documentType: 'mirv', documentId: 'doc-1' },
        include: {
          approver: { select: { id: true, fullName: true, email: true, role: true } },
        },
        orderBy: { level: 'asc' },
      });
    });

    it('returns empty array when no steps exist', async () => {
      mockPrisma.approvalStep.findMany.mockResolvedValue([]);

      const result = await getApprovalSteps('mirv', 'nonexistent');

      expect(result).toEqual([]);
    });
  });
});
