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
} from 'lucide-react';
import { useSlottingAnalysis, usePickFrequencies, useApplySlotting } from '@/api/hooks/useSlotting';
import { useWarehouses } from '@/api/hooks/useMasterData';
import type { SlottingSuggestion } from '@/api/hooks/useSlotting';

// ── Constants ───────────────────────────────────────────────────────────

const ABC_COLORS: Record<string, { bg: string; text: string }> = {
  A: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  B: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  C: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
};

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
        {/* Background arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
        {/* Projected arc (lighter) */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="rgba(16,185,129,0.2)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${projectedDash} ${circumference}`}
        />
        {/* Current arc */}
        <path
          d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
          fill="none"
          stroke="#10b981"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${currentDash} ${circumference}`}
        />
        {/* Center text */}
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

// ── Main Component ──────────────────────────────────────────────────────

export const SlottingPage: React.FC = () => {
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [applyingIds, setApplyingIds] = useState<Set<string>>(new Set());

  // Queries
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
    // Apply top suggestions sequentially (batch)
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
            <p className="text-sm text-gray-400">Optimize bin placement based on pick frequency and ABC class</p>
          </div>
        </div>
        {suggestions.length > 0 && (
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
            {/* Gauge */}
            <div className="glass-card rounded-2xl p-6 border border-white/10 flex flex-col items-center justify-center">
              <h2 className="text-sm font-semibold text-white mb-4">Efficiency Gauge</h2>
              <EfficiencyGauge
                current={analysis?.currentEfficiency ?? 0}
                projected={analysis?.projectedEfficiency ?? 0}
              />
            </div>

            {/* Frequency Bar Chart */}
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
                      formatter={(value: number) => [`${value} picks/mo`, 'Frequency']}
                    />
                    <Bar dataKey="frequency" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Suggestions Table */}
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
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-5 py-3">
                        Item
                      </th>
                      <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-3">
                        ABC
                      </th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-3">
                        Picks/Mo
                      </th>
                      <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-3 py-3">
                        Current Bin
                      </th>
                      <th className="text-center text-xs font-medium text-gray-500 uppercase tracking-wider px-1 py-3">
                        {' '}
                      </th>
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
                              onClick={() => handleApply(s)}
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
        </>
      )}
    </div>
  );
};
