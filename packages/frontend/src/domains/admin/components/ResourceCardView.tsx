import React from 'react';
import { EmptyState } from '@/components/EmptyState';
import type { ColumnDef } from '@/config/resourceColumns';

interface ResourceCardViewProps {
  data: Record<string, unknown>[];
  columns: ColumnDef[];
  onRowClick: (row: Record<string, unknown>) => void;
  renderCellValue: (col: ColumnDef, row: Record<string, unknown>) => React.ReactNode;
  renderActions: (row: Record<string, unknown>, size: number, inCard: boolean) => React.ReactNode;
}

export const ResourceCardView: React.FC<ResourceCardViewProps> = ({
  data,
  columns,
  onRowClick,
  renderCellValue,
  renderActions,
}) => {
  if (data.length === 0) {
    return (
      <div className="p-4">
        <EmptyState />
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((row, idx) => {
          const primaryCol = columns[0];
          const titleCol = columns.find(c => c.key === 'name') || columns[1];
          const statusCol = columns.find(c => c.key === 'status' || c.key === 'stockStatus');
          const restCols = columns.filter(c => c !== primaryCol && c !== titleCol && c !== statusCol);

          return (
            <div
              key={idx}
              onClick={() => onRowClick(row)}
              className="glass-card p-5 rounded-xl hover:bg-white/10 transition-all cursor-pointer group border border-white/5 hover:border-nesma-secondary/20"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0">
                  <p className="text-white font-medium text-sm truncate group-hover:text-nesma-secondary transition-colors">
                    {titleCol ? renderCellValue(titleCol, row) : '-'}
                  </p>
                  <p className="text-gray-400 text-xs font-mono mt-0.5">
                    {primaryCol ? (row[primaryCol.key] as string) || '-' : '-'}
                  </p>
                </div>
                {statusCol && <div className="flex-shrink-0 ml-2">{renderCellValue(statusCol, row)}</div>}
              </div>
              <div className="space-y-1.5 pt-3 border-t border-white/5">
                {restCols.slice(0, 4).map((col, cIdx) => (
                  <div key={cIdx} className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">{col.label}</span>
                    <span className="text-gray-300 truncate ml-2 max-w-[60%] text-right">
                      {renderCellValue(col, row)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                {renderActions(row, 14, true)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
