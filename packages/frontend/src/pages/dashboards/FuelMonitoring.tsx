import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { Droplets, DollarSign, Loader2 } from 'lucide-react';
import { useGeneratorFuelList } from '@/api/hooks';

// ── Fuel Monitoring Dashboard ──────────────────────────────────────────────
// Rendered as tab content inside LogisticsSectionPage (Fuel tab).
// Shows generator fuel consumption logs, trend charts, and cost analysis.

const CHART_COLORS = {
  fuel: '#22d3ee', // cyan-400
  cost: '#34d399', // emerald-400
  grid: 'rgba(255,255,255,0.06)',
  text: '#9ca3af', // gray-400
};

export const FuelMonitoring: React.FC = () => {
  const { data: fuelResponse, isLoading } = useGeneratorFuelList({
    pageSize: 50,
    sortBy: 'fuelDate',
    sortDir: 'desc',
  });

  const rows = (fuelResponse?.data ?? []) as Record<string, unknown>[];

  // ── Summary KPIs ───────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const totalFuel = rows.reduce((sum, r) => sum + Number(r.quantity ?? r.fuelQuantity ?? 0), 0);
    const totalCost = rows.reduce((sum, r) => sum + Number(r.totalCost ?? 0), 0);
    const avgCostPerLiter = totalFuel > 0 ? totalCost / totalFuel : 0;
    const logCount = rows.length;
    return { totalFuel, totalCost, avgCostPerLiter, logCount };
  }, [rows]);

  // ── Chart data: aggregate by date ────────────────────────────────────
  const dailyData = useMemo(() => {
    const byDate = new Map<string, { fuel: number; cost: number }>();
    for (const r of rows) {
      const raw = r.fuelDate ?? r.createdAt;
      if (!raw || typeof raw !== 'string') continue;
      const key = new Date(raw).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const entry = byDate.get(key) ?? { fuel: 0, cost: 0 };
      entry.fuel += Number(r.quantity ?? r.fuelQuantity ?? 0);
      entry.cost += Number(r.totalCost ?? 0);
      byDate.set(key, entry);
    }
    // Return chronologically (rows are desc, so reverse)
    return Array.from(byDate, ([date, vals]) => ({ date, ...vals }))
      .reverse()
      .slice(-14);
  }, [rows]);

  // ── Chart data: aggregate by generator ───────────────────────────────
  const byGenerator = useMemo(() => {
    const map = new Map<string, { fuel: number; cost: number }>();
    for (const r of rows) {
      const name = String(r.generatorName ?? r.generatorId ?? 'Unknown');
      const entry = map.get(name) ?? { fuel: 0, cost: 0 };
      entry.fuel += Number(r.quantity ?? r.fuelQuantity ?? 0);
      entry.cost += Number(r.totalCost ?? 0);
      map.set(name, entry);
    }
    return Array.from(map, ([name, vals]) => ({ name, ...vals }))
      .sort((a, b) => b.fuel - a.fuel)
      .slice(0, 8);
  }, [rows]);

  const formatAmount = (val: number) => {
    if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (val >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
    return val.toLocaleString();
  };

  const formatDate = (dateStr: unknown) => {
    if (!dateStr || typeof dateStr !== 'string') return '--';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // ── Loading state ──────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-7 h-7 text-nesma-secondary animate-spin" />
        <span className="ml-3 text-gray-400">Loading fuel data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Summary Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-cyan-500/20 rounded-lg text-cyan-400">
              <Droplets className="w-4 h-4" />
            </div>
            <p className="text-xs text-gray-400">Total Fuel (L)</p>
          </div>
          <p className="text-2xl font-bold text-white">{formatAmount(summary.totalFuel)}</p>
        </div>

        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-green-500/20 rounded-lg text-green-400">
              <DollarSign className="w-4 h-4" />
            </div>
            <p className="text-xs text-gray-400">Total Cost (SAR)</p>
          </div>
          <p className="text-2xl font-bold text-white">
            {formatAmount(summary.totalCost)} <span className="text-sm font-normal text-gray-400">SAR</span>
          </p>
        </div>

        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400">
              <DollarSign className="w-4 h-4" />
            </div>
            <p className="text-xs text-gray-400">Avg Cost/Liter</p>
          </div>
          <p className="text-2xl font-bold text-amber-400">
            {summary.avgCostPerLiter > 0 ? summary.avgCostPerLiter.toFixed(2) : '--'}{' '}
            <span className="text-sm font-normal text-gray-400">SAR</span>
          </p>
        </div>

        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-purple-500/20 rounded-lg text-purple-400">
              <Droplets className="w-4 h-4" />
            </div>
            <p className="text-xs text-gray-400">Log Count</p>
          </div>
          <p className="text-2xl font-bold text-white">{summary.logCount}</p>
        </div>
      </div>

      {/* ── Charts Row ─────────────────────────────────────────────────── */}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Daily consumption trend */}
          <div className="glass-card rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Daily Consumption Trend</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis dataKey="date" tick={{ fill: CHART_COLORS.text, fontSize: 11 }} />
                  <YAxis tick={{ fill: CHART_COLORS.text, fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(10,22,40,0.95)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8,
                      color: '#fff',
                    }}
                    formatter={(value, name) => [
                      `${Number(value ?? 0).toLocaleString()} ${name === 'fuel' ? 'L' : 'SAR'}`,
                      name === 'fuel' ? 'Fuel' : 'Cost',
                    ]}
                  />
                  <Bar dataKey="fuel" fill={CHART_COLORS.fuel} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Cost trend line */}
          <div className="glass-card rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Cost Trend (SAR)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis dataKey="date" tick={{ fill: CHART_COLORS.text, fontSize: 11 }} />
                  <YAxis tick={{ fill: CHART_COLORS.text, fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(10,22,40,0.95)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 8,
                      color: '#fff',
                    }}
                    formatter={value => [`${Number(value ?? 0).toLocaleString()} SAR`, 'Cost']}
                  />
                  <Line
                    type="monotone"
                    dataKey="cost"
                    stroke={CHART_COLORS.cost}
                    strokeWidth={2}
                    dot={{ fill: CHART_COLORS.cost, r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Consumption by generator */}
          {byGenerator.length > 1 && (
            <div className="glass-card rounded-2xl p-6 lg:col-span-2">
              <h3 className="text-lg font-semibold text-white mb-4">Consumption by Generator</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byGenerator} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                    <XAxis type="number" tick={{ fill: CHART_COLORS.text, fontSize: 11 }} />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={120}
                      tick={{ fill: CHART_COLORS.text, fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(10,22,40,0.95)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8,
                        color: '#fff',
                      }}
                      formatter={(value, name) => [
                        `${Number(value ?? 0).toLocaleString()} ${name === 'fuel' ? 'L' : 'SAR'}`,
                        name === 'fuel' ? 'Fuel' : 'Cost',
                      ]}
                    />
                    <Bar dataKey="fuel" fill={CHART_COLORS.fuel} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Fuel Logs Table ────────────────────────────────────────────── */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">Fuel Consumption Logs</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-gray-400 border-b border-white/10">
              <tr>
                <th className="pb-3 pt-3 pl-4">Generator</th>
                <th className="pb-3 pt-3">Date</th>
                <th className="pb-3 pt-3 text-right">Qty (L)</th>
                <th className="pb-3 pt-3 text-right">Cost/L</th>
                <th className="pb-3 pt-3 text-right">Total Cost</th>
                <th className="pb-3 pt-3">Supplier</th>
                <th className="pb-3 pt-3 pr-4">Logged By</th>
              </tr>
            </thead>
            <tbody className="text-white divide-y divide-white/5">
              {rows.length > 0 ? (
                rows.map((row, idx) => {
                  const qty = Number(row.quantity ?? row.fuelQuantity ?? 0);
                  const costPerL = Number(row.costPerLiter ?? 0);
                  const total = Number(row.totalCost ?? qty * costPerL);
                  return (
                    <tr key={String(row.id ?? idx)} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 pl-4 font-medium">{String(row.generatorName ?? row.generatorId ?? '--')}</td>
                      <td className="py-3 text-gray-400">{formatDate(row.fuelDate ?? row.createdAt)}</td>
                      <td className="py-3 text-right">{qty.toLocaleString()}</td>
                      <td className="py-3 text-right">{costPerL.toFixed(2)}</td>
                      <td className="py-3 text-right font-medium">{total.toLocaleString()}</td>
                      <td className="py-3 text-gray-300">{String(row.supplier ?? row.supplierName ?? '--')}</td>
                      <td className="py-3 pr-4 text-gray-400">{String(row.loggedBy ?? row.createdByName ?? '--')}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500">
                    No fuel logs found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
