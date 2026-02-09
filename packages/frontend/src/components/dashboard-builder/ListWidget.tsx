import React from 'react';
import { useWidgetData } from '@/api/hooks/useWidgetData';
import type { DashboardWidget } from '@/api/hooks/useDashboards';

interface ListWidgetProps {
  widget: DashboardWidget;
}

export const ListWidget: React.FC<ListWidgetProps> = ({ widget }) => {
  const { data, isLoading } = useWidgetData(widget.dataSource);

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-6 bg-white/5 rounded" />
        ))}
      </div>
    );
  }

  const items = (data?.data as Record<string, unknown>[] | undefined) ?? [];

  if (items.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-500 text-sm">No items</div>;
  }

  // Use first two keys as primary label + secondary
  const keys = Object.keys(items[0]);
  const primaryKey = keys[0] || 'name';
  const secondaryKey = keys[1];

  return (
    <ul className="space-y-1 overflow-y-auto max-h-full">
      {items.slice(0, 10).map((item, i) => (
        <li
          key={i}
          className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 transition-colors"
        >
          <span className="text-sm text-gray-200 truncate">{String(item[primaryKey] ?? '')}</span>
          {secondaryKey && (
            <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{String(item[secondaryKey] ?? '')}</span>
          )}
        </li>
      ))}
    </ul>
  );
};
