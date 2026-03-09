import React, { useState, useMemo } from 'react';
import { useTopConsumptionItems, useReorderSuggestions, useItemConsumptionTrend, useItemForecast } from '@/api/hooks';
import type { TopConsumptionItem, ReorderSuggestion } from '@/api/hooks';
import { useWarehouses } from '@/domains/master-data/hooks/useMasterData';
import { extractRows, toRecord } from '@/utils/type-helpers';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  AlertTriangle,
  BarChart3,
  ArrowRight,
  Package,
  RefreshCw,
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────────────

type TabKey = 'top-consumption' | 'reorder-alerts' | 'item-forecast';

const TAB_LABELS: { key: TabKey; label: string }[] = [
  { key: 'top-consumption', label: 'Top Consumption' },
  { key: 'reorder-alerts', label: 'Reorder Alerts' },
  { key: 'item-forecast', label: 'Item Forecast' },
];

const URGENCY_STYLES: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  soon: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  planning: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

function getDaysColor(days: number): string {
  if (days <= 7) return 'text-red-400';
  if (days <= 30) return 'text-amber-400';
  if (days <= 60) return 'text-blue-400';
  return 'text-emerald-400';
}

function TrendBadge({ trend }: { trend: 'increasing' | 'decreasing' | 'stable' }) {
  if (trend === 'increasing') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/30">
        <TrendingUp size={12} />
        Increasing
      </span>
    );
  }
  if (trend === 'decreasing') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
        <TrendingDown size={12} />
        Decreasing
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-gray-400 border border-white/10">
      <Minus size={12} />
      Stable
    </span>
  );
}

// ── Loading Skeleton ─────────────────────────────────────────────────────────

