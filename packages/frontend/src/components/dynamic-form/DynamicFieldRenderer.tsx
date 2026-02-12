import React from 'react';
import type { FieldDefinition } from '@/api/hooks/useDynamicDocumentTypes';
import { useProjects, useWarehouses, useSuppliers, useEmployees, useItems } from '@/api/hooks/useMasterData';

interface DynamicFieldRendererProps {
  field: FieldDefinition;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
  disabled?: boolean;
  error?: string;
}

export const DynamicFieldRenderer: React.FC<DynamicFieldRendererProps> = ({
  field,
  value,
  onChange,
  disabled = false,
  error,
}) => {
  const inputBase =
    'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-nesma-secondary focus:ring-1 focus:ring-nesma-secondary outline-none transition-all';

  const handleChange = (val: unknown) => onChange(field.fieldKey, val);

  const renderField = () => {
    switch (field.fieldType) {
      case 'text':
      case 'email':
      case 'phone':
      case 'url':
        return (
          <input
            type={field.fieldType === 'phone' ? 'tel' : field.fieldType}
            value={(value as string) ?? ''}
            onChange={e => handleChange(e.target.value)}
            className={inputBase}
            disabled={disabled || field.isReadOnly}
            placeholder={`Enter ${field.label}`}
          />
        );

      case 'number':
      case 'currency':
        return (
          <input
            type="number"
            value={(value as number) ?? ''}
            onChange={e => handleChange(e.target.value ? Number(e.target.value) : '')}
            className={inputBase}
            disabled={disabled || field.isReadOnly}
            step={field.fieldType === 'currency' ? '0.01' : 'any'}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={(value as string) ?? ''}
            onChange={e => handleChange(e.target.value)}
            className={inputBase}
            disabled={disabled || field.isReadOnly}
          />
        );

      case 'datetime':
        return (
          <input
            type="datetime-local"
            value={(value as string) ?? ''}
            onChange={e => handleChange(e.target.value)}
            className={inputBase}
            disabled={disabled || field.isReadOnly}
          />
        );

      case 'textarea':
        return (
          <textarea
            value={(value as string) ?? ''}
            onChange={e => handleChange(e.target.value)}
            className={`${inputBase} min-h-[100px]`}
            disabled={disabled || field.isReadOnly}
            placeholder={`Enter ${field.label}`}
          />
        );

      case 'select':
        return (
          <select
            value={(value as string) ?? ''}
            onChange={e => handleChange(e.target.value)}
            className={`${inputBase} appearance-none`}
            disabled={disabled || field.isReadOnly}
          >
            <option value="">Select...</option>
            {field.options?.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'multiselect': {
        const selected = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-1">
            {field.options?.map(opt => (
              <label key={opt.value} className="flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(opt.value)}
                  onChange={e => {
                    if (e.target.checked) handleChange([...selected, opt.value]);
                    else handleChange(selected.filter((v: string) => v !== opt.value));
                  }}
                  className="w-4 h-4 rounded border-gray-500 text-nesma-secondary focus:ring-nesma-secondary bg-transparent"
                  disabled={disabled || field.isReadOnly}
                />
                <span className="text-sm text-gray-300">{opt.label}</span>
              </label>
            ))}
          </div>
        );
      }

      case 'checkbox':
        return (
          <label className="flex items-center gap-3 p-3 border border-white/10 rounded-lg bg-white/5 cursor-pointer hover:bg-white/10 transition-colors">
            <input
              type="checkbox"
              checked={!!value}
              onChange={e => handleChange(e.target.checked)}
              className="w-5 h-5 rounded border-gray-500 text-nesma-secondary focus:ring-nesma-secondary bg-transparent"
              disabled={disabled || field.isReadOnly}
            />
            <span className="text-sm text-gray-300">Yes</span>
          </label>
        );

      case 'lookup_project':
        return (
          <LookupField
            type="projects"
            value={value as string}
            onChange={handleChange}
            disabled={disabled || field.isReadOnly}
          />
        );
      case 'lookup_warehouse':
        return (
          <LookupField
            type="warehouses"
            value={value as string}
            onChange={handleChange}
            disabled={disabled || field.isReadOnly}
          />
        );
      case 'lookup_supplier':
        return (
          <LookupField
            type="suppliers"
            value={value as string}
            onChange={handleChange}
            disabled={disabled || field.isReadOnly}
          />
        );
      case 'lookup_employee':
        return (
          <LookupField
            type="employees"
            value={value as string}
            onChange={handleChange}
            disabled={disabled || field.isReadOnly}
          />
        );
      case 'lookup_item':
        return (
          <LookupField
            type="items"
            value={value as string}
            onChange={handleChange}
            disabled={disabled || field.isReadOnly}
          />
        );

      case 'file':
      case 'signature':
        return (
          <div className="border-2 border-dashed border-white/20 rounded-lg p-6 text-center">
            <p className="text-sm text-gray-400">
              {field.fieldType === 'signature' ? 'Signature pad (coming soon)' : 'File upload (coming soon)'}
            </p>
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={(value as string) ?? ''}
            onChange={e => handleChange(e.target.value)}
            className={inputBase}
            disabled={disabled || field.isReadOnly}
          />
        );
    }
  };

  return (
    <div className={`col-span-${field.colSpan}`}>
      <label className="block text-sm font-medium text-gray-300 mb-1.5">
        {field.label}
        {field.isRequired && <span className="text-red-400 ml-1">*</span>}
      </label>
      {renderField()}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
};

// ── Lookup Field Component ──────────────────────────────────────────────

const LOOKUP_HOOKS = {
  projects: useProjects,
  warehouses: useWarehouses,
  suppliers: useSuppliers,
  employees: useEmployees,
  items: useItems,
} as const;

function LookupField({
  type,
  value,
  onChange,
  disabled,
}: {
  type: keyof typeof LOOKUP_HOOKS;
  value: string | undefined;
  onChange: (val: unknown) => void;
  disabled: boolean;
}) {
  const useHook = LOOKUP_HOOKS[type];
  const { data: hookData } = useHook();
  const items = ((hookData as { data?: Array<Record<string, unknown>> })?.data ?? []) as Array<{
    id: string;
    name?: string;
    fullName?: string;
    code?: string;
  }>;

  const inputBase =
    'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-nesma-secondary focus:ring-1 focus:ring-nesma-secondary outline-none transition-all appearance-none';

  const getLabel = (item: (typeof items)[0]) => {
    return item.fullName ?? item.name ?? item.code ?? item.id;
  };

  return (
    <select value={value ?? ''} onChange={e => onChange(e.target.value)} className={inputBase} disabled={disabled}>
      <option value="">Select...</option>
      {items.map(item => (
        <option key={item.id} value={item.id}>
          {getLabel(item)}
        </option>
      ))}
    </select>
  );
}
