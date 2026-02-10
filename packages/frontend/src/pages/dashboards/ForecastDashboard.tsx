import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  BarChart3,
  Package,
  Loader2,
  Activity,
  ThermometerSun,
  Minus,
} from 'lucide-react';
import { KpiCard } from '@/components/KpiCard';
import {
  useDemandForecast,
  useTopDemandItems,
  useReorderAlerts,
  useSeasonalPatterns,
} from '@/api/hooks/useDemandForecast';
import type { ItemForecast, SeasonalPattern } from '@/api/hooks/useDemandForecast';
import { useWarehouses } from '@/api/hooks';

// ── Forecast Dashboard ──────────────────────────────────────────────────────

export const ForecastDashboard: React.FC = () => {
  // Warehouse selector
  const { data: warehouseResponse } = useWarehouses();
  const warehouses = (warehouseResponse?.data ?? []) as Array<{ id: string; name?: string; warehouseName?: string }>;
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [selectedItemId, setSelectedItemId] = useState<string>('');

  // Data hooks
  const { data: forecastResponse, isLoading: forecastLoading } = useDemandForecast(warehouseId || undefined, undefined);
  const { data: topDemandResponse, isLoading: topLoading } = useTopDemandItems(warehouseId || undefined, 10);
  const { data: alertsResponse, isLoading: alertsLoading } = useReorderAlerts(warehouseId || undefined);
  const { data: seasonalResponse, isLoading: seasonalLoading } = useSeasonalPatterns(warehouseId || undefined);

  const forecasts = (forecastResponse?.data ?? []) as ItemForecast[];
  const topDemand = (topDemandResponse?.data ?? []) as ItemForecast[];
  const alerts = (alertsResponse?.data ?? []) as ItemForecast[];
  const seasonalPatterns = (seasonalResponse?.data ?? []) as SeasonalPattern[];

  const isLoading = forecastLoading || topLoading || alertsLoading || seasonalLoading;

  // Set first warehouse on load
  React.useEffect(() => {
    if (warehouses.length > 0 && !warehouseId) {
      setWarehouseId(warehouses[0].id);
    }
  }, [warehouses, warehouseId]);

  // Selected item for line chart
  const selectedItem = useMemo(() => {
    if (selectedItemId) return forecasts.find(f => f.itemId === selectedItemId);
    return forecasts[0];
  }, [forecasts, selectedItemId]);

  // ── KPI calculations ─────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const totalTracked = forecasts.length;
    const reorderCount = alerts.length;
    const increasing = forecasts.filter(f => f.trend === 'increasing').length;
    const decreasing = forecasts.filter(f => f.trend === 'decreasing').length;
    const trendDirection =
      increasing > decreasing ? 'Mostly increasing' : decreasing > increasing ? 'Mostly decreasing' : 'Stable';

    // Forecast "accuracy" proxy: high confidence items ratio
    const highConfItems = forecasts.filter(
      f => f.forecastMonthly.length > 0 && f.forecastMonthly[0].confidence === 'high',
    ).length;
    const accuracyPct = totalTracked > 0 ? Math.round((highConfItems / totalTracked) * 100) : 0;

    return { totalTracked, reorderCount, trendDirection, accuracyPct };
  }, [forecasts, alerts]);

  // ── Line chart data: historical + forecast for selected item ──────────────

  const lineChartData = useMemo(() => {
    if (!selectedItem) return [];

    const historical = selectedItem.historicalMonthly.map(h => ({
      month: h.month,
      historical: h.quantity,
      forecast: null as number | null,
    }));

    // Overlap: last historical month as first forecast point
    const forecast = selectedItem.forecastMonthly.map(f => ({
      month: f.month,
      historical: null as number | null,
      forecast: f.quantity,
    }));

    // Bridge: connect historical to forecast with the last historical value
    if (historical.length > 0 && forecast.length > 0) {
      const lastHistorical = historical[historical.length - 1];
      forecast.unshift({
        month: lastHistorical.month,
        historical: null,
        forecast: lastHistorical.historical,
      });
    }

    return [...historical, ...forecast];
  }, [selectedItem]);

  // ── Top demand bar chart data ────────────────────────────────────────────

  const barChartData = useMemo(() => {
    return topDemand.slice(0, 10).map(item => ({
      name: item.itemCode.length > 12 ? item.itemCode.slice(0, 12) + '..' : item.itemCode,
      demand: item.forecastMonthly.reduce((s, m) => s + m.quantity, 0),
      avg: item.avgMonthlyDemand,
    }));
  }, [topDemand]);

  // ── Seasonal heatmap data ────────────────────────────────────────────────

  const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const heatmapItems = useMemo(() => {
    return seasonalPatterns.slice(0, 12);
  }, [seasonalPatterns]);

  const getHeatColor = (index: number): string => {
    if (index <= 0) return 'bg-gray-800/50';
    if (index < 0.5) return 'bg-blue-900/60';
    if (index < 0.8) return 'bg-blue-700/50';
    if (index < 1.0) return 'bg-cyan-600/40';
    if (index < 1.2) return 'bg-emerald-600/40';
    if (index < 1.5) return 'bg-amber-500/40';
    if (index < 2.0) return 'bg-orange-500/50';
    return 'bg-red-500/50';
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (!warehouseId && warehouses.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-7 h-7 text-nesma-secondary animate-spin" />
        <span className="ml-3 text-gray-400">Loading warehouses...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-nesma-primary/20 text-nesma-secondary">
            <Activity size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white glow-text">Demand Forecast</h1>
            <p className="text-gray-400 mt-1 text-sm">Statistical demand forecasting from historical consumption</p>
          </div>
        </div>

        {/* Warehouse Selector */}
        <select
          value={warehouseId}
          onChange={e => {
            setWarehouseId(e.target.value);
            setSelectedItemId('');
          }}
          className="input-field w-full md:w-64"
        >
          <option value="">Select Warehouse</option>
          {warehouses.map(w => (
            <option key={w.id} value={w.id}>
              {w.name || w.warehouseName || w.id}
            </option>
          ))}
        </select>
      </div>

      {/* ── Loading State ───────────────────────────────────────────────── */}
      {isLoading && (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-7 h-7 text-nesma-secondary animate-spin" />
          <span className="ml-3 text-gray-400">Computing forecasts...</span>
        </div>
      )}

      {/* ── KPI Cards ───────────────────────────────────────────────────── */}
      {!isLoading && warehouseId && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <KpiCard title="Items Tracked" value={kpis.totalTracked} icon={Package} color="bg-blue-500" />
            <KpiCard
              title="Reorder Alerts"
              value={kpis.reorderCount}
              icon={AlertTriangle}
              color="bg-red-500"
              alert={kpis.reorderCount > 0}
            />
            <KpiCard
              title="Trend Direction"
              value={kpis.trendDirection}
              icon={
                kpis.trendDirection.includes('increasing')
                  ? TrendingUp
                  : kpis.trendDirection.includes('decreasing')
                    ? TrendingDown
                    : Minus
              }
              color="bg-emerald-500"
            />
            <KpiCard
              title="High Confidence"
              value={`${kpis.accuracyPct}%`}
              icon={BarChart3}
              color="bg-purple-500"
              sublabel="of forecast items"
            />
          </div>

          {/* ── Item Selector + Demand Trend Chart ────────────────────────── */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-white/10 pb-4">
              <h3 className="font-bold text-lg text-white">Demand Trend</h3>
              <select
                value={selectedItemId || selectedItem?.itemId || ''}
                onChange={e => setSelectedItemId(e.target.value)}
                className="input-field w-full md:w-80"
              >
                {forecasts.map(f => (
                  <option key={f.itemId} value={f.itemId}>
                    {f.itemCode} - {f.itemName.length > 40 ? f.itemName.slice(0, 40) + '...' : f.itemName}
                  </option>
                ))}
              </select>
            </div>

            {selectedItem && (
              <div className="flex flex-wrap gap-4 mb-4">
                <span className="text-xs px-3 py-1 rounded-full bg-white/10 border border-white/10 text-gray-300">
                  Avg Monthly: {selectedItem.avgMonthlyDemand.toLocaleString()}
                </span>
                <span
                  className={`text-xs px-3 py-1 rounded-full border ${
                    selectedItem.trend === 'increasing'
                      ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                      : selectedItem.trend === 'decreasing'
                        ? 'bg-red-500/20 border-red-500/30 text-red-400'
                        : 'bg-gray-500/20 border-gray-500/30 text-gray-400'
                  }`}
                >
                  Trend: {selectedItem.trend} ({selectedItem.trendSlope > 0 ? '+' : ''}
                  {selectedItem.trendSlope})
                </span>
                <span className="text-xs px-3 py-1 rounded-full bg-white/10 border border-white/10 text-gray-300">
                  Reorder Point: {selectedItem.suggestedReorderPoint.toLocaleString()}
                </span>
                {selectedItem.currentStock !== undefined && (
                  <span
                    className={`text-xs px-3 py-1 rounded-full border ${
                      selectedItem.reorderAlert
                        ? 'bg-red-500/20 border-red-500/30 text-red-400'
                        : 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                    }`}
                  >
                    Stock: {selectedItem.currentStock.toLocaleString()}
                  </span>
                )}
              </div>
            )}

            {lineChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={lineChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis
                    dataKey="month"
                    stroke="#6b7280"
                    fontSize={11}
                    tickFormatter={v => {
                      const parts = v.split('-');
                      return parts.length === 2
                        ? MONTH_LABELS[parseInt(parts[1], 10) - 1] + ' ' + parts[0].slice(2)
                        : v;
                    }}
                  />
                  <YAxis stroke="#6b7280" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(17, 24, 39, 0.95)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: '#9ca3af' }} />
                  <Line
                    type="monotone"
                    dataKey="historical"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ r: 3, fill: '#3b82f6' }}
                    connectNulls={false}
                    name="Historical"
                  />
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="8 4"
                    dot={{ r: 3, fill: '#f59e0b' }}
                    connectNulls={false}
                    name="Forecast"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
                No demand data available for the selected warehouse
              </div>
            )}
          </div>

          {/* ── Reorder Alerts & Top Demand (side by side) ────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Reorder Alerts Table */}
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-white/10 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <h3 className="text-lg font-semibold text-white">Reorder Alerts</h3>
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                  {alerts.length} items
                </span>
              </div>
              <div className="overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="text-gray-400 border-b border-white/10 sticky top-0 bg-gray-900/90 backdrop-blur-sm">
                    <tr>
                      <th className="pb-3 pt-3 pl-4">Item</th>
                      <th className="pb-3 pt-3 text-right">Stock</th>
                      <th className="pb-3 pt-3 text-right pr-4">Reorder Pt</th>
                    </tr>
                  </thead>
                  <tbody className="text-white divide-y divide-white/5">
                    {alerts.length > 0 ? (
                      alerts.map(item => (
                        <tr
                          key={item.itemId}
                          className="hover:bg-white/5 transition-colors cursor-pointer"
                          onClick={() => setSelectedItemId(item.itemId)}
                        >
                          <td className="py-3 pl-4">
                            <p className="font-mono text-nesma-secondary text-xs">{item.itemCode}</p>
                            <p className="text-gray-400 text-xs truncate max-w-[200px]">{item.itemName}</p>
                          </td>
                          <td className="py-3 text-right text-red-400 font-medium">
                            {(item.currentStock ?? 0).toLocaleString()}
                          </td>
                          <td className="py-3 text-right pr-4 text-gray-300">
                            {item.suggestedReorderPoint.toLocaleString()}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3} className="py-12 text-center text-gray-500">
                          No reorder alerts - stock levels are healthy
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top Demand Bar Chart */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-6 border-b border-white/10 pb-4">
                <BarChart3 className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-lg text-white">Top 10 Demand Items</h3>
              </div>
              {barChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={barChartData} layout="vertical" margin={{ top: 5, right: 20, left: 60, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis type="number" stroke="#6b7280" fontSize={11} />
                    <YAxis type="category" dataKey="name" stroke="#6b7280" fontSize={10} width={55} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(17, 24, 39, 0.95)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '12px',
                        color: '#fff',
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="demand" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Predicted (3mo)" />
                    <Bar dataKey="avg" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Avg Monthly" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
                  No demand data available
                </div>
              )}
            </div>
          </div>

          {/* ── Seasonal Patterns Heatmap ──────────────────────────────────── */}
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-6 border-b border-white/10 pb-4">
              <ThermometerSun className="w-5 h-5 text-cyan-400" />
              <h3 className="font-bold text-lg text-white">Seasonal Demand Patterns</h3>
              <span className="ml-auto text-xs text-gray-500">Index: &lt;1 = below avg, &gt;1 = above avg</span>
            </div>

            {heatmapItems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left text-gray-400 pb-3 pr-4 min-w-[140px]">Item</th>
                      {MONTH_LABELS.map(m => (
                        <th key={m} className="text-center text-gray-400 pb-3 px-1 min-w-[44px]">
                          {m}
                        </th>
                      ))}
                      <th className="text-center text-gray-400 pb-3 pl-3 min-w-[60px]">Strength</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {heatmapItems.map(pattern => (
                      <tr key={pattern.itemId} className="hover:bg-white/5">
                        <td className="py-2 pr-4">
                          <p className="font-mono text-nesma-secondary text-xs">{pattern.itemCode}</p>
                          <p className="text-gray-500 text-[10px] truncate max-w-[140px]">{pattern.itemName}</p>
                        </td>
                        {pattern.seasonalIndices.map(si => (
                          <td key={si.month} className="py-2 px-1 text-center">
                            <div
                              className={`w-9 h-9 rounded-lg flex items-center justify-center text-[10px] font-medium text-white mx-auto ${getHeatColor(si.index)}`}
                              title={`${si.label}: ${si.index.toFixed(2)}`}
                            >
                              {si.index.toFixed(1)}
                            </div>
                          </td>
                        ))}
                        <td className="py-2 pl-3 text-center">
                          <span
                            className={`text-xs font-medium ${
                              pattern.seasonalityStrength > 0.5
                                ? 'text-amber-400'
                                : pattern.seasonalityStrength > 0.3
                                  ? 'text-cyan-400'
                                  : 'text-gray-500'
                            }`}
                          >
                            {(pattern.seasonalityStrength * 100).toFixed(0)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Legend */}
                <div className="flex items-center gap-3 mt-4 pt-4 border-t border-white/10">
                  <span className="text-[10px] text-gray-500">Low</span>
                  <div className="flex gap-1">
                    {[
                      'bg-blue-900/60',
                      'bg-blue-700/50',
                      'bg-cyan-600/40',
                      'bg-emerald-600/40',
                      'bg-amber-500/40',
                      'bg-orange-500/50',
                      'bg-red-500/50',
                    ].map((c, i) => (
                      <div key={i} className={`w-6 h-3 rounded ${c}`} />
                    ))}
                  </div>
                  <span className="text-[10px] text-gray-500">High</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
                {seasonalLoading
                  ? 'Computing seasonal patterns...'
                  : 'Not enough data for seasonal analysis (6+ months required)'}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── No warehouse selected ───────────────────────────────────────── */}
      {!isLoading && !warehouseId && (
        <div className="glass-card rounded-2xl p-10 text-center border border-white/10">
          <Activity className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Select a Warehouse</h3>
          <p className="text-gray-400 text-sm">
            Choose a warehouse from the dropdown above to view demand forecasts, reorder alerts, and seasonal patterns.
          </p>
        </div>
      )}
    </div>
  );
};
