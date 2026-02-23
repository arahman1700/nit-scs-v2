import type { Server as SocketIOServer } from 'socket.io';
import { prisma } from '../utils/prisma.js';
import { createAuditLog } from './audit.service.js';
import { createNotification } from './notification.service.js';
import { emitToRole, emitToDocument } from '../socket/setup.js';
import { log } from '../config/logger.js';
import { eventBus } from '../events/event-bus.js';

// ── Document Display Names (V1 internal → V2 label) ────────────────────

const DOC_LABELS: Record<string, string> = {
  mrrv: 'GRN',
  mirv: 'MI',
  mrv: 'MRN',
  rfim: 'QCI',
  osd: 'DR',
  mrf: 'MR',
  stock_transfer: 'WT',
  jo: 'Job Order',
  gate_pass: 'Gate Pass',
  shipment: 'Shipment',
  imsf: 'IMSF',
  scrap: 'Scrap',
  surplus: 'Surplus',
};

function docLabel(type: string): string {
  return DOC_LABELS[type] || type.toUpperCase();
}

/** Send a persistent + push notification to every active user with the given role. */
async function notifyRoleUsers(
  role: string,
  params: { title: string; body: string; referenceTable: string; referenceId: string },
  io?: SocketIOServer,
): Promise<void> {
  const users = await prisma.employee.findMany({
    where: { systemRole: role, isActive: true },
    select: { id: true },
  });
  await Promise.allSettled(
    users.map(u =>
      createNotification(
        {
          recipientId: u.id,
          title: params.title,
          body: params.body,
          notificationType: 'approval',
          referenceTable: params.referenceTable,
          referenceId: params.referenceId,
        },
        io,
      ),
    ),
  );
}

// ── Types ───────────────────────────────────────────────────────────────

export interface RequiredApproval {
  approverRole: string;
  slaHours: number;
}

export interface ApprovalChain {
  steps: Array<{
    level: number;
    approverRole: string;
    slaHours: number;
  }>;
}

// ── Model Name Mapping ──────────────────────────────────────────────────

const MODEL_MAP: Record<string, string> = {
  mirv: 'mirv',
  mrrv: 'mrrv',
  mrv: 'mrv',
  rfim: 'rfim',
  osd: 'osdReport',
  jo: 'jobOrder',
  gate_pass: 'gatePass',
  stock_transfer: 'stockTransfer',
  mrf: 'materialRequisition',
  shipment: 'shipment',
};

type PrismaDelegate = {
  update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
  findUnique: (args: { where: { id: string } }) => Promise<Record<string, unknown> | null>;
};

function getDelegate(documentType: string): PrismaDelegate {
  const modelName = MODEL_MAP[documentType] || documentType;
  return (prisma as unknown as Record<string, PrismaDelegate>)[modelName];
}

// ── Delegation Resolution ───────────────────────────────────────────────

/**
 * Check if the given user has a valid delegation for the required approver role.
 * Returns true if a delegation exists that covers the current date and scope.
 */
async function hasActiveDelegation(userId: string, requiredRole: string, documentType: string): Promise<boolean> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const delegation = await prisma.delegationRule.findFirst({
    where: {
      delegateId: userId,
      isActive: true,
      startDate: { lte: today },
      endDate: { gte: today },
      OR: [{ scope: 'all' }, { scope: documentType }],
      delegator: {
        systemRole: requiredRole,
        isActive: true,
      },
    },
    include: {
      delegator: { select: { id: true, fullName: true, systemRole: true } },
    },
  });

  if (delegation) {
    log('info', `[Approval] Delegation active: ${delegation.delegator.fullName} (${requiredRole}) → user ${userId}`);
    return true;
  }
  return false;
}

/**
 * Check if a user is authorized to approve at a given step.
 * Checks direct role match OR active delegation.
 */
export async function isAuthorizedApprover(
  userId: string,
  requiredRole: string,
  documentType: string,
): Promise<boolean> {
  // Check direct role
  const user = await prisma.employee.findUnique({
    where: { id: userId },
    select: { systemRole: true, isActive: true },
  });

  if (!user || !user.isActive) return false;

  // Admin can always approve
  if (user.systemRole === 'admin') return true;

  // Direct role match
  if (user.systemRole === requiredRole) return true;

  // Check delegation
  return hasActiveDelegation(userId, requiredRole, documentType);
}

// ── Lookup Approval Chain ───────────────────────────────────────────────

/**
 * Build the full multi-level approval chain for a document type and amount.
 * Returns all matching workflow rules ordered by minAmount ascending (lower amounts = earlier levels).
 */
