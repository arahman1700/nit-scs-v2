import { prisma } from '../utils/prisma.js';
import { log } from '../config/logger.js';

// ── Types ───────────────────────────────────────────────────────────────

export interface ParallelApprovalGroupResult {
  id: string;
  documentType: string;
  documentId: string;
  approvalLevel: number;
  mode: string;
  status: string;
  createdAt: Date;
  completedAt: Date | null;
  responses: Array<{
    id: string;
    approverId: string;
    decision: string;
    comments: string | null;
    decidedAt: Date;
    approver: { id: string; fullName: string; email: string; role: string };
  }>;
}

const INCLUDE_RESPONSES = {
  responses: {
    include: {
      approver: { select: { id: true, fullName: true, email: true, role: true } },
    },
    orderBy: { decidedAt: 'asc' as const },
  },
};

// ── Create a Parallel Approval Group ────────────────────────────────────

/**
 * Create a new parallel approval group for a document at a given level.
 * Approver IDs define who must respond. Mode controls resolution logic:
 *   - 'all': group is approved when ALL approvers approve; rejected if ANY reject
 *   - 'any': group is approved when the FIRST approver approves; rejected when ALL reject
 */
export async function createParallelApproval(params: {
  documentType: string;
  documentId: string;
  level: number;
  mode: 'all' | 'any';
  approverIds: string[];
}): Promise<ParallelApprovalGroupResult> {
  const { documentType, documentId, level, mode, approverIds } = params;

  if (approverIds.length === 0) {
    throw new Error('At least one approver is required');
  }

  // Verify all approver IDs exist and are active
  const approvers = await prisma.employee.findMany({
    where: { id: { in: approverIds }, isActive: true },
    select: { id: true },
  });

  if (approvers.length !== approverIds.length) {
    const found = new Set(approvers.map(a => a.id));
    const missing = approverIds.filter(id => !found.has(id));
    throw new Error(`Approver(s) not found or inactive: ${missing.join(', ')}`);
  }

  const group = await prisma.parallelApprovalGroup.create({
    data: {
      documentType,
      documentId,
      approvalLevel: level,
      mode,
      status: 'pending',
    },
    include: INCLUDE_RESPONSES,
  });

  log(
    'info',
    `[ParallelApproval] Created group ${group.id} for ${documentType}/${documentId} level ${level} mode=${mode} with ${approverIds.length} approvers`,
  );

  return group;
}

// ── Respond to a Parallel Approval ──────────────────────────────────────

/**
 * Record an approver's decision on a parallel approval group.
 * Evaluates whether the group is now complete based on its mode:
 *   - mode='all': rejected immediately on any rejection
 *   - mode='any': approved immediately on any approval
 * For full completion (mode='all' approved, mode='any' rejected),
 * call evaluateGroupCompletion with the expected approver count.
 */
export async function respondToApproval(params: {
  groupId: string;
  approverId: string;
  decision: 'approved' | 'rejected';
  comments?: string;
}): Promise<ParallelApprovalGroupResult> {
  const { groupId, approverId, decision, comments } = params;

  // Load group
  const group = await prisma.parallelApprovalGroup.findUnique({
    where: { id: groupId },
    include: INCLUDE_RESPONSES,
  });

  if (!group) {
    throw new Error(`Parallel approval group ${groupId} not found`);
  }

  if (group.status !== 'pending') {
    throw new Error(`Group ${groupId} is already ${group.status}`);
  }

  // Check if approver already responded
  const existing = group.responses.find(r => r.approverId === approverId);
  if (existing) {
    throw new Error(`Approver ${approverId} has already responded to this group`);
  }

  // Record the response
  await prisma.parallelApprovalResponse.create({
    data: {
      groupId,
      approverId,
      decision,
      comments: comments ?? null,
    },
  });

  // Re-fetch to evaluate
  const allResponses = await prisma.parallelApprovalResponse.findMany({
    where: { groupId },
  });

  const approvedCount = allResponses.filter(r => r.decision === 'approved').length;
  const rejectedCount = allResponses.filter(r => r.decision === 'rejected').length;
  const totalResponses = allResponses.length;

  let newStatus: 'pending' | 'approved' | 'rejected' = 'pending';

  if (group.mode === 'all') {
    // mode='all': rejected immediately if ANY reject
    if (rejectedCount > 0) {
      newStatus = 'rejected';
    }
    // For full approval in 'all' mode, call evaluateGroupCompletion
    // with the expected count once all responses are in.
  } else if (group.mode === 'any') {
    // mode='any': approved on FIRST approval
    if (approvedCount > 0) {
      newStatus = 'approved';
    }
    // For rejection in 'any' mode (all must reject), call evaluateGroupCompletion.
  }

  // Update group status if resolved
  if (newStatus !== 'pending') {
    await prisma.parallelApprovalGroup.update({
      where: { id: groupId },
      data: {
        status: newStatus,
        completedAt: new Date(),
      },
    });

    log(
      'info',
      `[ParallelApproval] Group ${groupId} resolved as ${newStatus} (${totalResponses} responses, mode=${group.mode})`,
    );
  } else {
    log('info', `[ParallelApproval] Group ${groupId} response recorded (${totalResponses} total, mode=${group.mode})`);
  }

  // Return updated group
  return prisma.parallelApprovalGroup.findUnique({
    where: { id: groupId },
    include: INCLUDE_RESPONSES,
  }) as Promise<ParallelApprovalGroupResult>;
}

