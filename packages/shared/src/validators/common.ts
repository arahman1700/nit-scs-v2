export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  rule: string;
  message: string;
}

export interface ValidationWarning {
  field: string;
  rule: string;
  message: string;
}

// ── Generic ─────────────────────────────────────────────────────────────

export function validateRequired(
  data: Record<string, unknown>,
  fields: { key: string; label: string }[],
): ValidationError[] {
  return fields
    .filter(f => !data[f.key] || (typeof data[f.key] === 'string' && !(data[f.key] as string).trim()))
    .map(f => ({ field: f.key, rule: 'REQUIRED', message: `${f.label} is required` }));
}
