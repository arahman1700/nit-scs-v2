import { prisma } from '../utils/prisma.js';
import { Prisma } from '@prisma/client';
import { NotFoundError } from '@nit-scs-v2/shared';
import { log } from '../config/logger.js';

// ── Types ──────────────────────────────────────────────────────────────

export interface CreateDocumentTypeInput {
  code: string;
  name: string;
  description?: string;
  icon?: string;
  category?: string;
  statusFlow?: Record<string, unknown>;
  approvalConfig?: Record<string, unknown>;
  permissionConfig?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  visibleToRoles?: string[];
}

export interface UpdateDocumentTypeInput {
  name?: string;
  description?: string;
  icon?: string;
  category?: string;
  statusFlow?: Record<string, unknown>;
  approvalConfig?: Record<string, unknown>;
  permissionConfig?: Record<string, unknown>;
  settings?: Record<string, unknown>;
  isActive?: boolean;
  visibleToRoles?: string[];
}

export interface FieldDefinitionInput {
  fieldKey: string;
  label: string;
  fieldType: string;
  options?: unknown[];
  isRequired?: boolean;
  showInGrid?: boolean;
  showInForm?: boolean;
  sectionName?: string;
  sortOrder?: number;
  validationRules?: Record<string, unknown>;
  defaultValue?: string;
  colSpan?: number;
  isLineItem?: boolean;
  isReadOnly?: boolean;
  conditionalDisplay?: Record<string, unknown>;
}

// ── CRUD for Document Types ────────────────────────────────────────────

export async function listDocumentTypes(params: {
  skip: number;
  pageSize: number;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  search?: string;
  category?: string;
  isActive?: string;
}) {
  const where: Record<string, unknown> = {};

  if (params.search) {
    where.OR = [
      { name: { contains: params.search, mode: 'insensitive' } },
      { code: { contains: params.search, mode: 'insensitive' } },
    ];
  }
  if (params.category) where.category = params.category;
  if (params.isActive !== undefined) where.isActive = params.isActive === 'true';

  const [data, total] = await Promise.all([
    prisma.dynamicDocumentType.findMany({
      where,
      orderBy: { [params.sortBy]: params.sortDir },
      skip: params.skip,
      take: params.pageSize,
      include: { _count: { select: { fields: true, documents: true } } },
    }),
    prisma.dynamicDocumentType.count({ where }),
  ]);

  return { data, total };
}

export async function getDocumentTypeById(id: string) {
  const docType = await prisma.dynamicDocumentType.findUnique({
    where: { id },
    include: {
      fields: { orderBy: { sortOrder: 'asc' } },
      createdBy: { select: { fullName: true, email: true } },
    },
  });
  if (!docType) throw new NotFoundError('Document type not found');
  return docType;
}

