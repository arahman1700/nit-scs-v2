import React, { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Wrench, Calendar, Loader2, AlertTriangle } from 'lucide-react';
import { useGeneratorMaintenanceList } from '@/api/hooks';
import { StatusBadge } from '@/components/StatusBadge';

// ── Maintenance Schedule Dashboard ─────────────────────────────────────────
// Rendered as tab content inside LogisticsSectionPage (Maintenance tab).
// Shows generator maintenance records, status breakdown, and schedule.

const STATUS_COLORS: Record<string, string> = {
  Scheduled: '#6b7280', // gray-500
  'In Progress': '#f59e0b', // amber-500
  Completed: '#34d399', // emerald-400
  Overdue: '#ef4444', // red-500
  New: '#6b7280',
};

const CHART_GRID = 'rgba(255,255,255,0.06)';
const CHART_TEXT = '#9ca3af';

/** Normalize raw status strings to display-friendly labels */
const normalizeStatus = (raw: unknown): string => {
  const s = String(raw ?? '')
    .toLowerCase()
    .trim();
  switch (s) {
    case 'completed':
      return 'Completed';
    case 'in_progress':
    case 'in progress':
      return 'In Progress';
    case 'overdue':
      return 'Overdue';
    case 'scheduled':
    default:
      return 'New';
  }
};

