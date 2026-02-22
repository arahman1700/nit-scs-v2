import type { DynamicFieldDefinition } from '@prisma/client';

// ── Types ──────────────────────────────────────────────────────────────

export interface FieldError {
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

// ── Core Validator ─────────────────────────────────────────────────────

/**
 * Validate header data against field definitions.
 * Returns an array of field-level errors (empty = valid).
 */
export function validateDynamicData(
  fields: DynamicFieldDefinition[],
  data: Record<string, unknown>,
  isLineItem = false,
): FieldError[] {
  const errors: FieldError[] = [];
  const relevantFields = fields.filter(f => f.isLineItem === isLineItem);

  for (const field of relevantFields) {
    const value = data[field.fieldKey];
    const rules = field.validationRules as ValidationRules | null;

    // Required check
    if (field.isRequired && (value === undefined || value === null || value === '')) {
      errors.push({ field: field.fieldKey, message: `${field.label} is required` });
      continue;
    }

    // Skip further validation if value is empty and not required
    if (value === undefined || value === null || value === '') continue;

    // Type-specific validation
    const typeErrors = validateFieldType(field, value, rules);
    errors.push(...typeErrors);
  }

  return errors;
}

/**
 * Validate line items array — each line is validated against line-item fields.
 */
export function validateDynamicLines(
  fields: DynamicFieldDefinition[],
  lines: Array<Record<string, unknown>>,
): FieldError[] {
  const errors: FieldError[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lineErrors = validateDynamicData(fields, lines[i], true);
    for (const err of lineErrors) {
      errors.push({ field: `lines[${i}].${err.field}`, message: err.message });
    }
  }

  return errors;
}

// ── Field Type Validators ──────────────────────────────────────────────

function validateFieldType(field: DynamicFieldDefinition, value: unknown, rules: ValidationRules | null): FieldError[] {
  const errors: FieldError[] = [];
  const key = field.fieldKey;

  switch (field.fieldType) {
    case 'number':
    case 'currency': {
      const num = Number(value);
      if (isNaN(num)) {
        errors.push({ field: key, message: `${field.label} must be a number` });
        break;
      }
      if (rules?.min !== undefined && num < rules.min) {
        errors.push({ field: key, message: `${field.label} must be at least ${rules.min}` });
      }
      if (rules?.max !== undefined && num > rules.max) {
        errors.push({ field: key, message: `${field.label} must be at most ${rules.max}` });
      }
      break;
    }

    case 'text':
    case 'textarea': {
      const str = String(value);
      if (rules?.minLength !== undefined && str.length < rules.minLength) {
        errors.push({ field: key, message: `${field.label} must be at least ${rules.minLength} characters` });
      }
      if (rules?.maxLength !== undefined && str.length > rules.maxLength) {
        errors.push({ field: key, message: `${field.label} must be at most ${rules.maxLength} characters` });
      }
      if (rules?.pattern) {
        const regex = new RegExp(rules.pattern);
        if (!regex.test(str)) {
          errors.push({ field: key, message: `${field.label} format is invalid` });
        }
      }
      break;
    }

    case 'email': {
      const str = String(value);
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(str)) {
        errors.push({ field: key, message: `${field.label} must be a valid email` });
        break;
      }
      if (rules?.minLength !== undefined && str.length < rules.minLength) {
        errors.push({ field: key, message: `${field.label} must be at least ${rules.minLength} characters` });
      }
      if (rules?.maxLength !== undefined && str.length > rules.maxLength) {
        errors.push({ field: key, message: `${field.label} must be at most ${rules.maxLength} characters` });
      }
      if (rules?.pattern) {
        const regex = new RegExp(rules.pattern);
        if (!regex.test(str)) {
          errors.push({ field: key, message: `${field.label} format is invalid` });
        }
      }
      break;
    }

    case 'phone': {
      const str = String(value);
      const phoneRegex = /^\+?[\d\s\-()]{7,20}$/;
      if (!phoneRegex.test(str)) {
        errors.push({ field: key, message: `${field.label} must be a valid phone number` });
        break;
      }
      if (rules?.minLength !== undefined && str.length < rules.minLength) {
        errors.push({ field: key, message: `${field.label} must be at least ${rules.minLength} characters` });
      }
      if (rules?.maxLength !== undefined && str.length > rules.maxLength) {
        errors.push({ field: key, message: `${field.label} must be at most ${rules.maxLength} characters` });
      }
      if (rules?.pattern) {
        const regex = new RegExp(rules.pattern);
        if (!regex.test(str)) {
          errors.push({ field: key, message: `${field.label} format is invalid` });
        }
      }
      break;
    }

    case 'url': {
      const str = String(value);
      try {
        new URL(str);
      } catch {
        errors.push({ field: key, message: `${field.label} must be a valid URL` });
        break;
      }
      if (rules?.minLength !== undefined && str.length < rules.minLength) {
        errors.push({ field: key, message: `${field.label} must be at least ${rules.minLength} characters` });
      }
      if (rules?.maxLength !== undefined && str.length > rules.maxLength) {
        errors.push({ field: key, message: `${field.label} must be at most ${rules.maxLength} characters` });
      }
      if (rules?.pattern) {
        const regex = new RegExp(rules.pattern);
        if (!regex.test(str)) {
          errors.push({ field: key, message: `${field.label} format is invalid` });
        }
      }
      break;
    }

    case 'date':
    case 'datetime': {
      const d = new Date(String(value));
      if (isNaN(d.getTime())) {
        errors.push({ field: key, message: `${field.label} must be a valid date` });
      }
      break;
    }

    case 'select': {
      const options = field.options as Array<{ value: string }> | null;
      if (options && !options.some(o => o.value === value)) {
        errors.push({ field: key, message: `${field.label} has an invalid selection` });
      }
      break;
    }

    case 'multiselect': {
      if (!Array.isArray(value)) {
        errors.push({ field: key, message: `${field.label} must be an array` });
        break;
      }
      const options = field.options as Array<{ value: string }> | null;
      if (options) {
        const validValues = new Set(options.map(o => o.value));
        for (const v of value) {
          if (!validValues.has(v as string)) {
            errors.push({ field: key, message: `${field.label} contains invalid value: ${v}` });
          }
        }
      }
      break;
    }

    case 'checkbox': {
      if (typeof value !== 'boolean') {
        errors.push({ field: key, message: `${field.label} must be true or false` });
      }
      break;
    }

    // Lookup fields — validate that the value is a UUID string
    case 'lookup_project':
    case 'lookup_warehouse':
    case 'lookup_supplier':
    case 'lookup_employee':
    case 'lookup_item': {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (typeof value !== 'string' || !uuidRegex.test(value)) {
        errors.push({ field: key, message: `${field.label} must be a valid reference ID` });
      }
      break;
    }

    // file and signature — just ensure a non-empty string
    case 'file':
    case 'signature':
      if (typeof value !== 'string' || value.trim() === '') {
        errors.push({ field: key, message: `${field.label} is required` });
      }
      break;
  }

  return errors;
}
