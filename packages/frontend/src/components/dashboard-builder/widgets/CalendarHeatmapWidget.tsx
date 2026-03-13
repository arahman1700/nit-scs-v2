import React, { useMemo, useState } from 'react';
import { useWidgetData } from '@/domains/reporting/hooks/useWidgetData';
import type { DashboardWidget } from '@/domains/reporting/hooks/useDashboards';

interface HeatmapDay {
  date: string;
  count: number;
}

interface HeatmapData {
  days: HeatmapDay[];
  maxCount: number;
}

interface CalendarHeatmapWidgetProps {
  widget: DashboardWidget;
}

const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''];
const CELL_SIZE = 12;
const CELL_GAP = 2;
const LABEL_WIDTH = 28;
const HEADER_HEIGHT = 16;

function getIntensityClass(count: number, max: number): string {
  if (count === 0 || max === 0) return 'fill-white/5';
  const ratio = count / max;
  if (ratio <= 0.25) return 'fill-nesma-secondary/25';
  if (ratio <= 0.5) return 'fill-nesma-secondary/50';
  if (ratio <= 0.75) return 'fill-nesma-secondary/75';
  return 'fill-nesma-secondary';
}

export const CalendarHeatmapWidget: React.FC<CalendarHeatmapWidgetProps> = ({ widget }) => {
  const { data, isLoading } = useWidgetData(widget.dataSource);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; date: string; count: number } | null>(null);

  const grid = useMemo(() => {
    const result = data?.data as HeatmapData | undefined;
    const days = result?.days ?? [];
    const maxCount = result?.maxCount ?? 0;
    if (days.length === 0) return null;

    // Build a map of date -> count
    const dateMap = new Map<string, number>();
    days.forEach(d => dateMap.set(d.date, d.count));

    // Sort dates and find range
    const sortedDates = days.map(d => new Date(d.date)).sort((a, b) => a.getTime() - b.getTime());
    const startDate = new Date(sortedDates[0]);
    const endDate = new Date(sortedDates[sortedDates.length - 1]);

    // Adjust start to the previous Monday
    const startDay = startDate.getDay();
    const mondayOffset = startDay === 0 ? -6 : 1 - startDay;
    startDate.setDate(startDate.getDate() + mondayOffset);

    // Build cells
    const cells: { x: number; y: number; date: string; count: number; weekIndex: number }[] = [];
    const monthLabels: { label: string; weekIndex: number }[] = [];
    const cursor = new Date(startDate);
    let weekIndex = 0;
    let lastMonth = -1;

    while (cursor <= endDate) {
      const dayOfWeek = cursor.getDay();
      // Monday=0 row mapping
      const row = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const dateStr = cursor.toISOString().slice(0, 10);

      cells.push({
        x: weekIndex,
        y: row,
        date: dateStr,
        count: dateMap.get(dateStr) ?? 0,
        weekIndex,
      });

      // Track month changes
      const month = cursor.getMonth();
      if (month !== lastMonth) {
        monthLabels.push({
          label: cursor.toLocaleString('default', { month: 'short' }),
          weekIndex,
        });
        lastMonth = month;
      }

      // Advance
      cursor.setDate(cursor.getDate() + 1);
      if (cursor.getDay() === 1) weekIndex++;
    }

    return { cells, monthLabels, maxCount, totalWeeks: weekIndex + 1 };
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full animate-pulse">
        <div className="h-24 w-full bg-white/5 rounded-lg" />
      </div>
    );
  }

  if (!grid) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm">No heatmap data available</div>
    );
  }

  const { cells, monthLabels, maxCount, totalWeeks } = grid;
  const svgWidth = LABEL_WIDTH + totalWeeks * (CELL_SIZE + CELL_GAP) + 4;
  const svgHeight = HEADER_HEIGHT + 7 * (CELL_SIZE + CELL_GAP) + 4;

  return (
    <div className="w-full h-full overflow-auto relative">
      <svg width="100%" viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="text-gray-400">
        {/* Month labels */}
        {monthLabels.map((m, i) => (
          <text
            key={i}
            x={LABEL_WIDTH + m.weekIndex * (CELL_SIZE + CELL_GAP)}
            y={10}
            fill="#9ca3af"
            fontSize="8"
            fontFamily="Inter, system-ui, sans-serif"
          >
            {m.label}
          </text>
        ))}

        {/* Day labels */}
        {DAY_LABELS.map((label, i) =>
          label ? (
            <text
              key={i}
              x={0}
              y={HEADER_HEIGHT + i * (CELL_SIZE + CELL_GAP) + CELL_SIZE - 2}
              fill="#6b7280"
              fontSize="8"
              fontFamily="Inter, system-ui, sans-serif"
            >
              {label}
            </text>
          ) : null,
        )}

        {/* Cells */}
        {cells.map((cell, i) => (
          <rect
            key={i}
            x={LABEL_WIDTH + cell.x * (CELL_SIZE + CELL_GAP)}
            y={HEADER_HEIGHT + cell.y * (CELL_SIZE + CELL_GAP)}
            width={CELL_SIZE}
            height={CELL_SIZE}
            rx={2}
            className={`${getIntensityClass(cell.count, maxCount)} transition-all duration-150 cursor-pointer`}
            onMouseEnter={e => {
              const rect = (e.target as SVGRectElement).getBoundingClientRect();
              const parent = (e.target as SVGRectElement).closest('div')?.getBoundingClientRect();
              if (parent) {
                setTooltip({
                  x: rect.left - parent.left + rect.width / 2,
                  y: rect.top - parent.top - 4,
                  date: cell.date,
                  count: cell.count,
                });
              }
            }}
            onMouseLeave={() => setTooltip(null)}
          />
        ))}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none px-2 py-1 rounded-lg bg-[#0d2137] border border-white/10 text-xs text-white whitespace-nowrap z-10"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          {tooltip.date}: {tooltip.count}
        </div>
      )}
    </div>
  );
};
