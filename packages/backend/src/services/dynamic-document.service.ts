import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError } from '@nit-scs-v2/shared';
import { generateDocumentNumber } from './document-number.service.js';
import { validateDynamicData, validateDynamicLines, type FieldError } from './dynamic-validation.service.js';
import { getDocumentTypeByCode } from './dynamic-document-type.service.js';
import { isAuthorizedApprover, getApprovalSteps } from './approval.service.js';
import { log } from '../config/logger.js';

// ── Types ──────────────────────────────────────────────────────────────

interface StatusFlowConfig {
  initialStatus: string;
  statuses: Array<{ key: string; label: string; color: string }>;
  transitions: Record<string, string[]>;
}

interface ApprovalConfigLevel {
  role: string;
  level: number;
}

interface ApprovalConfig {
  levels: ApprovalConfigLevel[];
  amountField?: string;
}

function parseApprovalConfig(raw: unknown): ApprovalConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const config = raw as ApprovalConfig;
  if (!config.levels || !Array.isArray(config.levels) || config.levels.length === 0) return null;
  return config;
}

// ── List ────────────────────────────────────────────────────────────────

export async function listDocuments(
  typeCode: string,
  params: {
    skip: number;
    pageSize: number;
    sortBy: string;
    sortDir: 'asc' | 'desc';
    search?: string;
    status?: string;
    [key: string]: unknown;
  },
) {
  const docType = await getDocumentTypeByCode(typeCode);
  const where: Record<string, unknown> = { documentTypeId: docType.id };

  if (params.status) where.status = params.status;
  if (params.projectId) where.projectId = params.projectId;
  if (params.warehouseId) where.warehouseId = params.warehouseId;

  if (params.search) {
    where.OR = [{ documentNumber: { contains: params.search, mode: 'insensitive' } }];
  }

  const [data, total] = await Promise.all([
    prisma.dynamicDocument.findMany({
      where,
      orderBy: { [params.sortBy]: params.sortDir },
      skip: params.skip,
      take: params.pageSize,
      include: {
        project: { select: { projectCode: true, projectName: true } },
        warehouse: { select: { warehouseCode: true, warehouseName: true } },
        createdBy: { select: { fullName: true } },
      },
    }),
    prisma.dynamicDocument.count({ where }),
  ]);

  return { data, total };
}

// ── Get by ID ──────────────────────────────────────────────────────────

export async function getDocumentById(id: string) {
  const doc = await prisma.dynamicDocument.findUnique({
    where: { id },
    include: {
      documentType: { include: { fields: { orderBy: { sortOrder: 'asc' } } } },
      lines: { orderBy: { lineNumber: 'asc' } },
      history: {
        orderBy: { performedAt: 'desc' },
        include: { performedBy: { select: { fullName: true } } },
      },
      project: { select: { projectCode: true, projectName: true } },
      warehouse: { select: { warehouseCode: true, warehouseName: true } },
      createdBy: { select: { fullName: true } },
      updatedBy: { select: { fullName: true } },
    },
  });
  if (!doc) throw new NotFoundError('Document not found');
  return doc;
}

// ── Create ─────────────────────────────────────────────────────────────

export async function createDocument(
  typeCode: string,
  body: {
    data: Record<string, unknown>;
    lines?: Array<Record<string, unknown>>;
    projectId?: string;
    warehouseId?: string;
  },
  userId: string,
) {
  const docType = await getDocumentTypeByCode(typeCode);
  const statusFlow = docType.statusFlow as unknown as StatusFlowConfig;

  // Validate header data
  const errors = validateDynamicData(docType.fields, body.data);

  // Validate line items if applicable
  if (body.lines && body.lines.length > 0) {
    errors.push(...validateDynamicLines(docType.fields, body.lines));
  }

  if (errors.length > 0) {
    throw new DynamicValidationError(errors);
  }

  // Generate document number
  const settings = docType.settings as Record<string, unknown>;
  const _prefix = (settings.numberPrefix as string) || docType.code.toUpperCase();
  const documentNumber = await generateDocumentNumber(`dyn:${docType.code}`);

  const initialStatus = statusFlow.initialStatus || 'draft';

  const approvalConfig = parseApprovalConfig(docType.approvalConfig);

  const doc = await prisma.$transaction(async tx => {
    const created = await tx.dynamicDocument.create({
      data: {
        documentTypeId: docType.id,
        documentNumber,
        status: initialStatus,
        data: body.data as Prisma.InputJsonValue,
        projectId: body.projectId,
        warehouseId: body.warehouseId,
        createdById: userId,
        updatedById: userId,
        lines: body.lines
          ? {
              create: body.lines.map((line, i) => ({
                lineNumber: i + 1,
                data: line as Prisma.InputJsonValue,
              })),
            }
          : undefined,
        history: {
          create: {
            fromStatus: null,
            toStatus: initialStatus,
            performedById: userId,
            comment: 'Document created',
          },
        },
      },
      include: {
        lines: true,
      },
    });

    // Create ApprovalStep records if approvalConfig has levels
    if (approvalConfig) {
      const docTypeKey = `dynamic_${typeCode}`;
      await tx.approvalStep.createMany({
        data: approvalConfig.levels.map(level => ({
          documentType: docTypeKey,
          documentId: created.id,
          level: level.level,
          approverRole: level.role,
          status: 'pending' as const,
        })),
      });
      log(
        'info',
        `[DynDoc] Created ${approvalConfig.levels.length} approval steps for ${docTypeKey}:${created.documentNumber}`,
      );
    }

    return created;
  });

  log('info', `[DynDoc] Created ${typeCode} document: ${doc.documentNumber}`);
  return doc;
}

