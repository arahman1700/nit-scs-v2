import React, { memo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

export interface KpiCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string; // tailwind bg class e.g. 'bg-emerald-500'
  sublabel?: string;
  trend?: { value: string; up: boolean } | null;
  alert?: boolean; // red glow when true
  onClick?: () => void;
  loading?: boolean;
}

export const KpiCard: React.FC<KpiCardProps> = memo(
  ({ title, value, icon: Icon, color, sublabel, trend, alert, onClick, loading }) => {
    if (loading) {
      return (
        <div className="glass-card p-6 rounded-xl animate-pulse">
          <div className="flex items-start justify-between">
            <div className="space-y-3">
              <div className="h-8 w-16 bg-white/10 rounded" />
              <div className="h-4 w-28 bg-white/5 rounded" />
            </div>
            <div className="w-14 h-14 bg-white/10 rounded-xl" />
          </div>
        </div>
      );
    }

    return (
      <div
        onClick={onClick}
        className={`glass-card p-6 rounded-xl flex items-start justify-between transition-all duration-300 group
        ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''}
        ${alert ? 'border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.15)]' : 'hover:border-nesma-secondary/30'}
      `}
      >
        <div className="min-w-0">
          <h3 className="text-3xl font-bold text-white mb-1 group-hover:text-nesma-secondary transition-colors">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </h3>
          <p className="text-gray-400 text-sm font-medium">{title}</p>
          {sublabel && (
            <span className="text-[10px] px-2 py-0.5 rounded-full mt-3 inline-block bg-white/10 border border-white/10 text-gray-300">
              {sublabel}
            </span>
          )}
          {trend && (
            <div
              className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend.up ? 'text-emerald-400' : 'text-red-400'}`}
            >
              {trend.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {trend.value}
            </div>
          )}
        </div>
        <div
          className={`p-4 rounded-xl ${color} text-white shadow-lg group-hover:scale-110 transition-transform duration-300 flex-shrink-0`}
        >
          <Icon size={24} />
        </div>
      </div>
    );
  },
);
