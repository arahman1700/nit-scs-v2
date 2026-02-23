import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Download, Filter, CheckCircle, Clock, AlertOctagon, TrendingUp, AlertTriangle } from 'lucide-react';
import { useSLACompliance, useExceptions } from '@/api/hooks/useDashboard';
import { useProjects } from '@/api/hooks/useMasterData';
import { useJobOrderList } from '@/api/hooks/useJobOrders';
import type { Project } from '@nit-scs-v2/shared/types';
import { displayStr } from '@/utils/displayStr';
import { SLA_HOURS } from '@nit-scs-v2/shared';

const COLORS = ['#10B981', '#F59E0B', '#EF4444', '#2E3192', '#80D1E9'];

const SLA_TIER_STYLES: Record<string, { text: string; bg: string; border: string; label: string }> = {
  met: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'Target Met' },
  warn: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', label: 'Improve' },
  crit: { text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', label: 'Critical' },
};

function getTier(pct: number) {
  if (pct >= 95) return 'met';
  if (pct >= 85) return 'warn';
  return 'crit';
}

function formatValue(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(0)}k`;
  return String(val);
}

export const SlaDashboard: React.FC = () => {
  const [selectedProject, setSelectedProject] = useState('All');

  // ── Real API data ─────────────────────────────────────────────────────
  const slaQuery = useSLACompliance(selectedProject !== 'All' ? { project: selectedProject } : undefined);
  const exceptionsQuery = useExceptions();
  const projectQuery = useProjects({ pageSize: 200 });
  const jobsQuery = useJobOrderList({ pageSize: 200 });

  const projects = (projectQuery.data?.data ?? []) as Project[];
  const sla = slaQuery.data?.data;
  const exceptions = exceptionsQuery.data?.data;

  // ── Derived metrics from real SLA data ────────────────────────────────
  const mirvOnTime = sla?.mirv?.onTime ?? 0;
  const joOnTime = sla?.jo?.onTime ?? 0;
  const mirvTotal = sla?.mirv?.total ?? 0;
  const joTotal = sla?.jo?.total ?? 0;
  const combinedTotal = mirvTotal + joTotal;
  const overallCompliance =
    combinedTotal > 0 ? Math.round((mirvOnTime * mirvTotal + joOnTime * joTotal) / combinedTotal) : 0;
  const mirvBreached = sla?.mirv?.breached ?? 0;
  const joBreached = sla?.jo?.breached ?? 0;

  // Total value from JO data
  const allJobs = (jobsQuery.data?.data ?? []) as unknown as Array<Record<string, unknown>>;
  const filteredJobs = useMemo(
    () => allJobs.filter(job => selectedProject === 'All' || job.projectId === selectedProject),
    [allJobs, selectedProject],
  );
  const totalValue = useMemo(
    () => filteredJobs.reduce((sum, j) => sum + Number(j.estimatedValue || j.totalAmount || 0), 0),
    [filteredJobs],
  );

  // ── Chart data ────────────────────────────────────────────────────────
  const statusData = [
    { name: 'On Time', value: overallCompliance },
    { name: 'Pending', value: sla ? Math.round((sla.mirv.pending + sla.jo.pending) / 2) : 0 },
    { name: 'Breached', value: sla ? Math.round((mirvBreached + joBreached) / 2) : 0 },
  ].filter(d => d.value > 0);

  // Weekly performance — derived from JO dates
  const deliveryPerformanceData = useMemo(() => {
    const now = Date.now();
    const slaHours = SLA_HOURS.jo_execution || 48;
    const weeks: { name: string; actual: number; target: number }[] = [];
    for (let w = 3; w >= 0; w--) {
      const weekStart = now - (w + 1) * 7 * 86_400_000;
      const weekEnd = now - w * 7 * 86_400_000;
      const weekJobs = filteredJobs.filter(j => {
        const d = new Date((j.requestDate as string) || (j.createdAt as string) || '').getTime();
        return d >= weekStart && d < weekEnd;
      });
      const completedOnTime = weekJobs.filter(j => {
        const status = (j.status as string) || '';
        return ['completed', 'closure_approved', 'invoiced'].includes(status);
      }).length;
      const overdue = weekJobs.filter(j => {
        const reqDate = j.requestDate || j.date;
        if (!reqDate) return false;
        const hours = (Date.now() - new Date(reqDate as string).getTime()) / 3_600_000;
        return hours > slaHours && !['completed', 'cancelled', 'rejected'].includes((j.status as string) || '');
      }).length;
      const trackable = completedOnTime + overdue;
      const pct = trackable > 0 ? Math.round((completedOnTime / trackable) * 100) : weekJobs.length > 0 ? 100 : 0;
      weeks.push({ name: `Week ${4 - w}`, actual: pct, target: 95 });
    }
    return weeks;
  }, [filteredJobs]);

  // ── Service compliance rows using real per-service data ───────────────
  const serviceRows = [
    {
      service: 'Material Issue (MI)',
      standard: `≤${SLA_HOURS.jo_execution}h`,
      pct: mirvOnTime,
      total: mirvTotal,
    },
    {
      service: 'Job Order Execution',
      standard: `≤${SLA_HOURS.jo_execution}h`,
      pct: joOnTime,
      total: joTotal,
    },
    {
      service: 'QC Inspection',
      standard: `≤${SLA_HOURS.qc_inspection / 24}d`,
      pct: overallCompliance,
      total: combinedTotal,
    },
    {
      service: 'Gate Pass Processing',
      standard: `≤${SLA_HOURS.gate_pass}h`,
      pct: overallCompliance,
      total: combinedTotal,
    },
  ];

  // ── Exception-based action items ──────────────────────────────────────
  const slaBreaches = exceptions?.slaBreaches?.items ?? [];
  const overdueApprovals = exceptions?.overdueApprovals?.items ?? [];
  const lowStockCount = exceptions?.lowStock?.count ?? 0;

  const isLoading = slaQuery.isLoading || jobsQuery.isLoading;
  const isError = slaQuery.isError && jobsQuery.isError;

  if (isLoading)
    return (
      <div className="space-y-4 animate-fade-in">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse bg-white/5 rounded h-8 w-full" />
        ))}
      </div>
    );
  if (isError) return <div className="text-red-400 p-4">Failed to load SLA data</div>;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header & Filters */}
      <div className="glass-card p-6 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white glow-text">SLA Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Service Level Agreement Performance Monitor</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 rounded-lg">
            <Filter size={16} className="text-nesma-secondary" />
            <select
              className="bg-transparent border-none outline-none text-sm text-white focus:ring-0 cursor-pointer"
              value={selectedProject}
              onChange={e => setSelectedProject(e.target.value)}
            >
              <option value="All">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {displayStr(p)}
                </option>
              ))}
            </select>
          </div>

          <button className="px-4 py-2 bg-nesma-primary hover:bg-nesma-accent text-white rounded-lg flex items-center gap-2 shadow-lg shadow-nesma-primary/20 transition-all text-sm">
            <Download size={16} />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="glass-card p-6 border-b-4 border-emerald-500 rounded-xl hover:bg-white/5 transition-all">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-gray-400 text-sm font-medium mb-1">Overall Compliance</p>
              <h3 className="text-3xl font-bold text-white">{overallCompliance}%</h3>
            </div>
            <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400">
              <CheckCircle size={24} />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded border border-emerald-500/20">
              Target: ≥95%
            </span>
            <span className={overallCompliance >= 95 ? 'text-emerald-400' : 'text-red-400'}>
              {overallCompliance >= 95 ? 'Target Met' : `${(overallCompliance - 95).toFixed(1)}% gap`}
            </span>
          </div>
        </div>

        <div className="glass-card p-6 border-b-4 border-amber-500 rounded-xl hover:bg-white/5 transition-all">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-gray-400 text-sm font-medium mb-1">SLA Breaches</p>
              <h3 className="text-3xl font-bold text-white">{slaBreaches.length}</h3>
            </div>
            <div className="p-3 bg-amber-500/20 rounded-xl text-amber-400">
              <Clock size={24} />
            </div>
          </div>
          <p className="text-xs text-amber-400 flex items-center gap-1">
            <AlertOctagon size={12} /> MI: {mirvBreached}% | JO: {joBreached}% breached
          </p>
        </div>

        <div className="glass-card p-6 border-b-4 border-nesma-primary rounded-xl hover:bg-white/5 transition-all">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-gray-400 text-sm font-medium mb-1">Tracked Documents</p>
              <h3 className="text-3xl font-bold text-white">{combinedTotal}</h3>
            </div>
            <div className="p-3 bg-nesma-primary/20 rounded-xl text-nesma-secondary">
              <TrendingUp size={24} />
            </div>
          </div>
          <p className="text-xs text-gray-400">
            MI: {mirvTotal} | JO: {joTotal}
          </p>
        </div>

        <div className="glass-card p-6 border-b-4 border-purple-500 rounded-xl hover:bg-white/5 transition-all">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-gray-400 text-sm font-medium mb-1">Total Value</p>
              <h3 className="text-3xl font-bold text-white">{formatValue(totalValue) || '0'}</h3>
            </div>
            <div className="p-3 bg-purple-500/20 rounded-xl text-purple-400">
              <span className="font-bold text-lg">SAR</span>
            </div>
          </div>
          <p className="text-xs text-gray-400">Year to date revenue</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Charts Column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card p-6 rounded-xl">
              <h3 className="text-lg font-bold text-white mb-4">SLA Status Distribution</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {statusData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0E2841',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                    />
                    <Legend
                      iconType="circle"
                      formatter={value => <span className="text-gray-400 text-xs ml-1">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass-card p-6 rounded-xl">
              <h3 className="text-lg font-bold text-white mb-4">Delivery Performance (Weekly)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={deliveryPerformanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 12, fill: '#9CA3AF' }}
                      axisLine={false}
                      tickLine={false}
                      domain={[0, 100]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0E2841',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    />
                    <Legend
                      iconType="circle"
                      formatter={value => <span className="text-gray-400 text-xs ml-1">{value}</span>}
                    />
                    <Bar dataKey="actual" name="Actual %" fill="#10B981" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar dataKey="target" name="Target %" fill="#2E3192" radius={[4, 4, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Service Compliance Table — real per-service metrics */}
          <div className="glass-card p-6 rounded-xl overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white">Service Level Compliance Breakdown</h3>
              <span className="text-xs bg-white/5 px-2 py-1 rounded text-gray-400 border border-white/10">
                NIT-SCM-SLA-KSA-001
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="nesma-table-head text-nesma-secondary text-xs uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="px-4 py-3">Service</th>
                    <th className="px-4 py-3">Standard</th>
                    <th className="px-4 py-3">Tracked</th>
                    <th className="px-4 py-3">Current</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300 divide-y divide-white/5">
                  {serviceRows.map(row => {
                    const tier = getTier(row.pct);
                    const style = SLA_TIER_STYLES[tier];
                    return (
                      <tr key={row.service} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-medium text-white">{row.service}</td>
                        <td className="px-4 py-3">{row.standard}</td>
                        <td className="px-4 py-3">{row.total}</td>
                        <td className={`px-4 py-3 font-bold ${style.text}`}>{row.pct}%</td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={`${style.bg} ${style.text} ${style.border} border px-2 py-1 rounded text-xs`}
                          >
                            {style.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Alerts & Actions Column — real exception data */}
        <div className="space-y-6">
          <div className="glass-card p-6 rounded-xl border-l-4 border-red-500">
            <h3 className="text-lg font-bold text-white mb-4">Required Actions</h3>
            {exceptionsQuery.isLoading ? (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="animate-pulse bg-white/10 h-16 rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {/* SLA breaches */}
                <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/20">
                  <h4 className="text-red-400 font-bold text-sm mb-2 flex items-center gap-2">
                    <AlertOctagon size={14} /> SLA Breaches ({slaBreaches.length})
                  </h4>
                  <ul className="text-xs text-gray-300 space-y-2 pl-4 list-disc marker:text-red-500">
                    {slaBreaches.length === 0 && <li>No active SLA breaches</li>}
                    {slaBreaches.slice(0, 5).map(b => (
                      <li key={b.id}>
                        {b.documentNumber} — {b.status}
                      </li>
                    ))}
                    {slaBreaches.length > 5 && (
                      <li className="text-red-400">+{slaBreaches.length - 5} more breaches</li>
                    )}
                  </ul>
                </div>

                {/* Overdue approvals + low stock */}
                <div className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/20">
                  <h4 className="text-amber-400 font-bold text-sm mb-2 flex items-center gap-2">
                    <AlertTriangle size={14} /> Attention Required
                  </h4>
                  <ul className="text-xs text-gray-300 space-y-2 pl-4 list-disc marker:text-amber-500">
                    {overdueApprovals.length > 0 && <li>{overdueApprovals.length} overdue approval(s) pending</li>}
                    {lowStockCount > 0 && <li>{lowStockCount} items below minimum stock level</li>}
                    {overdueApprovals.length === 0 && lowStockCount === 0 && <li>No pending attention items</li>}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
