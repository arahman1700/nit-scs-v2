import React from 'react';
import { BarChart3, Hash, Table2, List, Activity, PieChart } from 'lucide-react';

export interface WidgetTypeDefinition {
  type: string;
  label: string;
  icon: React.ElementType;
  defaultWidth: number;
  defaultHeight: number;
}

export const WIDGET_TYPES: WidgetTypeDefinition[] = [
  { type: 'kpi', label: 'KPI Card', icon: Hash, defaultWidth: 1, defaultHeight: 1 },
  { type: 'chart', label: 'Chart', icon: BarChart3, defaultWidth: 2, defaultHeight: 1 },
  { type: 'table', label: 'Data Table', icon: Table2, defaultWidth: 2, defaultHeight: 1 },
  { type: 'list', label: 'List', icon: List, defaultWidth: 1, defaultHeight: 1 },
  { type: 'activity', label: 'Activity Feed', icon: Activity, defaultWidth: 1, defaultHeight: 1 },
  { type: 'status_counts', label: 'Status Counts', icon: PieChart, defaultWidth: 1, defaultHeight: 1 },
];

interface WidgetPaletteProps {
  onAddWidget: (widgetType: WidgetTypeDefinition) => void;
}

export const WidgetPalette: React.FC<WidgetPaletteProps> = ({ onAddWidget }) => {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1 mb-3">Add Widget</h3>
      {WIDGET_TYPES.map(wt => {
        const Icon = wt.icon;
        return (
          <button
            key={wt.type}
            onClick={() => onAddWidget(wt)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
              bg-white/5 border border-white/5 hover:border-nesma-secondary/30
              hover:bg-white/10 transition-all text-left group"
          >
            <div className="p-2 rounded-lg bg-nesma-primary/30 text-nesma-secondary group-hover:bg-nesma-primary/50 transition-colors">
              <Icon size={16} />
            </div>
            <span className="text-sm text-gray-300 group-hover:text-white transition-colors">{wt.label}</span>
          </button>
        );
      })}
    </div>
  );
};
