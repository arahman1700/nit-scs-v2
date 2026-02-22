/**
 * Tool Issue Service — V2
 * Prisma model: ToolIssue (table: tool_issues)
 * State flow: issued → returned (or overdue)
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import { assertTransition } from '@nit-scs-v2/shared';
import { eventBus } from '../events/event-bus.js';
import type { ToolIssueCreateDto, ToolIssueReturnDto, ListParams } from '../types/dto.js';

const DOC_TYPE = 'tool_issue';

const LIST_INCLUDE = {
  tool: { select: { id: true, toolCode: true, toolName: true } },
  issuedTo: { select: { id: true, fullName: true } },
  issuedBy: { select: { id: true, fullName: true } },
} satisfies Prisma.ToolIssueInclude;

const DETAIL_INCLUDE = {
  tool: true,
  issuedTo: { select: { id: true, fullName: true, email: true } },
  issuedBy: { select: { id: true, fullName: true, email: true } },
  returnVerifiedBy: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.ToolIssueInclude;

export async function list(params: ListParams) {
  const where: Record<string, unknown> = {};
  if (params.search) {
    where.OR = [
      { tool: { toolCode: { contains: params.search, mode: 'insensitive' } } },
      { tool: { toolName: { contains: params.search, mode: 'insensitive' } } },
      { issuedTo: { fullName: { contains: params.search, mode: 'insensitive' } } },
    ];
  }
  if (params.status) where.status = params.status;
  if (params.toolId) where.toolId = params.toolId;
  if (params.issuedToId) where.issuedToId = params.issuedToId;

  const [data, total] = await Promise.all([
    prisma.toolIssue.findMany({
      where,
      orderBy: { [params.sortBy]: params.sortDir },
      skip: params.skip,
      take: params.pageSize,
      include: LIST_INCLUDE,
    }),
    prisma.toolIssue.count({ where }),
  ]);
  return { data, total };
}

export async function getById(id: string) {
  const issue = await prisma.toolIssue.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!issue) throw new NotFoundError('ToolIssue', id);
  return issue;
}

export async function create(data: ToolIssueCreateDto, userId: string) {
  // Verify tool exists and is available
  const tool = await prisma.tool.findUnique({ where: { id: data.toolId } });
  if (!tool) throw new NotFoundError('Tool', data.toolId);

  // Check if tool is already issued
  const activeIssue = await prisma.toolIssue.findFirst({
    where: { toolId: data.toolId, status: 'issued' },
  });
  if (activeIssue) {
    throw new BusinessRuleError('Tool is already issued and has not been returned');
  }

  const created = await prisma.toolIssue.create({
    data: {
      toolId: data.toolId,
      issuedToId: data.issuedToId,
      issuedById: userId,
      issuedDate: new Date(),
      expectedReturnDate: data.expectedReturnDate ? new Date(data.expectedReturnDate) : null,
      status: 'issued',
    },
    include: {
      tool: { select: { id: true, toolCode: true, toolName: true } },
      issuedTo: { select: { id: true, fullName: true } },
    },
  });

  eventBus.publish({
    type: 'document:created',
    entityType: 'tool_issue',
    entityId: created.id,
    action: 'create',
    payload: { toolId: data.toolId, issuedToId: data.issuedToId },
    performedById: userId,
    timestamp: new Date().toISOString(),
  });

  return created;
}

export async function update(id: string, data: Record<string, unknown>) {
  const existing = await prisma.toolIssue.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('ToolIssue', id);
  if (existing.status !== 'issued') {
    throw new BusinessRuleError('Only tool issues in "issued" status can be updated');
  }

  const updated = await prisma.toolIssue.update({
    where: { id },
    data: {
      ...(data.expectedReturnDate ? { expectedReturnDate: new Date(data.expectedReturnDate as string) } : {}),
    },
  });
  return { existing, updated };
}

export async function returnTool(id: string, returnData: ToolIssueReturnDto, userId: string) {
  const issue = await prisma.toolIssue.findUnique({ where: { id } });
  if (!issue) throw new NotFoundError('ToolIssue', id);
  assertTransition(DOC_TYPE, issue.status, 'returned');

  const result = await prisma.$transaction(async tx => {
    const updated = await tx.toolIssue.update({
      where: { id: issue.id },
      data: {
        status: 'returned',
        actualReturnDate: new Date(),
        returnCondition: returnData.returnCondition,
        returnVerifiedById: userId,
      },
    });

    // Update tool condition based on return condition
    if (returnData.returnCondition === 'damaged') {
      await tx.tool.update({
        where: { id: issue.toolId },
        data: { condition: 'damaged' },
      });
    }

    return updated;
  });

  eventBus.publish({
    type: 'document:status_changed',
    entityType: 'tool_issue',
    entityId: issue.id,
    action: 'status_change',
    payload: { from: issue.status, to: 'returned', returnCondition: returnData.returnCondition },
    performedById: userId,
    timestamp: new Date().toISOString(),
  });

  return result;
}
