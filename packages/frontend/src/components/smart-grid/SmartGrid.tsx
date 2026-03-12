import React, { useMemo, useCallback, useRef, useEffect, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef as TanStackColumnDef,
  type SortingState,
  type ColumnSizingState,
  type VisibilityState,
  type RowSelectionState,
} from '@tanstack/react-table';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import type { ColumnDef } from '@/config/resourceColumns';
import { StatusBadge } from '@/components/StatusBadge';

export interface ColumnState {
  colId: string;
  width?: number;
  visible?: boolean;
  sort?: 'asc' | 'desc' | null;
  sortIndex?: number;
}

export interface SmartGridProps {
  columns: ColumnDef[];
  rowData: Record<string, unknown>[];
  loading?: boolean;
  onSortChanged?: (sortBy: string, sortDir: 'asc' | 'desc') => void;
  onRowClicked?: (row: Record<string, unknown>) => void;
  isDocument?: boolean;
  selectedIds?: Set<string>;
  onSelectionChanged?: (ids: Set<string>) => void;
  onCellValueChanged?: (rowId: string, field: string, newValue: unknown) => void;
  suppressPagination?: boolean;
  initialColumnState?: ColumnState[];
  onColumnStateChanged?: (state: ColumnState[]) => void;
}

/** Resolve a nested key like 'item.itemCode' from a data row. */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

/** Detect status-type columns by function name or key pattern. */
function isStatusColumn(col: ColumnDef): boolean {
  if (col.key === 'status' || col.key === 'stockStatus' || col.key === 'slaStatus') return true;
  if (col.component) {
    const fnName = col.component.name || col.component.toString();
    return fnName.includes('statusCol') || fnName.includes('StatusBadge') || fnName.includes('slaCol');
  }
  return false;
}

/** Detect currency-type columns by format function name or key. */
function isCurrencyColumn(col: ColumnDef): boolean {
  if (col.key === 'value') return true;
  if (col.format) {
    const fnName = col.format.name || col.format.toString();
    return fnName.includes('sarFormat');
  }
  return false;
}

