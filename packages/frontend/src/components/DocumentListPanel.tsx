import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Plus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SmartGrid } from '@/components/smart-grid';
import type { ColumnDef } from '@/config/resourceColumns';

interface DocumentListPanelProps {
  title: string;
  icon: LucideIcon;
  columns: ColumnDef[];
  rows: Record<string, unknown>[];
  loading: boolean;
  createLabel?: string;
  createUrl?: string;
  onRowClick?: (row: Record<string, unknown>) => void;
}

export const DocumentListPanel: React.FC<DocumentListPanelProps> = ({
  title,
  icon: Icon,
  columns,
  rows,
  loading,
  createLabel,
  createUrl,
  onRowClick,
}) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-nesma-secondary" />
          <h3 className="text-white font-semibold">{title}</h3>
          <span className="text-xs text-gray-500">({rows.length} records)</span>
        </div>
        {createLabel && createUrl && (
          <button
            onClick={() => navigate(createUrl)}
            className="btn-primary px-4 py-2 rounded-lg text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {createLabel}
          </button>
        )}
      </div>
      <div className="glass-card rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 text-nesma-secondary animate-spin" />
            <span className="ml-3 text-gray-400">Loading {title.toLowerCase()}...</span>
          </div>
        ) : (
          <SmartGrid columns={columns} rowData={rows} loading={loading} onRowClicked={onRowClick} isDocument />
        )}
      </div>
    </div>
  );
};
