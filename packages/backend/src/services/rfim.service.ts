import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import { assertTransition } from '@nit-scs-v2/shared';
import type { RfimUpdateDto, ListParams } from '../types/dto.js';

const DOC_TYPE = 'rfim';

const LIST_INCLUDE = {
  mrrv: { select: { id: true, mrrvNumber: true, status: true } },
  inspector: { select: { id: true, fullName: true } },
} satisfies Prisma.RfimInclude;

const DETAIL_INCLUDE = {
  mrrv: {
    include: {
      mrrvLines: {
        include: {
          item: { select: { id: true, itemCode: true, itemDescription: true } },
          uom: { select: { id: true, uomCode: true, uomName: true } },
        },
      },
      supplier: { select: { id: true, supplierName: true } },
      warehouse: { select: { id: true, warehouseName: true } },
    },
  },
  inspector: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.RfimInclude;

export async function list(params: ListParams) {
  const where: Record<string, unknown> = {};
  if (params.search) {
    where.OR = [{ rfimNumber: { contains: params.search, mode: 'insensitive' } }];
  }
  if (params.status) where.status = params.status;
  // Row-level security: RFIM scoping is via parent MRRV's warehouse/project
  if (params.warehouseId)
    where.mrrv = { ...((where.mrrv as Record<string, unknown>) ?? {}), warehouseId: params.warehouseId };
  if (params.projectId)
    where.mrrv = { ...((where.mrrv as Record<string, unknown>) ?? {}), projectId: params.projectId };
  if (params.inspectorId) where.inspectorId = params.inspectorId;

  const [data, total] = await Promise.all([
    prisma.rfim.findMany({
      where,
      orderBy: { [params.sortBy]: params.sortDir },
      skip: params.skip,
      take: params.pageSize,
      include: LIST_INCLUDE,
    }),
    prisma.rfim.count({ where }),
  ]);
  return { data, total };
}

export async function getById(id: string) {
  const rfim = await prisma.rfim.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!rfim) throw new NotFoundError('RFIM', id);
  return rfim;
}

export async function update(id: string, data: RfimUpdateDto) {
  const existing = await prisma.rfim.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('RFIM', id);

  const updated = await prisma.rfim.update({ where: { id }, data });
  return { existing, updated };
}

export async function start(id: string, userId: string) {
  const rfim = await prisma.rfim.findUnique({ where: { id } });
  if (!rfim) throw new NotFoundError('RFIM', id);
  assertTransition(DOC_TYPE, rfim.status, 'in_progress');

  return prisma.rfim.update({
    where: { id: rfim.id },
    data: { status: 'in_progress', inspectionDate: new Date(), inspectorId: userId },
  });
}

export async function complete(id: string, result: string, comments?: string) {
  const rfim = await prisma.rfim.findUnique({ where: { id } });
  if (!rfim) throw new NotFoundError('RFIM', id);

  if (!result || !['pass', 'fail', 'conditional'].includes(result)) {
    throw new BusinessRuleError('Inspection result is required (pass, fail, or conditional)');
  }

  // If result is 'conditional', route through completeConditional instead
  if (result === 'conditional') {
    return completeConditional(id, comments);
  }

  assertTransition(DOC_TYPE, rfim.status, 'completed');

  const updated = await prisma.rfim.update({
    where: { id: rfim.id },
    data: { status: 'completed', result, comments: comments ?? rfim.comments },
  });
  return { updated, mrrvId: rfim.mrrvId };
}

/**
 * Complete a QCI/RFIM with a conditional acceptance result.
 * Sets status to 'completed_conditional' which requires PM approval to become fully completed.
 * The pmApprovalRequired flag is implicitly true for conditional completions.
 */
export async function completeConditional(id: string, comments?: string) {
  const rfim = await prisma.rfim.findUnique({ where: { id } });
  if (!rfim) throw new NotFoundError('RFIM', id);
  assertTransition(DOC_TYPE, rfim.status, 'completed_conditional');

  const updated = await prisma.rfim.update({
    where: { id: rfim.id },
    data: {
      status: 'completed_conditional',
      result: 'conditional',
      comments: comments ?? rfim.comments,
      // NOTE: pmApprovalRequired field pending schema migration — will be set to true
      // pmApprovalRequired: true,
    },
  });
  return { updated, mrrvId: rfim.mrrvId, pmApprovalRequired: true };
}

/**
 * PM approves a conditional QCI/RFIM, upgrading it to fully completed.
 * Only records in 'completed_conditional' status can be PM-approved.
 */
export async function pmApprove(id: string, pmUserId: string, comments?: string) {
  const rfim = await prisma.rfim.findUnique({ where: { id } });
  if (!rfim) throw new NotFoundError('RFIM', id);

  if (rfim.status !== 'completed_conditional') {
    throw new BusinessRuleError('Only conditionally completed QCIs can receive PM approval');
  }
  assertTransition(DOC_TYPE, rfim.status, 'completed');

  const updated = await prisma.rfim.update({
    where: { id: rfim.id },
    data: {
      status: 'completed',
      comments: comments ? `${rfim.comments ?? ''}\n[PM Approval] ${comments}`.trim() : rfim.comments,
      // NOTE: pmApprovedById and pmApprovalDate fields pending schema migration
      // pmApprovedById: pmUserId,
      // pmApprovalDate: new Date(),
    },
  });
  return { updated, mrrvId: rfim.mrrvId, pmApprovedBy: pmUserId };
}
