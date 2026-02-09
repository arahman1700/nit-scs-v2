import React from 'react';
import { useWidgetData } from '@/api/hooks/useWidgetData';
import type { DashboardWidget } from '@/api/hooks/useDashboards';

interface ActivityWidgetProps {
  widget: DashboardWidget;
}

interface ActivityItem {
  action?: string;
  entity?: string;
  user?: string;
  timestamp?: string;
}

const ACTION_COLORS: Record<string, string> = {
  created: 'bg-emerald-500',
  updated: 'bg-blue-500',
  approved: 'bg-green-500',
  rejected: 'bg-red-500',
  deleted: 'bg-red-500',
  submitted: 'bg-amber-500',
};

export const ActivityWidget: React.FC<ActivityWidgetProps> = ({ widget }) => {
  const { data, isLoading } = useWidgetData(widget.dataSource || 'table/recent_activity');

  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="w-2 h-2 rounded-full bg-white/10 mt-2" />
            <div className="flex-1 space-y-1">
              <div className="h-4 w-3/4 bg-white/5 rounded" />
              <div className="h-3 w-1/2 bg-white/5 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const items = (data?.data as ActivityItem[] | undefined) ?? [];

  if (items.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-500 text-sm">No recent activity</div>;
  }

  return (
    <div className="space-y-3 overflow-y-auto max-h-full">
      {items.slice(0, 8).map((item, i) => {
        const action = item.action?.toLowerCase() ?? '';
        const dotColor = ACTION_COLORS[action] || 'bg-gray-500';

        return (
          <div key={i} className="flex gap-3">
            <div className={`w-2 h-2 rounded-full ${dotColor} mt-1.5 flex-shrink-0`} />
            <div className="min-w-0">
              <p className="text-sm text-gray-200 truncate">
                <span className="text-white font-medium">{item.user || 'System'}</span> {item.action} {item.entity}
              </p>
              {item.timestamp && (
                <p className="text-xs text-gray-500 mt-0.5">{new Date(item.timestamp).toLocaleString()}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
