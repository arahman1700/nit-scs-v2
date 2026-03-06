import type { Prisma } from '@prisma/client';
import { prisma } from '../../../utils/prisma.js';
import { generateDocumentNumber } from '../../../services/document-number.service.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import { eventBus } from '../../../events/event-bus.js';
import type { ListParams } from '../../../types/dto.js';

// ── Prisma includes ─────────────────────────────────────────────────────

const CHECKLIST_LIST_INCLUDE = {
  _count: { select: { items: true, audits: true } },
} satisfies Prisma.ComplianceChecklistInclude;

const CHECKLIST_DETAIL_INCLUDE = {
  items: { orderBy: { itemNumber: 'asc' as const } },
  _count: { select: { audits: true } },
} satisfies Prisma.ComplianceChecklistInclude;

const AUDIT_LIST_INCLUDE = {
  checklist: { select: { id: true, checklistCode: true, title: true, standard: true } },
  warehouse: { select: { id: true, warehouseCode: true, warehouseName: true } },
  auditor: { select: { id: true, fullName: true } },
  _count: { select: { responses: true } },
} satisfies Prisma.ComplianceAuditInclude;

const AUDIT_DETAIL_INCLUDE = {
  checklist: {
    include: {
      items: { orderBy: { itemNumber: 'asc' as const } },
    },
  },
  warehouse: { select: { id: true, warehouseCode: true, warehouseName: true } },
  auditor: { select: { id: true, fullName: true, email: true } },
  responses: {
    include: {
      checklistItem: { select: { id: true, itemNumber: true, question: true, weight: true } },
    },
    orderBy: { checklistItem: { itemNumber: 'asc' as const } },
  },
} satisfies Prisma.ComplianceAuditInclude;

// ═══════════════════════════════════════════════════════════════════════
// CHECKLISTS
// ═══════════════════════════════════════════════════════════════════════

// ── List Checklists ──────────────────────────────────────────────────────

export async function listChecklists(params: ListParams) {
  const where: Record<string, unknown> = {};

  if (params.search) {
    where.OR = [
      { checklistCode: { contains: params.search, mode: 'insensitive' } },
      { title: { contains: params.search, mode: 'insensitive' } },
    ];
  }
  if (params.status === 'active') where.isActive = true;
  if (params.status === 'inactive') where.isActive = false;
  if (params.standard) where.standard = params.standard;
  if (params.category) where.category = params.category;

  const [data, total] = await Promise.all([
    prisma.complianceChecklist.findMany({
      where,
      orderBy: { [params.sortBy]: params.sortDir },
      skip: params.skip,
      take: params.pageSize,
      include: CHECKLIST_LIST_INCLUDE,
    }),
    prisma.complianceChecklist.count({ where }),
  ]);

  return { data, total };
}

// ── Get Checklist by ID ──────────────────────────────────────────────────

export async function getChecklistById(id: string) {
  const checklist = await prisma.complianceChecklist.findUnique({
    where: { id },
    include: CHECKLIST_DETAIL_INCLUDE,
  });
  if (!checklist) throw new NotFoundError('Compliance Checklist', id);
  return checklist;
}

// ── Create Checklist ─────────────────────────────────────────────────────

export async function createChecklist(data: {
  checklistCode: string;
  title: string;
  standard: string;
  category: string;
  version?: number;
  isActive?: boolean;
  items?: Array<{
    itemNumber: number;
    question: string;
    category?: string;
    requiredEvidence?: string;
    weight?: number;
  }>;
}) {
  const checklist = await prisma.complianceChecklist.create({
    data: {
      checklistCode: data.checklistCode,
      title: data.title,
      standard: data.standard,
      category: data.category,
      version: data.version ?? 1,
      isActive: data.isActive ?? true,
      items: data.items
        ? {
            create: data.items.map(item => ({
              itemNumber: item.itemNumber,
              question: item.question,
              category: item.category ?? null,
              requiredEvidence: item.requiredEvidence ?? null,
              weight: item.weight ?? 1,
            })),
          }
        : undefined,
    },
    include: CHECKLIST_DETAIL_INCLUDE,
  });

  eventBus.emit('compliance:checklist:created', { checklistId: checklist.id });
  return checklist;
}

// ── Update Checklist ─────────────────────────────────────────────────────