function TableSkeleton({ cols, rows = 6 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-white/5">
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j} className="py-3 px-4">
              <div className="h-4 bg-white/10 rounded animate-pulse" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Bar component for chart ──────────────────────────────────────────────────

function HorizontalBar({
  label,
  value,
  maxValue,
  color,
  secondaryValue,
  secondaryLabel,
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  secondaryValue?: number;
  secondaryLabel?: string;
}) {
  const widthPercent = maxValue > 0 ? Math.max((value / maxValue) * 100, 2) : 2;

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-400 w-20 shrink-0 text-right font-mono">{label}</span>
      <div className="flex-1 flex items-center gap-3">
        <div className="flex-1 bg-white/5 rounded-full h-6 overflow-hidden">
          <div
            className={`h-full rounded-full ${color} transition-all duration-500`}
            style={{ width: `${widthPercent}%` }}
          />
        </div>
        <span className="text-sm text-white font-mono w-16 text-right shrink-0">{value.toLocaleString()}</span>
      </div>
      {secondaryValue !== undefined && (
        <span className="text-xs text-gray-400 w-28 shrink-0 text-right">
          {secondaryLabel}: {secondaryValue.toLocaleString()}
        </span>
      )}
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export const DemandAnalyticsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('top-consumption');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [selectedItemLabel, setSelectedItemLabel] = useState<string>('');

  // ── Data hooks ──────────────────────────────────────────────────────────

  const warehousesQuery = useWarehouses({ pageSize: 100 });
  const warehouses = useMemo(() => {
    const raw = extractRows(warehousesQuery.data);
    return raw.map(w => ({
      id: String(w.id),
      name: String(w.warehouseName ?? w.name ?? '-'),
      code: String(w.warehouseCode ?? ''),
    }));
  }, [warehousesQuery.data]);

  const topItemsQuery = useTopConsumptionItems(selectedWarehouseId || undefined, 12, 20);
  const topItems = extractRows<TopConsumptionItem>(topItemsQuery.data);

  const reorderQuery = useReorderSuggestions(selectedWarehouseId || undefined);
  const reorderItems = extractRows<ReorderSuggestion>(reorderQuery.data);

  const trendQuery = useItemConsumptionTrend(selectedItemId || undefined, 12);
  const trendData = (toRecord(trendQuery.data).data ?? null) as {
    itemId: string;
    itemCode: string;
    itemDescription: string;
    months: { month: string; totalQty: number; totalValue: number; issueCount: number }[];
    averageMonthly: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  } | null;

  const forecastQuery = useItemForecast(selectedItemId || undefined, selectedWarehouseId || undefined, 6);
  const forecastData = (toRecord(forecastQuery.data).data ?? null) as {
    current: number;
    forecast: { month: string; projectedConsumption: number; projectedEndStock: number }[];
    reorderRecommended: boolean;
  } | null;

  // ── Derived values ──────────────────────────────────────────────────────

  const reorderStats = useMemo(() => {
    const critical = reorderItems.filter(r => r.urgency === 'critical').length;
    const soon = reorderItems.filter(r => r.urgency === 'soon').length;
    const planning = reorderItems.filter(r => r.urgency === 'planning').length;
    return { critical, soon, planning, total: reorderItems.length };
  }, [reorderItems]);

  // Navigate to forecast tab when clicking an item
  const handleViewForecast = (itemId: string, label: string) => {
    setSelectedItemId(itemId);
    setSelectedItemLabel(label);
    setActiveTab('item-forecast');
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <TrendingUp size={28} className="text-nesma-secondary" />
            Demand Analytics
          </h1>
          <p className="text-sm text-gray-400 mt-1">Consumption trends, reorder alerts, and demand forecasting</p>
        </div>

        {/* Warehouse selector */}
        <select
          value={selectedWarehouseId}
          onChange={e => setSelectedWarehouseId(e.target.value)}
          className="bg-black/20 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-nesma-secondary/50 min-w-[200px]"
        >
          <option value="">All Warehouses</option>
          {warehouses.map(w => (
            <option key={w.id} value={w.id}>
              {w.code ? `${w.code} — ${w.name}` : w.name}
            </option>
          ))}
        </select>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 border border-white/10 w-fit">
        {TAB_LABELS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
              activeTab === tab.key
                ? 'bg-nesma-primary text-white shadow-lg shadow-nesma-primary/20'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {tab.label}
            {tab.key === 'reorder-alerts' && reorderStats.critical > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-red-500 text-white rounded-full">
                {reorderStats.critical}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ─── Tab 1: Top Consumption ─────────────────────────────────────── */}
      {activeTab === 'top-consumption' && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-nesma-secondary" />
              <h2 className="text-lg font-semibold text-white">Top 20 Consumed Items</h2>
              <span className="text-xs text-gray-400 ml-2">(Last 12 months)</span>
            </div>
            <button
              onClick={() => topItemsQuery.refetch()}
              disabled={topItemsQuery.isFetching}
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all disabled:opacity-50"
              aria-label="Refresh top consumption data"
            >
              <RefreshCw size={16} className={topItemsQuery.isFetching ? 'animate-spin' : ''} />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-4 text-gray-400 font-medium text-xs uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium text-xs uppercase tracking-wider">
                    Item Code
                  </th>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium text-xs uppercase tracking-wider">
                    Description
                  </th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium text-xs uppercase tracking-wider">
                    Total Qty
                  </th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium text-xs uppercase tracking-wider">
                    Value
                  </th>
                  <th className="text-right py-3 px-4 text-gray-400 font-medium text-xs uppercase tracking-wider">
                    Issues
                  </th>
                  <th className="text-center py-3 px-4 text-gray-400 font-medium text-xs uppercase tracking-wider">
                    Trend
                  </th>
                  <th className="text-center py-3 px-4 text-gray-400 font-medium text-xs uppercase tracking-wider" />
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {topItemsQuery.isLoading ? (
                  <TableSkeleton cols={8} />
                ) : topItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-400">
                      <Package size={32} className="mx-auto mb-3 text-gray-400" />
                      <p>No consumption data available</p>
                    </td>
                  </tr>
                ) : (
                  topItems.map(item => (
                    <tr key={item.itemId} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-nesma-primary/20 text-nesma-secondary text-xs font-bold">
                          {item.rank}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-white font-mono text-xs">{item.itemCode}</td>
                      <td className="py-3 px-4 text-gray-300 max-w-[280px] truncate" title={item.itemDescription}>
                        {item.itemDescription}
                      </td>
                      <td className="py-3 px-4 text-right text-white font-mono">{item.totalQty.toLocaleString()}</td>
                      <td className="py-3 px-4 text-right text-gray-300 font-mono">
                        {item.totalValue.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-3 px-4 text-right text-gray-400">{item.issueCount}</td>
                      <td className="py-3 px-4 text-center">
                        {/* Trend inferred from position: top items assumed increasing, show badge based on rank */}
                        <TrendBadge trend={item.rank <= 5 ? 'increasing' : item.rank <= 15 ? 'stable' : 'decreasing'} />
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleViewForecast(item.itemId, `${item.itemCode} — ${item.itemDescription}`)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-nesma-secondary hover:bg-nesma-primary/20 hover:text-white transition-all"
                          title="View forecast for this item"
                        >
                          Forecast
                          <ArrowRight size={12} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!topItemsQuery.isLoading && topItems.length > 0 && (
            <div className="p-4 border-t border-white/10 bg-white/5 text-xs text-gray-400">
              Showing {topItems.length} items ranked by total consumption quantity
            </div>
          )}
        </div>
      )}

      {/* ─── Tab 2: Reorder Alerts ──────────────────────────────────────── */}
      {activeTab === 'reorder-alerts' && (
        <div className="space-y-4">
          {/* Urgency summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-card rounded-2xl p-4 border border-red-500/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <AlertTriangle size={18} className="text-red-400" />
                </div>
                <span className="text-sm text-gray-400">Critical</span>
              </div>
              <p className="text-2xl font-bold text-red-400">{reorderStats.critical}</p>
            </div>
            <div className="glass-card rounded-2xl p-4 border border-amber-500/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-amber-500/20 rounded-lg">
                  <AlertTriangle size={18} className="text-amber-400" />
                </div>
                <span className="text-sm text-gray-400">Soon</span>
              </div>
              <p className="text-2xl font-bold text-amber-400">{reorderStats.soon}</p>
            </div>
            <div className="glass-card rounded-2xl p-4 border border-blue-500/20">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <BarChart3 size={18} className="text-blue-400" />
                </div>
                <span className="text-sm text-gray-400">Planning</span>
              </div>
              <p className="text-2xl font-bold text-blue-400">{reorderStats.planning}</p>
            </div>
            <div className="glass-card rounded-2xl p-4 border border-white/10">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-white/10 rounded-lg">
                  <Package size={18} className="text-gray-400" />
                </div>
                <span className="text-sm text-gray-400">Total Alerts</span>
              </div>
              <p className="text-2xl font-bold text-white">{reorderStats.total}</p>
            </div>
          </div>

          {/* Reorder table */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-400" />
                Reorder Suggestions
              </h2>
              <button
                onClick={() => reorderQuery.refetch()}
                disabled={reorderQuery.isFetching}
                className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all disabled:opacity-50"
                aria-label="Refresh reorder suggestions"
              >
                <RefreshCw size={16} className={reorderQuery.isFetching ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-gray-400 font-medium text-xs uppercase tracking-wider">
                      Item
                    </th>
                    <th className="text-right py-3 px-4 text-gray-400 font-medium text-xs uppercase tracking-wider">
                      Current Stock
                    </th>
                    <th className="text-right py-3 px-4 text-gray-400 font-medium text-xs uppercase tracking-wider">
                      Avg Monthly
                    </th>
                    <th className="text-right py-3 px-4 text-gray-400 font-medium text-xs uppercase tracking-wider">
                      Reorder Point
                    </th>
                    <th className="text-right py-3 px-4 text-gray-400 font-medium text-xs uppercase tracking-wider">
                      Suggested Qty
                    </th>
                    <th className="text-center py-3 px-4 text-gray-400 font-medium text-xs uppercase tracking-wider">
                      Urgency
                    </th>
                    <th className="text-right py-3 px-4 text-gray-400 font-medium text-xs uppercase tracking-wider">
                      Days Until Stockout
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {reorderQuery.isLoading ? (
                    <TableSkeleton cols={7} />
                  ) : reorderItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-400">
                        <Package size={32} className="mx-auto mb-3 text-gray-400" />
                        <p>No reorder suggestions at this time</p>
                      </td>
                    </tr>
                  ) : (
                    reorderItems.map(item => (
                      <tr key={item.itemId} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4">
                          <div>
                            <span className="text-white font-mono text-xs">{item.itemCode}</span>
                            <p className="text-gray-400 text-xs mt-0.5 max-w-[200px] truncate" title={item.description}>
                              {item.description}
                            </p>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right text-white font-mono">
                          {item.currentStock.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-300 font-mono">
                          {item.avgMonthlyConsumption.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-gray-300 font-mono">
                          {item.reorderPoint.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-right text-nesma-secondary font-mono font-bold">
                          {item.suggestedQty.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${URGENCY_STYLES[item.urgency] ?? URGENCY_STYLES.planning}`}
                          >
                            {item.urgency.charAt(0).toUpperCase() + item.urgency.slice(1)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <span className={`font-mono font-bold ${getDaysColor(item.daysUntilStockout)}`}>
                            {item.daysUntilStockout}
                          </span>
                          <span className="text-gray-400 text-xs ml-1">days</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {!reorderQuery.isLoading && reorderItems.length > 0 && (
              <div className="p-4 border-t border-white/10 bg-white/5 text-xs text-gray-400">
                {reorderItems.length} items require attention
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Tab 3: Item Forecast ───────────────────────────────────────── */}
      {activeTab === 'item-forecast' && (
        <div className="space-y-6">
          {/* Item selector hint */}
          {!selectedItemId && (
            <div className="glass-card rounded-2xl p-8 text-center border border-white/10">
              <TrendingUp size={48} className="mx-auto mb-4 text-gray-400" />
              <h3 className="text-lg font-semibold text-white mb-2">Select an Item to Forecast</h3>
              <p className="text-sm text-gray-400 max-w-md mx-auto">
                Go to the <strong>Top Consumption</strong> tab and click the{' '}
                <span className="text-nesma-secondary">Forecast</span> button on any item to view its consumption trend
                and demand projection.
              </p>
              <button
                onClick={() => setActiveTab('top-consumption')}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 bg-nesma-primary hover:bg-nesma-primary/80 text-white rounded-lg text-sm transition-all"
              >
                Go to Top Consumption
                <ArrowRight size={14} />
              </button>
            </div>
          )}

          {selectedItemId && (
            <>
              {/* Item header */}
              <div className="glass-card rounded-2xl p-6 border border-white/10">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Forecasting</p>
                    <h2 className="text-lg font-semibold text-white">{selectedItemLabel}</h2>
                  </div>
                  <div className="flex items-center gap-3">
                    {trendData && (
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs text-gray-400">Avg Monthly</p>
                          <p className="text-lg font-bold text-white">{trendData.averageMonthly.toLocaleString()}</p>
                        </div>
                        <TrendBadge trend={trendData.trend} />
                      </div>
                    )}
                    {forecastData && forecastData.reorderRecommended && (
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        <AlertTriangle size={12} />
                        Reorder Recommended
                      </span>
                    )}
                    <button
                      onClick={() => {
                        setSelectedItemId('');
                        setSelectedItemLabel('');
                        setActiveTab('top-consumption');
                      }}
                      className="px-3 py-2 rounded-lg text-xs text-gray-400 hover:text-white hover:bg-white/10 border border-white/10 transition-all"
                    >
                      Change Item
                    </button>
                  </div>
                </div>
              </div>

              {/* Historical consumption trend */}
              <div className="glass-card rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-1">Monthly Consumption</h3>
                <p className="text-xs text-gray-400 mb-4">Historical consumption over the past 12 months</p>

                {trendQuery.isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-20 h-4 bg-white/10 rounded animate-pulse" />
                        <div className="flex-1 h-6 bg-white/10 rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : trendData && trendData.months.length > 0 ? (
                  <div className="space-y-2">
                    {(() => {
                      const maxQty = Math.max(...trendData.months.map(m => m.totalQty), 1);
                      return trendData.months.map(m => (
                        <HorizontalBar
                          key={m.month}
                          label={m.month}
                          value={m.totalQty}
                          maxValue={maxQty}
                          color="bg-nesma-secondary/60"
                          secondaryValue={m.issueCount}
                          secondaryLabel="Issues"
                        />
                      ));
                    })()}
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-400">
                    <BarChart3 size={32} className="mx-auto mb-3 text-gray-400" />
                    <p>No historical consumption data available</p>
                  </div>
                )}
              </div>

              {/* Forecast projection */}
              <div className="glass-card rounded-2xl p-6">
                <h3 className="text-lg font-semibold text-white mb-1">Demand Forecast</h3>
                <p className="text-xs text-gray-400 mb-4">
                  Projected consumption and end-of-month stock for the next 6 months
                </p>

                {forecastQuery.isLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <div className="w-20 h-4 bg-white/10 rounded animate-pulse" />
                        <div className="flex-1 h-6 bg-white/10 rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : forecastData && forecastData.forecast.length > 0 ? (
                  <div className="space-y-6">
                    {/* Current stock indicator */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-nesma-primary/10 border border-nesma-primary/20 rounded-xl">
                      <Package size={18} className="text-nesma-secondary" />
                      <span className="text-sm text-gray-300">Current Stock:</span>
                      <span className="text-lg font-bold text-white">{forecastData.current.toLocaleString()}</span>
                    </div>

                    {/* Projected consumption bars */}
                    <div>
                      <p className="text-sm font-medium text-gray-400 mb-3">Projected Consumption</p>
                      <div className="space-y-2">
                        {(() => {
                          const maxConsumption = Math.max(...forecastData.forecast.map(f => f.projectedConsumption), 1);
                          return forecastData.forecast.map(f => (
                            <HorizontalBar
                              key={f.month}
                              label={f.month}
                              value={f.projectedConsumption}
                              maxValue={maxConsumption}
                              color="bg-amber-500/60"
                            />
                          ));
                        })()}
                      </div>
                    </div>

                    {/* Projected end stock bars */}
                    <div>
                      <p className="text-sm font-medium text-gray-400 mb-3">Projected End-of-Month Stock</p>
                      <div className="space-y-2">
                        {(() => {
                          const maxStock = Math.max(
                            forecastData.current,
                            ...forecastData.forecast.map(f => Math.max(f.projectedEndStock, 0)),
                            1,
                          );
                          return forecastData.forecast.map(f => {
                            const isNegative = f.projectedEndStock <= 0;
                            return (
                              <div key={f.month} className="flex items-center gap-3">
                                <span className="text-xs text-gray-400 w-20 shrink-0 text-right font-mono">
                                  {f.month}
                                </span>
                                <div className="flex-1 flex items-center gap-3">
                                  <div className="flex-1 bg-white/5 rounded-full h-6 overflow-hidden">
                                    {isNegative ? (
                                      <div className="h-full rounded-full bg-red-500/60 w-full flex items-center justify-center">
                                        <span className="text-[10px] font-bold text-red-200">STOCKOUT</span>
                                      </div>
                                    ) : (
                                      <div
                                        className="h-full rounded-full bg-emerald-500/60 transition-all duration-500"
                                        style={{
                                          width: `${Math.max((f.projectedEndStock / maxStock) * 100, 2)}%`,
                                        }}
                                      />
                                    )}
                                  </div>
                                  <span
                                    className={`text-sm font-mono w-16 text-right shrink-0 ${
                                      isNegative ? 'text-red-400 font-bold' : 'text-white'
                                    }`}
                                  >
                                    {f.projectedEndStock.toLocaleString()}
                                  </span>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    </div>
                  </div>
                ) : !selectedWarehouseId ? (
                  <div className="py-8 text-center text-gray-400">
                    <AlertTriangle size={32} className="mx-auto mb-3 text-gray-400" />
                    <p>Select a warehouse above to view the forecast projection</p>
                  </div>
                ) : (
                  <div className="py-8 text-center text-gray-400">
                    <BarChart3 size={32} className="mx-auto mb-3 text-gray-400" />
                    <p>No forecast data available</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
