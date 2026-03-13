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
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
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

export interface ServerPaginationProps {
  /** Total number of records on the server */
  total: number;
  /** Current 1-based page number */
  page: number;
  /** Number of rows per page */
  pageSize: number;
  /** Called when the user changes pages */
  onPageChange: (page: number) => void;
  /** Called when the user changes page size */
  onPageSizeChange: (pageSize: number) => void;
  /** Called when the user sorts a column (server-side sort) */
  onSortChange?: (sortBy: string, sortDir: 'asc' | 'desc') => void;
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
  /** When provided, enables server-side pagination mode */
  serverPagination?: ServerPaginationProps;
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

// Threshold above which virtual scrolling is activated
const VIRTUAL_SCROLL_THRESHOLD = 500;
// Estimated row height in pixels (matches py-2.5 + text-[13px])
const ROW_HEIGHT_ESTIMATE = 42;
// Fixed height for the virtual scroll container
const VIRTUAL_CONTAINER_HEIGHT = 600;

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
  serverPagination,
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
        // Disable client-side sorting when server pagination is active
        enableSorting: !serverPagination,
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
  }, [columns, isDocument, serverPagination]);

  // ── Table instance ─────────────────────────────────────────────────────
  const table = useReactTable({
    data: rowData,
    columns: tanStackColumns,
    state: { sorting, columnSizing, columnVisibility, rowSelection },
    onSortingChange: updater => {
      setSorting(prev => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (serverPagination?.onSortChange && next.length > 0) {
          serverPagination.onSortChange(next[0].id, next[0].desc ? 'desc' : 'asc');
        } else if (onSortChanged && next.length > 0) {
          onSortChanged(next[0].id, next[0].desc ? 'desc' : 'asc');
        }
        return next;
      });
    },
    onColumnSizingChange: setColumnSizing,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: handleRowSelectionChange,
    getCoreRowModel: getCoreRowModel(),
    // Only use client-side sort model when not in server pagination mode
    getSortedRowModel: serverPagination ? undefined : getSortedRowModel(),
    getRowId: row => row.id as string,
    enableRowSelection: isDocument,
    columnResizeMode: 'onChange',
    // When server pagination is active, tell TanStack Table the real row count
    ...(serverPagination
      ? {
          manualSorting: true,
          manualPagination: true,
          rowCount: serverPagination.total,
        }
      : {}),
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
        .map((c, _i) => ({
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

  // ── Virtual scrolling setup ────────────────────────────────────────────
  const tableRows = table.getRowModel().rows;
  const useVirtual = tableRows.length > VIRTUAL_SCROLL_THRESHOLD;
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ROW_HEIGHT_ESTIMATE,
    overscan: 10,
    enabled: useVirtual,
  });

  const virtualItems = useVirtual ? virtualizer.getVirtualItems() : null;
  const totalVirtualSize = useVirtual ? virtualizer.getTotalSize() : 0;

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

  // ── Server pagination controls ─────────────────────────────────────────
  const renderServerPagination = () => {
    if (!serverPagination) return null;
    const { total, page, pageSize, onPageChange, onPageSizeChange } = serverPagination;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const to = Math.min(page * pageSize, total);

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-white/10">
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <span>
            {from}–{to} of {total.toLocaleString()} records
          </span>
          <span className="text-gray-600">|</span>
          <label className="flex items-center gap-1.5">
            <span>Rows:</span>
            <select
              value={pageSize}
              onChange={e => onPageSizeChange(Number(e.target.value))}
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-sm focus:outline-none focus:border-nesma-secondary/50"
            >
              {[10, 20, 50, 100].map(size => (
                <option key={size} value={size} className="bg-nesma-dark">
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center gap-1">
          <button
            disabled={page <= 1}
            onClick={() => onPageChange(1)}
            className="px-2 py-1 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="First page"
          >
            «
          </button>
          <button
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>

          {/* Page number pills */}
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum: number;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (page <= 3) {
              pageNum = i + 1;
            } else if (page >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = page - 2 + i;
            }
            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`min-w-[32px] h-8 px-2 rounded-lg text-sm transition-colors ${
                  pageNum === page
                    ? 'bg-nesma-primary text-white font-medium'
                    : 'text-gray-400 hover:text-white hover:bg-white/10'
                }`}
              >
                {pageNum}
              </button>
            );
          })}

          <button
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => onPageChange(totalPages)}
            className="px-2 py-1 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Last page"
          >
            »
          </button>
        </div>
      </div>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────
  const maxHeight = useVirtual
    ? VIRTUAL_CONTAINER_HEIGHT
    : suppressPagination
      ? undefined
      : Math.min(600, 56 + rowData.length * ROW_HEIGHT_ESTIMATE);

  // Header row (shared between both render paths)
  const headerContent = (
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
  );

  // ── Virtual scrolling render path ──────────────────────────────────────
  if (useVirtual && virtualItems) {
    return (
      <div>
        <div ref={scrollContainerRef} className="w-full overflow-auto" style={{ height: VIRTUAL_CONTAINER_HEIGHT }}>
          <table className="w-full border-collapse">
            {headerContent}
            <tbody style={{ height: totalVirtualSize, position: 'relative' }}>
              {virtualItems.map(virtualRow => {
                const row = tableRows[virtualRow.index];
                return (
                  <tr
                    key={row.id}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    className={`border-b border-white/[0.05] transition-colors duration-150 absolute w-full ${
                      row.getIsSelected() ? 'bg-[rgba(217,175,123,0.08)]' : 'hover:bg-white/[0.04]'
                    } ${onRowClicked ? 'cursor-pointer' : ''}`}
                    style={{
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
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
                );
              })}
            </tbody>
          </table>
        </div>
        {renderServerPagination()}
      </div>
    );
  }

  // ── Standard render path ───────────────────────────────────────────────
  return (
    <div>
      <div className="w-full overflow-auto" style={{ maxHeight }}>
        <table className="w-full border-collapse">
          {headerContent}
          <tbody>
            {tableRows.map(row => (
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
      {renderServerPagination()}
    </div>
  );
};
