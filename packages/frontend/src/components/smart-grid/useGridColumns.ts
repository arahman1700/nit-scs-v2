import type { ColDef } from 'ag-grid-community';
import type { ColumnDef } from '@/config/resourceColumns';
import { StatusCellRenderer } from './renderers/StatusCellRenderer';
import { CurrencyCellRenderer } from './renderers/CurrencyCellRenderer';

/**
 * Maps the app's ColumnDef[] to AG Grid ColDef[].
 * Detects column type from format/component functions and
 * applies appropriate renderers.
 */
export function mapColumnsToAgGrid(columns: ColumnDef[]): ColDef[] {
  return columns.map(col => {
    const agCol: ColDef = {
      field: col.key,
      headerName: col.label,
      flex: 1,
      minWidth: 100,
    };

    // Map component-based columns to cell renderers
    if (col.component) {
      const fnName = col.component.name || col.component.toString();
      if (
        fnName.includes('statusCol') ||
        fnName.includes('StatusBadge') ||
        col.key === 'status' ||
        col.key === 'stockStatus'
      ) {
        agCol.cellRenderer = StatusCellRenderer;
        agCol.minWidth = 120;
      } else if (fnName.includes('slaCol') || col.key === 'slaStatus') {
        agCol.cellRenderer = StatusCellRenderer;
        agCol.minWidth = 100;
      } else {
        // Generic component renderer — use valueFormatter fallback
        agCol.cellRenderer = (params: { value: unknown }) => {
          if (col.component) return col.component(params.value);
          return params.value;
        };
      }
    }

    // Map format functions to value formatters
    if (col.format) {
      const fnName = col.format.name || col.format.toString();
      if (fnName.includes('sarFormat') || col.key === 'value') {
        agCol.cellRenderer = CurrencyCellRenderer;
        agCol.type = 'numericColumn';
        agCol.minWidth = 130;
      } else {
        agCol.valueFormatter = params => {
          if (col.format && params.value != null) return col.format(params.value);
          return params.value ?? '-';
        };
      }
    }

    // Default display for empty values
    if (!col.component && !col.format) {
      agCol.valueFormatter = params => params.value ?? '-';
    }

    // Column-specific sizing
    if (col.key === 'id') {
      agCol.minWidth = 130;
      agCol.maxWidth = 180;
    }

    return agCol;
  });
}