export async function getApprovalChain(documentType: string, amount: number): Promise<ApprovalChain> {
  const workflows = await prisma.approvalWorkflow.findMany({
    where: {
      documentType,
      minAmount: { lte: amount },
      OR: [{ maxAmount: null }, { maxAmount: { gte: amount } }],
    },
    orderBy: { minAmount: 'asc' },
  });

  if (workflows.length === 0) {
    return { steps: [] };
  }

  // Build multi-level chain: each matching workflow rule = one approval level
  const steps = workflows.map((wf, index) => ({
    level: index + 1,
    approverRole: wf.approverRole,
    slaHours: wf.slaHours,
  }));

  return { steps };
}

/**
 * Legacy single-level lookup — returns the highest-authority approval needed.
 */
export async function getRequiredApproval(documentType: string, amount: number): Promise<RequiredApproval | null> {
  const chain = await getApprovalChain(documentType, amount);
  if (chain.steps.length === 0) return null;

  // Return the highest level (last step)
  const topLevel = chain.steps[chain.steps.length - 1];
  return {
    approverRole: topLevel.approverRole,
    slaHours: topLevel.slaHours,
  };
}

// ── Submit Document for Approval ────────────────────────────────────────

export async function submitForApproval(params: {
  documentType: string;
  documentId: string;
  amount: number;
  submittedById: string;
  io?: SocketIOServer;
}): Promise<RequiredApproval> {
  const { documentType, documentId, amount, submittedById, io } = params;

  const chain = await getApprovalChain(documentType, amount);
  if (chain.steps.length === 0) {
    throw new Error(`No approval workflow configured for ${documentType} with amount ${amount}`);
  }

  // Calculate SLA for the first step
  const firstStep = chain.steps[0];
  const slaDueDate = new Date();
  slaDueDate.setHours(slaDueDate.getHours() + firstStep.slaHours);

  // Update document status
  const delegate = getDelegate(documentType);
  await delegate.update({
    where: { id: documentId },
    data: {
      status: 'pending_approval',
      slaDueDate,
    },
  });

  // Create ApprovalStep records — idempotent: skip levels that already exist
  const existingSteps = await prisma.approvalStep.findMany({
    where: { documentType, documentId },
    select: { level: true },
  });
  const existingLevels = new Set(existingSteps.map(s => s.level));

  const newSteps = chain.steps.filter(step => !existingLevels.has(step.level));
  if (newSteps.length > 0) {
    await prisma.approvalStep.createMany({
      data: newSteps.map(step => ({
        documentType,
        documentId,
        level: step.level,
        approverRole: step.approverRole,
        status: 'pending' as const,
      })),
    });
  }

  // Audit log
  await createAuditLog({
    tableName: documentType,
    recordId: documentId,
    action: 'update',
    newValues: {
      status: 'pending_approval',
      slaDueDate: slaDueDate.toISOString(),
      approvalChain: chain.steps,
    },
    performedById: submittedById,
  });

  // Socket events — notify first level approver role
  if (io) {
    emitToRole(io, firstStep.approverRole, 'approval:requested', {
      documentType,
      documentId,
      amount,
      level: 1,
      approverRole: firstStep.approverRole,
      totalLevels: chain.steps.length,
      slaDueDate: slaDueDate.toISOString(),
    });
    emitToDocument(io, documentId, 'document:status', {
      documentType,
      documentId,
      status: 'pending_approval',
      currentLevel: 1,
      totalLevels: chain.steps.length,
    });
  }

  // Push + persistent notification to first-level approvers
  notifyRoleUsers(
    firstStep.approverRole,
    {
      title: `${docLabel(documentType)} Pending Approval`,
      body: `A ${docLabel(documentType)} requires your Level 1 approval.`,
      referenceTable: documentType,
      referenceId: documentId,
    },
    io,
  ).catch(err => log('warn', `[Approval] Push notify failed: ${err}`));

  log('info', `[Approval] ${documentType} ${documentId} submitted for ${chain.steps.length}-level approval`);

  eventBus.publish({
    type: 'approval:requested',
    entityType: documentType,
    entityId: documentId,
    action: 'submit_for_approval',
    payload: {
      amount,
      approvalChain: chain.steps,
      currentLevel: 1,
      slaDueDate: slaDueDate.toISOString(),
    },
    performedById: submittedById,
    timestamp: new Date().toISOString(),
  });

  // Return top-level approval for backward compatibility
  const topStep = chain.steps[chain.steps.length - 1];
  return { approverRole: topStep.approverRole, slaHours: topStep.slaHours };
}

// ── Process Approval or Rejection ───────────────────────────────────────

