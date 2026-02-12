import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Layers,
  ArrowRight,
  CheckCircle2,
  Clock,
  TrendingUp,
  Loader2,
  Gauge,
  Lightbulb,
  BarChart3,
  Brain,
  Link2,
  CalendarRange,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import {
  useSlottingAnalysis,
  usePickFrequencies,
  useApplySlotting,
  useCoLocation,
  useSeasonalTrends,
  useAiSlottingSummary,
} from '@/api/hooks/useSlotting';
import { useWarehouses } from '@/api/hooks/useMasterData';
import type { SlottingSuggestion } from '@/api/hooks/useSlotting';

// ── Constants ───────────────────────────────────────────────────────────

const ABC_COLORS: Record<string, { bg: string; text: string }> = {
  A: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  B: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  C: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
};

type TabKey = 'standard' | 'ai-enhanced' | 'co-location' | 'seasonal';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: 'standard', label: 'Standard Analysis', icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { key: 'ai-enhanced', label: 'AI Enhanced', icon: <Brain className="w-3.5 h-3.5" /> },
  { key: 'co-location', label: 'Co-Location', icon: <Link2 className="w-3.5 h-3.5" /> },
  { key: 'seasonal', label: 'Seasonal Trends', icon: <CalendarRange className="w-3.5 h-3.5" /> },
];

// ── Efficiency Gauge (semi-circle) ──────────────────────────────────────

interface GaugeChartProps {
  current: number;
  projected: number;
}

