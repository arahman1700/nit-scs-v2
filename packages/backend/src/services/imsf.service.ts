/**
 * IMSF (Internal Material Shifting Form) Service — V2
 * Prisma model: Imsf (table: imsf)
 * State flow: created → sent → confirmed → in_transit → delivered → completed
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { generateDocumentNumber } from './document-number.service.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import { assertTransition } from '@nit-scs-v2/shared';
import type { ImsfCreateDto, ImsfUpdateDto, ImsfLineDto, ListParams } from '../types/dto.js';

const DOC_TYPE = 'imsf';

const LIST_INCLUDE = {
  senderProject: { select: { id: true, projectName: true, projectCode: true } },
  receiverProject: { select: { id: true, projectName: true, projectCode: true } },
  createdBy: { select: { id: true, fullName: true } },
  _count: { select: { imsfLines: true } },
} satisfies Prisma.ImsfInclude;

const DETAIL_INCLUDE = {
  imsfLines: {
    include: {
      item: { select: { id: true, itemCode: true, itemDescription: true } },
      uom: { select: { id: true, uomCode: true, uomName: true } },
    },
  },
  senderProject: true,
  receiverProject: true,
  createdBy: { select: { id: true, fullName: true, email: true } },
} satisfies Prisma.ImsfInclude;

export async function list(params: ListParams) {
  const where: Record<string, unknown> = {};
  if (params.search) {
    where.OR = [{ imsfNumber: { contains: params.search, mode: 'insensitive' } }];
  }
  if (params.status) where.status = params.status;
  if (params.senderProjectId) where.senderProjectId = params.senderProjectId;
  if (params.receiverProjectId) where.receiverProjectId = params.receiverProjectId;
  if (params.createdById) where.createdById = params.createdById;

  const [data, total] = await Promise.all([
    prisma.imsf.findMany({
      where,
      orderBy: { [params.sortBy]: params.sortDir },
      skip: params.skip,
      take: params.pageSize,
      include: LIST_INCLUDE,
    }),
    prisma.imsf.count({ where }),
  ]);
  return { data, total };
}

export async function getById(id: string) {
  const imsf = await prisma.imsf.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!imsf) throw new NotFoundError('IMSF', id);
  return imsf;
}

export async function create(headerData: Omit<ImsfCreateDto, 'lines'>, lines: ImsfLineDto[], userId: string) {
  return prisma.$transaction(async tx => {
    const imsfNumber = await generateDocumentNumber('imsf');
    return tx.imsf.create({
      data: {
        imsfNumber,
        senderProjectId: headerData.senderProjectId,
        receiverProjectId: headerData.receiverProjectId,
        materialType: headerData.materialType ?? 'normal',
        requiredDate: headerData.requiredDate ? new Date(headerData.requiredDate) : null,
        status: 'created',
        notes: headerData.notes ?? null,
        createdById: userId,
        imsfLines: {
          create: lines.map(line => ({
            itemId: line.itemId,
            description: line.description ?? null,
            qty: line.qty,
            uomId: line.uomId,
            poNumber: line.poNumber ?? null,
            mrfNumber: line.mrfNumber ?? null,
          })),
        },
      },
      include: {
        imsfLines: true,
        senderProject: { select: { id: true, projectName: true } },
        receiverProject: { select: { id: true, projectName: true } },
      },
    });
  });
}

export async function update(id: string, data: ImsfUpdateDto) {
  const existing = await prisma.imsf.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('IMSF', id);
  if (existing.status !== 'created') {
    throw new BusinessRuleError('Only IMSF documents in "created" status can be updated');
  }

  const updated = await prisma.imsf.update({
    where: { id },
    data: {
      ...data,
      ...(data.requiredDate ? { requiredDate: new Date(data.requiredDate) } : {}),
    },
  });
  return { existing, updated };
}

export async function send(id: string) {
  const imsf = await prisma.imsf.findUnique({ where: { id }, include: { imsfLines: true } });
  if (!imsf) throw new NotFoundError('IMSF', id);
  assertTransition(DOC_TYPE, imsf.status, 'sent');

  if (imsf.imsfLines.length === 0) {
    throw new BusinessRuleError('Cannot send IMSF with no line items');
  }

  return prisma.imsf.update({ where: { id: imsf.id }, data: { status: 'sent' } });
}

export async function confirm(id: string) {
  const imsf = await prisma.imsf.findUnique({ where: { id } });
  if (!imsf) throw new NotFoundError('IMSF', id);
  assertTransition(DOC_TYPE, imsf.status, 'confirmed');

  return prisma.imsf.update({ where: { id: imsf.id }, data: { status: 'confirmed' } });
}

export async function ship(id: string) {
  const imsf = await prisma.imsf.findUnique({ where: { id } });
  if (!imsf) throw new NotFoundError('IMSF', id);
  assertTransition(DOC_TYPE, imsf.status, 'in_transit');

  return prisma.imsf.update({ where: { id: imsf.id }, data: { status: 'in_transit' } });
}

export async function deliver(id: string) {
  const imsf = await prisma.imsf.findUnique({ where: { id } });
  if (!imsf) throw new NotFoundError('IMSF', id);
  assertTransition(DOC_TYPE, imsf.status, 'delivered');

  return prisma.imsf.update({ where: { id: imsf.id }, data: { status: 'delivered' } });
}

export async function complete(id: string) {
  const imsf = await prisma.imsf.findUnique({ where: { id } });
  if (!imsf) throw new NotFoundError('IMSF', id);
  assertTransition(DOC_TYPE, imsf.status, 'completed');

  return prisma.imsf.update({ where: { id: imsf.id }, data: { status: 'completed' } });
}