export async function getDocumentTypeByCode(code: string) {
  const docType = await prisma.dynamicDocumentType.findUnique({
    where: { code },
    include: {
      fields: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!docType) throw new NotFoundError(`Document type '${code}' not found`);
  return docType;
}

export async function createDocumentType(input: CreateDocumentTypeInput, userId: string) {
  const docType = await prisma.dynamicDocumentType.create({
    data: {
      code: input.code,
      name: input.name,
      description: input.description,
      icon: input.icon,
      category: input.category ?? 'custom',
      statusFlow: (input.statusFlow ?? {
        initialStatus: 'draft',
        statuses: [{ key: 'draft', label: 'Draft', color: 'gray' }],
        transitions: {},
      }) as Prisma.InputJsonValue,
      approvalConfig: (input.approvalConfig as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      permissionConfig: (input.permissionConfig as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      settings: (input.settings ?? {}) as Prisma.InputJsonValue,
      visibleToRoles: (input.visibleToRoles ?? ['admin']) as Prisma.InputJsonValue,
      createdById: userId,
    },
  });

  log('info', `[DynDocType] Created document type: ${docType.code} (${docType.id})`);
  return docType;
}

export async function updateDocumentType(id: string, input: UpdateDocumentTypeInput) {
  const existing = await prisma.dynamicDocumentType.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Document type not found');

  const data: Prisma.DynamicDocumentTypeUpdateInput = {
    version: { increment: 1 },
  };
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.icon !== undefined) data.icon = input.icon;
  if (input.category !== undefined) data.category = input.category;
  if (input.isActive !== undefined) data.isActive = input.isActive;
  if (input.statusFlow !== undefined) data.statusFlow = input.statusFlow as Prisma.InputJsonValue;
  if (input.approvalConfig !== undefined) data.approvalConfig = input.approvalConfig as Prisma.InputJsonValue;
  if (input.permissionConfig !== undefined) data.permissionConfig = input.permissionConfig as Prisma.InputJsonValue;
  if (input.settings !== undefined) data.settings = input.settings as Prisma.InputJsonValue;
  if (input.visibleToRoles !== undefined) data.visibleToRoles = input.visibleToRoles as Prisma.InputJsonValue;

  const updated = await prisma.dynamicDocumentType.update({ where: { id }, data });

  return { existing, updated };
}

export async function deleteDocumentType(id: string) {
  const existing = await prisma.dynamicDocumentType.findUnique({
    where: { id },
    include: { _count: { select: { documents: true } } },
  });
  if (!existing) throw new NotFoundError('Document type not found');

  if (existing._count.documents > 0) {
    throw new Error(
      `Cannot delete document type '${existing.code}': ${existing._count.documents} documents exist. Deactivate instead.`,
    );
  }

  await prisma.dynamicDocumentType.delete({ where: { id } });
  log('info', `[DynDocType] Deleted document type: ${existing.code}`);
}

// ── Field Management ───────────────────────────────────────────────────

export async function addField(documentTypeId: string, input: FieldDefinitionInput) {
  // Verify doc type exists
  const docType = await prisma.dynamicDocumentType.findUnique({ where: { id: documentTypeId } });
  if (!docType) throw new NotFoundError('Document type not found');

  // Auto-assign sortOrder if not provided
  if (input.sortOrder === undefined) {
    const maxOrder = await prisma.dynamicFieldDefinition.aggregate({
      where: { documentTypeId },
      _max: { sortOrder: true },
    });
    input.sortOrder = (maxOrder._max.sortOrder ?? -1) + 1;
  }

  return prisma.dynamicFieldDefinition.create({
    data: {
      documentTypeId,
      fieldKey: input.fieldKey,
      label: input.label,
      fieldType: input.fieldType,
      options: (input.options as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      isRequired: input.isRequired ?? false,
      showInGrid: input.showInGrid ?? false,
      showInForm: input.showInForm ?? true,
      sectionName: input.sectionName,
      sortOrder: input.sortOrder,
      validationRules: (input.validationRules as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      defaultValue: input.defaultValue,
      colSpan: input.colSpan ?? 2,
      isLineItem: input.isLineItem ?? false,
      isReadOnly: input.isReadOnly ?? false,
      conditionalDisplay: (input.conditionalDisplay as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    },
  });
}

export async function updateField(fieldId: string, input: Partial<FieldDefinitionInput>) {
  const existing = await prisma.dynamicFieldDefinition.findUnique({ where: { id: fieldId } });
  if (!existing) throw new NotFoundError('Field not found');

  return prisma.dynamicFieldDefinition.update({
    where: { id: fieldId },
    data: {
      label: input.label,
      fieldType: input.fieldType,
      options: (input.options as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      isRequired: input.isRequired,
      showInGrid: input.showInGrid,
      showInForm: input.showInForm,
      sectionName: input.sectionName,
      sortOrder: input.sortOrder,
      validationRules: (input.validationRules as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      defaultValue: input.defaultValue,
      colSpan: input.colSpan,
      isLineItem: input.isLineItem,
      isReadOnly: input.isReadOnly,
      conditionalDisplay: (input.conditionalDisplay as Prisma.InputJsonValue) ?? Prisma.JsonNull,
    },
  });
}

export async function deleteField(fieldId: string) {
  const existing = await prisma.dynamicFieldDefinition.findUnique({ where: { id: fieldId } });
  if (!existing) throw new NotFoundError('Field not found');
  await prisma.dynamicFieldDefinition.delete({ where: { id: fieldId } });
}

export async function reorderFields(documentTypeId: string, fieldIds: string[]) {
  const updates = fieldIds.map((id, index) =>
    prisma.dynamicFieldDefinition.update({
      where: { id },
      data: { sortOrder: index },
    }),
  );
  await prisma.$transaction(updates);
}

// ── List active types for navigation ──────────────────────────────────

export async function getActiveTypesForRole(role: string) {
  const types = await prisma.dynamicDocumentType.findMany({
    where: { isActive: true },
    select: { code: true, name: true, icon: true, category: true, visibleToRoles: true },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });

  // Filter by role visibility
  return types.filter(t => {
    const roles = t.visibleToRoles as string[];
    return roles.includes('*') || roles.includes(role);
  });
}
