import React from 'react';
import { Search, Filter, ScanLine } from 'lucide-react';
import { ViewSwitcher } from '@/components/smart-grid';
import type { ViewMode } from '@/components/smart-grid';

interface ResourceToolbarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  title: string;
  filterValues: Record<string, string>;
  onFilterClick: () => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onSaveView: () => void;
  isSaveLoading: boolean;
  canScan: boolean;
  onScan: () => void;
}

export const ResourceToolbar: React.FC<ResourceToolbarProps> = ({
  searchTerm,
  onSearchChange,
  title,
  filterValues,
  onFilterClick,
  viewMode,
  onViewModeChange,
  onSaveView,
  isSaveLoading,
  canScan,
  onScan,
}) => {
  const activeFilterCount = Object.values(filterValues).filter(v => v).length;

  return (
    <div className="p-4 border-b border-white/10 flex flex-col md:flex-row gap-4 justify-between items-center bg-white/5">
      <div className="relative flex-1 w-full md:max-w-md flex gap-2">
        <div className="relative flex-1">
          <Search size={18} className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400" />
          <input
            type="text"
            placeholder={`Search ${title}...`}
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-nesma-secondary/50 focus:ring-1 focus:ring-nesma-secondary/50 transition-all"
          />
        </div>
        {canScan && (
          <button
            onClick={onScan}
            className="flex items-center gap-2 px-3 py-2 bg-nesma-primary/20 text-nesma-secondary border border-nesma-primary/30 rounded-lg text-sm hover:bg-nesma-primary/30 transition-all"
            title="Scan Barcode"
            aria-label="Scan barcode"
          >
            <ScanLine size={16} />
          </button>
        )}
      </div>
      <div className="flex gap-2 w-full md:w-auto">
        <button
          onClick={onFilterClick}
          className={`flex items-center gap-2 px-3 py-2 bg-black/20 border rounded-lg text-sm transition-all flex-1 md:flex-none justify-center ${
            activeFilterCount > 0
              ? 'border-nesma-secondary/50 text-nesma-secondary bg-nesma-secondary/5'
              : 'border-white/10 text-gray-300 hover:text-white hover:bg-white/5'
          }`}
        >
          <Filter size={16} />
          <span>Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</span>
        </button>
        <ViewSwitcher mode={viewMode} onChange={onViewModeChange} availableModes={['grid', 'list', 'card']} />
        {viewMode === 'grid' && (
          <button
            type="button"
            onClick={onSaveView}
            disabled={isSaveLoading}
            className="px-2.5 py-1.5 text-xs border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-all disabled:opacity-40"
            title="Save current grid layout"
          >
            {isSaveLoading ? 'Saving...' : 'Save View'}
          </button>
        )}
      </div>
    </div>
  );
};
