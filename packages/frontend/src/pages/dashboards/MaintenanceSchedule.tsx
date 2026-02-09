import React, { useMemo } from 'react';
import { Wrench, Calendar, Loader2 } from 'lucide-react';
import { useGeneratorMaintenanceList } from '@/api/hooks';
import { StatusBadge } from '@/components/StatusBadge';

// ── Maintenance Schedule Dashboard ─────────────────────────────────────────
// Rendered as tab content inside LogisticsSectionPage (Maintenance tab).
// Shows generator maintenance records, status breakdown KPIs, and schedule.

/** Normalize raw status strings to display-friendly labels for StatusBadge */
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
  const { data: maintResponse, isLoading } = useGeneratorMaintenanceList({ pageSize: 20 });

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
              <Calendar className="w-4 h-4" />
            </div>
            <p className="text-xs text-gray-400">Overdue</p>
          </div>
          <p className="text-2xl font-bold text-red-400">{summary.overdue}</p>
        </div>
      </div>

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
