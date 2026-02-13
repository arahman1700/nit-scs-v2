import React, { useMemo, useCallback, useRef, useEffect } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type {
  ColDef,
  GridReadyEvent,
  SortChangedEvent,
  CellValueChangedEvent,
  GridApi,
  ColumnState,
} from 'ag-grid-community';
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import { EmptyState } from '@/components/EmptyState';
import type { ColumnDef } from '@/config/resourceColumns';
import { mapColumnsToAgGrid } from './useGridColumns';

ModuleRegistry.registerModules([AllCommunityModule]);

const darkTheme = themeQuartz.withParams({
  backgroundColor: 'transparent',
  foregroundColor: '#d1d5db',
  headerBackgroundColor: 'rgba(255,255,255,0.03)',
  headerTextColor: '#9ca3af',
  headerFontSize: 11,
  headerFontWeight: 600,
  rowHoverColor: 'rgba(255,255,255,0.04)',
  borderColor: 'rgba(255,255,255,0.05)',
  selectedRowBackgroundColor: 'rgba(217,175,123,0.08)',
  cellTextColor: '#d1d5db',
  oddRowBackgroundColor: 'transparent',
  fontSize: 13,
  rowBorder: true,
  wrapperBorder: false,
  columnBorder: false,
  spacing: 6,
});

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

export const SmartGrid: React.FC<SmartGridProps> = ({
  columns,
  rowData,
  loading,
  onSortChanged,
  onRowClicked,
  isDocument,
  selectedIds,
  onSelectionChanged,
  onCellValueChanged,
  suppressPagination,
  initialColumnState,
  onColumnStateChanged,
}) => {
  const gridRef = useRef<GridApi | null>(null);

  const agColumns = useMemo(() => mapColumnsToAgGrid(columns), [columns]);

  const defaultColDef = useMemo<ColDef>(
    () => ({
      sortable: true,
      resizable: true,
      suppressMovable: false,
      minWidth: 80,
    }),
    [],
  );

  const onGridReady = useCallback(
    (params: GridReadyEvent) => {
      gridRef.current = params.api;
      if (initialColumnState && initialColumnState.length > 0) {
        params.api.applyColumnState({ state: initialColumnState, applyOrder: true });
      }
      params.api.sizeColumnsToFit();
    },
    [initialColumnState],
  );

  const columnStateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleColumnStateChanged = useCallback(() => {
    if (!onColumnStateChanged || !gridRef.current) return;
    // Debounce to avoid excessive saves during resize dragging
    if (columnStateTimerRef.current) clearTimeout(columnStateTimerRef.current);
    columnStateTimerRef.current = setTimeout(() => {
      if (gridRef.current) {
        onColumnStateChanged(gridRef.current.getColumnState());
      }
    }, 500);
  }, [onColumnStateChanged]);

  useEffect(() => {
    return () => {
      if (columnStateTimerRef.current) clearTimeout(columnStateTimerRef.current);
    };
  }, []);

  const handleSortChanged = useCallback(
    (event: SortChangedEvent) => {
      if (!onSortChanged) return;
      const sortModel = event.api.getColumnState().filter(c => c.sort);
      if (sortModel.length > 0) {
        const first = sortModel[0];
        onSortChanged(first.colId, first.sort as 'asc' | 'desc');
      }
    },
    [onSortChanged],
  );

  const handleCellValueChanged = useCallback(
    (event: CellValueChangedEvent) => {
      if (!onCellValueChanged) return;
      const rowId = event.data?.id as string;
      if (rowId && event.colDef.field) {
        onCellValueChanged(rowId, event.colDef.field, event.newValue);
      }
    },
    [onCellValueChanged],
  );

  const handleRowClicked = useCallback(
    (event: { data: Record<string, unknown> }) => {
      if (onRowClicked && event.data) {
        onRowClicked(event.data);
      }
    },
    [onRowClicked],
  );

  const noRowsOverlay = useMemo(() => () => <EmptyState />, []);

  if (loading && rowData.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-nesma-secondary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height: rowData.length === 0 ? 200 : Math.min(600, 56 + rowData.length * 42) }}>
      <AgGridReact
        theme={darkTheme}
        columnDefs={agColumns}
        rowData={rowData}
        defaultColDef={defaultColDef}
        enableRtl={false}
        animateRows={false}
        rowSelection={isDocument ? 'multiple' : undefined}
        suppressRowClickSelection
        onGridReady={onGridReady}
        onSortChanged={handleSortChanged}
        onCellValueChanged={handleCellValueChanged}
        onRowClicked={handleRowClicked}
        onColumnResized={handleColumnStateChanged}
        onColumnMoved={handleColumnStateChanged}
        onColumnVisible={handleColumnStateChanged}
        noRowsOverlayComponent={noRowsOverlay}
        loading={loading}
        getRowId={params => params.data.id as string}
        domLayout={suppressPagination ? 'autoHeight' : 'normal'}
      />
    </div>
  );
};
