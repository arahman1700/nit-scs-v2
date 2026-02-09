
import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Download, Filter, Calendar, CheckCircle, Clock, AlertOctagon, TrendingUp } from 'lucide-react';
import { useJobOrderList } from '@/api/hooks/useJobOrders';
import { useProjects } from '@/api/hooks/useMasterData';
import type { Project } from '@nit-scs/shared/types';

export const SlaDashboard: React.FC = () => {
  const [selectedProject, setSelectedProject] = useState('All');
  const [selectedMonth, setSelectedMonth] = useState('Jan 2026');

  const jobsQuery = useJobOrderList({ pageSize: 200 });
  const projectQuery = useProjects({ pageSize: 200 });
  const projects = (projectQuery.data?.data ?? []) as Project[];
  const allJobs = (jobsQuery.data?.data ?? []) as Array<Record<string, unknown>>;

  // Filter Data
  const filteredJobs = useMemo(() => {
    return allJobs.filter(job => selectedProject === 'All' || job.project === selectedProject);
  }, [allJobs, selectedProject]);

  // Loading / error
  const isLoading = jobsQuery.isLoading;
  const isError = jobsQuery.isError;

  // Derived Metrics
  const totalJobs = filteredJobs.length;
  const onTrack = filteredJobs.filter(j => j.slaStatus === 'On Track').length;
  const atRisk = filteredJobs.filter(j => j.slaStatus === 'At Risk').length;
  const overdue = filteredJobs.filter(j => j.slaStatus === 'Overdue').length;
  const onTimePercentage = totalJobs > 0 ? ((onTrack / totalJobs) * 100).toFixed(1) : '0.0';

  // Chart Data
  const statusData = [
    { name: 'On Track', value: onTrack },
    { name: 'At Risk', value: atRisk },
    { name: 'Overdue', value: overdue },
  ].filter(d => d.value > 0);

  const companyData = [
    { name: 'NIT', value: Math.floor(totalJobs * 0.7) },
    { name: 'NP', value: Math.floor(totalJobs * 0.2) },
    { name: 'Logistic', value: Math.floor(totalJobs * 0.1) },
  ];

  const deliveryPerformanceData = [
    { name: 'Week 1', actual: 95, target: 95 },
    { name: 'Week 2', actual: 88, target: 95 },
    { name: 'Week 3', actual: 92, target: 95 },
    { name: 'Week 4', actual: 97, target: 95 },
  ];

  const COLORS = ['#10B981', '#F59E0B', '#EF4444', '#2E3192', '#80D1E9'];

  if (isLoading) return <div className="space-y-4 animate-fade-in">{[1,2,3].map(i => <div key={i} className="animate-pulse bg-white/5 rounded h-8 w-full"></div>)}</div>;
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
                onChange={(e) => setSelectedProject(e.target.value)}
              >
                <option value="All">All Projects</option>
                {projects.map(p => (
                  <option key={p.id as string} value={p.name as string}>{p.name as string}</option>
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
            <span className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded border border-emerald-500/20">Target: ≥95%</span>
            <span className={`${parseFloat(onTimePercentage) >= 95 ? 'text-emerald-400' : 'text-red-400'}`}>
              {parseFloat(onTimePercentage) >= 95 ? 'Target Met' : `${(parseFloat(onTimePercentage) - 95).toFixed(1)}% gap`}
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
              <h3 className="text-3xl font-bold text-white">{totalJobs + 150}</h3>
            </div>
            <div className="p-3 bg-nesma-primary/20 rounded-xl text-nesma-secondary">
              <TrendingUp size={24} />
            </div>
          </div>
          <p className="text-xs text-gray-400">NIT: {Math.floor((totalJobs + 150) * 0.7)} | NP: {Math.floor((totalJobs + 150) * 0.3)}</p>
        </div>

        <div className="glass-card p-6 border-b-4 border-purple-500 rounded-xl hover:bg-white/5 transition-all">
          <div className="flex justify-between items-start mb-4">
            <div>
              <p className="text-gray-400 text-sm font-medium mb-1">Total Value</p>
              <h3 className="text-3xl font-bold text-white">5.1M</h3>
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
                    <Tooltip contentStyle={{ backgroundColor: '#0E2841', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
                    <Legend iconType="circle" formatter={(value) => <span className="text-gray-400 text-xs ml-1">{value}</span>} />
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
                    <XAxis dataKey="name" tick={{fontSize: 12, fill: '#9CA3AF'}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize: 12, fill: '#9CA3AF'}} axisLine={false} tickLine={false} domain={[0, 100]} />
                    <Tooltip contentStyle={{ backgroundColor: '#0E2841', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                    <Legend iconType="circle" formatter={(value) => <span className="text-gray-400 text-xs ml-1">{value}</span>} />
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
              <span className="text-xs bg-white/5 px-2 py-1 rounded text-gray-400 border border-white/10">NIT-SCM-SLA-KSA-001</span>
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
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">Equipment Request</td>
                    <td className="px-4 py-3">≤1 Day</td>
                    <td className="px-4 py-3">≥95%</td>
                    <td className="px-4 py-3 text-emerald-400 font-bold">98.5%</td>
                    <td className="px-4 py-3 text-right"><span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded text-xs">Excellent</span></td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">Equipment Delivery</td>
                    <td className="px-4 py-3">2-3 Days</td>
                    <td className="px-4 py-3">≥95%</td>
                    <td className="px-4 py-3 text-amber-400 font-bold">88.0%</td>
                    <td className="px-4 py-3 text-right"><span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-1 rounded text-xs">Improve</span></td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">Scrap Removal</td>
                    <td className="px-4 py-3">≤3 Days</td>
                    <td className="px-4 py-3">≥95%</td>
                    <td className="px-4 py-3 text-emerald-400 font-bold">97.8%</td>
                    <td className="px-4 py-3 text-right"><span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded text-xs">Target Met</span></td>
                  </tr>
                  <tr className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">Material Movement</td>
                    <td className="px-4 py-3">≤2 Days</td>
                    <td className="px-4 py-3">≥95%</td>
                    <td className="px-4 py-3 text-emerald-400 font-bold">95.7%</td>
                    <td className="px-4 py-3 text-right"><span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded text-xs">Target Met</span></td>
                  </tr>
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
                <h4 className="text-red-400 font-bold text-sm mb-2 flex items-center gap-2"><AlertOctagon size={14} /> Immediate (1 Week)</h4>
                <ul className="text-xs text-gray-300 space-y-2 pl-4 list-disc marker:text-red-500">
                  <li>Process {overdue} overdue orders immediately</li>
                  <li>Improve equipment delivery time for Project Beta</li>
                </ul>
              </div>
              <div className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/20">
                <h4 className="text-amber-400 font-bold text-sm mb-2 flex items-center gap-2"><Clock size={14} /> Near Term (1 Month)</h4>
                <ul className="text-xs text-gray-300 space-y-2 pl-4 list-disc marker:text-amber-500">
                  <li>Create Material Days in Custody report</li>
                  <li>Complete quarterly inventory for remaining 30%</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="glass-card p-6 rounded-xl">
            <h3 className="text-lg font-bold text-white mb-4">Scrap Summary</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center pb-3 border-b border-white/10">
                <span className="text-sm text-gray-400">Total Jobs</span>
                <span className="font-bold text-white">306</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-white/10">
                <span className="text-sm text-gray-400">Cable Scrap</span>
                <span className="font-bold text-purple-400">673k SAR</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-white/10">
                <span className="text-sm text-gray-400">Wood Scrap</span>
                <span className="font-bold text-amber-400">407k SAR</span>
              </div>
              <div className="flex justify-between items-center pt-2">
                <span className="text-sm text-gray-300 font-bold">Total Revenue</span>
                <span className="font-bold text-xl text-nesma-secondary">1.08M SAR</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
