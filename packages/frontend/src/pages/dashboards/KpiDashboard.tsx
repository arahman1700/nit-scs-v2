import React, { useState, useMemo } from 'react';

import {
  BarChart3,
  Package,
  ShoppingCart,
  Truck,
  ShieldCheck,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  LayoutDashboard,
} from 'lucide-react';
import { useKpis } from '@/domains/reporting/hooks/useKpis';
import type { KpiResult, KpiCategory, ComprehensiveKpis } from '@/domains/reporting/hooks/useKpis';

import { toRecord } from '@/utils/type-helpers';

// ── Category Metadata ────────────────────────────────────────────────────────

interface CategoryMeta {
  label: string;
  icon: React.ElementType;
  color: string; // Tailwind bg class for the badge
  textColor: string; // Tailwind text class for the badge
}

const CATEGORY_META: Record<KpiCategory, CategoryMeta> = {
  inventory: {
    label: 'Inventory',
    icon: Package,
    color: 'bg-blue-500/20',
    textColor: 'text-blue-400',
  },
  procurement: {
    label: 'Procurement',
    icon: ShoppingCart,
    color: 'bg-purple-500/20',
    textColor: 'text-purple-400',
  },
  logistics: {
    label: 'Logistics',
    icon: Truck,
    color: 'bg-amber-500/20',
    textColor: 'text-amber-400',
  },
  quality: {
    label: 'Quality',
    icon: ShieldCheck,
    color: 'bg-emerald-500/20',
    textColor: 'text-emerald-400',
  },
  financial: {
    label: 'Financial',
    icon: DollarSign,
    color: 'bg-rose-500/20',
    textColor: 'text-rose-400',
  },
};

const ALL_CATEGORIES: KpiCategory[] = ['inventory', 'procurement', 'logistics', 'quality', 'financial'];

type FilterTab = 'all' | KpiCategory;

// ── Helper: flatten KPIs into a renderable list ──────────────────────────────

interface FlatKpi {
  key: string;
  category: KpiCategory;
  kpi: KpiResult;
}

function flattenKpis(data: ComprehensiveKpis, filter: FilterTab): FlatKpi[] {
  const categories = filter === 'all' ? ALL_CATEGORIES : [filter];
  const result: FlatKpi[] = [];

  for (const cat of categories) {
    const group = data[cat];
    if (!group) continue;
    for (const [key, kpi] of Object.entries(group)) {
      result.push({ key, category: cat, kpi: kpi as KpiResult });
    }
  }

  return result;
}

// ── Skeleton Card ────────────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <div className="glass-card rounded-2xl p-4 animate-pulse">
      <div className="flex items-center justify-between mb-3">
        <div className="h-5 w-20 bg-white/10 rounded-full" />
        <div className="h-4 w-4 bg-white/10 rounded" />
      </div>
      <div className="h-9 w-24 bg-white/10 rounded mb-1" />
      <div className="h-4 w-32 bg-white/5 rounded mb-3" />
      <div className="flex items-center justify-between">
        <div className="h-3 w-16 bg-white/5 rounded" />
        <div className="h-3 w-20 bg-white/5 rounded" />
      </div>
    </div>
  );
}

// ── Trend Indicator ──────────────────────────────────────────────────────────

function TrendIndicator({ trend }: { trend: number }) {
  if (trend > 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400">
        <TrendingUp size={14} />+{trend.toFixed(1)}%
      </span>
    );
  }
  if (trend < 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-400">
        <TrendingDown size={14} />
        {trend.toFixed(1)}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-400">
      <Minus size={14} />
      0%
    </span>
  );
}

// ── Format KPI Value ─────────────────────────────────────────────────────────

function formatValue(value: number, unit: string): string {
  if (unit === 'SAR' || unit === 'sar') {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
    return value.toLocaleString();
  }
  if (unit === '%') {
    return `${value.toFixed(1)}`;
  }
  if (unit === 'days' || unit === 'hours' || unit === 'hrs') {
    return value.toFixed(1);
  }
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return value.toLocaleString();
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

interface KpiDashboardCardProps {
  item: FlatKpi;
}

function KpiDashboardCard({ item }: KpiDashboardCardProps) {
  const { kpi, category } = item;
  const meta = CATEGORY_META[category];

  // Use the trend direction as a proxy for whether the KPI is on track
  const isPositiveTrend = kpi.trend >= 0;

  return (
    <div className="glass-card rounded-2xl p-4 hover:bg-white/10 transition-all duration-300 group">
      {/* Category badge + trend */}
      <div className="flex items-center justify-between mb-3">
        <span
          className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full ${meta.color} ${meta.textColor}`}
        >
          <meta.icon size={12} />
          {meta.label}
        </span>
        <TrendIndicator trend={kpi.trend} />
      </div>

      {/* Value */}
      <div className="flex items-baseline gap-1.5 mb-1">
        <span className="text-3xl font-bold text-white group-hover:text-nesma-secondary transition-colors">
          {formatValue(kpi.value, kpi.unit)}
        </span>
        {kpi.unit && <span className="text-sm font-medium text-gray-400">{kpi.unit}</span>}
      </div>

      {/* Label */}
      <p className="text-sm font-medium text-gray-400 mb-3">{kpi.label}</p>

      {/* Target bar */}
      <div className="flex items-center gap-2">
        <Target size={12} className="text-gray-400 flex-shrink-0" />
        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isPositiveTrend ? 'bg-emerald-500' : 'bg-red-500'
            }`}
            style={{ width: `${Math.min(Math.max(Math.abs(kpi.value), 0), 100)}%` }}
          />
        </div>
        <span className={`text-[10px] font-bold ${isPositiveTrend ? 'text-emerald-400' : 'text-red-400'}`}>
          {isPositiveTrend ? 'On Track' : 'Below Target'}
        </span>
      </div>
    </div>
  );
}

