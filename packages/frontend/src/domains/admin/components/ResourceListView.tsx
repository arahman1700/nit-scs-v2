import React from 'react';
import { ChevronUp, ChevronDown, CheckSquare, Square } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import type { ColumnDef } from '@/config/resourceColumns';

interface ResourceListViewProps {
  data: Record<string, unknown>[];
  columns: ColumnDef[];
  isDocument: boolean;
  selectedIds: Set<string>;
  allSelected: boolean;
  sortKey: string;
  sortDir: 'asc' | 'desc';
  onSort: (key: string) => void;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  renderCellValue: (col: ColumnDef, row: Record<string, unknown>) => React.ReactNode;
  renderActions: (row: Record<string, unknown>, size: number, inCard: boolean) => React.ReactNode;
}

export const ResourceListView: React.FC<ResourceListViewProps> = ({
  data,
  columns,
  isDocument,
  selectedIds,
  allSelected,
  sortKey,
  sortDir,
  onSort,
  onToggleSelect,
  onToggleSelectAll,
  renderCellValue,
  renderActions,
}) => (
  <div className="overflow-x-auto">
    <table className="w-full text-left border-collapse">
      <thead className="nesma-table-head text-nesma-secondary text-xs uppercase tracking-wider font-semibold">
        <tr>
          {isDocument && (
            <th className="px-3 py-4 w-10">
              <button
                type="button"
                onClick={onToggleSelectAll}
                className="text-gray-400 hover:text-nesma-secondary transition-colors"
                title={allSelected ? 'Deselect all' : 'Select all'}
                aria-label={allSelected ? 'Deselect all' : 'Select all'}
              >
                {allSelected ? <CheckSquare size={16} /> : <Square size={16} />}
              </button>
            </th>
          )}
          {columns.map((col, idx) => (
            <th
              key={idx}
              className="px-6 py-4 whitespace-nowrap cursor-pointer hover:text-white transition-colors select-none"
              onClick={() => onSort(col.key)}
            >
              <span className="flex items-center gap-1">
                {col.label}
                {sortKey === col.key && (sortDir === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
              </span>
            </th>
          ))}
          <th className="px-6 py-4 text-right">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-white/5 text-sm text-gray-300">
        {data.length > 0 ? (
          data.map((row, idx) => {
            const rowId = row.id as string;
            const isRowSelected = rowId ? selectedIds.has(rowId) : false;
            return (
              <tr key={idx} className={`nesma-table-row group ${isRowSelected ? 'bg-nesma-secondary/5' : ''}`}>
                {isDocument && (
                  <td className="px-3 py-4 w-10">
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        if (rowId) onToggleSelect(rowId);
                      }}
                      className="text-gray-400 hover:text-nesma-secondary transition-colors"
                      aria-label={isRowSelected ? 'Deselect row' : 'Select row'}
                    >
                      {isRowSelected ? (
                        <CheckSquare size={16} className="text-nesma-secondary" />
                      ) : (
                        <Square size={16} />
                      )}
                    </button>
                  </td>
                )}
                {columns.map((col, cIdx) => (
                  <td key={cIdx} className="px-6 py-4 whitespace-nowrap group-hover:text-white transition-colors">
                    {renderCellValue(col, row)}
                  </td>
                ))}
                <td className="px-6 py-4 text-right">{renderActions(row, 16, false)}</td>
              </tr>
            );
          })
        ) : (
          <tr>
            <td colSpan={columns.length + (isDocument ? 2 : 1)} className="px-6 py-12 text-center">
              <EmptyState />
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
);
