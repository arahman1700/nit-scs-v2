/**
 * Custom Fields Service
 *
 * Allows adding extra fields to existing document types (GRN, MI, JO, etc.)
 * without schema migration. Values are stored in a separate table
 * (CustomFieldValue) with JSONB `value` column.
 */
import { prisma } from '../utils/prisma.js';
import { Prisma } from '@prisma/client';

// ── Types ───────────────────────────────────────────────────────────────

export interface CustomFieldError {
  field: string;
  message: string;
}

interface ValidationRules {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

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
  fieldType: string;
  options?: unknown;
  validationRules?: unknown;
  isRequired?: boolean;
  showInGrid?: boolean;
  sortOrder?: number;
}) {
  return prisma.customFieldDefinition.create({
    data: {
      entityType: data.entityType,
      fieldKey: data.fieldKey,
      label: data.label,
      fieldType: data.fieldType,
      options: data.options ? (data.options as Prisma.InputJsonValue) : Prisma.JsonNull,
      validationRules: data.validationRules ? (data.validationRules as Prisma.InputJsonValue) : Prisma.JsonNull,
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
    fieldType?: string;
    options?: unknown;
    validationRules?: unknown;
    isRequired?: boolean;
    showInGrid?: boolean;
    sortOrder?: number;
  },
) {
  return prisma.customFieldDefinition.update({
    where: { id },
    data: {
      ...(data.label !== undefined && { label: data.label }),
      ...(data.fieldType !== undefined && { fieldType: data.fieldType }),
      ...(data.options !== undefined && {
        options: data.options ? (data.options as Prisma.InputJsonValue) : Prisma.JsonNull,
      }),
      ...(data.validationRules !== undefined && {
        validationRules: data.validationRules ? (data.validationRules as Prisma.InputJsonValue) : Prisma.JsonNull,
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
 * Validate custom field values against their definitions' validationRules.
 * Returns an array of field-level errors (empty = valid).
 */
export function validateCustomFieldValues(
  definitions: Array<{
    fieldKey: string;
    label: string;
    fieldType: string;
    isRequired: boolean;
    validationRules?: unknown;
  }>,
  values: Record<string, unknown>,
): CustomFieldError[] {
  const errors: CustomFieldError[] = [];

  for (const def of definitions) {
    const value = values[def.fieldKey];
    const rules = (def.validationRules ?? null) as ValidationRules | null;

    // Required check
    if (def.isRequired && (value === undefined || value === null || value === '')) {
      errors.push({ field: def.fieldKey, message: `${def.label} is required` });
      continue;
    }

    // Skip further validation if value is empty and not required
    if (value === undefined || value === null || value === '') continue;

    // Type-specific + validationRules checks
    switch (def.fieldType) {
      case 'number':
      case 'currency': {
        const num = Number(value);
        if (isNaN(num)) {
          errors.push({ field: def.fieldKey, message: `${def.label} must be a number` });
          break;
        }
        if (rules?.min !== undefined && num < rules.min) {
          errors.push({ field: def.fieldKey, message: `${def.label} must be at least ${rules.min}` });
        }
        if (rules?.max !== undefined && num > rules.max) {
          errors.push({ field: def.fieldKey, message: `${def.label} must be at most ${rules.max}` });
        }
        break;
      }

      case 'text':
      case 'textarea':
      case 'email':
      case 'url':
      case 'phone': {
        const str = String(value);
        if (rules?.minLength !== undefined && str.length < rules.minLength) {
          errors.push({
            field: def.fieldKey,
            message: `${def.label} must be at least ${rules.minLength} characters`,
          });
        }
        if (rules?.maxLength !== undefined && str.length > rules.maxLength) {
          errors.push({
            field: def.fieldKey,
            message: `${def.label} must be at most ${rules.maxLength} characters`,
          });
        }
        if (rules?.pattern) {
          const regex = new RegExp(rules.pattern);
          if (!regex.test(str)) {
            errors.push({ field: def.fieldKey, message: `${def.label} format is invalid` });
          }
        }
        break;
      }

      // No validationRules applicable for date, select, multiselect, checkbox, file, etc.
      default:
        break;
    }
  }

  return errors;
}

/**
 * Set custom field values for an entity.
 * Accepts a flat object: { fieldKey: value, ... }
 * Validates against field definitions' validationRules before persisting.
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

  // Validate before persisting
  const validationErrors = validateCustomFieldValues(definitions, values);
  if (validationErrors.length > 0) {
    const err = new Error('Custom field validation failed');
    (err as Error & { status: number; errors: CustomFieldError[] }).status = 400;
    (err as Error & { errors: CustomFieldError[] }).errors = validationErrors;
    throw err;
  }

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