// ── Main Dashboard Component ─────────────────────────────────────────────────

export function KpiDashboard() {
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const query = useKpis();
  const data = toRecord(query.data).data as ComprehensiveKpis | undefined;
  const isLoading = query.isLoading;
  const isError = query.isError;

  const flatKpis = useMemo(() => {
    if (!data) return [];
    return flattenKpis(data, activeTab);
  }, [data, activeTab]);

  // Count KPIs per category for the tab badges
  const categoryCounts = useMemo(() => {
    if (!data) return {} as Record<KpiCategory, number>;
    const counts: Record<string, number> = {};
    for (const cat of ALL_CATEGORIES) {
      const group = data[cat];
      counts[cat] = group ? Object.keys(group).length : 0;
    }
    return counts as Record<KpiCategory, number>;
  }, [data]);

  const totalCount = useMemo(() => Object.values(categoryCounts).reduce((sum, c) => sum + c, 0), [categoryCounts]);

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <BarChart3 size={24} className="text-nesma-secondary" />
            KPI Dashboard
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Comprehensive performance indicators across all supply chain operations
          </p>
        </div>

        {/* Summary chip */}
        {data && (
          <div className="glass-card rounded-xl px-4 py-2 flex items-center gap-2">
            <LayoutDashboard size={16} className="text-nesma-secondary" />
            <span className="text-sm text-gray-300">
              <span className="text-white font-semibold">{totalCount}</span> KPIs across{' '}
              <span className="text-white font-semibold">{ALL_CATEGORIES.length}</span> categories
            </span>
          </div>
        )}
      </div>

      {/* ── Filter Tabs ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
            activeTab === 'all'
              ? 'bg-nesma-primary text-white shadow-lg shadow-nesma-primary/20'
              : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
          }`}
        >
          All
          {data && (
            <span className="ml-2 text-[10px] font-bold bg-white/10 px-1.5 py-0.5 rounded-full">{totalCount}</span>
          )}
        </button>

        {ALL_CATEGORIES.map(cat => {
          const meta = CATEGORY_META[cat];
          const CatIcon = meta.icon;
          const isActive = activeTab === cat;

          return (
            <button
              key={cat}
              onClick={() => setActiveTab(cat)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                isActive
                  ? `${meta.color} ${meta.textColor} ring-1 ring-current`
                  : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <CatIcon size={16} />
              {meta.label}
              {data && categoryCounts[cat] > 0 && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    isActive ? 'bg-white/20' : 'bg-white/10'
                  }`}
                >
                  {categoryCounts[cat]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Error State ─────────────────────────────────────────────────── */}
      {isError && (
        <div className="glass-card rounded-2xl p-10 text-center">
          <p className="text-red-400 text-sm">Failed to load KPI data. Please try again later.</p>
        </div>
      )}

      {/* ── Loading Skeletons ───────────────────────────────────────────── */}
      {isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <KpiSkeleton key={i} />
          ))}
        </div>
      )}

      {/* ── KPI Cards Grid ──────────────────────────────────────────────── */}
      {!isLoading && !isError && data && (
        <>
          {flatKpis.length === 0 ? (
            <div className="glass-card rounded-2xl p-10 text-center text-gray-400">
              No KPIs available for the selected category.
            </div>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {flatKpis.map(item => (
                <KpiDashboardCard key={item.key} item={item} />
              ))}
            </div>
          )}

          {/* ── Category Summary Cards ────────────────────────────────────── */}
          {activeTab === 'all' && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {ALL_CATEGORIES.map(cat => {
                const meta = CATEGORY_META[cat];
                const CatIcon = meta.icon;
                const group = data[cat];
                const entries = group ? Object.entries(group) : [];
                const positiveCount = entries.filter(([, kpi]) => (kpi as KpiResult).trend > 0).length;
                const negativeCount = entries.filter(([, kpi]) => (kpi as KpiResult).trend < 0).length;

                return (
                  <button
                    key={cat}
                    onClick={() => setActiveTab(cat)}
                    className="glass-card rounded-2xl p-4 text-left hover:bg-white/10 transition-all duration-300 group"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2.5 rounded-xl ${meta.color}`}>
                        <CatIcon size={20} className={meta.textColor} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white group-hover:text-nesma-secondary transition-colors">
                          {meta.label}
                        </h3>
                        <p className="text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                          {entries.length} indicators
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {positiveCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                          <TrendingUp size={12} />
                          {positiveCount}
                        </span>
                      )}
                      {negativeCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs text-red-400">
                          <TrendingDown size={12} />
                          {negativeCount}
                        </span>
                      )}
                      {positiveCount === 0 && negativeCount === 0 && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                          <Minus size={12} />
                          Stable
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
