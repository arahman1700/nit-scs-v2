/**
 * Tool Service — V2
 * Prisma model: Tool (table: tools)
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { NotFoundError, BusinessRuleError } from '@nit-scs-v2/shared';
import { generateDocumentNumber } from './document-number.service.js';
import type { ToolCreateDto, ToolUpdateDto, ListParams } from '../types/dto.js';

const LIST_INCLUDE = {
  owner: { select: { id: true, fullName: true } },
  warehouse: { select: { id: true, warehouseName: true, warehouseCode: true } },
} satisfies Prisma.ToolInclude;

const DETAIL_INCLUDE = {
  owner: { select: { id: true, fullName: true, email: true } },
  warehouse: true,
  toolIssues: {
    orderBy: { createdAt: 'desc' as const },
    take: 10,
    include: {
      issuedTo: { select: { id: true, fullName: true } },
    },
  },
} satisfies Prisma.ToolInclude;

export async function list(params: ListParams) {
  const where: Record<string, unknown> = {};
  if (params.search) {
    where.OR = [
      { toolCode: { contains: params.search, mode: 'insensitive' } },
      { toolName: { contains: params.search, mode: 'insensitive' } },
    ];
  }
  if (params.condition) where.condition = params.condition;
  if (params.warehouseId) where.warehouseId = params.warehouseId;
  if (params.category) where.category = params.category;

  const [data, total] = await Promise.all([
    prisma.tool.findMany({
      where,
      orderBy: { [params.sortBy]: params.sortDir },
      skip: params.skip,
      take: params.pageSize,
      include: LIST_INCLUDE,
    }),
    prisma.tool.count({ where }),
  ]);
  return { data, total };
}

export async function getById(id: string) {
  const record = await prisma.tool.findUnique({ where: { id }, include: DETAIL_INCLUDE });
  if (!record) throw new NotFoundError('Tool', id);
  return record;
}

export async function create(data: ToolCreateDto, _userId: string) {
  const toolCode = await generateDocumentNumber('tool');

  return prisma.tool.create({
    data: {
      toolCode,
      toolName: data.toolName,
      category: data.category ?? null,
      serialNumber: data.serialNumber ?? null,
      condition: 'good',
      warehouseId: data.warehouseId ?? null,
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
      warrantyExpiry: data.warrantyExpiry ? new Date(data.warrantyExpiry) : null,
    },
    include: LIST_INCLUDE,
  });
}

export async function update(id: string, data: ToolUpdateDto) {
  const existing = await prisma.tool.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Tool', id);

  const updated = await prisma.tool.update({
    where: { id },
    data: {
      ...data,
    },
  });
  return { existing, updated };
}

export async function decommission(id: string) {
  const existing = await prisma.tool.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Tool', id);

  if (existing.condition === 'decommissioned') {
    throw new BusinessRuleError('Tool is already decommissioned');
  }

  return prisma.tool.update({
    where: { id },
    data: { condition: 'decommissioned' },
  });
}
