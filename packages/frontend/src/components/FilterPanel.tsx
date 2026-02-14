import React from 'react';
import { X, Filter } from 'lucide-react';
import { useEscapeKey } from '@/hooks/useEscapeKey';

interface FilterConfig {
  key: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'dateRange';
  options?: string[];
}

interface FilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FilterConfig[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onApply: () => void;
  onClear: () => void;
}

export const FilterPanel: React.FC<FilterPanelProps> = ({
  isOpen,
  onClose,
  filters,
  values,
  onChange,
  onApply,
  onClear,
}) => {
  useEscapeKey(onClose, isOpen);

  if (!isOpen) return null;

  const activeCount = Object.values(values).filter(v => v !== '' && v !== undefined && v !== null).length;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md z-50 flex flex-col bg-[#0a1628]/95 backdrop-blur-xl border-l border-white/10 shadow-2xl animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-nesma-primary/20 border border-nesma-primary/30">
              <Filter size={18} className="text-nesma-secondary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Filters</h2>
              {activeCount > 0 && (
                <p className="text-xs text-nesma-secondary mt-0.5">
                  {activeCount} filter{activeCount !== 1 ? 's' : ''} active
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 border border-transparent hover:border-white/10 transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-6 space-y-5">
          {filters.map(filter => (
            <div key={filter.key}>
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                {filter.label}
              </label>

              {filter.type === 'text' && (
                <input
                  type="text"
                  value={values[filter.key] || ''}
                  onChange={e => onChange(filter.key, e.target.value)}
                  placeholder={`Search ${filter.label.toLowerCase()}...`}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-500 focus:border-nesma-secondary/50 focus:bg-white/10 outline-none transition-all"
                />
              )}

              {filter.type === 'select' && (
                <select
                  value={values[filter.key] || ''}
                  onChange={e => onChange(filter.key, e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:border-nesma-secondary/50 outline-none transition-all appearance-none cursor-pointer"
                >
                  <option value="">All</option>
                  {filter.options?.map(opt => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )}

              {filter.type === 'date' && (
                <input
                  type="date"
                  value={values[filter.key] || ''}
                  onChange={e => onChange(filter.key, e.target.value)}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:border-nesma-secondary/50 outline-none transition-all"
                />
              )}

              {filter.type === 'dateRange' && (
                <div className="flex items-center gap-3">
                  <input
                    type="date"
                    value={values[`${filter.key}_from`] || ''}
                    onChange={e => onChange(`${filter.key}_from`, e.target.value)}
                    className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:border-nesma-secondary/50 outline-none transition-all"
                  />
                  <span className="text-gray-500 text-xs font-medium">to</span>
                  <input
                    type="date"
                    value={values[`${filter.key}_to`] || ''}
                    onChange={e => onChange(`${filter.key}_to`, e.target.value)}
                    className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:border-nesma-secondary/50 outline-none transition-all"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-5 border-t border-white/10 bg-black/20 flex items-center justify-between gap-4">
          <button
            onClick={onClear}
            className="px-5 py-2.5 text-sm font-medium text-gray-400 hover:text-white border border-white/10 rounded-xl hover:bg-white/5 transition-all"
          >
            Clear All
          </button>
          <button
            onClick={() => {
              onApply();
              onClose();
            }}
            className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-nesma-primary to-nesma-primary/80 border border-nesma-secondary/30 rounded-xl hover:shadow-[0_0_20px_rgba(128,209,233,0.2)] transition-all"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </>
  );
};