export async function processApproval(params: {
  documentType: string;
  documentId: string;
  action: 'approve' | 'reject';
  processedById: string;
  comments?: string;
  io?: SocketIOServer;
}): Promise<void> {
  const { documentType, documentId, action, processedById, comments, io } = params;

  // Find the current pending step (lowest level that is still pending)
  const currentStep = await prisma.approvalStep.findFirst({
    where: {
      documentType,
      documentId,
      status: 'pending',
    },
    orderBy: { level: 'asc' },
  });

  if (!currentStep) {
    throw new Error(`No pending approval step for ${documentType} ${documentId}`);
  }

  // Verify the user is authorized for this step
  const isAuthorized = await isAuthorizedApprover(processedById, currentStep.approverRole, documentType);
  if (!isAuthorized) {
    throw new Error(`User is not authorized to ${action} this document. Required role: ${currentStep.approverRole}`);
  }

  const delegate = getDelegate(documentType);

  if (action === 'approve') {
    // Mark current step as approved
    await prisma.approvalStep.update({
      where: { id: currentStep.id },
      data: {
        status: 'approved',
        approverId: processedById,
        notes: comments ?? null,
        decidedAt: new Date(),
      },
    });

    // Check if there are more steps
    const nextStep = await prisma.approvalStep.findFirst({
      where: {
        documentType,
        documentId,
        status: 'pending',
        level: { gt: currentStep.level },
      },
      orderBy: { level: 'asc' },
    });

    if (nextStep) {
      // More levels to go — update SLA for next level
      const nextSlaDate = new Date();
      // Look up SLA hours for next step's role
      const nextWorkflow = await prisma.approvalWorkflow.findFirst({
        where: {
          documentType,
          approverRole: nextStep.approverRole,
        },
        orderBy: { minAmount: 'desc' },
      });

      if (nextWorkflow) {
        nextSlaDate.setHours(nextSlaDate.getHours() + nextWorkflow.slaHours);
        await delegate.update({
          where: { id: documentId },
          data: { slaDueDate: nextSlaDate },
        });
      }

      // Notify next level
      if (io) {
        emitToRole(io, nextStep.approverRole, 'approval:requested', {
          documentType,
          documentId,
          level: nextStep.level,
          approverRole: nextStep.approverRole,
          previouslyApprovedBy: processedById,
        });
        emitToDocument(io, documentId, 'approval:level_approved', {
          documentType,
          documentId,
          approvedLevel: currentStep.level,
          nextLevel: nextStep.level,
          nextApproverRole: nextStep.approverRole,
          approvedById: processedById,
        });
      }

      // Push + persistent notification to next-level approvers
      notifyRoleUsers(
        nextStep.approverRole,
        {
          title: `${docLabel(documentType)} Awaiting L${nextStep.level} Approval`,
          body: `Level ${currentStep.level} approved. Your Level ${nextStep.level} approval is required.`,
          referenceTable: documentType,
          referenceId: documentId,
        },
        io,
      ).catch(err => log('warn', `[Approval] Push notify failed: ${err}`));

      log(
        'info',
        `[Approval] ${documentType} ${documentId} level ${currentStep.level} approved by ${processedById}, advancing to level ${nextStep.level}`,
      );

      eventBus.publish({
        type: 'approval:level_approved',
        entityType: documentType,
        entityId: documentId,
        action: 'approve_level',
        payload: {
          approvedLevel: currentStep.level,
          nextLevel: nextStep.level,
          approvedById: processedById,
          comments,
        },
        performedById: processedById,
        timestamp: new Date().toISOString(),
      });
    } else {
      // All levels approved — mark document as approved
      await delegate.update({
        where: { id: documentId },
        data: {
          status: 'approved',
          approvedById: processedById,
          approvedDate: new Date(),
        },
      });

      await createAuditLog({
        tableName: documentType,
        recordId: documentId,
        action: 'update',
        newValues: {
          status: 'approved',
          approvedById: processedById,
          comments,
          finalLevel: currentStep.level,
        },
        performedById: processedById,
      });

      if (io) {
        emitToDocument(io, documentId, 'approval:approved', {
          documentType,
          documentId,
          approvedById: processedById,
          totalLevels: currentStep.level,
          comments,
        });
      }

      // Notify the document submitter that it's fully approved
      const approvedDoc = await delegate.findUnique({ where: { id: documentId } });
      const submitter = (approvedDoc as Record<string, unknown> | null)?.createdById as string | undefined;
      if (submitter) {
        createNotification(
          {
            recipientId: submitter,
            title: `${docLabel(documentType)} Approved`,
            body: `Your ${docLabel(documentType)} has been fully approved.`,
            notificationType: 'approval',
            referenceTable: documentType,
            referenceId: documentId,
          },
          io,
        ).catch(err => log('warn', `[Approval] Push notify failed: ${err}`));
      }

      log(
        'info',
        `[Approval] ${documentType} ${documentId} fully approved (${currentStep.level} levels) by ${processedById}`,
      );

      eventBus.publish({
        type: 'approval:approved',
        entityType: documentType,
        entityId: documentId,
        action: 'approve',
        payload: { approvedById: processedById, comments, totalLevels: currentStep.level },
        performedById: processedById,
        timestamp: new Date().toISOString(),
      });
    }
  } else {
    // Reject — mark current step and all subsequent steps
    await prisma.approvalStep.update({
      where: { id: currentStep.id },
      data: {
        status: 'rejected',
        approverId: processedById,
        notes: comments ?? 'Rejected',
        decidedAt: new Date(),
      },
    });

    // Skip all remaining steps
    await prisma.approvalStep.updateMany({
      where: {
        documentType,
        documentId,
        status: 'pending',
        level: { gt: currentStep.level },
      },
      data: { status: 'skipped' },
    });

    // Update document
    await delegate.update({
      where: { id: documentId },
      data: {
        status: 'rejected',
        rejectionReason: comments || 'Rejected',
      },
    });

    await createAuditLog({
      tableName: documentType,
      recordId: documentId,
      action: 'update',
      newValues: {
        status: 'rejected',
        rejectedAtLevel: currentStep.level,
        rejectionReason: comments || 'Rejected',
      },
      performedById: processedById,
    });

    if (io) {
      emitToDocument(io, documentId, 'approval:rejected', {
        documentType,
        documentId,
        rejectedById: processedById,
        rejectedAtLevel: currentStep.level,
        reason: comments,
      });
    }

    // Notify the document submitter that it's been rejected
    const rejectedDoc = await delegate.findUnique({ where: { id: documentId } });
    const rejSubmitter = (rejectedDoc as Record<string, unknown> | null)?.createdById as string | undefined;
    if (rejSubmitter) {
      createNotification(
        {
          recipientId: rejSubmitter,
          title: `${docLabel(documentType)} Rejected`,
          body: `Your ${docLabel(documentType)} was rejected at Level ${currentStep.level}.${comments ? ` Reason: ${comments}` : ''}`,
          notificationType: 'approval',
          referenceTable: documentType,
          referenceId: documentId,
        },
        io,
      ).catch(err => log('warn', `[Approval] Push notify failed: ${err}`));
    }

    log('info', `[Approval] ${documentType} ${documentId} rejected at level ${currentStep.level} by ${processedById}`);

    eventBus.publish({
      type: 'approval:rejected',
      entityType: documentType,
      entityId: documentId,
      action: 'reject',
      payload: {
        rejectedById: processedById,
        rejectedAtLevel: currentStep.level,
        reason: comments,
      },
      performedById: processedById,
      timestamp: new Date().toISOString(),
    });
  }
}