function EfficiencyGauge({ current, projected }: GaugeChartProps) {
  const radius = 80;
  const stroke = 14;
  const cx = 100;
  const cy = 95;
  const circumference = Math.PI * radius;

  const currentAngle = (current / 100) * 180;
  const projectedAngle = (projected / 100) * 180;

  const currentDash = (currentAngle / 180) * circumference;
  const projectedDash = (projectedAngle / 180) * circumference;

  return (
    <div className="flex flex-col items-center">
      <svg width="200" height="110" viewBox="0 0 200 110">
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="rgba(16,185,129,0.2)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${projectedDash} ${circumference}`}
        />
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="#10b981"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${currentDash} ${circumference}`}
        />
        <text x={cx} y={cy - 20} textAnchor="middle" className="fill-white text-2xl font-bold">
          {current}%
        </text>
        <text x={cx} y={cy - 2} textAnchor="middle" className="fill-gray-400 text-xs">
          current
        </text>
      </svg>
      <div className="flex items-center gap-4 mt-2 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span className="text-gray-400">Current: {current}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/30" />
          <span className="text-gray-400">Projected: {projected}%</span>
        </div>
      </div>
    </div>
  );
}

// ── Zone Heatmap ────────────────────────────────────────────────────────

function ZoneHeatmap({ suggestions }: { suggestions: SlottingSuggestion[] }) {
  // Build a simple grid of zones based on suggestion data
  const zoneData = useMemo(() => {
    const zones: Record<string, { count: number; zone: string; aisle: number }> = {};
    for (const s of suggestions) {
      const key = `${s.currentZone}-${s.currentBin.split('-')[1] ?? '01'}`;
      if (!zones[key]) {
        zones[key] = {
          count: 0,
          zone: s.currentZone,
          aisle: parseInt(s.currentBin.split('-')[1] ?? '1', 10),
        };
      }
      zones[key]!.count++;
    }
    return Object.values(zones).sort((a, b) => {
      if (a.zone !== b.zone) return a.zone.localeCompare(b.zone);
      return a.aisle - b.aisle;
    });
  }, [suggestions]);

  if (zoneData.length === 0) {
    return <div className="text-center py-8 text-gray-500 text-sm">No zone data available.</div>;
  }

  const maxCount = Math.max(...zoneData.map(z => z.count), 1);

  return (
    <div className="grid grid-cols-6 gap-2">
      {zoneData.map((z, i) => {
        const intensity = z.count / maxCount;
        let color = 'bg-blue-500/20'; // underutilized
        if (intensity > 0.7)
          color = 'bg-red-500/30'; // overloaded
        else if (intensity > 0.3) color = 'bg-emerald-500/20'; // optimal

        return (
          <div
            key={i}
            className={`${color} rounded-lg p-3 text-center border border-white/5 transition-all hover:scale-105`}
            title={`Zone ${z.zone}, Aisle ${z.aisle}: ${z.count} items to move`}
          >
            <div className="text-[10px] font-bold text-gray-500 uppercase">
              {z.zone}-{String(z.aisle).padStart(2, '0')}
            </div>
            <div className="text-sm font-semibold text-white mt-1">{z.count}</div>
            <div className="text-[10px] text-gray-500">moves</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────

export const SlottingPage: React.FC = () => {
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [applyingIds, setApplyingIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TabKey>('standard');

  // Standard queries
  const { data: warehousesRes } = useWarehouses();
  const warehouses =
    (warehousesRes as unknown as { data?: Array<{ id: string; warehouseName: string; warehouseCode: string }> })
      ?.data ?? [];

  const { data: analysisRes, isLoading: analysisLoading } = useSlottingAnalysis(selectedWarehouse || undefined);
  const analysis = (analysisRes as unknown as { data?: import('@/api/hooks/useSlotting').SlottingAnalysis })?.data;

  const { data: frequenciesRes, isLoading: freqLoading } = usePickFrequencies(selectedWarehouse || undefined);
  const frequencies =
    (frequenciesRes as unknown as { data?: import('@/api/hooks/useSlotting').ItemPickFrequency[] })?.data ?? [];

  const applyMutation = useApplySlotting();

  // AI queries
  const { data: coLocationRes, isLoading: coLocationLoading } = useCoLocation(
    activeTab === 'co-location' || activeTab === 'ai-enhanced' ? selectedWarehouse || undefined : undefined,
  );
  const coLocation = (coLocationRes as unknown as { data?: import('@/api/hooks/useSlotting').CoLocationAnalysis })
    ?.data;

  const { data: seasonalRes, isLoading: seasonalLoading } = useSeasonalTrends(
    activeTab === 'seasonal' || activeTab === 'ai-enhanced' ? selectedWarehouse || undefined : undefined,
  );
  const seasonal = (seasonalRes as unknown as { data?: import('@/api/hooks/useSlotting').SeasonalAnalysis })?.data;

  const { data: aiSummaryRes, isLoading: aiSummaryLoading } = useAiSlottingSummary(
    activeTab === 'ai-enhanced' ? selectedWarehouse || undefined : undefined,
  );
  const aiSummary = (aiSummaryRes as unknown as { data?: import('@/api/hooks/useSlotting').AiSlottingSummary })?.data;

  // Top 20 items by pick frequency for the bar chart
  const top20Frequencies = useMemo(() => {
    return [...frequencies]
      .sort((a, b) => b.pickFrequency - a.pickFrequency)
      .slice(0, 20)
      .map(f => ({
        name: f.itemCode,
        frequency: f.pickFrequency,
        abcClass: f.abcClass,
      }));
  }, [frequencies]);

  // Suggestions sorted by priority score
  const suggestions = useMemo(() => {
    return [...(analysis?.suggestions ?? [])].sort((a, b) => b.priorityScore - a.priorityScore);
  }, [analysis]);

  // ── Handlers ───────────────────────────────────────────────────────────

  function handleApply(suggestion: SlottingSuggestion) {
    setApplyingIds(prev => new Set(prev).add(suggestion.itemId));
    applyMutation.mutate(
      {
        itemId: suggestion.itemId,
        warehouseId: selectedWarehouse,
        newBinNumber: suggestion.suggestedBin,
      },
      {
        onSettled: () => {
          setApplyingIds(prev => {
            const next = new Set(prev);
            next.delete(suggestion.itemId);
            return next;
          });
        },
      },
    );
  }

  function handleApplyAll() {
    const topSuggestions = suggestions.slice(0, 20);
    topSuggestions.forEach(s => handleApply(s));
  }

  // ── Loading / empty state ──────────────────────────────────────────────

  const isLoading = analysisLoading || freqLoading;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-nesma-primary/20 flex items-center justify-center">
            <Layers className="w-5 h-5 text-nesma-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Slotting Optimization</h1>
            <p className="text-sm text-gray-400">Optimize bin placement with AI-powered analysis</p>
          </div>
        </div>
        {suggestions.length > 0 && activeTab === 'standard' && (
          <button
            onClick={handleApplyAll}
            disabled={applyMutation.isPending}
            className="flex items-center gap-2 px-4 py-2.5 bg-nesma-primary text-white rounded-xl hover:bg-nesma-accent transition-all text-sm font-medium shadow-lg shadow-nesma-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {applyMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Apply Top Suggestions
          </button>
        )}
      </div>

      {/* Warehouse filter */}
      <div className="glass-card rounded-2xl p-4 border border-white/10">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
          <label className="text-sm text-gray-400 whitespace-nowrap">Warehouse:</label>
          <select
            value={selectedWarehouse}
            onChange={e => setSelectedWarehouse(e.target.value)}
            className="input-field w-full sm:w-72"
          >
            <option value="">Select a warehouse...</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>
                {w.warehouseCode} - {w.warehouseName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      {selectedWarehouse && (
        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-nesma-primary text-white shadow-lg shadow-nesma-primary/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {!selectedWarehouse ? (
        <div className="glass-card rounded-2xl p-12 border border-white/10 text-center">
          <Layers className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">Select a warehouse to analyze its bin slotting efficiency.</p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
        </div>
      ) : (
        <>
          {/* ── Standard Analysis Tab ───────────────────────────────────────── */}
          {activeTab === 'standard' && (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-card rounded-2xl p-5 border border-white/10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                      <Gauge className="w-4.5 h-4.5 text-emerald-400" />
                    </div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">Current Efficiency</div>
                  </div>
                  <div className="text-3xl font-bold text-white">
                    {analysis?.currentEfficiency ?? 0}
                    <span className="text-lg font-normal text-gray-500">%</span>
                  </div>
                </div>

                <div className="glass-card rounded-2xl p-5 border border-white/10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <TrendingUp className="w-4.5 h-4.5 text-blue-400" />
                    </div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">Projected Efficiency</div>
                  </div>
                  <div className="text-3xl font-bold text-white">
                    {analysis?.projectedEfficiency ?? 0}
                    <span className="text-lg font-normal text-gray-500">%</span>
                  </div>
                </div>

                <div className="glass-card rounded-2xl p-5 border border-white/10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-amber-500/20 flex items-center justify-center">
                      <Lightbulb className="w-4.5 h-4.5 text-amber-400" />
                    </div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">Suggestions</div>
                  </div>
                  <div className="text-3xl font-bold text-white">{suggestions.length}</div>
                </div>

                <div className="glass-card rounded-2xl p-5 border border-white/10">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center">
                      <Clock className="w-4.5 h-4.5 text-purple-400" />
                    </div>
                    <div className="text-xs text-gray-500 uppercase tracking-wider">Est. Time Saved</div>
                  </div>
                  <div className="text-3xl font-bold text-white">
                    {analysis?.estimatedTimeSavingMinutes ?? 0}
                    <span className="text-lg font-normal text-gray-500"> min/mo</span>
                  </div>
                </div>
              </div>

              {/* Efficiency Gauge + Frequency Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="glass-card rounded-2xl p-6 border border-white/10 flex flex-col items-center justify-center">
                  <h2 className="text-sm font-semibold text-white mb-4">Efficiency Gauge</h2>
                  <EfficiencyGauge
                    current={analysis?.currentEfficiency ?? 0}
                    projected={analysis?.projectedEfficiency ?? 0}
                  />
                </div>

                <div className="glass-card rounded-2xl p-6 border border-white/10 lg:col-span-2">
                  <div className="flex items-center gap-2 mb-4">
                    <BarChart3 className="w-4 h-4 text-nesma-primary" />
                    <h2 className="text-sm font-semibold text-white">Top 20 Items by Pick Frequency</h2>
                  </div>
                  {top20Frequencies.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 text-sm">No pick frequency data available.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={top20Frequencies} margin={{ top: 5, right: 20, bottom: 60, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis
                          dataKey="name"
                          tick={{ fill: '#9ca3af', fontSize: 10 }}
                          angle={-45}
                          textAnchor="end"
                          interval={0}
                        />
                        <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(17,24,39,0.95)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '12px',
                            color: '#fff',
                            fontSize: '12px',
                          }}
                          formatter={value => [`${value} picks/mo`, 'Frequency']}
                        />
                        <Bar dataKey="frequency" fill="#6366f1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Suggestions Table */}
              <SuggestionsTable suggestions={suggestions} applyingIds={applyingIds} onApply={handleApply} />
            </>
          )}

          {/* ── AI Enhanced Tab ─────────────────────────────────────────────── */}
          {activeTab === 'ai-enhanced' && (
            <>
              {aiSummaryLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
                </div>
              ) : aiSummary ? (
                <>
                  {/* AI Confidence + KPIs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="glass-card rounded-2xl p-5 border border-nesma-primary/30">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-lg bg-pink-500/20 flex items-center justify-center">
                          <Brain className="w-4.5 h-4.5 text-pink-400" />
                        </div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider">AI Confidence</div>
                      </div>
                      <div className="text-3xl font-bold text-white">
                        {aiSummary.aiConfidence}
                        <span className="text-lg font-normal text-gray-500">%</span>
                      </div>
                    </div>

                    <div className="glass-card rounded-2xl p-5 border border-white/10">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                          <Link2 className="w-4.5 h-4.5 text-cyan-400" />
                        </div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider">Co-Picked Pairs</div>
                      </div>
                      <div className="text-3xl font-bold text-white">{aiSummary.coLocation.pairs.length}</div>
                    </div>

                    <div className="glass-card rounded-2xl p-5 border border-white/10">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-lg bg-orange-500/20 flex items-center justify-center">
                          <CalendarRange className="w-4.5 h-4.5 text-orange-400" />
                        </div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider">Seasonal Alerts</div>
                      </div>
                      <div className="text-3xl font-bold text-white">{aiSummary.seasonal.seasonalAlertCount}</div>
                    </div>

                    <div className="glass-card rounded-2xl p-5 border border-white/10">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                          <Lightbulb className="w-4.5 h-4.5 text-emerald-400" />
                        </div>
                        <div className="text-xs text-gray-500 uppercase tracking-wider">Recommendations</div>
                      </div>
                      <div className="text-3xl font-bold text-white">{aiSummary.topRecommendations.length}</div>
                    </div>
                  </div>

                  {/* Top Recommendations */}
                  <div className="glass-card rounded-2xl p-6 border border-nesma-primary/20">
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles className="w-4 h-4 text-nesma-primary" />
                      <h2 className="text-sm font-semibold text-white">AI Recommendations</h2>
                    </div>
                    <div className="space-y-2">
                      {aiSummary.topRecommendations.map((rec, i) => (
                        <div
                          key={i}
                          className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5"
                        >
                          <div className="w-6 h-6 rounded-full bg-nesma-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                            <span className="text-[10px] font-bold text-nesma-primary">{i + 1}</span>
                          </div>
                          <p className="text-sm text-gray-300">{rec}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Zone Heatmap */}
                  <div className="glass-card rounded-2xl p-6 border border-white/10">
                    <div className="flex items-center gap-2 mb-4">
                      <Layers className="w-4 h-4 text-purple-400" />
                      <h2 className="text-sm font-semibold text-white">Zone Density Heatmap</h2>
                    </div>
                    <div className="flex items-center gap-4 mb-4 text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-red-500/30" />
                        <span className="text-gray-500">Overloaded</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-emerald-500/20" />
                        <span className="text-gray-500">Optimal</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-blue-500/20" />
                        <span className="text-gray-500">Underutilized</span>
                      </div>
                    </div>
                    <ZoneHeatmap suggestions={suggestions} />
                  </div>
                </>
              ) : (
                <div className="glass-card rounded-2xl p-12 border border-white/10 text-center">
                  <Brain className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">No AI analysis data available yet.</p>
                </div>
              )}
            </>
          )}

          {/* ── Co-Location Tab ─────────────────────────────────────────────── */}
          {activeTab === 'co-location' && (
            <>
              {coLocationLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
                </div>
              ) : coLocation && coLocation.pairs.length > 0 ? (
                <>
                  <div className="glass-card rounded-2xl p-5 border border-white/10">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Link2 className="w-4 h-4 text-cyan-400" />
                        <h2 className="text-sm font-semibold text-white">Co-Picked Item Pairs</h2>
                      </div>
                      <span className="text-xs text-gray-500">
                        Potential time saving: {coLocation.potentialTimeSavingMinutes} min/mo
                      </span>
                    </div>
                  </div>

                  <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                              Item A
                            </th>
                            <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-3">
                              Item B
                            </th>
                            <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-3">
                              Co-Picks
                            </th>
                            <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-3">
                              Bin A
                            </th>
                            <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-3">
                              Bin B
                            </th>
                            <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-3">
                              Distance
                            </th>
                            <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                              Suggestion
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {coLocation.pairs.map((pair, i) => (
                            <tr key={i} className="hover:bg-white/[0.02] transition-colors">
                              <td className="px-5 py-3">
                                <div className="text-sm font-medium text-white">{pair.itemA.code}</div>
                                <div className="text-xs text-gray-500 truncate max-w-[150px]">{pair.itemA.name}</div>
                              </td>
                              <td className="px-3 py-3">
                                <div className="text-sm font-medium text-white">{pair.itemB.code}</div>
                                <div className="text-xs text-gray-500 truncate max-w-[150px]">{pair.itemB.name}</div>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <span className="text-sm font-semibold text-white">{pair.coOccurrences}</span>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <span className="inline-block px-2 py-1 rounded-lg bg-white/5 text-gray-300 text-xs font-mono">
                                  {pair.itemABin ?? '—'}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <span className="inline-block px-2 py-1 rounded-lg bg-white/5 text-gray-300 text-xs font-mono">
                                  {pair.itemBBin ?? '—'}
                                </span>
                              </td>
                              <td className="px-3 py-3 text-center">
                                <span
                                  className={`text-sm font-medium ${pair.binDistance > 20 ? 'text-red-400' : pair.binDistance > 5 ? 'text-amber-400' : 'text-emerald-400'}`}
                                >
                                  {pair.binDistance}
                                </span>
                              </td>
                              <td className="px-5 py-3">
                                <span className="text-xs text-gray-400 line-clamp-2">{pair.suggestion}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="glass-card rounded-2xl p-12 border border-white/10 text-center">
                  <Link2 className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">
                    No co-location data available. Items need to be co-picked at least {3} times.
                  </p>
                </div>
              )}
            </>
          )}

          {/* ── Seasonal Trends Tab ────────────────────────────────────────── */}
          {activeTab === 'seasonal' && (
            <>
              {seasonalLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
                </div>
              ) : seasonal && seasonal.items.length > 0 ? (
                <>
                  <div className="glass-card rounded-2xl p-5 border border-white/10">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      <h2 className="text-sm font-semibold text-white">
                        {seasonal.seasonalAlertCount} Items with Seasonal Spikes
                      </h2>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Items with peak demand &gt;2x their average monthly volume
                    </p>
                  </div>

                  <div className="space-y-3">
                    {seasonal.items.map(item => (
                      <div
                        key={item.itemId}
                        className="glass-card rounded-2xl p-5 border border-white/10 hover:bg-white/[0.02] transition-all"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-white">{item.itemCode}</span>
                              <span
                                className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold ${(ABC_COLORS[item.abcClass] ?? ABC_COLORS.C!).bg} ${(ABC_COLORS[item.abcClass] ?? ABC_COLORS.C!).text}`}
                              >
                                {item.abcClass}
                              </span>
                              {item.currentBin && (
                                <span className="inline-block px-2 py-0.5 rounded-lg bg-white/5 text-gray-400 text-[10px] font-mono">
                                  {item.currentBin}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mb-2">{item.itemName}</p>
                            <p className="text-xs text-amber-400">{item.recommendation}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xl font-bold text-white">{item.seasonalityIndex}x</div>
                            <div className="text-[10px] text-gray-500">seasonality</div>
                            <div className="text-xs text-gray-400 mt-1">Peak: {item.peakMonth}</div>
                          </div>
                        </div>

                        {/* Mini volume bar chart */}
                        <div className="mt-3 flex items-end gap-0.5 h-8">
                          {Object.entries(item.monthlyVolumes)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([month, vol]) => {
                              const maxVol = item.peakVolume || 1;
                              const height = Math.max((vol / maxVol) * 100, 5);
                              const isPeak = month === item.peakMonth;
                              return (
                                <div
                                  key={month}
                                  className={`flex-1 rounded-sm ${isPeak ? 'bg-amber-500' : 'bg-white/10'}`}
                                  style={{ height: `${height}%` }}
                                  title={`${month}: ${vol}`}
                                />
                              );
                            })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="glass-card rounded-2xl p-12 border border-white/10 text-center">
                  <CalendarRange className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">
                    No seasonal patterns detected. Need at least 3 months of MI data.
                  </p>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

// ── Suggestions Table (extracted for reuse) ────────────────────────────

function SuggestionsTable({
  suggestions,
  applyingIds,
  onApply,
}: {
  suggestions: SlottingSuggestion[];
  applyingIds: Set<string>;
  onApply: (s: SlottingSuggestion) => void;
}) {
  return (
    <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-white">Move Suggestions ({suggestions.length})</h2>
        </div>
      </div>

      {suggestions.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">
          <CheckCircle2 className="w-10 h-10 text-emerald-500/40 mx-auto mb-3" />
          All items are optimally slotted. No moves needed.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">Item</th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-3">
                  ABC
                </th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-3">
                  Picks/Mo
                </th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-3">
                  Current Bin
                </th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-1 py-3"> </th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-3">
                  Suggested Bin
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-3">
                  Reason
                </th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-3">
                  Priority
                </th>
                <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {suggestions.map(s => {
                const abcStyle = ABC_COLORS[s.abcClass] ?? ABC_COLORS.C!;
                const isApplying = applyingIds.has(s.itemId);

                return (
                  <tr key={s.itemId} className="hover:bg-white/[0.02] transition-colors">
                    <td className="px-5 py-3">
                      <div className="text-sm font-medium text-white">{s.itemCode}</div>
                      <div className="text-xs text-gray-500 mt-0.5 max-w-[200px] truncate">{s.itemName}</div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${abcStyle.bg} ${abcStyle.text}`}
                      >
                        {s.abcClass}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-sm font-medium text-white">{s.pickFrequency}</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-block px-2 py-1 rounded-lg bg-red-500/10 text-red-400 text-xs font-mono">
                        {s.currentBin}
                      </span>
                    </td>
                    <td className="px-1 py-3 text-center">
                      <ArrowRight className="w-3.5 h-3.5 text-gray-600 mx-auto" />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className="inline-block px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-mono">
                        {s.suggestedBin}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-xs text-gray-400 line-clamp-2">{s.reason}</span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-sm font-semibold text-white">{s.priorityScore}</span>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <button
                        onClick={() => onApply(s)}
                        disabled={isApplying}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-nesma-primary/20 text-nesma-primary rounded-lg hover:bg-nesma-primary/30 transition-colors text-xs font-medium border border-nesma-primary/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isApplying ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3" />
                        )}
                        Apply
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
