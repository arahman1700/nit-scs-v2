import React from 'react';
import { useWidgetData } from '@/api/hooks/useWidgetData';
import type { DashboardWidget } from '@/api/hooks/useDashboards';

interface KpiWidgetProps {
  widget: DashboardWidget;
}

const COLOR_MAP: Record<string, string> = {
  emerald: 'text-emerald-400',
  blue: 'text-blue-400',
  amber: 'text-amber-400',
  red: 'text-red-400',
  purple: 'text-purple-400',
};

export const KpiWidget: React.FC<KpiWidgetProps> = ({ widget }) => {
  const { data, isLoading } = useWidgetData(widget.dataSource);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full animate-pulse">
        <div className="h-10 w-24 bg-white/10 rounded mb-2" />
        <div className="h-4 w-16 bg-white/5 rounded" />
      </div>
    );
  }

  const result = data?.data as { value?: number; label?: string; trend?: string } | undefined;
  const value = result?.value ?? 0;
  const label = result?.label ?? widget.title;
  const colorKey = (widget.displayConfig?.color as string) || 'blue';
  const colorClass = COLOR_MAP[colorKey] || 'text-blue-400';

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <span className={`text-4xl font-bold ${colorClass}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      <span className="text-sm text-gray-400 mt-1">{label}</span>
      {result?.trend && <span className="text-xs text-gray-500 mt-1">{result.trend}</span>}
    </div>
  );
};
