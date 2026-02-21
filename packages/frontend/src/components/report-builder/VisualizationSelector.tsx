import React from 'react';
import { Table2, BarChart3, TrendingUp, PieChart } from 'lucide-react';

const VIZ_OPTIONS = [
  { value: 'table' as const, label: 'Table', icon: Table2 },
  { value: 'bar' as const, label: 'Bar Chart', icon: BarChart3 },
  { value: 'line' as const, label: 'Line Chart', icon: TrendingUp },
  { value: 'pie' as const, label: 'Pie Chart', icon: PieChart },
];

interface VisualizationSelectorProps {
  value: 'table' | 'bar' | 'line' | 'pie';
  onChange: (value: 'table' | 'bar' | 'line' | 'pie') => void;
}

export const VisualizationSelector: React.FC<VisualizationSelectorProps> = ({ value, onChange }) => {
  return (
    <div>
      <label className="block text-sm text-gray-400 mb-1.5">Visualization</label>
      <div className="grid grid-cols-2 gap-2">
        {VIZ_OPTIONS.map(opt => {
          const Icon = opt.icon;
          const isSelected = value === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all
                ${
                  isSelected
                    ? 'bg-nesma-primary/40 border-nesma-secondary/40 text-white'
                    : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
                }`}
            >
              <Icon size={16} />
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};