// ── Get Approval Steps for a Document ───────────────────────────────────

export async function getApprovalSteps(documentType: string, documentId: string) {
  return prisma.approvalStep.findMany({
    where: { documentType, documentId },
    include: {
      approver: { select: { id: true, fullName: true, email: true, role: true } },
    },
    orderBy: { level: 'asc' },
  });
}

// ── Get Pending Approvals for a User ────────────────────────────────────

/**
 * Get all documents pending approval that this user can action.
 * Checks both direct role and active delegations.
 */
export async function getPendingApprovalsForUser(userId: string) {
  const user = await prisma.employee.findUnique({
    where: { id: userId },
    select: { systemRole: true },
  });

  if (!user) return [];

  // Get roles this user can approve for (own role + delegated roles)
  const roles = [user.systemRole];

  // Admin can see all pending approvals
  if (user.systemRole === 'admin') {
    const allPending = await prisma.approvalStep.findMany({
      where: { status: 'pending' },
      orderBy: [{ createdAt: 'desc' }],
    });
    return allPending;
  }

  // Check active delegations
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const delegations = await prisma.delegationRule.findMany({
    where: {
      delegateId: userId,
      isActive: true,
      startDate: { lte: today },
      endDate: { gte: today },
    },
    include: {
      delegator: { select: { systemRole: true } },
    },
  });

  for (const d of delegations) {
    if (!roles.includes(d.delegator.systemRole)) {
      roles.push(d.delegator.systemRole);
    }
  }

  // Find pending steps for these roles at the current active level
  const pendingSteps = await prisma.approvalStep.findMany({
    where: {
      status: 'pending',
      approverRole: { in: roles },
    },
    orderBy: [{ createdAt: 'desc' }],
  });

  // Filter to only the lowest pending level per document (the currently actionable step)
  const actionableSteps = new Map<string, (typeof pendingSteps)[0]>();
  for (const step of pendingSteps) {
    const key = `${step.documentType}:${step.documentId}`;
    const existing = actionableSteps.get(key);
    if (!existing || step.level < existing.level) {
      actionableSteps.set(key, step);
    }
  }

  return Array.from(actionableSteps.values());
}
