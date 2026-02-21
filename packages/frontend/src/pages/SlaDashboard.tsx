import React, { useState, useMemo, useCallback } from 'react';
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
import { Download, Filter, Calendar, CheckCircle, Clock, AlertOctagon, TrendingUp } from 'lucide-react';
import { useJobOrderList } from '@/api/hooks/useJobOrders';
import { useScrapList } from '@/api/hooks/useScrap';
import { useProjects } from '@/api/hooks/useMasterData';
import type { Project } from '@nit-scs-v2/shared/types';
import { displayStr } from '@/utils/displayStr';
import { SLA_HOURS } from '@nit-scs-v2/shared';

export const SlaDashboard: React.FC = () => {
  const [selectedProject, setSelectedProject] = useState('All');
  const [selectedMonth] = useState('Jan 2026');

  const jobsQuery = useJobOrderList({ pageSize: 200 });
  const scrapQuery = useScrapList({ pageSize: 200 });
  const projectQuery = useProjects({ pageSize: 200 });
  const projects = (projectQuery.data?.data ?? []) as Project[];
  const allJobs = (jobsQuery.data?.data ?? []) as unknown as Array<Record<string, unknown>>;
  const allScrap = (scrapQuery.data?.data ?? []) as unknown as Array<Record<string, unknown>>;

  // Compute SLA status from JO dates — stable function (no hooks deps)
  const slaHours = SLA_HOURS.jo_execution || 48;
  const computeSlaStatus = useCallback(
    (job: Record<string, unknown>): string => {
      const status = (job.status as string) || '';
      if (['completed', 'closure_approved', 'invoiced'].includes(status)) return 'On Track';
      if (['cancelled', 'rejected'].includes(status)) return 'N/A';
      const requestDate = job.requestDate || job.date;
      if (!requestDate) return 'On Track';
      const hoursSince = (Date.now() - new Date(requestDate as string).getTime()) / 3_600_000;
      if (hoursSince <= slaHours * 0.75) return 'On Track';
      if (hoursSince <= slaHours) return 'At Risk';
      return 'Overdue';
    },
    [slaHours],
  );

  // Filter Data
  const filteredJobs = useMemo(() => {
    return allJobs.filter(job => selectedProject === 'All' || job.projectId === selectedProject);
  }, [allJobs, selectedProject]);

  // Loading / error
  const isLoading = jobsQuery.isLoading;
  const isError = jobsQuery.isError;

  // Derived Metrics
  const totalJobs = filteredJobs.length;
  const slaResults = useMemo(() => filteredJobs.map(j => computeSlaStatus(j)), [filteredJobs, computeSlaStatus]);
  const onTrack = slaResults.filter(s => s === 'On Track').length;
  const atRisk = slaResults.filter(s => s === 'At Risk').length;
  const overdue = slaResults.filter(s => s === 'Overdue').length;
  const trackableJobs = onTrack + atRisk + overdue;
  const onTimePercentage = trackableJobs > 0 ? ((onTrack / trackableJobs) * 100).toFixed(1) : '0.0';

  // Total value from job orders
  const totalValue = useMemo(
    () => filteredJobs.reduce((sum, j) => sum + Number(j.estimatedValue || j.totalAmount || 0), 0),
    [filteredJobs],
  );
  const totalValueLabel =
    totalValue >= 1_000_000
      ? `${(totalValue / 1_000_000).toFixed(1)}M`
      : totalValue >= 1_000
        ? `${(totalValue / 1_000).toFixed(0)}k`
        : String(totalValue);

  // Chart Data
  const statusData = [
    { name: 'On Track', value: onTrack },
    { name: 'At Risk', value: atRisk },
    { name: 'Overdue', value: overdue },
  ].filter(d => d.value > 0);

  // Weekly delivery performance from JO data
  const deliveryPerformanceData = useMemo(() => {
    const now = Date.now();
    const weeks: { name: string; actual: number; target: number }[] = [];
    for (let w = 3; w >= 0; w--) {
      const weekStart = now - (w + 1) * 7 * 86_400_000;
      const weekEnd = now - w * 7 * 86_400_000;
      const weekJobs = filteredJobs.filter(j => {
        const d = new Date((j.requestDate as string) || (j.createdAt as string) || '').getTime();
        return d >= weekStart && d < weekEnd;
      });
      const onTime = weekJobs.filter(j => computeSlaStatus(j) === 'On Track').length;
      const pct = weekJobs.length > 0 ? Math.round((onTime / weekJobs.length) * 100) : 0;
      weeks.push({ name: `Week ${4 - w}`, actual: pct, target: 95 });
    }
    return weeks;
  }, [filteredJobs, computeSlaStatus]);

  // Scrap summary from API
  const scrapSummary = useMemo(() => {
    let cableValue = 0;
    let woodValue = 0;
    let otherValue = 0;
    for (const s of allScrap) {
      const val = Number(s.estimatedValue || s.soldAmount || 0);
      const type = String(s.materialType || '').toLowerCase();
      if (type.includes('cable')) cableValue += val;
      else if (type.includes('wood')) woodValue += val;
      else otherValue += val;
    }
    const total = cableValue + woodValue + otherValue;
    return { count: allScrap.length, cableValue, woodValue, otherValue, total };
  }, [allScrap]);

  const COLORS = ['#10B981', '#F59E0B', '#EF4444', '#2E3192', '#80D1E9'];

  if (isLoading)
    return (
      <div className="space-y-4 animate-fade-in">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse bg-white/5 rounded h-8 w-full"></div>
        ))}
      </div>
    );
  if (isError) return <div className="text-red-400 p-4">Failed to load data</div>;

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

          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 rounded-lg">
            <Calendar size={16} className="text-nesma-secondary" />
            <span className="text-sm text-white">{selectedMonth}</span>
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
              <p className="text-gray-400 text-sm font-medium mb-1">On-Time Delivery</p>
              <h3 className="text-3xl font-bold text-white">{onTimePercentage}%</h3>
            </div>
            <div className="p-3 bg-emerald-500/20 rounded-xl text-emerald-400">
              <CheckCircle size={24} />
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded border border-emerald-500/20">
              Target: ≥95%
            </span>
            <span className={`${parseFloat(onTimePercentage) >= 95 ? 'text-emerald-400' : 'text-red-400'}`}>
              {parseFloat(onTimePercentage) >= 95
                ? 'Target Met'
                : `${(parseFloat(onTimePercentage) - 95).toFixed(1)}% gap`}
            </span>
          </div>
        </div>

        <div className="glass-card p-6 border-b-4 border-amber-500 rounded-xl hover:bg-white/5 transition-all">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-gray-400 text-sm font-medium mb-1">Open Orders</p>
              <h3 className="text-3xl font-bold text-white">{totalJobs}</h3>
            </div>
            <div className="p-3 bg-amber-500/20 rounded-xl text-amber-400">
              <Clock size={24} />
            </div>
          </div>
          <p className="text-xs text-amber-400 flex items-center gap-1">
            <AlertOctagon size={12} /> {atRisk} jobs at risk of delay
          </p>
        </div>

        <div className="glass-card p-6 border-b-4 border-nesma-primary rounded-xl hover:bg-white/5 transition-all">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-gray-400 text-sm font-medium mb-1">Total Orders</p>
              <h3 className="text-3xl font-bold text-white">{totalJobs}</h3>
            </div>
            <div className="p-3 bg-nesma-primary/20 rounded-xl text-nesma-secondary">
              <TrendingUp size={24} />
            </div>
          </div>
          <p className="text-xs text-gray-400">
            {trackableJobs} trackable | {totalJobs - trackableJobs} N/A
          </p>
        </div>

        <div className="glass-card p-6 border-b-4 border-purple-500 rounded-xl hover:bg-white/5 transition-all">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-gray-400 text-sm font-medium mb-1">Total Value</p>
              <h3 className="text-3xl font-bold text-white">{totalValueLabel || '0'}</h3>
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
          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card p-6 rounded-xl">
              <h3 className="text-lg font-bold text-white mb-4">Order Status Distribution</h3>
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
                      {statusData.map((entry, index) => (
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

          {/* Service Compliance Table */}
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
                    <th className="px-4 py-3">Target</th>
                    <th className="px-4 py-3">Current</th>
                    <th className="px-4 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="text-gray-300 divide-y divide-white/5">
                  {[
                    { service: 'Job Order Execution', standard: `≤${SLA_HOURS.jo_execution}h`, slaKey: 'jo_execution' },
                    { service: 'Gate Pass Processing', standard: `≤${SLA_HOURS.gate_pass}h`, slaKey: 'gate_pass' },
                    {
                      service: 'QC Inspection',
                      standard: `≤${SLA_HOURS.qc_inspection / 24}d`,
                      slaKey: 'qc_inspection',
                    },
                    {
                      service: 'Scrap Buyer Pickup',
                      standard: `≤${SLA_HOURS.scrap_buyer_pickup / 24}d`,
                      slaKey: 'scrap_buyer_pickup',
                    },
                  ].map(row => {
                    const pct = trackableJobs > 0 ? parseFloat(onTimePercentage) : 0;
                    const tier = pct >= 95 ? 'met' : pct >= 85 ? 'warn' : 'crit';
                    const SLA_TIER_STYLES: Record<string, { text: string; bg: string; border: string; label: string }> =
                      {
                        met: {
                          text: 'text-emerald-400',
                          bg: 'bg-emerald-500/10',
                          border: 'border-emerald-500/20',
                          label: 'Target Met',
                        },
                        warn: {
                          text: 'text-amber-400',
                          bg: 'bg-amber-500/10',
                          border: 'border-amber-500/20',
                          label: 'Improve',
                        },
                        crit: {
                          text: 'text-red-400',
                          bg: 'bg-red-500/10',
                          border: 'border-red-500/20',
                          label: 'Critical',
                        },
                      };
                    const style = SLA_TIER_STYLES[tier];
                    return (
                      <tr key={row.slaKey} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-medium text-white">{row.service}</td>
                        <td className="px-4 py-3">{row.standard}</td>
                        <td className="px-4 py-3">≥95%</td>
                        <td className={`px-4 py-3 font-bold ${style.text}`}>{pct.toFixed(1)}%</td>
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

        {/* Alerts & Actions Column */}
        <div className="space-y-6">
          <div className="glass-card p-6 rounded-xl border-l-4 border-red-500">
            <h3 className="text-lg font-bold text-white mb-4">Required Actions</h3>
            <div className="space-y-4">
              <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/20">
                <h4 className="text-red-400 font-bold text-sm mb-2 flex items-center gap-2">
                  <AlertOctagon size={14} /> Immediate (1 Week)
                </h4>
                <ul className="text-xs text-gray-300 space-y-2 pl-4 list-disc marker:text-red-500">
                  <li>Process {overdue} overdue orders immediately</li>
                  <li>Improve equipment delivery time for Project Beta</li>
                </ul>
              </div>
              <div className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/20">
                <h4 className="text-amber-400 font-bold text-sm mb-2 flex items-center gap-2">
                  <Clock size={14} /> Near Term (1 Month)
                </h4>
                <ul className="text-xs text-gray-300 space-y-2 pl-4 list-disc marker:text-amber-500">
                  <li>Create Material Days in Custody report</li>
                  <li>Complete quarterly inventory for remaining 30%</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="glass-card p-6 rounded-xl">
            <h3 className="text-lg font-bold text-white mb-4">Scrap Summary</h3>
            {scrapQuery.isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="animate-pulse bg-white/10 h-6 rounded" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-3 border-b border-white/10">
                  <span className="text-sm text-gray-400">Total Items</span>
                  <span className="font-bold text-white">{scrapSummary.count}</span>
                </div>
                {scrapSummary.cableValue > 0 && (
                  <div className="flex justify-between items-center pb-3 border-b border-white/10">
                    <span className="text-sm text-gray-400">Cable Scrap</span>
                    <span className="font-bold text-purple-400">
                      {(scrapSummary.cableValue / 1000).toFixed(0)}k SAR
                    </span>
                  </div>
                )}
                {scrapSummary.woodValue > 0 && (
                  <div className="flex justify-between items-center pb-3 border-b border-white/10">
                    <span className="text-sm text-gray-400">Wood Scrap</span>
                    <span className="font-bold text-amber-400">{(scrapSummary.woodValue / 1000).toFixed(0)}k SAR</span>
                  </div>
                )}
                {scrapSummary.otherValue > 0 && (
                  <div className="flex justify-between items-center pb-3 border-b border-white/10">
                    <span className="text-sm text-gray-400">Other Scrap</span>
                    <span className="font-bold text-gray-300">{(scrapSummary.otherValue / 1000).toFixed(0)}k SAR</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2">
                  <span className="text-sm text-gray-300 font-bold">Total Value</span>
                  <span className="font-bold text-xl text-nesma-secondary">
                    {scrapSummary.total >= 1_000_000
                      ? `${(scrapSummary.total / 1_000_000).toFixed(2)}M SAR`
                      : `${(scrapSummary.total / 1_000).toFixed(0)}k SAR`}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