// ── Update ─────────────────────────────────────────────────────────────

export async function updateDocument(
  id: string,
  body: {
    data?: Record<string, unknown>;
    lines?: Array<Record<string, unknown>>;
    projectId?: string;
    warehouseId?: string;
  },
  userId: string,
) {
  const existing = await prisma.dynamicDocument.findUnique({
    where: { id },
    include: { documentType: { include: { fields: { orderBy: { sortOrder: 'asc' } } } } },
  });
  if (!existing) throw new NotFoundError('Document not found');

  // Only allow updates in editable statuses
  const statusFlow = existing.documentType.statusFlow as unknown as StatusFlowConfig;
  const editableStatuses = getEditableStatuses(statusFlow);
  if (!editableStatuses.includes(existing.status)) {
    throw new Error(`Cannot edit document in '${existing.status}' status`);
  }

  // Validate
  if (body.data) {
    const errors = validateDynamicData(existing.documentType.fields, body.data);
    if (body.lines) {
      errors.push(...validateDynamicLines(existing.documentType.fields, body.lines));
    }
    if (errors.length > 0) {
      throw new DynamicValidationError(errors);
    }
  }

  // Update document + replace lines
  const updated = await prisma.$transaction(async tx => {
    // Delete existing lines if new ones provided
    if (body.lines) {
      await tx.dynamicDocumentLine.deleteMany({ where: { documentId: id } });
    }

    return tx.dynamicDocument.update({
      where: { id },
      data: {
        data: body.data ? (body.data as Prisma.InputJsonValue) : undefined,
        projectId: body.projectId,
        warehouseId: body.warehouseId,
        updatedById: userId,
        version: { increment: 1 },
        lines: body.lines
          ? {
              create: body.lines.map((line, i) => ({
                lineNumber: i + 1,
                data: line as Prisma.InputJsonValue,
              })),
            }
          : undefined,
      },
      include: { lines: true },
    });
  });

  return { existing, updated };
}

// ── Status Transition ──────────────────────────────────────────────────

export async function transitionDocument(
  typeCode: string,
  documentId: string,
  targetStatus: string,
  userId: string,
  comment?: string,
) {
  const doc = await prisma.dynamicDocument.findUnique({
    where: { id: documentId },
    include: { documentType: true },
  });
  if (!doc) throw new NotFoundError('Document not found');

  const statusFlow = doc.documentType.statusFlow as unknown as StatusFlowConfig;
  const allowedTransitions = statusFlow.transitions[doc.status] || [];

  if (!allowedTransitions.includes(targetStatus)) {
    const allowedStr = allowedTransitions.length > 0 ? allowedTransitions.join(', ') : 'none';
    throw new Error(`Invalid status transition: '${doc.status}' → '${targetStatus}'. Allowed: ${allowedStr}`);
  }

  // Check approval requirements before allowing transition
  const approvalConfig = parseApprovalConfig(doc.documentType.approvalConfig);
  if (approvalConfig) {
    const docTypeKey = `dynamic_${typeCode}`;
    const pendingSteps = await prisma.approvalStep.findMany({
      where: {
        documentType: docTypeKey,
        documentId,
        status: 'pending',
      },
    });

    if (pendingSteps.length > 0) {
      const pendingLevels = pendingSteps.map(s => s.level).sort((a, b) => a - b);
      throw new Error(
        `Cannot transition: document has ${pendingSteps.length} pending approval(s) at level(s) ${pendingLevels.join(', ')}. ` +
          `All approval steps must be completed before status transition.`,
      );
    }
  }

  const updated = await prisma.$transaction(async tx => {
    // Update document status
    const result = await tx.dynamicDocument.update({
      where: { id: documentId },
      data: {
        status: targetStatus,
        updatedById: userId,
        version: { increment: 1 },
      },
    });

    // Add history entry
    await tx.dynamicDocumentHistory.create({
      data: {
        documentId,
        fromStatus: doc.status,
        toStatus: targetStatus,
        performedById: userId,
        comment,
      },
    });

    return result;
  });

  log('info', `[DynDoc] ${typeCode}:${doc.documentNumber} ${doc.status} → ${targetStatus}`);
  return updated;
}

