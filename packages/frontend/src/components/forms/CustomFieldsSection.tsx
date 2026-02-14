import React, { useEffect, useCallback } from 'react';
import { useCustomFieldDefinitions, useCustomFieldValues, useSaveCustomFieldValues } from '@/api/hooks/useCustomFields';
import type { CustomFieldDefinition } from '@/api/hooks/useCustomFields';
import { Settings2 } from 'lucide-react';

interface CustomFieldsSectionProps {
  entityType: string;
  entityId: string | undefined;
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  readOnly?: boolean;
  errors?: Record<string, string>;
}

export function CustomFieldsSection({
  entityType,
  entityId,
  values,
  onChange,
  readOnly,
  errors,
}: CustomFieldsSectionProps) {
  const { data: defsData, isLoading } = useCustomFieldDefinitions(entityType);
  const { data: savedData } = useCustomFieldValues(entityType, entityId);

  const definitions = (defsData as unknown as { data?: CustomFieldDefinition[] })?.data ?? [];
  const savedValues = (savedData as unknown as { data?: Record<string, unknown> })?.data ?? {};

  // Load saved values when editing an existing document
  useEffect(() => {
    if (entityId && Object.keys(savedValues).length > 0 && Object.keys(values).length === 0) {
      onChange(savedValues);
    }
  }, [entityId, savedValues, values, onChange]);

  const handleFieldChange = useCallback(
    (fieldKey: string, value: unknown) => {
      onChange({ ...values, [fieldKey]: value });
    },
    [values, onChange],
  );

  if (isLoading) {
    return (
      <div className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Settings2 size={18} className="text-nesma-secondary" />
          <h3 className="text-lg font-semibold text-white">Custom Fields</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-white/10 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (definitions.length === 0) return null;

  return (
    <div className="glass-card rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Settings2 size={18} className="text-nesma-secondary" />
        <h3 className="text-lg font-semibold text-white">Custom Fields</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {definitions.map(def => (
          <CustomFieldInput
            key={def.id}
            definition={def}
            value={values[def.fieldKey]}
            onChange={v => handleFieldChange(def.fieldKey, v)}
            readOnly={readOnly}
            error={errors?.[def.fieldKey]}
          />
        ))}
      </div>
    </div>
  );
}

// ── Single Field Input ────────────────────────────────────────────────────

function CustomFieldInput({
  definition,
  value,
  onChange,
  readOnly,
  error,
}: {
  definition: CustomFieldDefinition;
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly?: boolean;
  error?: string;
}) {
  const strValue = (value ?? '') as string;
  const numValue = value as number | undefined;

  const label = (
    <label className="text-sm text-gray-300 block mb-1">
      {definition.label}
      {definition.isRequired && <span className="text-red-400 ml-1">*</span>}
    </label>
  );

  switch (definition.fieldType) {
    case 'text':
    case 'email':
    case 'url':
    case 'phone':
      return (
        <div>
          {label}
          <input
            type={definition.fieldType === 'phone' ? 'tel' : definition.fieldType}
            className="input-field w-full"
            value={strValue}
            onChange={e => onChange(e.target.value)}
            readOnly={readOnly}
            required={definition.isRequired}
          />
          {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
        </div>
      );

    case 'number':
    case 'currency':
      return (
        <div>
          {label}
          <input
            type="number"
            className="input-field w-full"
            value={numValue ?? ''}
            onChange={e => onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
            readOnly={readOnly}
            required={definition.isRequired}
            step={definition.fieldType === 'currency' ? '0.01' : undefined}
          />
          {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
        </div>
      );

    case 'date':
      return (
        <div>
          {label}
          <input
            type="date"
            className="input-field w-full"
            value={strValue}
            onChange={e => onChange(e.target.value)}
            readOnly={readOnly}
            required={definition.isRequired}
          />
          {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
        </div>
      );

    case 'textarea':
      return (
        <div className="md:col-span-2">
          {label}
          <textarea
            className="input-field w-full min-h-[80px]"
            value={strValue}
            onChange={e => onChange(e.target.value)}
            readOnly={readOnly}
            required={definition.isRequired}
          />
          {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
        </div>
      );

    case 'select':
      return (
        <div>
          {label}
          <select
            className="input-field w-full"
            value={strValue}
            onChange={e => onChange(e.target.value)}
            disabled={readOnly}
            required={definition.isRequired}
          >
            <option value="">Select...</option>
            {definition.options?.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
        </div>
      );

    case 'checkbox':
      return (
        <div>
          <div className="flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              id={`cf-${definition.fieldKey}`}
              checked={!!value}
              onChange={e => onChange(e.target.checked)}
              disabled={readOnly}
              className="rounded"
            />
            <label htmlFor={`cf-${definition.fieldKey}`} className="text-sm text-gray-300">
              {definition.label}
            </label>
          </div>
          {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
        </div>
      );

    default:
      return (
        <div>
          {label}
          <input
            className="input-field w-full"
            value={strValue}
            onChange={e => onChange(e.target.value)}
            readOnly={readOnly}
          />
          {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
        </div>
      );
  }
}

// ── Hook for saving custom field values on form submit ─────────────────

export function useCustomFieldsSave() {
  const saveMutation = useSaveCustomFieldValues();
  return saveMutation;
}
