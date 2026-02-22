import React, { useState, useMemo } from 'react';
import { useAnomalies, useInventoryHealth, useReorderPredictions, useAutoUpdateReorderPoints } from '@/api/hooks';
import type { Anomaly, ReorderPrediction, InventoryHealthSummary } from '@/api/hooks/useIntelligence';
import {
  Brain,
  ShieldAlert,
  TrendingDown,
  Package,
  AlertTriangle,
  Activity,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Zap,
  BarChart3,
  ArrowDownCircle,
} from 'lucide-react';

// ── Helpers ─────────────────────────────────────────────────────────────

const severityColor: Record<string, string> = {
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
};

const urgencyColor: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  warning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  ok: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
};

const anomalyIcon: Record<string, React.ReactNode> = {
  quantity_spike: <TrendingDown size={16} />,
  off_hours: <Clock size={16} />,
  negative_stock: <AlertTriangle size={16} />,
  repeated_issue: <Activity size={16} />,
  dormant_reactivation: <Zap size={16} />,
};

const anomalyLabel: Record<string, string> = {
  quantity_spike: 'Quantity Spike',
  off_hours: 'Off-Hours Activity',
  negative_stock: 'Negative Stock',
  repeated_issue: 'Repeated Issue',
  dormant_reactivation: 'Dormant Reactivation',
};

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="glass-card rounded-2xl p-5 hover:bg-white/10 transition-all duration-300">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-400">{title}</p>
          <p className="text-3xl font-bold text-white mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-xl ${color}`}>
          <Icon size={22} className="text-white" />
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

