import React from 'react';
import type { FieldDefinition } from '@/domains/system/hooks/useDynamicDocumentTypes';
import { FieldOptionsEditor } from './FieldOptionsEditor';
import { ValidationRulesPanel } from './ValidationRulesPanel';
import { FieldConfigPanel } from './FieldConfigPanel';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';

const INPUT_BASE =
  'w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-nesma-secondary focus:ring-1 focus:ring-nesma-secondary outline-none transition-all';

interface FieldsTabProps {
  isNew: boolean;
  typeId: string | undefined;
  fields: FieldDefinition[] | undefined;
  fieldTypes: Array<{ value: string; label: string }>;
  existingSections: string[];
  onAddField: () => void;
  onDeleteField: (fieldId: string) => void;
  onMoveField: (idx: number, direction: 'up' | 'down') => void;
  onUpdateField: (params: { typeId: string; fieldId: string; [key: string]: unknown }) => void;
}

export const FieldsTab: React.FC<FieldsTabProps> = ({
  isNew,
  typeId,
  fields,
  fieldTypes,
  existingSections,
  onAddField,
  onDeleteField,
  onMoveField,
  onUpdateField,
}) => (
  <div className="space-y-4">
    <div className="flex justify-between items-center">
      <p className="text-sm text-gray-400">{fields?.length ?? 0} field(s) defined</p>
      <button
        onClick={onAddField}
        disabled={isNew}
        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-nesma-secondary/20 text-nesma-secondary hover:bg-nesma-secondary/30 transition-colors disabled:opacity-50"
      >
        <Plus size={16} /> Add Field
      </button>
    </div>

    {isNew && (
      <div className="glass-card rounded-2xl p-6 text-center text-gray-400">
        Save the document type first, then add fields.
      </div>
    )}

    {fields?.map((field, idx) => (
      <div key={field.id} className="glass-card rounded-2xl p-4">
        <div className="flex items-start gap-4">
          {/* Reorder buttons */}
          <div className="flex flex-col gap-1 pt-1">
            <button
              onClick={() => onMoveField(idx, 'up')}
              disabled={idx === 0}
              className="p-1 rounded hover:bg-white/10 text-gray-400 disabled:opacity-30 transition-colors"
              aria-label="Move field up"
            >
              <ChevronUp size={16} />
            </button>
            <button
              onClick={() => onMoveField(idx, 'down')}
              disabled={idx === (fields?.length ?? 0) - 1}
              className="p-1 rounded hover:bg-white/10 text-gray-400 disabled:opacity-30 transition-colors"
              aria-label="Move field down"
            >
              <ChevronDown size={16} />
            </button>
          </div>
          <div className="flex-1">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <label htmlFor={`field-key-${field.id}`} className="block text-xs text-gray-400 mb-1">
                  Key
                </label>
                <input
                  id={`field-key-${field.id}`}
                  defaultValue={field.fieldKey}
                  onBlur={e =>
                    onUpdateField({ typeId: typeId!, fieldId: field.id, fieldKey: e.target.value })
                  }
                  className={`${INPUT_BASE} text-sm`}
                />
              </div>
              <div>
                <label htmlFor={`field-label-${field.id}`} className="block text-xs text-gray-400 mb-1">
                  Label
                </label>
                <input
                  id={`field-label-${field.id}`}
                  defaultValue={field.label}
                  onBlur={e => onUpdateField({ typeId: typeId!, fieldId: field.id, label: e.target.value })}
                  className={`${INPUT_BASE} text-sm`}
                />
              </div>
              <div>
                <label htmlFor={`field-type-${field.id}`} className="block text-xs text-gray-400 mb-1">
                  Type
                </label>
                <select
                  id={`field-type-${field.id}`}
                  defaultValue={field.fieldType}
                  onChange={e =>
                    onUpdateField({ typeId: typeId!, fieldId: field.id, fieldType: e.target.value })
                  }
                  className={`${INPUT_BASE} text-sm appearance-none`}
                >
                  {fieldTypes.map(ft => (
                    <option key={ft.value} value={ft.value}>
                      {ft.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 text-sm text-gray-400">
                  <input
                    type="checkbox"
                    defaultChecked={field.isRequired}
                    onChange={e =>
                      onUpdateField({ typeId: typeId!, fieldId: field.id, isRequired: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-gray-500 text-nesma-secondary bg-transparent"
                  />
                  Required
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-400">
                  <input
                    type="checkbox"
                    defaultChecked={field.showInGrid}
                    onChange={e =>
                      onUpdateField({ typeId: typeId!, fieldId: field.id, showInGrid: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-gray-500 text-nesma-secondary bg-transparent"
                  />
                  Grid
                </label>
                <button
                  onClick={() => onDeleteField(field.id)}
                  className="p-2 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors ml-auto"
                  aria-label="Delete field"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Options Editor (select/multiselect only) */}
            {(field.fieldType === 'select' || field.fieldType === 'multiselect') && (
              <FieldOptionsEditor
                options={field.options ?? []}
                onSave={options => onUpdateField({ typeId: typeId!, fieldId: field.id, options })}
              />
            )}

            {/* Validation Rules */}
            <ValidationRulesPanel
              fieldType={field.fieldType}
              rules={(field.validationRules ?? {}) as Record<string, unknown>}
              onSave={validationRules =>
                onUpdateField({ typeId: typeId!, fieldId: field.id, validationRules })
              }
            />

            {/* Field Configuration */}
            <FieldConfigPanel
              field={field}
              siblingFields={fields ?? []}
              existingSections={existingSections}
              onSave={updates => onUpdateField({ typeId: typeId!, fieldId: field.id, ...updates })}
            />
          </div>
        </div>
      </div>
    ))}
  </div>
);
