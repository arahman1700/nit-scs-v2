import React, { useState } from 'react';
import { INPUT_CLS } from './FieldOptionsEditor';
import type { FieldDefinition } from '@/domains/system/hooks/useDynamicDocumentTypes';
import { ChevronRight } from 'lucide-react';

interface FieldConfigPanelProps {
  field: FieldDefinition;
  siblingFields: FieldDefinition[];
  existingSections: string[];
  onSave: (updates: Partial<FieldDefinition>) => void;
}

export const FieldConfigPanel: React.FC<FieldConfigPanelProps> = ({ field, siblingFields, existingSections, onSave }) => {
  const [open, setOpen] = useState(false);

  const cond = (field.conditionalDisplay ?? {}) as {
    dependsOn?: string;
    operator?: string;
    value?: string;
  };

  const handleCondChange = (key: string, value: string) => {
    const next = { ...cond, [key]: value };
    onSave({ conditionalDisplay: next });
  };

  return (
    <div className="mt-3 border-t border-white/5 pt-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs text-nesma-secondary hover:underline"
      >
        <ChevronRight size={14} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
        Configuration
      </button>
      {open && (
        <div className="mt-2 space-y-3">
          {/* Conditional Display */}
          <div>
            <label htmlFor={`cond-depends-on-${field.id}`} className="block text-xs text-gray-400 mb-1">
              Conditional Display
            </label>
            <div className="flex gap-2">
              <select
                id={`cond-depends-on-${field.id}`}
                value={cond.dependsOn ?? ''}
                onChange={e => handleCondChange('dependsOn', e.target.value)}
                className={`${INPUT_CLS} flex-1 appearance-none`}
              >
                <option value="">No condition</option>
                {siblingFields
                  .filter(f => f.id !== field.id)
                  .map(f => (
                    <option key={f.id} value={f.fieldKey}>
                      {f.label}
                    </option>
                  ))}
              </select>
              <select
                value={cond.operator ?? 'eq'}
                onChange={e => handleCondChange('operator', e.target.value)}
                className={`${INPUT_CLS} w-20 appearance-none`}
                disabled={!cond.dependsOn}
              >
                <option value="eq">eq</option>
                <option value="ne">ne</option>
                <option value="in">in</option>
              </select>
              <input
                value={cond.value ?? ''}
                onChange={e => handleCondChange('value', e.target.value)}
                onBlur={() => onSave({ conditionalDisplay: cond })}
                className={`${INPUT_CLS} w-32`}
                placeholder="Value"
                disabled={!cond.dependsOn}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Section Name */}
            <div>
              <label htmlFor={`section-${field.id}`} className="block text-xs text-gray-400 mb-1">
                Section
              </label>
              <input
                id={`section-${field.id}`}
                defaultValue={field.sectionName ?? ''}
                onBlur={e => onSave({ sectionName: e.target.value || undefined })}
                className={INPUT_CLS}
                placeholder="General"
                list={`sections-${field.id}`}
              />
              <datalist id={`sections-${field.id}`}>
                {existingSections.map(s => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            {/* Column Span */}
            <div>
              <label htmlFor={`col-span-${field.id}`} className="block text-xs text-gray-400 mb-1">
                Column Span
              </label>
              <select
                id={`col-span-${field.id}`}
                defaultValue={field.colSpan}
                onChange={e => onSave({ colSpan: Number(e.target.value) })}
                className={`${INPUT_CLS} appearance-none`}
              >
                <option value={1}>1 column</option>
                <option value={2}>2 columns</option>
                <option value={3}>3 columns</option>
                <option value={4}>4 columns (full)</option>
              </select>
            </div>
          </div>

          {/* Line Item Toggle */}
          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={field.isLineItem}
              onChange={e => onSave({ isLineItem: e.target.checked })}
              className="w-4 h-4 rounded border-gray-500 text-nesma-secondary bg-transparent"
            />
            Line Item Field
          </label>
        </div>
      )}
    </div>
  );
};
