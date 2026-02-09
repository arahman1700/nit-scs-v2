import React, { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useWidgetData } from '@/api/hooks/useWidgetData';
import type { DashboardWidget } from '@/api/hooks/useDashboards';

interface TableWidgetProps {
  widget: DashboardWidget;
}

const PAGE_SIZE = 5;

export const TableWidget: React.FC<TableWidgetProps> = ({ widget }) => {
  const { data, isLoading } = useWidgetData(widget.dataSource);
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortAsc, setSortAsc] = useState(true);

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-8 bg-white/5 rounded" />
        ))}
      </div>
    );
  }

  const rows = (data?.data as Record<string, unknown>[] | undefined) ?? [];
  if (rows.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-500 text-sm">No data available</div>;
  }

  const columns = Object.keys(rows[0]);

  // Sort
  let sorted = rows;
  if (sortKey) {
    sorted = [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortAsc ? av - bv : bv - av;
      }
      return sortAsc ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
    });
  }

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function handleSort(col: string) {
    if (sortKey === col) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(col);
      setSortAsc(true);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              {columns.map(col => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="text-left px-3 py-2 text-gray-400 font-medium text-xs uppercase
                    cursor-pointer hover:text-white select-none"
                >
                  <span className="inline-flex items-center gap-1">
                    {col.replace(/_/g, ' ')}
                    {sortKey === col && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, ri) => (
              <tr key={ri} className="border-b border-white/5 hover:bg-white/5">
                {columns.map(col => (
                  <td key={col} className="px-3 py-2 text-gray-300 whitespace-nowrap">
                    {String(row[col] ?? '-')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2 text-xs text-gray-500">
          <span>
            {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, sorted.length)} of {sorted.length}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30"
            >
              Prev
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
