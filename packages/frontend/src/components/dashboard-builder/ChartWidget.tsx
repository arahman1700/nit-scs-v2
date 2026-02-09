import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  type PieLabelRenderProps,
} from 'recharts';
import { useWidgetData } from '@/api/hooks/useWidgetData';
import type { DashboardWidget } from '@/api/hooks/useDashboards';

interface ChartWidgetProps {
  widget: DashboardWidget;
}

const CHART_COLORS = ['#80D1E9', '#2E3A8C', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export const ChartWidget: React.FC<ChartWidgetProps> = ({ widget }) => {
  const { data, isLoading } = useWidgetData(widget.dataSource);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full animate-pulse">
        <div className="h-32 w-full bg-white/5 rounded-lg" />
      </div>
    );
  }

  const chartData = (data?.data as Record<string, unknown>[] | undefined) ?? [];
  const chartType = (widget.displayConfig?.chartType as string) || 'bar';

  if (chartData.length === 0) {
    return <div className="flex items-center justify-center h-full text-gray-500 text-sm">No data available</div>;
  }

  // Infer keys from data
  const keys = Object.keys(chartData[0] || {});
  const labelKey = keys[0] || 'name';
  const valueKey = keys[1] || 'value';

  const tooltipStyle = {
    contentStyle: {
      backgroundColor: '#0d2137',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '8px',
      color: '#fff',
      fontSize: '12px',
    },
  };

  if (chartType === 'pie') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey={valueKey}
            nameKey={labelKey}
            cx="50%"
            cy="50%"
            outerRadius="80%"
            strokeWidth={0}
            label={(props: PieLabelRenderProps) =>
              `${props.name ?? ''} ${(((props.percent as number) ?? 0) * 100).toFixed(0)}%`
            }
            labelLine={false}
            fontSize={11}
          >
            {chartData.map((_, index) => (
              <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip {...tooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'line') {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey={labelKey} tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} />
          <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} />
          <Tooltip {...tooltipStyle} />
          <Line type="monotone" dataKey={valueKey} stroke="#80D1E9" strokeWidth={2} dot={{ fill: '#80D1E9', r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // Default: bar chart
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
        <XAxis dataKey={labelKey} tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} />
        <Tooltip {...tooltipStyle} />
        <Bar dataKey={valueKey} fill="#2E3A8C" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
};