export const MaintenanceSchedule: React.FC = () => {
  const { data: maintResponse, isLoading } = useGeneratorMaintenanceList({ pageSize: 50 });

  const rows = (maintResponse?.data ?? []) as Record<string, unknown>[];

  // ── Summary KPIs ───────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const scheduled = rows.filter(r => String(r.status ?? '').toLowerCase() === 'scheduled').length;
    const inProgress = rows.filter(r => {
      const s = String(r.status ?? '').toLowerCase();
      return s === 'in_progress' || s === 'in progress';
    }).length;
    const completed = rows.filter(r => String(r.status ?? '').toLowerCase() === 'completed').length;
    const overdue = rows.filter(r => String(r.status ?? '').toLowerCase() === 'overdue').length;
    return { scheduled, inProgress, completed, overdue };
  }, [rows]);

  // ── Pie chart data ───────────────────────────────────────────────────
  const pieData = useMemo(() => {
    const entries = [
      { name: 'Scheduled', value: summary.scheduled },
      { name: 'In Progress', value: summary.inProgress },
      { name: 'Completed', value: summary.completed },
      { name: 'Overdue', value: summary.overdue },
    ];
    return entries.filter(e => e.value > 0);
  }, [summary]);

  // ── Maintenance by type ─────────────────────────────────────────────
  const byType = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const type = String(r.maintenanceType ?? r.type ?? 'Other');
      map.set(type, (map.get(type) ?? 0) + 1);
    }
    return Array.from(map, ([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count);
  }, [rows]);

  // ── Upcoming maintenance (next 7 days) ──────────────────────────────
  const upcoming = useMemo(() => {
    const now = new Date();
    const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return rows
      .filter(r => {
        const status = String(r.status ?? '').toLowerCase();
        if (status === 'completed') return false;
        const dateStr = r.scheduledDate ?? r.scheduledAt;
        if (!dateStr || typeof dateStr !== 'string') return false;
        const d = new Date(dateStr);
        return d >= now && d <= weekAhead;
      })
      .sort((a, b) => {
        const da = new Date(String(a.scheduledDate ?? a.scheduledAt ?? '')).getTime();
        const db = new Date(String(b.scheduledDate ?? b.scheduledAt ?? '')).getTime();
        return da - db;
      })
      .slice(0, 5);
  }, [rows]);

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
        <span className="ml-3 text-gray-400">Loading maintenance data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Summary Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-gray-500/20 rounded-lg text-gray-400">
              <Calendar className="w-4 h-4" />
            </div>
            <p className="text-xs text-gray-400">Scheduled</p>
          </div>
          <p className="text-2xl font-bold text-white">{summary.scheduled}</p>
        </div>

        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-amber-500/20 rounded-lg text-amber-400">
              <Wrench className="w-4 h-4" />
            </div>
            <p className="text-xs text-gray-400">In Progress</p>
          </div>
          <p className="text-2xl font-bold text-amber-400">{summary.inProgress}</p>
        </div>

        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400">
              <Wrench className="w-4 h-4" />
            </div>
            <p className="text-xs text-gray-400">Completed</p>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{summary.completed}</p>
        </div>

        <div className="glass-card p-4 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-red-500/20 rounded-lg text-red-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <p className="text-xs text-gray-400">Overdue</p>
          </div>
          <p className="text-2xl font-bold text-red-400">{summary.overdue}</p>
        </div>
      </div>

      {/* ── Charts + Upcoming Row ──────────────────────────────────────── */}
      {rows.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Status distribution pie */}
          <div className="glass-card rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Status Distribution</h3>
            {pieData.length > 0 ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={45}
                      paddingAngle={2}
                    >
                      {pieData.map(entry => (
                        <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#6b7280'} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(10,22,40,0.95)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8,
                        color: '#fff',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-12">No data</p>
            )}
            {/* Legend */}
            <div className="flex flex-wrap gap-3 mt-2 justify-center">
              {pieData.map(entry => (
                <div key={entry.name} className="flex items-center gap-1.5 text-xs text-gray-400">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[entry.name] }} />
                  {entry.name} ({entry.value})
                </div>
              ))}
            </div>
          </div>

          {/* By type bar chart */}
          {byType.length > 0 && (
            <div className="glass-card rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">By Maintenance Type</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={byType} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
                    <XAxis type="number" tick={{ fill: CHART_TEXT, fontSize: 11 }} />
                    <YAxis dataKey="type" type="category" width={100} tick={{ fill: CHART_TEXT, fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(10,22,40,0.95)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8,
                        color: '#fff',
                      }}
                    />
                    <Bar dataKey="count" fill="#80D1E9" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Upcoming maintenance */}
          <div className="glass-card rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Upcoming (7 Days)</h3>
            {upcoming.length > 0 ? (
              <div className="space-y-3">
                {upcoming.map((row, idx) => {
                  const status = normalizeStatus(row.status);
                  return (
                    <div key={String(row.id ?? idx)} className="flex items-start gap-3 p-3 bg-white/5 rounded-lg">
                      <div className="mt-0.5 w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">
                          {String(row.generatorName ?? row.generatorId ?? 'Generator')}
                        </p>
                        <p className="text-xs text-gray-400">
                          {String(row.maintenanceType ?? row.type ?? '--')} —{' '}
                          {formatDate(row.scheduledDate ?? row.scheduledAt)}
                        </p>
                      </div>
                      <StatusBadge status={status} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-sm text-center py-8">No upcoming maintenance in the next 7 days</p>
            )}
          </div>
        </div>
      )}

      {/* ── Maintenance Table ──────────────────────────────────────────── */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">Maintenance Schedule</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-gray-400 border-b border-white/10">
              <tr>
                <th className="pb-3 pt-3 pl-4">Generator</th>
                <th className="pb-3 pt-3">Type</th>
                <th className="pb-3 pt-3">Scheduled Date</th>
                <th className="pb-3 pt-3">Completed Date</th>
                <th className="pb-3 pt-3 text-center">Status</th>
                <th className="pb-3 pt-3 pr-4">Performed By</th>
              </tr>
            </thead>
            <tbody className="text-white divide-y divide-white/5">
              {rows.length > 0 ? (
                rows.map((row, idx) => (
                  <tr key={String(row.id ?? idx)} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 pl-4 font-medium">{String(row.generatorName ?? row.generatorId ?? '--')}</td>
                    <td className="py-3 capitalize text-gray-300">{String(row.maintenanceType ?? row.type ?? '--')}</td>
                    <td className="py-3 text-gray-400">{formatDate(row.scheduledDate ?? row.scheduledAt)}</td>
                    <td className="py-3 text-gray-400">{formatDate(row.completedDate ?? row.completedAt)}</td>
                    <td className="py-3 text-center">
                      <StatusBadge status={normalizeStatus(row.status)} />
                    </td>
                    <td className="py-3 pr-4 text-gray-400">
                      {String(row.performedBy ?? row.performedByName ?? '--')}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    No maintenance records found
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