export async function updateChecklist(
  id: string,
  data: {
    title?: string;
    standard?: string;
    category?: string;
    version?: number;
    isActive?: boolean;
    items?: Array<{
      itemNumber: number;
      question: string;
      category?: string;
      requiredEvidence?: string;
      weight?: number;
    }>;
  },
) {
  const existing = await prisma.complianceChecklist.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Compliance Checklist', id);

  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.standard !== undefined) updateData.standard = data.standard;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.version !== undefined) updateData.version = data.version;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  // If items provided, replace them
  if (data.items) {
    await prisma.complianceChecklistItem.deleteMany({ where: { checklistId: id } });
    await prisma.complianceChecklistItem.createMany({
      data: data.items.map(item => ({
        checklistId: id,
        itemNumber: item.itemNumber,
        question: item.question,
        category: item.category ?? null,
        requiredEvidence: item.requiredEvidence ?? null,
        weight: item.weight ?? 1,
      })),
    });
  }

  const updated = await prisma.complianceChecklist.update({
    where: { id },
    data: updateData,
    include: CHECKLIST_DETAIL_INCLUDE,
  });

  eventBus.emit('compliance:checklist:updated', { checklistId: updated.id });
  return updated;
}

// ═══════════════════════════════════════════════════════════════════════
// AUDITS
// ═══════════════════════════════════════════════════════════════════════

// ── List Audits ──────────────────────────────────────────────────────────

export async function listAudits(params: ListParams) {
  const where: Record<string, unknown> = {};

  if (params.search) {
    where.OR = [
      { auditNumber: { contains: params.search, mode: 'insensitive' } },
      { checklist: { title: { contains: params.search, mode: 'insensitive' } } },
      { warehouse: { warehouseName: { contains: params.search, mode: 'insensitive' } } },
    ];
  }
  if (params.status) where.status = params.status;
  if (params.warehouseId) where.warehouseId = params.warehouseId;
  if (params.checklistId) where.checklistId = params.checklistId;
  if (params.auditorId) where.auditorId = params.auditorId;

  const [data, total] = await Promise.all([
    prisma.complianceAudit.findMany({
      where,
      orderBy: { [params.sortBy]: params.sortDir },
      skip: params.skip,
      take: params.pageSize,
      include: AUDIT_LIST_INCLUDE,
    }),
    prisma.complianceAudit.count({ where }),
  ]);

  return { data, total };
}

// ── Get Audit by ID ──────────────────────────────────────────────────────

export async function getAuditById(id: string) {
  const audit = await prisma.complianceAudit.findUnique({
    where: { id },
    include: AUDIT_DETAIL_INCLUDE,
  });
  if (!audit) throw new NotFoundError('Compliance Audit', id);
  return audit;
}

// ── Create Audit ─────────────────────────────────────────────────────────

export async function createAudit(
  data: {
    checklistId: string;
    warehouseId: string;
    auditDate: string;
    dueDate?: string;
    findings?: string;
    correctiveActions?: string;
  },
  userId: string,
) {
  // Validate checklist exists and is active
  const checklist = await prisma.complianceChecklist.findUnique({
    where: { id: data.checklistId },
  });
  if (!checklist) throw new NotFoundError('Compliance Checklist', data.checklistId);
  if (!checklist.isActive) throw new BusinessRuleError('Cannot create audit for inactive checklist');

  const auditNumber = await generateDocumentNumber('compliance_audit');

  const audit = await prisma.complianceAudit.create({
    data: {
      auditNumber,
      checklistId: data.checklistId,
      warehouseId: data.warehouseId,
      auditorId: userId,
      auditDate: new Date(data.auditDate),
      status: 'draft',
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      findings: data.findings ?? null,
      correctiveActions: data.correctiveActions ?? null,
    },
    include: AUDIT_DETAIL_INCLUDE,
  });

  eventBus.emit('compliance:audit:created', { auditId: audit.id, auditNumber });
  return audit;
}

// ── Update Audit ─────────────────────────────────────────────────────────

export async function updateAudit(
  id: string,
  data: {
    auditDate?: string;
    dueDate?: string;
    findings?: string;
    correctiveActions?: string;
    status?: string;
  },
) {
  const existing = await prisma.complianceAudit.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Compliance Audit', id);
  if (existing.status === 'completed') {
    throw new BusinessRuleError('Cannot update a completed audit');
  }

  const updateData: Record<string, unknown> = {};
  if (data.auditDate) updateData.auditDate = new Date(data.auditDate);
  if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
  if (data.findings !== undefined) updateData.findings = data.findings;
  if (data.correctiveActions !== undefined) updateData.correctiveActions = data.correctiveActions;
  if (data.status) updateData.status = data.status;

  const updated = await prisma.complianceAudit.update({
    where: { id },
    data: updateData,
    include: AUDIT_DETAIL_INCLUDE,
  });

  eventBus.emit('compliance:audit:updated', { auditId: updated.id });
  return updated;
}

