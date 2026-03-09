import React, { memo, useCallback, useState, useRef, useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

// ── Mini Sparkline (pure SVG, no library) ───────────────────────────────────

const Sparkline: React.FC<{ data: number[]; color?: string }> = ({ data, color = '#80D1E9' }) => {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 80;
  const h = 24;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  return (
    <svg width={w} height={h} className="mt-1" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export interface KpiCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string; // tailwind bg class e.g. 'bg-emerald-500'
  sublabel?: string;
  trend?: { value: string; up: boolean } | null;
  sparkline?: number[]; // optional 5-10 data points for mini sparkline
  sparklineColor?: string; // optional sparkline color (default: #80D1E9)
  alert?: boolean; // red glow when true
  onClick?: () => void;
  loading?: boolean;
}

export const KpiCard: React.FC<KpiCardProps> = memo(
  ({ title, value, icon: Icon, color, sublabel, trend, sparkline, sparklineColor, alert, onClick, loading }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [showClickRing, setShowClickRing] = useState(false);
    const cardRef = useRef<HTMLDivElement>(null);

    // Entrance animation: fade-in + slide-up on mount
    useEffect(() => {
      const timer = setTimeout(() => setIsVisible(true), 50);
      return () => clearTimeout(timer);
    }, []);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onClick();
        }
      },
      [onClick],
    );

    const handleClick = useCallback(() => {
      if (!onClick) return;
      setShowClickRing(true);
      setTimeout(() => setShowClickRing(false), 400);
      onClick();
    }, [onClick]);

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
        ref={cardRef}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label={onClick ? `${title}: ${typeof value === 'number' ? value.toLocaleString() : value}` : undefined}
        className={`glass-card p-6 rounded-xl flex items-start justify-between transition-all duration-300 group
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
        ${onClick ? 'cursor-pointer hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-nesma-secondary focus-visible:outline-none' : ''}
        ${alert ? 'border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.15)]' : 'hover:border-nesma-secondary/30'}
        ${showClickRing ? 'ring-2 ring-nesma-secondary/50 ring-offset-0' : ''}
      `}
      >
        <div className="min-w-0">
          <h3 className="text-3xl font-bold text-white mb-1 group-hover:text-nesma-secondary transition-colors">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </h3>
          <p className="text-gray-400 text-sm font-medium">{title}</p>
          {sparkline && sparkline.length >= 2 && <Sparkline data={sparkline} color={sparklineColor} />}
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
