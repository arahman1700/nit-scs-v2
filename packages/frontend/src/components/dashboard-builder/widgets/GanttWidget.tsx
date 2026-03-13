import React, { useMemo } from 'react';
import { useWidgetData } from '@/domains/reporting/hooks/useWidgetData';
import type { DashboardWidget } from '@/domains/reporting/hooks/useDashboards';

interface GanttTask {
  name: string;
  start: string;
  end: string;
  progress?: number;
  color?: string;
}

interface GanttData {
  tasks: GanttTask[];
}

interface GanttWidgetProps {
  widget: DashboardWidget;
}

const DEFAULT_COLORS = ['#80D1E9', '#2E3A8C', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

const ROW_HEIGHT = 28;
const ROW_GAP = 4;
const LABEL_WIDTH = 120;
const AXIS_HEIGHT = 24;
const PADDING_TOP = 8;

export const GanttWidget: React.FC<GanttWidgetProps> = ({ widget }) => {
  const { data, isLoading } = useWidgetData(widget.dataSource);

  const parsed = useMemo(() => {
    const result = data?.data as GanttData | undefined;
    const tasks = result?.tasks ?? [];
    if (tasks.length === 0) return null;

    const dates = tasks.flatMap(t => [new Date(t.start).getTime(), new Date(t.end).getTime()]);
    const minTime = Math.min(...dates);
    const maxTime = Math.max(...dates);
    const range = maxTime - minTime || 1;

    // Build month markers
    const months: { label: string; x: number }[] = [];
    const startDate = new Date(minTime);
    startDate.setDate(1);
    const endDate = new Date(maxTime);
    let cursor = new Date(startDate);
    while (cursor <= endDate) {
      const t = cursor.getTime();
      const x = ((t - minTime) / range) * 100;
      months.push({
        label: cursor.toLocaleString('default', { month: 'short', year: '2-digit' }),
        x: Math.max(0, Math.min(100, x)),
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }

    return { tasks, minTime, range, months };
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 h-full animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-6 bg-white/5 rounded" />
        ))}
      </div>
    );
  }

  if (!parsed) {
    return <div className="flex items-center justify-center h-full text-gray-400 text-sm">No tasks to display</div>;
  }

  const { tasks, minTime, range, months } = parsed;
  const chartHeight = PADDING_TOP + tasks.length * (ROW_HEIGHT + ROW_GAP) + AXIS_HEIGHT;

  return (
    <div className="w-full h-full overflow-auto">
      <svg width="100%" viewBox={`0 0 600 ${chartHeight}`} className="text-gray-300">
        {/* Month axis */}
        {months.map((m, i) => {
          const x = LABEL_WIDTH + (m.x / 100) * (600 - LABEL_WIDTH);
          return (
            <g key={i}>
              <line
                x1={x}
                y1={PADDING_TOP}
                x2={x}
                y2={chartHeight - AXIS_HEIGHT}
                stroke="rgba(255,255,255,0.07)"
                strokeDasharray="4 4"
              />
              <text x={x + 4} y={chartHeight - 6} fill="#9ca3af" fontSize="9" fontFamily="Inter, system-ui, sans-serif">
                {m.label}
              </text>
            </g>
          );
        })}

        {/* Task bars */}
        {tasks.map((task, i) => {
          const startTime = new Date(task.start).getTime();
          const endTime = new Date(task.end).getTime();
          const xStart = ((startTime - minTime) / range) * (600 - LABEL_WIDTH);
          const xEnd = ((endTime - minTime) / range) * (600 - LABEL_WIDTH);
          const barWidth = Math.max(xEnd - xStart, 4);
          const y = PADDING_TOP + i * (ROW_HEIGHT + ROW_GAP);
          const barColor = task.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length];
          const progress = task.progress ?? 0;

          return (
            <g key={i}>
              {/* Label */}
              <text
                x={4}
                y={y + ROW_HEIGHT / 2 + 4}
                fill="#d1d5db"
                fontSize="11"
                fontFamily="Inter, system-ui, sans-serif"
              >
                {task.name.length > 16 ? task.name.slice(0, 15) + '\u2026' : task.name}
              </text>

              {/* Background bar */}
              <rect
                x={LABEL_WIDTH + xStart}
                y={y + 4}
                width={barWidth}
                height={ROW_HEIGHT - 8}
                rx={4}
                fill={barColor}
                opacity={0.35}
              />

              {/* Progress overlay */}
              {progress > 0 && (
                <rect
                  x={LABEL_WIDTH + xStart}
                  y={y + 4}
                  width={barWidth * Math.min(progress, 1)}
                  height={ROW_HEIGHT - 8}
                  rx={4}
                  fill={barColor}
                  opacity={0.9}
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
};
