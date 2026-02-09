/**
 * Surplus Item Service — V2
 * Prisma model: SurplusItem (table: surplus_items)
 * State flow: identified → evaluated → approved → actioned → closed
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { generateDocumentNumber } from './document-number.service.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import { assertTransition } from '@nit-scs-v2/shared';
import type { SurplusCreateDto, SurplusUpdateDto, ListParams } from '../types/dto.js';

const DOC_TYPE = 'surplus';

const LIST_INCLUDE = {
  item: { select: { id: true, itemCode: true, itemDescription: true } },
  warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
  project: { select: { id: true, projectName: true, projectCode: true } },
  createdBy: { select: { id: true, fullName: true } },
} satisfies Prisma.SurplusItemInclude;

const DETAIL_INCLUDE = {
  item: true,
  warehouse: true,
  project: true,
  createdBy: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.SurplusItemInclude;

export async function list(params: ListParams) {
  const where: Record<string, unknown> = {};
  if (params.search) {
    where.OR = [{ surplusNumber: { contains: params.search, mode: 'insensitive' } }];
  }
  if (params.status) where.status = params.status;
  if (params.warehouseId) where.warehouseId = params.warehouseId;
  if (params.projectId) where.projectId = params.projectId;

  const [data, total] = await Promise.all([
    prisma.surplusItem.findMany({
      where,
      orderBy: { [params.sortBy]: params.sortDir },
      skip: params.skip,
      take: params.pageSize,
      include: LIST_INCLUDE,
    }),
    prisma.surplusItem.count({ where }),
  ]);
  return { data, total };
}

export async function getById(id: string) {
  const surplus = await prisma.surplusItem.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!surplus) throw new NotFoundError('Surplus', id);
  return surplus;
}

export async function create(data: SurplusCreateDto, userId: string) {
  const surplusNumber = await generateDocumentNumber('surplus');
  return prisma.surplusItem.create({
    data: {
      surplusNumber,
      itemId: data.itemId,
      warehouseId: data.warehouseId,
      projectId: data.projectId ?? null,
      qty: data.qty,
      condition: data.condition,
      estimatedValue: data.estimatedValue ?? null,
      disposition: data.disposition ?? null,
      status: 'identified',
      createdById: userId,
    },
    include: {
      item: { select: { id: true, itemCode: true, itemDescription: true } },
      warehouse: { select: { id: true, warehouseName: true } },
    },
  });
}

export async function update(id: string, data: SurplusUpdateDto) {
  const existing = await prisma.surplusItem.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Surplus', id);
  if (existing.status !== 'identified') {
    throw new BusinessRuleError('Only surplus items in "identified" status can be updated');
  }

  const updated = await prisma.surplusItem.update({ where: { id }, data });
  return { existing, updated };
}

export async function evaluate(id: string) {
  const surplus = await prisma.surplusItem.findUnique({ where: { id } });
  if (!surplus) throw new NotFoundError('Surplus', id);
  assertTransition(DOC_TYPE, surplus.status, 'evaluated');

  return prisma.surplusItem.update({ where: { id: surplus.id }, data: { status: 'evaluated' } });
}

export async function approve(id: string) {
  const surplus = await prisma.surplusItem.findUnique({ where: { id } });
  if (!surplus) throw new NotFoundError('Surplus', id);
  assertTransition(DOC_TYPE, surplus.status, 'approved');

  return prisma.surplusItem.update({
    where: { id: surplus.id },
    data: { status: 'approved', ouHeadApprovalDate: new Date() },
  });
}

export async function action(id: string) {
  const surplus = await prisma.surplusItem.findUnique({ where: { id } });
  if (!surplus) throw new NotFoundError('Surplus', id);
  assertTransition(DOC_TYPE, surplus.status, 'actioned');

  if (!surplus.disposition) {
    throw new BusinessRuleError('Disposition must be set before actioning surplus item');
  }

  return prisma.surplusItem.update({ where: { id: surplus.id }, data: { status: 'actioned' } });
}

export async function close(id: string) {
  const surplus = await prisma.surplusItem.findUnique({ where: { id } });
  if (!surplus) throw new NotFoundError('Surplus', id);
  assertTransition(DOC_TYPE, surplus.status, 'closed');

  return prisma.surplusItem.update({ where: { id: surplus.id }, data: { status: 'closed' } });
}