export const IntelligencePage: React.FC = () => {
  const [anomalyFilter, setAnomalyFilter] = useState<string>('all');
  const [predictionSort, setPredictionSort] = useState<'urgency' | 'stockout'>('urgency');
  const [showAllAnomalies, setShowAllAnomalies] = useState(false);
  const [showAllPredictions, setShowAllPredictions] = useState(false);

  // ── Data ──────────────────────────────────────────────────────────────
  const anomaliesQuery = useAnomalies();
  const healthQuery = useInventoryHealth();
  const predictionsQuery = useReorderPredictions();
  const autoUpdateMutation = useAutoUpdateReorderPoints();

  const anomalies = useMemo(() => {
    const raw = (anomaliesQuery.data as { data?: Anomaly[] } | undefined)?.data ?? [];
    if (anomalyFilter === 'all') return raw;
    return raw.filter(a => a.type === anomalyFilter);
  }, [anomaliesQuery.data, anomalyFilter]);

  const health = (healthQuery.data as { data?: InventoryHealthSummary } | undefined)?.data;

  const predictions = useMemo(() => {
    const raw = (predictionsQuery.data as { data?: ReorderPrediction[] } | undefined)?.data ?? [];
    if (predictionSort === 'stockout') {
      return [...raw].sort((a, b) => (a.daysUntilStockout ?? Infinity) - (b.daysUntilStockout ?? Infinity));
    }
    return raw; // already sorted by urgency from the API
  }, [predictionsQuery.data, predictionSort]);

  const displayedAnomalies = showAllAnomalies ? anomalies : anomalies.slice(0, 10);
  const displayedPredictions = showAllPredictions ? predictions : predictions.slice(0, 15);

  const anomalyTypeCounts = useMemo(() => {
    const raw = (anomaliesQuery.data as { data?: Anomaly[] } | undefined)?.data ?? [];
    const counts: Record<string, number> = {};
    for (const a of raw) {
      counts[a.type] = (counts[a.type] || 0) + 1;
    }
    return counts;
  }, [anomaliesQuery.data]);

  const criticalPredictions = predictions.filter(p => p.urgency === 'critical').length;
  const warningPredictions = predictions.filter(p => p.urgency === 'warning').length;

  const isLoading = anomaliesQuery.isLoading || healthQuery.isLoading || predictionsQuery.isLoading;

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Brain size={28} className="text-nesma-secondary" />
            Inventory Intelligence
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            AI-powered anomaly detection, predictive reorder points, and inventory health monitoring
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              anomaliesQuery.refetch();
              healthQuery.refetch();
              predictionsQuery.refetch();
            }}
            className="btn-ghost flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-all duration-300"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => autoUpdateMutation.mutate()}
            disabled={autoUpdateMutation.isPending}
            className="btn-primary flex items-center gap-2 bg-nesma-primary hover:bg-nesma-primary/80 text-white px-4 py-2.5 rounded-lg transition-all duration-300 disabled:opacity-50"
          >
            <Zap size={16} />
            {autoUpdateMutation.isPending ? 'Updating...' : 'Auto-Update Reorder Points'}
          </button>
        </div>
      </div>

      {/* Auto-update success message */}
      {autoUpdateMutation.isSuccess && (
        <div className="glass-card rounded-xl p-4 border border-emerald-500/30 bg-emerald-500/10">
          <p className="text-sm text-emerald-400">
            Reorder points updated:{' '}
            {(autoUpdateMutation.data as { data?: { updated: number; total: number } })?.data?.updated ?? 0} of{' '}
            {(autoUpdateMutation.data as { data?: { updated: number; total: number } })?.data?.total ?? 0} items
          </p>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <KpiCard
          title="Total Active Items"
          value={health?.totalItems ?? '-'}
          icon={Package}
          color="bg-nesma-secondary/20"
        />
        <KpiCard
          title="Negative Stock"
          value={health?.negativeStockCount ?? 0}
          subtitle="Items below zero"
          icon={AlertTriangle}
          color={health?.negativeStockCount ? 'bg-red-500/20' : 'bg-emerald-500/20'}
        />
        <KpiCard
          title="Overstock Items"
          value={health?.overstockCount ?? 0}
          subtitle="Qty > 3x reorder point"
          icon={ArrowDownCircle}
          color="bg-amber-500/20"
        />
        <KpiCard
          title="Dormant Items"
          value={health?.dormantItemCount ?? 0}
          subtitle="No movement in 180+ days"
          icon={Clock}
          color="bg-purple-500/20"
        />
      </div>

      {/* Two-column layout: Anomalies + Predictions */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ── Anomaly Detection Panel ──────────────────────────────────── */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <ShieldAlert size={20} className="text-red-400" />
              Anomaly Detection
              {anomalies.length > 0 && (
                <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">{anomalies.length}</span>
              )}
            </h2>
          </div>

          {/* Type filter pills */}
          <div className="flex flex-wrap gap-2 mb-4">
            <button
              onClick={() => setAnomalyFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                anomalyFilter === 'all'
                  ? 'bg-nesma-secondary/20 text-nesma-secondary'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              All ({(anomaliesQuery.data as { data?: Anomaly[] } | undefined)?.data?.length ?? 0})
            </button>
            {Object.entries(anomalyTypeCounts).map(([type, count]) => (
              <button
                key={type}
                onClick={() => setAnomalyFilter(type)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                  anomalyFilter === type
                    ? 'bg-nesma-secondary/20 text-nesma-secondary'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                {anomalyIcon[type]}
                {anomalyLabel[type] ?? type} ({count})
              </button>
            ))}
          </div>

          {/* Anomaly list */}
          {anomaliesQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-nesma-secondary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : anomalies.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ShieldAlert size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No anomalies detected</p>
            </div>
          ) : (
            <div className="space-y-2">
              {displayedAnomalies.map((a, i) => (
                <div
                  key={i}
                  className={`flex items-start gap-3 p-3 rounded-xl border ${severityColor[a.severity]} bg-opacity-50 transition-all duration-200`}
                >
                  <div className="mt-0.5">{anomalyIcon[a.type]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${severityColor[a.severity]}`}
                      >
                        {a.severity}
                      </span>
                      <span className="text-xs text-gray-500">{anomalyLabel[a.type]}</span>
                    </div>
                    <p className="text-sm text-gray-300 mt-1 truncate">{a.description}</p>
                    {a.warehouseName && <p className="text-xs text-gray-500 mt-0.5">{a.warehouseName}</p>}
                  </div>
                </div>
              ))}
              {anomalies.length > 10 && (
                <button
                  onClick={() => setShowAllAnomalies(!showAllAnomalies)}
                  className="w-full text-center text-xs text-nesma-secondary hover:text-nesma-secondary/80 py-2 flex items-center justify-center gap-1"
                >
                  {showAllAnomalies ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {showAllAnomalies ? 'Show less' : `Show all ${anomalies.length} anomalies`}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Reorder Predictions Panel ────────────────────────────────── */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <BarChart3 size={20} className="text-nesma-secondary" />
              Reorder Predictions
              {criticalPredictions > 0 && (
                <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">
                  {criticalPredictions} critical
                </span>
              )}
              {warningPredictions > 0 && (
                <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">
                  {warningPredictions} warning
                </span>
              )}
            </h2>
          </div>

          {/* Sort toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setPredictionSort('urgency')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                predictionSort === 'urgency'
                  ? 'bg-nesma-secondary/20 text-nesma-secondary'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              By Urgency
            </button>
            <button
              onClick={() => setPredictionSort('stockout')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                predictionSort === 'stockout'
                  ? 'bg-nesma-secondary/20 text-nesma-secondary'
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              By Stockout Date
            </button>
          </div>

          {/* Prediction table */}
          {predictionsQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-nesma-secondary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : predictions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <BarChart3 size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No prediction data available</p>
              <p className="text-xs mt-1">Predictions require consumption history</p>
            </div>
          ) : (
            <>
              {/* Table header */}
              <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-widest px-3 pb-2 border-b border-white/5">
                <div className="col-span-3">Item</div>
                <div className="col-span-2">Warehouse</div>
                <div className="col-span-1 text-right">Stock</div>
                <div className="col-span-1 text-right">ADC</div>
                <div className="col-span-2 text-right">Days Left</div>
                <div className="col-span-1 text-right">Reorder Pt</div>
                <div className="col-span-2 text-center">Status</div>
              </div>

              <div className="space-y-1 mt-2">
                {displayedPredictions.map((p, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-12 gap-2 items-center px-3 py-2 rounded-lg hover:bg-white/5 transition-all text-sm"
                  >
                    <div className="col-span-3 truncate">
                      <span className="text-white font-medium">{p.itemCode}</span>
                      <p className="text-xs text-gray-500 truncate">{p.itemDescription}</p>
                    </div>
                    <div className="col-span-2 text-gray-400 text-xs truncate">{p.warehouseName}</div>
                    <div className="col-span-1 text-right text-gray-300">{Math.round(p.effectiveStock)}</div>
                    <div className="col-span-1 text-right text-gray-400">{p.avgDailyConsumption.toFixed(1)}</div>
                    <div className="col-span-2 text-right">
                      {p.daysUntilStockout !== null ? (
                        <span
                          className={
                            p.daysUntilStockout <= 7
                              ? 'text-red-400 font-bold'
                              : p.daysUntilStockout <= 21
                                ? 'text-amber-400'
                                : 'text-gray-300'
                          }
                        >
                          {p.daysUntilStockout}d
                        </span>
                      ) : (
                        <span className="text-gray-600">-</span>
                      )}
                    </div>
                    <div className="col-span-1 text-right text-gray-400">{p.reorderPoint}</div>
                    <div className="col-span-2 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${urgencyColor[p.urgency]}`}
                      >
                        {p.urgency}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {predictions.length > 15 && (
                <button
                  onClick={() => setShowAllPredictions(!showAllPredictions)}
                  className="w-full text-center text-xs text-nesma-secondary hover:text-nesma-secondary/80 py-2 mt-2 flex items-center justify-center gap-1"
                >
                  {showAllPredictions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  {showAllPredictions ? 'Show less' : `Show all ${predictions.length} predictions`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