// ── Submit Responses ─────────────────────────────────────────────────────

export async function submitResponses(
  auditId: string,
  responses: Array<{
    checklistItemId: string;
    response: string;
    evidence?: string;
    notes?: string;
    score?: number;
  }>,
) {
  const audit = await prisma.complianceAudit.findUnique({
    where: { id: auditId },
  });
  if (!audit) throw new NotFoundError('Compliance Audit', auditId);
  if (audit.status === 'completed') {
    throw new BusinessRuleError('Cannot submit responses for a completed audit');
  }

  // Upsert responses — delete existing and recreate
  await prisma.$transaction(async tx => {
    // Remove existing responses for items being updated
    const itemIds = responses.map(r => r.checklistItemId);
    await tx.complianceAuditResponse.deleteMany({
      where: {
        auditId,
        checklistItemId: { in: itemIds },
      },
    });

    // Create new responses
    await tx.complianceAuditResponse.createMany({
      data: responses.map(r => ({
        auditId,
        checklistItemId: r.checklistItemId,
        response: r.response,
        evidence: r.evidence ?? null,
        notes: r.notes ?? null,
        score: r.score ?? null,
      })),
    });

    // Update audit status to in_progress if still draft
    if (audit.status === 'draft') {
      await tx.complianceAudit.update({
        where: { id: auditId },
        data: { status: 'in_progress' },
      });
    }
  });

  // Return full audit with responses
  const updated = await prisma.complianceAudit.findUnique({
    where: { id: auditId },
    include: AUDIT_DETAIL_INCLUDE,
  });

  eventBus.emit('compliance:audit:responses-submitted', { auditId });
  return updated;
}

// ── Complete Audit ───────────────────────────────────────────────────────

export async function completeAudit(id: string, userId: string) {
  const audit = await prisma.complianceAudit.findUnique({
    where: { id },
    include: {
      responses: {
        include: {
          checklistItem: { select: { weight: true } },
        },
      },
      checklist: { include: { items: true } },
    },
  });

  if (!audit) throw new NotFoundError('Compliance Audit', id);
  if (audit.status === 'completed') throw new BusinessRuleError('Audit is already completed');
  if (audit.auditorId !== userId) {
    throw new BusinessRuleError('Only the assigned auditor can complete this audit');
  }

  // Ensure all checklist items have responses
  const checklistItemIds = new Set(audit.checklist.items.map(i => i.id));
  const respondedItemIds = new Set(audit.responses.map(r => r.checklistItemId));
  const missingItems = [...checklistItemIds].filter(id => !respondedItemIds.has(id));
  if (missingItems.length > 0) {
    throw new BusinessRuleError(
      `All checklist items must have responses before completing. Missing ${missingItems.length} response(s).`,
    );
  }

  // Calculate overall score
  // Score per response: compliant=100, partial=50, non_compliant=0, not_applicable=excluded
  let totalWeight = 0;
  let weightedSum = 0;
  for (const response of audit.responses) {
    if (response.response === 'not_applicable') continue;

    const weight = response.checklistItem.weight;
    totalWeight += weight;

    let responseScore = 0;
    if (response.response === 'compliant') responseScore = 100;
    else if (response.response === 'partial') responseScore = 50;
    // non_compliant = 0

    weightedSum += responseScore * weight;
  }

  const overallScore = totalWeight > 0 ? Number((weightedSum / totalWeight).toFixed(2)) : 0;

  // Determine if corrective actions are needed (score < 80)
  const hasNonCompliant = audit.responses.some(r => r.response === 'non_compliant');
  const finalStatus = hasNonCompliant || overallScore < 80 ? 'action_required' : 'completed';

  const updated = await prisma.complianceAudit.update({
    where: { id },
    data: {
      status: finalStatus,
      overallScore,
      completedDate: new Date(),
    },
    include: AUDIT_DETAIL_INCLUDE,
  });

  eventBus.emit('compliance:audit:completed', {
    auditId: updated.id,
    auditNumber: updated.auditNumber,
    overallScore,
    status: finalStatus,
  });

  return updated;
}