// ── Approve Document ──────────────────────────────────────────────────

export async function approveDocument(typeCode: string, documentId: string, userId: string, comments?: string) {
  const doc = await prisma.dynamicDocument.findUnique({
    where: { id: documentId },
    include: { documentType: true },
  });
  if (!doc) throw new NotFoundError('Document not found');

  const approvalConfig = parseApprovalConfig(doc.documentType.approvalConfig);
  if (!approvalConfig) {
    throw new Error(`Document type '${typeCode}' does not have approval configuration`);
  }

  const docTypeKey = `dynamic_${typeCode}`;

  // Find the next pending approval step (lowest level that is still pending)
  const currentStep = await prisma.approvalStep.findFirst({
    where: {
      documentType: docTypeKey,
      documentId,
      status: 'pending',
    },
    orderBy: { level: 'asc' },
  });

  if (!currentStep) {
    throw new Error('No pending approval steps for this document — it may already be fully approved');
  }

  // Verify the user is authorized (direct role match, admin, or delegation)
  const authorized = await isAuthorizedApprover(userId, currentStep.approverRole, docTypeKey);
  if (!authorized) {
    throw new Error(
      `User is not authorized to approve at level ${currentStep.level}. Required role: ${currentStep.approverRole}`,
    );
  }

  // Approve the step
  await prisma.approvalStep.update({
    where: { id: currentStep.id },
    data: {
      status: 'approved',
      approverId: userId,
      notes: comments ?? null,
      decidedAt: new Date(),
    },
  });

  // Check if all steps are now approved
  const remainingPending = await prisma.approvalStep.count({
    where: {
      documentType: docTypeKey,
      documentId,
      status: 'pending',
    },
  });

  const allApproved = remainingPending === 0;

  // Add history entry
  await prisma.dynamicDocumentHistory.create({
    data: {
      documentId,
      fromStatus: doc.status,
      toStatus: allApproved ? doc.status : doc.status, // status unchanged until all approved
      performedById: userId,
      comment: allApproved
        ? `All approval levels completed (level ${currentStep.level} approved)`
        : `Approval level ${currentStep.level} approved by ${currentStep.approverRole}`,
    },
  });

  log(
    'info',
    `[DynDoc] ${typeCode}:${doc.documentNumber} approval level ${currentStep.level} approved by user ${userId}` +
      (allApproved ? ' — all levels complete' : ''),
  );

  // Get all steps for the response
  const steps = await getApprovalSteps(docTypeKey, documentId);

  return {
    documentId,
    approvedLevel: currentStep.level,
    approverRole: currentStep.approverRole,
    allApproved,
    remainingLevels: remainingPending,
    steps,
  };
}

// ── Get History ────────────────────────────────────────────────────────

export async function getDocumentHistory(documentId: string) {
  return prisma.dynamicDocumentHistory.findMany({
    where: { documentId },
    orderBy: { performedAt: 'desc' },
    include: { performedBy: { select: { fullName: true } } },
  });
}

// ── Helpers ────────────────────────────────────────────────────────────

function getEditableStatuses(statusFlow: StatusFlowConfig): string[] {
  // Statuses that have outgoing transitions are considered editable
  const initial = statusFlow.initialStatus || 'draft';
  const editable = [initial];
  for (const [from, targets] of Object.entries(statusFlow.transitions)) {
    // If this status can transition to others, it's still "active"
    if (targets.length > 0 && !editable.includes(from)) {
      editable.push(from);
    }
  }
  return editable;
}

// ── Custom Error ──────────────────────────────────────────────────────

export class DynamicValidationError extends Error {
  public readonly fieldErrors: FieldError[];
  public readonly statusCode = 422;

  constructor(errors: FieldError[]) {
    super(`Validation failed: ${errors.map(e => e.message).join(', ')}`);
    this.name = 'DynamicValidationError';
    this.fieldErrors = errors;
  }
}
