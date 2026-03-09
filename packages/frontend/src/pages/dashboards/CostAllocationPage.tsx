import React, { useState, useMemo } from 'react';

import { useCostAllocation, useCostAllocationSummary } from '@/domains/reporting/hooks/useCostAllocation';
import type {
  ProjectCostSummaryItem,
  CostCategory,
  MonthlyBreakdown,
} from '@/domains/reporting/hooks/useCostAllocation';

import {
  DollarSign,
  ArrowLeft,
  Package,
  Truck,
  Wrench,
  ClipboardList,
  Boxes,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatMonth(monthStr: string): string {
  // Expects "YYYY-MM" format
  const [year, month] = monthStr.split('-');
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const idx = parseInt(month, 10) - 1;
  return `${MONTHS[idx] ?? month} ${year?.slice(2) ?? ''}`;
}

interface CategoryConfig {
  key: string;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  barColor: string;
}

const CATEGORY_CONFIGS: CategoryConfig[] = [
  {
    key: 'receiving',
    label: 'Receiving',
    icon: Package,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20',
    borderColor: 'border-blue-500/20',
    barColor: 'bg-blue-500',
  },
  {
    key: 'materialIssues',
    label: 'Material Issues',
    icon: ClipboardList,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/20',
    borderColor: 'border-emerald-500/20',
    barColor: 'bg-emerald-500',
  },
  {
    key: 'jobOrders',
    label: 'Job Orders',
    icon: Wrench,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/20',
    borderColor: 'border-amber-500/20',
    barColor: 'bg-amber-500',
  },
  {
    key: 'shipments',
    label: 'Shipments',
    icon: Truck,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/20',
    borderColor: 'border-purple-500/20',
    barColor: 'bg-purple-500',
  },
  {
    key: 'rentalEquipment',
    label: 'Rental Equipment',
    icon: Boxes,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/20',
    borderColor: 'border-cyan-500/20',
    barColor: 'bg-cyan-500',
  },
];

// ── Component ────────────────────────────────────────────────────────────────

export const CostAllocationPage: React.FC = () => {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  // Summary hook (all projects)
  const {
    data: summaryResponse,
    isLoading: summaryLoading,
    isError: summaryError,
    refetch: refetchSummary,
  } = useCostAllocationSummary(dateFrom || undefined, dateTo || undefined);

  // Project detail hook (when a project is selected)
  const { data: detailResponse, isLoading: detailLoading } = useCostAllocation(
    selectedProjectId ?? undefined,
    dateFrom || undefined,
    dateTo || undefined,
  );

  const summaryData = summaryResponse?.data;
  const detailData = detailResponse?.data;
  const projects: ProjectCostSummaryItem[] = useMemo(
    () => [...(summaryData?.projects ?? [])].sort((a, b) => b.grandTotal - a.grandTotal),
    [summaryData],
  );

  // Find max monthly value for bar scaling
  const monthlyMax = useMemo(() => {
    const breakdown = selectedProjectId ? (detailData?.monthlyBreakdown ?? []) : (summaryData?.monthlyBreakdown ?? []);
    return Math.max(...breakdown.map(m => m.total), 1);
  }, [selectedProjectId, detailData, summaryData]);

  const isLoading = selectedProjectId ? detailLoading : summaryLoading;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          {selectedProjectId && (
            <button
              onClick={() => setSelectedProjectId(null)}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
              aria-label="Back to summary"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div>
            <h1 className="text-3xl font-bold text-white glow-text flex items-center gap-3">
              <DollarSign className="text-emerald-400" />
              Cost Allocation
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              {selectedProjectId && detailData
                ? `Project: ${detailData.project.projectName} (${detailData.project.projectCode})`
                : 'Cost breakdown across all projects and categories'}
            </p>
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="costDateFrom" className="text-xs text-gray-400">
              From
            </label>
            <input
              id="costDateFrom"
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-nesma-secondary/50"
            />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="costDateTo" className="text-xs text-gray-400">
              To
            </label>
            <input
              id="costDateTo"
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-nesma-secondary/50"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => {
                setDateFrom('');
                setDateTo('');
              }}
              className="text-xs text-nesma-secondary hover:text-white transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Error State ─────────────────────────────────────────────────── */}
      {summaryError && !selectedProjectId && (
        <div className="glass-card rounded-2xl p-6 border border-red-500/20 text-center">
          <AlertTriangle size={32} className="text-red-400 mx-auto mb-3" />
          <p className="text-red-400 font-medium">Failed to load cost allocation data</p>
          <p className="text-gray-400 text-sm mt-1">Check your connection and try again</p>
          <button
            onClick={() => refetchSummary()}
            className="mt-4 px-4 py-2 bg-nesma-primary text-white rounded-lg text-sm hover:bg-nesma-primary/80 transition-all"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Loading Skeleton ────────────────────────────────────────────── */}
      {isLoading && (
        <div className="space-y-6">
          {/* KPI skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="glass-card p-4 rounded-xl animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/10 rounded-lg" />
                  <div className="space-y-2 flex-1">
                    <div className="bg-white/10 rounded h-6 w-20" />
                    <div className="bg-white/10 rounded h-3 w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Table skeleton */}
          <div className="glass-card rounded-2xl p-5 animate-pulse space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="bg-white/10 rounded h-5 w-32" />
                <div className="bg-white/10 rounded h-5 flex-1" />
                <div className="bg-white/10 rounded h-5 w-20" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* SUMMARY VIEW (no project selected)                              */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {!isLoading && !selectedProjectId && summaryData && (
        <>
          {/* ── Category KPI Cards ─────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {CATEGORY_CONFIGS.map(cat => {
              const catData = summaryData.totals[cat.key as keyof typeof summaryData.totals] as
                | CostCategory
                | undefined;
              const Icon = cat.icon;
              return (
                <div key={cat.key} className={`glass-card p-4 rounded-xl border ${cat.borderColor}`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 ${cat.bgColor} rounded-lg`}>
                      <Icon size={20} className={cat.color} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xl font-bold text-white truncate">
                        {formatCurrency(catData?.totalValue ?? 0)}
                      </p>
                      <p className="text-xs text-gray-400">{cat.label}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Grand Total */}
          <div className="glass-card p-5 rounded-xl border border-nesma-primary/30 bg-gradient-to-r from-nesma-primary/10 to-transparent">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-nesma-primary/20 rounded-lg">
                  <TrendingUp size={24} className="text-nesma-secondary" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Grand Total</p>
                  <p className="text-3xl font-bold text-white">
                    SAR {summaryData.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
              <p className="text-sm text-gray-400">
                {projects.length} project{projects.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {/* ── Projects Table ──────────────────────────────────────────── */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="px-4 py-4 border-b border-white/10 bg-white/5">
              <h3 className="text-lg font-semibold text-white">Projects by Total Cost</h3>
            </div>
            <div className="overflow-x-auto mobile-scroll">
              <table className="w-full text-left text-sm min-w-[800px]">
                <thead className="text-gray-400 text-xs uppercase tracking-wider border-b border-white/10">
                  <tr>
                    <th className="px-4 py-3">#</th>
                    <th className="px-4 py-3">Project</th>
                    {CATEGORY_CONFIGS.map(cat => (
                      <th key={cat.key} className="px-4 py-3 text-right">
                        {cat.label}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right">Grand Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-gray-300">
                  {projects.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                        <DollarSign size={32} className="mx-auto mb-3 text-gray-400" />
                        <p>No cost allocation data found</p>
                        <p className="text-xs mt-1">Try adjusting the date range</p>
                      </td>
                    </tr>
                  ) : (
                    projects.map((project, idx) => (
                      <tr
                        key={project.projectId}
                        onClick={() => setSelectedProjectId(project.projectId)}
                        className="hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        <td className="px-4 py-3 text-gray-400">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <p className="text-white font-medium">{project.projectName}</p>
                          <p className="text-xs text-gray-400 font-mono">{project.projectCode}</p>
                        </td>
                        {CATEGORY_CONFIGS.map(cat => (
                          <td key={cat.key} className="px-4 py-3 text-right font-mono text-xs">
                            {formatCurrency(project[cat.key as keyof ProjectCostSummaryItem] as number)}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-right font-mono font-bold text-white">
                          {formatCurrency(project.grandTotal)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Monthly Breakdown Bars (Summary) ───────────────────────── */}
          {summaryData.monthlyBreakdown.length > 0 && (
            <MonthlyBreakdownSection
              title="Monthly Cost Trend (All Projects)"
              breakdown={summaryData.monthlyBreakdown}
              maxValue={monthlyMax}
            />
          )}
        </>
      )}

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* DETAIL VIEW (project selected)                                  */}
      {/* ═════════════════════════════════════════════════════════════════ */}
      {!isLoading && selectedProjectId && detailData && (
        <>
          {/* ── Category Detail Cards ──────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {CATEGORY_CONFIGS.map(cat => {
              const catData = detailData.categories[cat.key as keyof typeof detailData.categories] as
                | CostCategory
                | undefined;
              const Icon = cat.icon;
              return (
                <div key={cat.key} className={`glass-card p-4 rounded-xl border ${cat.borderColor}`}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 ${cat.bgColor} rounded-lg`}>
                      <Icon size={20} className={cat.color} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xl font-bold text-white truncate">
                        {formatCurrency(catData?.totalValue ?? 0)}
                      </p>
                      <p className="text-xs text-gray-400">{cat.label}</p>
                      <p className="text-[10px] text-gray-400">
                        {catData?.count ?? 0} transaction{(catData?.count ?? 0) !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Grand Total */}
          <div className="glass-card p-5 rounded-xl border border-nesma-primary/30 bg-gradient-to-r from-nesma-primary/10 to-transparent">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-nesma-primary/20 rounded-lg">
                <TrendingUp size={24} className="text-nesma-secondary" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Project Grand Total</p>
                <p className="text-3xl font-bold text-white">
                  SAR {detailData.grandTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          {/* ── Category Proportion Bars ────────────────────────────────── */}
          {detailData.grandTotal > 0 && (
            <div className="glass-card rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Cost Distribution</h3>
              <div className="space-y-4">
                {CATEGORY_CONFIGS.map(cat => {
                  const catData = detailData.categories[cat.key as keyof typeof detailData.categories] as
                    | CostCategory
                    | undefined;
                  const value = catData?.totalValue ?? 0;
                  const pct = detailData.grandTotal > 0 ? (value / detailData.grandTotal) * 100 : 0;
                  return (
                    <div key={cat.key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm text-gray-300">{cat.label}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-mono text-white">{formatCurrency(value)}</span>
                          <span className="text-xs text-gray-400 w-12 text-right">{pct.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="w-full h-2.5 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${cat.barColor} rounded-full transition-all duration-500`}
                          style={{ width: `${Math.max(pct, 0.5)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Monthly Breakdown Bars (Project) ───────────────────────── */}
          {detailData.monthlyBreakdown.length > 0 && (
            <MonthlyBreakdownSection
              title="Monthly Cost Trend"
              breakdown={detailData.monthlyBreakdown}
              maxValue={monthlyMax}
            />
          )}
        </>
      )}

      {/* ── No data (no project selected, no summary) ──────────────────── */}
      {!isLoading && !summaryError && !selectedProjectId && !summaryData && (
        <div className="glass-card rounded-2xl p-10 text-center border border-white/10">
          <DollarSign size={40} className="mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold text-white mb-2">No Data Available</h3>
          <p className="text-gray-400 text-sm">Cost allocation data will appear once transactions are recorded.</p>
        </div>
      )}
    </div>
  );
};

// ── Monthly Breakdown Sub-component ──────────────────────────────────────────

interface MonthlyBreakdownSectionProps {
  title: string;
  breakdown: MonthlyBreakdown[];
  maxValue: number;
}

const MonthlyBreakdownSection: React.FC<MonthlyBreakdownSectionProps> = ({ title, breakdown, maxValue }) => {
  return (
    <div className="glass-card rounded-2xl p-6">
      <h3 className="text-lg font-semibold text-white mb-5">{title}</h3>
      <div className="space-y-3">
        {breakdown.map(item => {
          const pct = maxValue > 0 ? (item.total / maxValue) * 100 : 0;
          return (
            <div key={item.month} className="flex items-center gap-4">
              <span className="text-xs text-gray-400 w-16 flex-shrink-0 text-right font-mono">
                {formatMonth(item.month)}
              </span>
              <div className="flex-1 h-7 bg-white/5 rounded-lg overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-nesma-primary to-nesma-secondary/70 rounded-lg transition-all duration-500"
                  style={{ width: `${Math.max(pct, 1)}%` }}
                />
                {pct > 20 && (
                  <span className="absolute inset-y-0 left-3 flex items-center text-[11px] font-medium text-white">
                    {formatCurrency(item.total)}
                  </span>
                )}
              </div>
              {pct <= 20 && (
                <span className="text-xs font-mono text-gray-400 flex-shrink-0">{formatCurrency(item.total)}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