export const SmartGrid: React.FC<SmartGridProps> = ({
  columns,
  rowData,
  loading,
  onSortChanged,
  onRowClicked,
  isDocument,
  selectedIds,
  onSelectionChanged,
  onCellValueChanged: _onCellValueChanged,
  suppressPagination,
  initialColumnState,
  onColumnStateChanged,
}) => {
  // ── Sorting ────────────────────────────────────────────────────────────
  const [sorting, setSorting] = useState<SortingState>(() => {
    if (!initialColumnState) return [];
    return initialColumnState
      .filter(cs => cs.sort)
      .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
      .map(cs => ({ id: cs.colId, desc: cs.sort === 'desc' }));
  });

  // ── Column sizing ──────────────────────────────────────────────────────
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => {
    if (!initialColumnState) return {};
    const sizing: ColumnSizingState = {};
    for (const cs of initialColumnState) {
      if (cs.width) sizing[cs.colId] = cs.width;
    }
    return sizing;
  });

  // ── Column visibility ──────────────────────────────────────────────────
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => {
    if (!initialColumnState) return {};
    const vis: VisibilityState = {};
    for (const cs of initialColumnState) {
      if (cs.visible === false) vis[cs.colId] = false;
    }
    return vis;
  });

  // ── Row selection ──────────────────────────────────────────────────────
  const [rowSelection, setRowSelection] = useState<RowSelectionState>(() => {
    if (!selectedIds || selectedIds.size === 0) return {};
    const sel: RowSelectionState = {};
    for (const id of selectedIds) sel[id] = true;
    return sel;
  });

  // Sync external selectedIds → internal rowSelection
  useEffect(() => {
    if (!selectedIds) return;
    const sel: RowSelectionState = {};
    for (const id of selectedIds) sel[id] = true;
    setRowSelection(sel);
  }, [selectedIds]);

  // Notify parent on selection change
  const handleRowSelectionChange = useCallback(
    (updater: RowSelectionState | ((prev: RowSelectionState) => RowSelectionState)) => {
      setRowSelection(prev => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (onSelectionChanged) {
          onSelectionChanged(new Set(Object.keys(next).filter(k => next[k])));
        }
        return next;
      });
    },
    [onSelectionChanged],
  );

  // ── Column definitions ─────────────────────────────────────────────────
  const tanStackColumns = useMemo<TanStackColumnDef<Record<string, unknown>>[]>(() => {
    const cols: TanStackColumnDef<Record<string, unknown>>[] = [];

    // Checkbox column for document mode
    if (isDocument) {
      cols.push({
        id: '_select',
        header: ({ table }) => (
          <input
            type="checkbox"
            className="accent-nesma-secondary"
            checked={table.getIsAllRowsSelected()}
            onChange={table.getToggleAllRowsSelectedHandler()}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="accent-nesma-secondary"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
          />
        ),
        size: 40,
        minSize: 40,
        maxSize: 40,
        enableSorting: false,
        enableResizing: false,
      });
    }

    for (const col of columns) {
      const isStatus = isStatusColumn(col);
      const isCurrency = isCurrencyColumn(col);

      cols.push({
        id: col.key,
        accessorFn: row => getNestedValue(row, col.key),
        header: col.label,
        size: col.key === 'id' ? 150 : isStatus ? 120 : isCurrency ? 130 : undefined,
        minSize: col.key === 'id' ? 130 : 80,
        maxSize: col.key === 'id' ? 180 : undefined,
        cell: info => {
          const value = info.getValue();
          if (isStatus) {
            if (col.component) return col.component(value);
            if (!value) return <span className="text-gray-400">-</span>;
            return <StatusBadge status={value as string} />;
          }
          if (isCurrency) {
            if (value == null) return <span className="text-gray-400">-</span>;
            return <span>{Number(value).toLocaleString()} SAR</span>;
          }
          if (col.component) return col.component(value);
          if (col.format && value != null) return <span>{col.format(value)}</span>;
          return <span>{value != null ? String(value) : '-'}</span>;
        },
      });
    }

    return cols;
  }, [columns, isDocument]);

  // ── Table instance ─────────────────────────────────────────────────────
  const table = useReactTable({
    data: rowData,
    columns: tanStackColumns,
    state: { sorting, columnSizing, columnVisibility, rowSelection },
    onSortingChange: updater => {
      setSorting(prev => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (onSortChanged && next.length > 0) {
          onSortChanged(next[0].id, next[0].desc ? 'desc' : 'asc');
        }
        return next;
      });
    },
    onColumnSizingChange: setColumnSizing,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: handleRowSelectionChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: row => row.id as string,
    enableRowSelection: isDocument,
    columnResizeMode: 'onChange',
  });

  // ── Column state persistence (debounced) ───────────────────────────────
  const columnStateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!onColumnStateChanged) return;
    if (columnStateTimerRef.current) clearTimeout(columnStateTimerRef.current);
    columnStateTimerRef.current = setTimeout(() => {
      const state: ColumnState[] = table
        .getAllColumns()
        .filter(c => c.id !== '_select')
        .map((c, i) => ({
          colId: c.id,
          width: c.getSize(),
          visible: c.getIsVisible(),
          sort: sorting.find(s => s.id === c.id)
            ? sorting.find(s => s.id === c.id)!.desc
              ? ('desc' as const)
              : ('asc' as const)
            : null,
          sortIndex: sorting.findIndex(s => s.id === c.id) >= 0 ? sorting.findIndex(s => s.id === c.id) : undefined,
        }));
      onColumnStateChanged(state);
    }, 500);

    return () => {
      if (columnStateTimerRef.current) clearTimeout(columnStateTimerRef.current);
    };
  }, [sorting, columnSizing, columnVisibility, onColumnStateChanged, table]);

  // ── Loading state ──────────────────────────────────────────────────────
  if (loading && rowData.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-nesma-secondary border-t-transparent" />
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────
  if (rowData.length === 0) {
    return <EmptyState />;
  }

  // ── Render ─────────────────────────────────────────────────────────────
  const maxHeight = suppressPagination ? undefined : Math.min(600, 56 + rowData.length * 42);

  return (
    <div className="w-full overflow-auto" style={{ maxHeight }}>
      <table className="w-full border-collapse">
        <thead className="sticky top-0 z-10">
          {table.getHeaderGroups().map(headerGroup => (
            <tr key={headerGroup.id} className="bg-white/[0.03]">
              {headerGroup.headers.map(header => {
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();
                return (
                  <th
                    key={header.id}
                    className={`px-3 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider select-none whitespace-nowrap ${
                      canSort ? 'cursor-pointer hover:text-gray-300' : ''
                    }`}
                    style={{ width: header.getSize() }}
                    onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {sorted === 'asc' && <ChevronUp size={12} className="text-nesma-secondary" />}
                      {sorted === 'desc' && <ChevronDown size={12} className="text-nesma-secondary" />}
                    </div>
                    {/* Resize handle */}
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className="absolute right-0 top-0 h-full w-1 cursor-col-resize select-none touch-none opacity-0 hover:opacity-100 bg-nesma-secondary/40"
                        style={{ transform: 'translateX(50%)' }}
                      />
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => (
            <tr
              key={row.id}
              className={`border-b border-white/[0.05] transition-colors duration-150 ${
                row.getIsSelected() ? 'bg-[rgba(217,175,123,0.08)]' : 'hover:bg-white/[0.04]'
              } ${onRowClicked ? 'cursor-pointer' : ''}`}
              onClick={() => onRowClicked?.(row.original)}
            >
              {row.getVisibleCells().map(cell => (
                <td
                  key={cell.id}
                  className="px-3 py-2.5 text-[13px] text-gray-300 whitespace-nowrap"
                  style={{ width: cell.column.getSize() }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