// ── Evaluate Group Completion ───────────────────────────────────────────

/**
 * Evaluate whether a parallel approval group is complete given the expected approver count.
 *   - mode='all': approved when approvedCount === expectedCount, rejected if any rejected.
 *   - mode='any': approved on first approval, rejected when rejectedCount === expectedCount.
 */
export async function evaluateGroupCompletion(
  groupId: string,
  expectedApproverCount: number,
): Promise<ParallelApprovalGroupResult> {
  const group = await prisma.parallelApprovalGroup.findUnique({
    where: { id: groupId },
    include: INCLUDE_RESPONSES,
  });

  if (!group) {
    throw new Error(`Parallel approval group ${groupId} not found`);
  }

  if (group.status !== 'pending') {
    return group;
  }

  const approvedCount = group.responses.filter(r => r.decision === 'approved').length;
  const rejectedCount = group.responses.filter(r => r.decision === 'rejected').length;

  let newStatus: 'pending' | 'approved' | 'rejected' = 'pending';

  if (group.mode === 'all') {
    if (rejectedCount > 0) {
      newStatus = 'rejected';
    } else if (approvedCount >= expectedApproverCount) {
      newStatus = 'approved';
    }
  } else if (group.mode === 'any') {
    if (approvedCount > 0) {
      newStatus = 'approved';
    } else if (rejectedCount >= expectedApproverCount) {
      newStatus = 'rejected';
    }
  }

  if (newStatus !== 'pending') {
    await prisma.parallelApprovalGroup.update({
      where: { id: groupId },
      data: {
        status: newStatus,
        completedAt: new Date(),
      },
    });

    log(
      'info',
      `[ParallelApproval] Group ${groupId} evaluated as ${newStatus} (${approvedCount} approved, ${rejectedCount} rejected, expected ${expectedApproverCount})`,
    );
  }

  return prisma.parallelApprovalGroup.findUnique({
    where: { id: groupId },
    include: INCLUDE_RESPONSES,
  }) as Promise<ParallelApprovalGroupResult>;
}

// ── Get Group Status for a Document ────────────────────────────────────

/**
 * Get all parallel approval groups for a given document.
 */
export async function getGroupStatus(documentType: string, documentId: string): Promise<ParallelApprovalGroupResult[]> {
  return prisma.parallelApprovalGroup.findMany({
    where: { documentType, documentId },
    include: INCLUDE_RESPONSES,
    orderBy: { approvalLevel: 'asc' },
  });
}

// ── Get Pending Groups for an Approver ──────────────────────────────────

/**
 * Get all pending parallel approval groups where this approver has not yet responded.
 */
export async function getPendingForApprover(approverId: string): Promise<ParallelApprovalGroupResult[]> {
  // Find all pending groups where this user has NOT already responded
  const pendingGroups = await prisma.parallelApprovalGroup.findMany({
    where: {
      status: 'pending',
      NOT: {
        responses: {
          some: { approverId },
        },
      },
    },
    include: INCLUDE_RESPONSES,
    orderBy: { createdAt: 'desc' },
  });

  return pendingGroups;
}
