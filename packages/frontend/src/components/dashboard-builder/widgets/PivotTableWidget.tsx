import React, { useMemo } from 'react';
import { useWidgetData } from '@/domains/reporting/hooks/useWidgetData';
import type { DashboardWidget } from '@/domains/reporting/hooks/useDashboards';

interface PivotData {
  rows: Record<string, unknown>[];
  columns: string[];
  groupBy?: string;
}

interface PivotTableWidgetProps {
  widget: DashboardWidget;
}

function formatCellValue(val: unknown): string {
  if (val === null || val === undefined) return '\u2014';
  if (typeof val === 'number') return val.toLocaleString();
  return String(val);
}

function isNumeric(val: unknown): val is number {
  return typeof val === 'number' && !isNaN(val);
}

export const PivotTableWidget: React.FC<PivotTableWidgetProps> = ({ widget }) => {
  const { data, isLoading } = useWidgetData(widget.dataSource);

  const tableData = useMemo(() => {
    const result = data?.data as PivotData | undefined;
    if (!result?.rows?.length || !result?.columns?.length) return null;

    const { rows, columns, groupBy } = result;

    if (!groupBy) {
      return { groups: [{ key: null, rows, subtotals: null }], columns };
    }

    // Group rows
    const groupMap = new Map<string, Record<string, unknown>[]>();
    for (const row of rows) {
      const key = String(row[groupBy] ?? 'Other');
      const list = groupMap.get(key) ?? [];
      list.push(row);
      groupMap.set(key, list);
    }

    // Compute subtotals for numeric columns
    const groups = Array.from(groupMap.entries()).map(([key, groupRows]) => {
      const subtotals: Record<string, number> = {};
      for (const col of columns) {
        if (col === groupBy) continue;
        const numericValues = groupRows.map(r => r[col]).filter(isNumeric);
        if (numericValues.length > 0) {
          subtotals[col] = numericValues.reduce((sum, v) => sum + v, 0);
        }
      }
      return { key, rows: groupRows, subtotals };
    });

    return { groups, columns };
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 h-full animate-pulse">
        <div className="h-8 bg-white/10 rounded" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-6 bg-white/5 rounded" />
        ))}
      </div>
    );
  }

  if (!tableData) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">No data available</div>;
  }

  const { groups, columns } = tableData;

  return (
    <div className="w-full h-full overflow-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            {columns.map(col => (
              <th
                key={col}
                className="text-left px-3 py-2 text-gray-400 font-medium text-xs uppercase tracking-wider border-b border-white/10"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group, gi) => (
            <React.Fragment key={gi}>
              {/* Group header */}
              {group.key !== null && (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-3 py-2 text-xs font-semibold text-nesma-secondary bg-white/5 border-b border-white/5"
                  >
                    {group.key}
                  </td>
                </tr>
              )}

              {/* Data rows */}
              {group.rows.map((row, ri) => (
                <tr
                  key={ri}
                  className={`border-b border-white/5 ${ri % 2 === 1 ? 'bg-white/5' : ''} hover:bg-white/10 transition-colors`}
                >
                  {columns.map(col => (
                    <td key={col} className="px-3 py-1.5 text-gray-300 whitespace-nowrap">
                      {formatCellValue(row[col])}
                    </td>
                  ))}
                </tr>
              ))}

              {/* Subtotals row */}
              {group.subtotals && Object.keys(group.subtotals).length > 0 && (
                <tr className="bg-white/10 border-b border-white/10">
                  {columns.map(col => (
                    <td key={col} className="px-3 py-1.5 text-white font-medium whitespace-nowrap">
                      {group.subtotals && col in group.subtotals
                        ? group.subtotals[col].toLocaleString()
                        : col === columns[0]
                          ? 'Subtotal'
                          : ''}
                    </td>
                  ))}
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};
