import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ReportFilter } from '@/api/hooks/useSavedReports';

const OPERATORS = [
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'not equals' },
  { value: 'gt', label: 'greater than' },
  { value: 'gte', label: 'greater or equal' },
  { value: 'lt', label: 'less than' },
  { value: 'lte', label: 'less or equal' },
  { value: 'contains', label: 'contains' },
  { value: 'starts_with', label: 'starts with' },
];

interface FilterBuilderProps {
  columns: string[];
  filters: ReportFilter[];
  onChange: (filters: ReportFilter[]) => void;
}

export const FilterBuilder: React.FC<FilterBuilderProps> = ({ columns, filters, onChange }) => {
  function addFilter() {
    onChange([...filters, { field: columns[0] || '', operator: 'eq', value: '' }]);
  }

  function removeFilter(index: number) {
    onChange(filters.filter((_, i) => i !== index));
  }

  function updateFilter(index: number, key: keyof ReportFilter, val: string) {
    const updated = filters.map((f, i) => (i === index ? { ...f, [key]: val } : f));
    onChange(updated);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm text-gray-400">Filters</label>
        <button
          onClick={addFilter}
          disabled={columns.length === 0}
          className="flex items-center gap-1 text-xs text-nesma-secondary hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <Plus size={12} /> Add Filter
        </button>
      </div>

      {filters.length === 0 && <p className="text-xs text-gray-500">No filters applied</p>}

      <div className="space-y-2">
        {filters.map((filter, i) => (
          <div key={i} className="flex items-center gap-2">
            {/* Field */}
            <select
              value={filter.field}
              onChange={e => updateFilter(i, 'field', e.target.value)}
              className="flex-1 px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm
                focus:border-nesma-secondary/50 focus:outline-none"
            >
              {columns.map(col => (
                <option key={col} value={col}>
                  {col.replace(/_/g, ' ')}
                </option>
              ))}
            </select>

            {/* Operator */}
            <select
              value={filter.operator}
              onChange={e => updateFilter(i, 'operator', e.target.value)}
              className="w-28 px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm
                focus:border-nesma-secondary/50 focus:outline-none"
            >
              {OPERATORS.map(op => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>

            {/* Value */}
            <input
              type="text"
              value={filter.value}
              onChange={e => updateFilter(i, 'value', e.target.value)}
              placeholder="Value..."
              className="flex-1 px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm
                placeholder:text-gray-600 focus:border-nesma-secondary/50 focus:outline-none"
            />

            {/* Remove */}
            <button
              onClick={() => removeFilter(i)}
              className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
