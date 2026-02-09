import React from 'react';
import { useWidgetData } from '@/api/hooks/useWidgetData';
import type { DashboardWidget } from '@/api/hooks/useDashboards';

interface StatusCountWidgetProps {
  widget: DashboardWidget;
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#6b7280',
  pending: '#f59e0b',
  submitted: '#3b82f6',
  approved: '#10b981',
  in_progress: '#8b5cf6',
  completed: '#10b981',
  cancelled: '#ef4444',
  rejected: '#ef4444',
  received: '#06b6d4',
  issued: '#14b8a6',
  on_hold: '#f97316',
};

export const StatusCountWidget: React.FC<StatusCountWidgetProps> = ({ widget }) => {
  const { data, isLoading } = useWidgetData(widget.dataSource);

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-6 bg-white/5 rounded" />
        ))}
      </div>
    );
  }

  const items = (data?.data as { name: string; value: number }[] | undefined) ?? [];

  if (items.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-500 text-sm">No data available</div>;
  }

  const total = items.reduce((sum, item) => sum + (item.value || 0), 0);

  return (
    <div className="space-y-3 overflow-y-auto max-h-full">
      {items.map((item, i) => {
        const pct = total > 0 ? (item.value / total) * 100 : 0;
        const statusKey = item.name?.toLowerCase().replace(/\s+/g, '_') ?? '';
        const color = STATUS_COLORS[statusKey] || '#6b7280';

        return (
          <div key={i} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-300 capitalize">{item.name?.replace(/_/g, ' ')}</span>
              <span className="text-gray-400 font-medium">{item.value}</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
