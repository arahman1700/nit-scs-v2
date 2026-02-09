/**
 * Scrap Item Service — V2
 * Prisma model: ScrapItem (table: scrap_items)
 * State flow: identified → reported → approved → in_ssc → sold/disposed → closed
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { generateDocumentNumber } from './document-number.service.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import { assertTransition } from '@nit-scs-v2/shared';
import type { ScrapCreateDto, ScrapUpdateDto, ListParams } from '../types/dto.js';

const DOC_TYPE = 'scrap';

const LIST_INCLUDE = {
  project: { select: { id: true, projectName: true, projectCode: true } },
  warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
  createdBy: { select: { id: true, fullName: true } },
  _count: { select: { sscBids: true } },
} satisfies Prisma.ScrapItemInclude;

const DETAIL_INCLUDE = {
  project: true,
  warehouse: true,
  createdBy: { select: { id: true, fullName: true, email: true } },
  sscBids: {
    orderBy: { bidDate: 'desc' as const },
  },
} satisfies Prisma.ScrapItemInclude;

export async function list(params: ListParams) {
  const where: Record<string, unknown> = {};
  if (params.search) {
    where.OR = [
      { scrapNumber: { contains: params.search, mode: 'insensitive' } },
      { description: { contains: params.search, mode: 'insensitive' } },
    ];
  }
  if (params.status) where.status = params.status;
  if (params.projectId) where.projectId = params.projectId;
  if (params.warehouseId) where.warehouseId = params.warehouseId;
  if (params.materialType) where.materialType = params.materialType;

  const [data, total] = await Promise.all([
    prisma.scrapItem.findMany({
      where,
      orderBy: { [params.sortBy]: params.sortDir },
      skip: params.skip,
      take: params.pageSize,
      include: LIST_INCLUDE,
    }),
    prisma.scrapItem.count({ where }),
  ]);
  return { data, total };
}

export async function getById(id: string) {
  const scrap = await prisma.scrapItem.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!scrap) throw new NotFoundError('Scrap', id);
  return scrap;
}

export async function create(data: ScrapCreateDto, userId: string) {
  const scrapNumber = await generateDocumentNumber('scrap');
  return prisma.scrapItem.create({
    data: {
      scrapNumber,
      projectId: data.projectId,
      warehouseId: data.warehouseId ?? null,
      materialType: data.materialType,
      description: data.description,
      qty: data.qty,
      packaging: data.packaging ?? null,
      condition: data.condition ?? null,
      estimatedValue: data.estimatedValue ?? null,
      photos: data.photos ?? [],
      status: 'identified',
      createdById: userId,
    },
    include: {
      project: { select: { id: true, projectName: true } },
      warehouse: { select: { id: true, warehouseName: true } },
    },
  });
}

export async function update(id: string, data: ScrapUpdateDto) {
  const existing = await prisma.scrapItem.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Scrap', id);
  if (existing.status !== 'identified') {
    throw new BusinessRuleError('Only scrap items in "identified" status can be updated');
  }

  const updated = await prisma.scrapItem.update({ where: { id }, data });
  return { existing, updated };
}

export async function report(id: string) {
  const scrap = await prisma.scrapItem.findUnique({ where: { id } });
  if (!scrap) throw new NotFoundError('Scrap', id);
  assertTransition(DOC_TYPE, scrap.status, 'reported');

  return prisma.scrapItem.update({ where: { id: scrap.id }, data: { status: 'reported' } });
}

export async function approve(id: string) {
  const scrap = await prisma.scrapItem.findUnique({ where: { id } });
  if (!scrap) throw new NotFoundError('Scrap', id);
  assertTransition(DOC_TYPE, scrap.status, 'approved');

  return prisma.scrapItem.update({
    where: { id: scrap.id },
    data: {
      status: 'approved',
      siteManagerApproval: true,
    },
  });
}

export async function sendToSsc(id: string) {
  const scrap = await prisma.scrapItem.findUnique({ where: { id } });
  if (!scrap) throw new NotFoundError('Scrap', id);
  assertTransition(DOC_TYPE, scrap.status, 'in_ssc');

  return prisma.scrapItem.update({ where: { id: scrap.id }, data: { status: 'in_ssc' } });
}

export async function markSold(id: string, buyerName: string) {
  const scrap = await prisma.scrapItem.findUnique({ where: { id } });
  if (!scrap) throw new NotFoundError('Scrap', id);
  assertTransition(DOC_TYPE, scrap.status, 'sold');

  return prisma.scrapItem.update({
    where: { id: scrap.id },
    data: { status: 'sold', buyerName },
  });
}

export async function dispose(id: string) {
  const scrap = await prisma.scrapItem.findUnique({ where: { id } });
  if (!scrap) throw new NotFoundError('Scrap', id);
  assertTransition(DOC_TYPE, scrap.status, 'disposed');

  return prisma.scrapItem.update({ where: { id: scrap.id }, data: { status: 'disposed' } });
}

export async function close(id: string) {
  const scrap = await prisma.scrapItem.findUnique({ where: { id } });
  if (!scrap) throw new NotFoundError('Scrap', id);
  assertTransition(DOC_TYPE, scrap.status, 'closed');

  return prisma.scrapItem.update({ where: { id: scrap.id }, data: { status: 'closed' } });
}
