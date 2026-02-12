/**
 * Custom Fields Service
 *
 * Allows adding extra fields to existing document types (GRN, MI, JO, etc.)
 * without schema migration. Values are stored in a separate table
 * (CustomFieldValue) with JSONB `value` column.
 */
import { prisma } from '../utils/prisma.js';
import { Prisma } from '@prisma/client';

// ── Field Definitions CRUD ───────────────────────────────────────────

export async function listFieldDefinitions(entityType?: string) {
  return prisma.customFieldDefinition.findMany({
    where: entityType ? { entityType } : undefined,
    orderBy: [{ entityType: 'asc' }, { sortOrder: 'asc' }],
  });
}

export async function getFieldDefinition(id: string) {
  return prisma.customFieldDefinition.findUniqueOrThrow({ where: { id } });
}

export async function createFieldDefinition(data: {
  entityType: string;
  fieldKey: string;
  label: string;
  labelAr?: string;
  fieldType: string;
  options?: unknown;
  isRequired?: boolean;
  showInGrid?: boolean;
  sortOrder?: number;
}) {
  return prisma.customFieldDefinition.create({
    data: {
      entityType: data.entityType,
      fieldKey: data.fieldKey,
      label: data.label,
      labelAr: data.labelAr,
      fieldType: data.fieldType,
      options: data.options ? (data.options as Prisma.InputJsonValue) : Prisma.JsonNull,
      isRequired: data.isRequired ?? false,
      showInGrid: data.showInGrid ?? false,
      sortOrder: data.sortOrder ?? 0,
    },
  });
}

export async function updateFieldDefinition(
  id: string,
  data: {
    label?: string;
    labelAr?: string;
    fieldType?: string;
    options?: unknown;
    isRequired?: boolean;
    showInGrid?: boolean;
    sortOrder?: number;
  },
) {
  return prisma.customFieldDefinition.update({
    where: { id },
    data: {
      ...(data.label !== undefined && { label: data.label }),
      ...(data.labelAr !== undefined && { labelAr: data.labelAr }),
      ...(data.fieldType !== undefined && { fieldType: data.fieldType }),
      ...(data.options !== undefined && {
        options: data.options ? (data.options as Prisma.InputJsonValue) : Prisma.JsonNull,
      }),
      ...(data.isRequired !== undefined && { isRequired: data.isRequired }),
      ...(data.showInGrid !== undefined && { showInGrid: data.showInGrid }),
      ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
    },
  });
}

export async function deleteFieldDefinition(id: string) {
  // Also delete all values for this definition
  await prisma.customFieldValue.deleteMany({ where: { definitionId: id } });
  return prisma.customFieldDefinition.delete({ where: { id } });
}

// ── Field Values CRUD ────────────────────────────────────────────────

/**
 * Get all custom field values for a specific entity.
 * Returns a flat object: { fieldKey: value, ... }
 */
export async function getCustomFieldValues(entityType: string, entityId: string): Promise<Record<string, unknown>> {
  const values = await prisma.customFieldValue.findMany({
    where: { entityType, entityId },
    include: { definition: { select: { fieldKey: true } } },
  });

  const result: Record<string, unknown> = {};
  for (const v of values) {
    result[v.definition.fieldKey] = v.value;
  }
  return result;
}

/**
 * Set custom field values for an entity.
 * Accepts a flat object: { fieldKey: value, ... }
 * Creates or updates each value.
 */
export async function setCustomFieldValues(
  entityType: string,
  entityId: string,
  values: Record<string, unknown>,
): Promise<void> {
  // Get all field definitions for this entity type
  const definitions = await prisma.customFieldDefinition.findMany({
    where: { entityType },
  });

  const defMap = new Map(definitions.map(d => [d.fieldKey, d]));

  for (const [fieldKey, value] of Object.entries(values)) {
    const def = defMap.get(fieldKey);
    if (!def) continue; // Skip unknown fields

    await prisma.customFieldValue.upsert({
      where: {
        definitionId_entityId: {
          definitionId: def.id,
          entityId,
        },
      },
      update: {
        value: value !== null && value !== undefined ? (value as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
      create: {
        definitionId: def.id,
        entityType,
        entityId,
        value: value !== null && value !== undefined ? (value as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  }
}

/**
 * Delete all custom field values for an entity.
 */
export async function deleteCustomFieldValues(entityType: string, entityId: string): Promise<void> {
  await prisma.customFieldValue.deleteMany({
    where: { entityType, entityId },
  });
}
