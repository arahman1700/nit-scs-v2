/**
 * Inspection Checklist Service — CRUD for reusable QCI checklists.
 * Prisma models: InspectionChecklist, InspectionChecklistItem
 */
import { prisma } from '../utils/prisma.js';
import { NotFoundError } from '@nit-scs-v2/shared';

// ── Checklist CRUD ─────────────────────────────────────────────────────────

export interface ChecklistCreateDto {
  name: string;
  description?: string;
  category?: string;
  isActive?: boolean;
  items?: ChecklistItemDto[];
}

export interface ChecklistUpdateDto {
  name?: string;
  description?: string;
  category?: string;
  isActive?: boolean;
}

export interface ChecklistItemDto {
  description: string;
  itemOrder: number;
  isMandatory?: boolean;
  inspectionType?: string;
}

const LIST_INCLUDE = {
  _count: { select: { items: true } },
} as const;

const DETAIL_INCLUDE = {
  items: { orderBy: { itemOrder: 'asc' as const } },
} as const;

export async function list(params?: { category?: string; isActive?: boolean; search?: string }) {
  const where: Record<string, unknown> = {};
  if (params?.category) where.category = params.category;
  if (params?.isActive !== undefined) where.isActive = params.isActive;
  if (params?.search) {
    where.OR = [
      { name: { contains: params.search, mode: 'insensitive' } },
      { description: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const data = await prisma.inspectionChecklist.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: LIST_INCLUDE,
  });
  return data;
}

export async function getById(id: string) {
  const checklist = await prisma.inspectionChecklist.findUnique({
    where: { id },
    include: DETAIL_INCLUDE,
  });
  if (!checklist) throw new NotFoundError('InspectionChecklist', id);
  return checklist;
}

export async function create(data: ChecklistCreateDto) {
  const { items, ...checklistData } = data;
  return prisma.inspectionChecklist.create({
    data: {
      ...checklistData,
      ...(items && items.length > 0
        ? {
            items: {
              create: items.map((item, idx) => ({
                description: item.description,
                itemOrder: item.itemOrder ?? idx + 1,
                isMandatory: item.isMandatory ?? true,
                inspectionType: item.inspectionType ?? 'visual',
              })),
            },
          }
        : {}),
    },
    include: DETAIL_INCLUDE,
  });
}

export async function update(id: string, data: ChecklistUpdateDto) {
  const existing = await prisma.inspectionChecklist.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('InspectionChecklist', id);

  return prisma.inspectionChecklist.update({
    where: { id },
    data,
    include: DETAIL_INCLUDE,
  });
}

export async function remove(id: string) {
  const existing = await prisma.inspectionChecklist.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('InspectionChecklist', id);

  await prisma.inspectionChecklist.delete({ where: { id } });
  return { deleted: true };
}

export async function getChecklistsByCategory(category: string) {
  return prisma.inspectionChecklist.findMany({
    where: { category, isActive: true },
    orderBy: { name: 'asc' },
    include: LIST_INCLUDE,
  });
}

// ── Checklist Items CRUD ───────────────────────────────────────────────────

export async function listItems(checklistId: string) {
  const checklist = await prisma.inspectionChecklist.findUnique({ where: { id: checklistId } });
  if (!checklist) throw new NotFoundError('InspectionChecklist', checklistId);

  return prisma.inspectionChecklistItem.findMany({
    where: { checklistId },
    orderBy: { itemOrder: 'asc' },
  });
}

export async function addItem(checklistId: string, data: ChecklistItemDto) {
  const checklist = await prisma.inspectionChecklist.findUnique({ where: { id: checklistId } });
  if (!checklist) throw new NotFoundError('InspectionChecklist', checklistId);

  return prisma.inspectionChecklistItem.create({
    data: {
      checklistId,
      description: data.description,
      itemOrder: data.itemOrder,
      isMandatory: data.isMandatory ?? true,
      inspectionType: data.inspectionType ?? 'visual',
    },
  });
}

export async function updateItem(itemId: string, data: Partial<ChecklistItemDto>) {
  const existing = await prisma.inspectionChecklistItem.findUnique({ where: { id: itemId } });
  if (!existing) throw new NotFoundError('InspectionChecklistItem', itemId);

  return prisma.inspectionChecklistItem.update({
    where: { id: itemId },
    data: {
      ...(data.description !== undefined && { description: data.description }),
      ...(data.itemOrder !== undefined && { itemOrder: data.itemOrder }),
      ...(data.isMandatory !== undefined && { isMandatory: data.isMandatory }),
      ...(data.inspectionType !== undefined && { inspectionType: data.inspectionType }),
    },
  });
}

export async function removeItem(itemId: string) {
  const existing = await prisma.inspectionChecklistItem.findUnique({ where: { id: itemId } });
  if (!existing) throw new NotFoundError('InspectionChecklistItem', itemId);

  await prisma.inspectionChecklistItem.delete({ where: { id: itemId } });
  return { deleted: true };
}

export async function reorderItems(checklistId: string, itemIds: string[]) {
  const checklist = await prisma.inspectionChecklist.findUnique({ where: { id: checklistId } });
  if (!checklist) throw new NotFoundError('InspectionChecklist', checklistId);

  // Update each item's order based on position in the array
  const updates = itemIds.map((id, index) =>
    prisma.inspectionChecklistItem.update({
      where: { id },
      data: { itemOrder: index + 1 },
    }),
  );

  await prisma.$transaction(updates);
  return prisma.inspectionChecklistItem.findMany({
    where: { checklistId },
    orderBy: { itemOrder: 'asc' },
  });
}
