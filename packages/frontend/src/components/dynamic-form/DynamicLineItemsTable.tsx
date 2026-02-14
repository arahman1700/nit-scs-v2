import React, { useCallback, useMemo } from 'react';
import type { FieldDefinition } from '@/api/hooks/useDynamicDocumentTypes';
import { DynamicFieldRenderer } from './DynamicFieldRenderer';
import { Plus, Trash2 } from 'lucide-react';

interface DynamicLineItemsTableProps {
  lineFields: FieldDefinition[];
  lines: Record<string, unknown>[];
  onLinesChange: (lines: Record<string, unknown>[]) => void;
  disabled?: boolean;
  errors?: Record<number, Record<string, string>>;
}

export function DynamicLineItemsTable({
  lineFields,
  lines,
  onLinesChange,
  disabled = false,
  errors,
}: DynamicLineItemsTableProps) {
  const sortedFields = useMemo(() => [...lineFields].sort((a, b) => a.sortOrder - b.sortOrder), [lineFields]);

  const handleCellChange = useCallback(
    (rowIdx: number, fieldKey: string, value: unknown) => {
      const updated = lines.map((line, i) => (i === rowIdx ? { ...line, [fieldKey]: value } : line));
      onLinesChange(updated);
    },
    [lines, onLinesChange],
  );

  const addRow = useCallback(() => {
    const newRow: Record<string, unknown> = {};
    for (const field of sortedFields) {
      newRow[field.fieldKey] = field.defaultValue ?? undefined;
    }
    onLinesChange([...lines, newRow]);
  }, [lines, onLinesChange, sortedFields]);

  const removeRow = useCallback(
    (rowIdx: number) => {
      onLinesChange(lines.filter((_, i) => i !== rowIdx));
    },
    [lines, onLinesChange],
  );

  return (
    <div className="glass-card rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-white mb-4">Line Items</h3>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-xs font-medium text-gray-400 uppercase tracking-wider px-3 py-2 text-left w-10">#</th>
              {sortedFields.map(field => (
                <th
                  key={field.fieldKey}
                  className="text-xs font-medium text-gray-400 uppercase tracking-wider px-3 py-2 text-left"
                >
                  {field.label}
                  {field.isRequired && <span className="text-red-400 ml-1">*</span>}
                </th>
              ))}
              {!disabled && (
                <th className="text-xs font-medium text-gray-400 uppercase tracking-wider px-3 py-2 text-left w-10" />
              )}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr>
                <td
                  colSpan={sortedFields.length + (disabled ? 1 : 2)}
                  className="text-center text-sm text-gray-400 py-8"
                >
                  No line items. Click Add Row to begin.
                </td>
              </tr>
            ) : (
              lines.map((line, rowIdx) => (
                <tr key={rowIdx} className="border-b border-white/10">
                  <td className="px-3 py-1.5 text-sm text-gray-400">{rowIdx + 1}</td>
                  {sortedFields.map(field => (
                    <td key={field.fieldKey} className="px-2 py-1.5">
                      <DynamicFieldRenderer
                        field={field}
                        value={line[field.fieldKey]}
                        onChange={(_key, val) => handleCellChange(rowIdx, field.fieldKey, val)}
                        hideLabel
                        disabled={disabled}
                        error={errors?.[rowIdx]?.[field.fieldKey]}
                      />
                    </td>
                  ))}
                  {!disabled && (
                    <td className="px-2 py-1.5">
                      <button
                        type="button"
                        onClick={() => removeRow(rowIdx)}
                        className="p-1.5 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-all"
                        aria-label={`Remove row ${rowIdx + 1}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!disabled && (
        <button
          type="button"
          onClick={addRow}
          className="flex items-center gap-2 text-nesma-secondary hover:text-white text-sm mt-3 transition-all"
        >
          <Plus size={16} />
          Add Row
        </button>
      )}
    </div>
  );
}
