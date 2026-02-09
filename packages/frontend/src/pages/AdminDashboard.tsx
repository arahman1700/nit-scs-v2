import React, { useState, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  ClipboardList,
  Package,
  Truck,
  AlertTriangle,
  Box,
  Ship,
  Users,
  ArrowRight,
  Filter,
  Calendar,
  Warehouse,
  FileInput,
  FileOutput,
  ShieldCheck,
  Briefcase,
  Database,
} from 'lucide-react';
import {
  useDashboardStats,
  useRecentActivity,
  useInventorySummary,
  useDocumentCounts,
  useSLACompliance,
  useTopProjects,
} from '@/api/hooks';
import { useProjects } from '@/api/hooks';
import { Link, useNavigate } from 'react-router-dom';

// Nesma Palette for Charts
const COLORS = ['#2E3192', '#80D1E9', '#0E2841', '#203366', '#B3B3B3'];

// ── Loading Skeleton Components ────────────────────────────────────────────

const StatCardSkeleton: React.FC = () => (
  <div className="glass-card p-6 rounded-xl animate-pulse">
    <div className="flex items-start justify-between">
      <div className="space-y-3">
        <div className="h-8 w-16 bg-white/10 rounded"></div>
        <div className="h-4 w-28 bg-white/5 rounded"></div>
      </div>
      <div className="w-14 h-14 bg-white/10 rounded-xl"></div>
    </div>
  </div>
);

const ChartSkeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`glass-card p-6 rounded-xl animate-pulse ${className}`}>
    <div className="h-5 w-40 bg-white/10 rounded mb-6"></div>
    <div className="h-72 bg-white/5 rounded-lg flex items-end justify-around px-8 pb-4 gap-4">
      {[60, 40, 80, 50].map((h, i) => (
        <div key={i} className="bg-white/10 rounded-t w-10" style={{ height: `${h}%` }}></div>
      ))}
    </div>
  </div>
);

const ActivitySkeleton: React.FC = () => (
  <div className="glass-card p-6 rounded-xl animate-pulse">
    <div className="h-5 w-32 bg-white/10 rounded mb-6"></div>
    {[1, 2, 3, 4, 5].map(i => (
      <div key={i} className="flex gap-4 py-3 border-b border-white/5 last:border-0">
        <div className="h-4 w-12 bg-white/5 rounded"></div>
        <div className="h-4 w-16 bg-white/10 rounded-full"></div>
        <div className="h-4 flex-1 bg-white/5 rounded"></div>
        <div className="h-4 w-20 bg-white/5 rounded"></div>
      </div>
    ))}
  </div>
);

// ── Sub-components ─────────────────────────────────────────────────────────

const StatCard: React.FC<{
  title: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  label?: string;
}> = ({ title, value, icon: Icon, color, label }) => (
  <div className="glass-card p-6 rounded-xl flex items-start justify-between hover:border-nesma-secondary/30 transition-all duration-300 group">
    <div>
      <h3 className="text-3xl font-bold text-white mb-1 group-hover:text-nesma-secondary transition-colors">{value}</h3>
      <p className="text-gray-400 text-sm font-medium">{title}</p>
      {label && (
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full mt-3 inline-block bg-white/10 border border-white/10 text-gray-300`}
        >
          {label}
        </span>
      )}
    </div>
    <div
      className={`p-4 rounded-xl ${color} text-white shadow-lg group-hover:scale-110 transition-transform duration-300`}
    >
      <Icon size={24} />
    </div>
  </div>
);

const ErrorBanner: React.FC<{ message: string }> = ({ message }) => (
  <div className="glass-card p-6 rounded-xl border border-red-500/20 bg-red-500/5">
    <div className="flex items-center gap-3">
      <AlertTriangle size={20} className="text-red-400" />
      <div>
        <p className="text-sm text-red-400 font-medium">Failed to load dashboard data</p>
        <p className="text-xs text-gray-500 mt-0.5">{message}</p>
      </div>
    </div>
  </div>
);

// ── Section Summary Card ──────────────────────────────────────────────────

interface SectionCardProps {
  title: string;
  icon: React.ElementType;
  path: string;
  metrics: { label: string; value: string | number }[];
  loading?: boolean;
}

const SectionCard: React.FC<SectionCardProps> = ({ title, icon: Icon, path, metrics, loading }) => {
  const navigate = useNavigate();
  return (
    <div
      onClick={() => navigate(path)}
      className="glass-card p-6 rounded-xl cursor-pointer hover:border-nesma-secondary/30 hover:scale-[1.02] transition-all duration-300 group"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 bg-gradient-to-br from-nesma-primary to-nesma-dark text-white rounded-xl shadow-lg border border-white/10">
          <Icon size={20} />
        </div>
        <h3 className="font-bold text-white text-sm">{title}</h3>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {loading ? (
          <>
            <div className="h-6 w-20 bg-white/10 rounded-full animate-pulse" />
            <div className="h-6 w-20 bg-white/10 rounded-full animate-pulse" />
          </>
        ) : (
          metrics.map((m, i) => (
            <span
              key={i}
              className="text-[11px] px-2.5 py-1 rounded-full bg-white/10 border border-white/10 text-gray-300 font-medium"
            >
              {m.label}: <span className="text-white font-bold">{m.value}</span>
            </span>
          ))
        )}
      </div>
      <div className="flex items-center gap-1 text-nesma-secondary text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
        Open <ArrowRight size={12} />
      </div>
    </div>
  );
};

// ── Document Count Progress Card ──────────────────────────────────────────

const DocCountCard: React.FC<{
  label: string;
  total: number;
  active: number;
  activeLabel: string;
  color: string;
  loading?: boolean;
}> = ({ label, total, active, activeLabel, color, loading }) => {
  const pct = total > 0 ? Math.round((active / total) * 100) : 0;
  if (loading) {
    return (
      <div className="glass-card p-4 rounded-xl animate-pulse">
        <div className="h-4 w-16 bg-white/10 rounded mb-3" />
        <div className="h-6 w-10 bg-white/10 rounded mb-2" />
        <div className="h-2 w-full bg-white/5 rounded-full" />
      </div>
    );
  }
  return (
    <div className="glass-card p-4 rounded-xl">
      <p className="text-gray-400 text-xs font-medium mb-1">{label}</p>
      <div className="flex items-end justify-between mb-2">
        <span className="text-2xl font-bold text-white">{total}</span>
        <span className="text-[10px] text-gray-400">
          {active} {activeLabel}
        </span>
      </div>
      <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

// ── Dashboard API data shapes ───────────────────────────────────────────────

interface DashboardStats {
  pendingApprovals?: number;
  pendingRequests?: number;
  totalProjects?: number;
  activeJobs?: number;
  totalItems?: number;
  incomingShipments?: number;
  lowStockAlerts?: number;
  lowStockItems?: number;
}

interface DocCountBreakdown {
  total?: number;
  pending?: number;
  breakdown?: Record<string, number>;
}

interface DocumentCounts {
  mrrv?: DocCountBreakdown;
  mirv?: DocCountBreakdown;
  jo?: DocCountBreakdown;
  mrv?: DocCountBreakdown;
  rfim?: DocCountBreakdown;
}

interface SLACompliance {
  compliancePct?: number;
}

interface InventorySummary {
  totalItems?: number;
  lowStockCount?: number;
  lowStock?: number;
  byCategory?: Array<{ name: string; value: number; outbound?: number }>;
}

// ── Main Component ─────────────────────────────────────────────────────────

export const AdminDashboard: React.FC = () => {
  const [selectedProject, setSelectedProject] = useState('All');
  const [timeRange, setTimeRange] = useState('30days');

  const projectFilter = selectedProject === 'All' ? undefined : selectedProject;

  // API queries
  const statsQuery = useDashboardStats({ project: projectFilter, timeRange });
  const activityQuery = useRecentActivity({ project: projectFilter, limit: 5 });
  const inventoryQuery = useInventorySummary({ project: projectFilter });
  const projectsQuery = useProjects({ pageSize: 100 });
  const docCountsQuery = useDocumentCounts({ project: projectFilter, timeRange });
  const slaQuery = useSLACompliance({ project: projectFilter });
  const topProjectsQuery = useTopProjects({ limit: 5 });

  const projects = projectsQuery.data?.data ?? [];

  // Extract raw data from queries
  const stats = statsQuery.data?.data as DashboardStats | undefined;
  const activities = activityQuery.data?.data ?? [];
  const docCounts = docCountsQuery.data?.data as DocumentCounts | undefined;
  const sla = slaQuery.data?.data as SLACompliance | undefined;
  const topProjects = (topProjectsQuery.data?.data ?? []) as unknown as Record<string, unknown>[];
  const invSummary = inventoryQuery.data?.data as InventorySummary | undefined;

  // Derived data for charts
  const inventoryData = useMemo(() => {
    const summary = inventoryQuery.data?.data;
    if (!summary?.byCategory?.length) return [];
    return summary.byCategory.map((c: { name: string; value: number; outbound?: number }) => ({
      name: c.name,
      in: c.value,
      out: c.outbound ?? 0,
    }));
  }, [inventoryQuery.data]);

  const jobTypesData = useMemo(() => {
    // Use JO status breakdown from document counts API
    const joBreakdown = docCounts?.jo?.breakdown;
    if (!joBreakdown) return [];
    return Object.entries(joBreakdown)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({
        name: status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        value: count,
      }));
  }, [docCounts]);

  const hasError = statsQuery.isError || activityQuery.isError;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header & Filters */}
      <div className="glass-card p-6 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white glow-text">Executive Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Real-time logistics and supply chain overview</p>
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
              {projects.map((p: { id: string; name: string }) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 rounded-lg">
            <Calendar size={16} className="text-nesma-secondary" />
            <select
              className="bg-transparent border-none outline-none text-sm text-white focus:ring-0 cursor-pointer"
              value={timeRange}
              onChange={e => setTimeRange(e.target.value)}
            >
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="90days">Last Quarter</option>
            </select>
          </div>
        </div>
      </div>

      {/* Error State */}
      {hasError && <ErrorBanner message={(statsQuery.error as Error)?.message || 'Network error. Retrying...'} />}

      {/* BLOCK 1: Stats Cards */}
      {statsQuery.isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Pending Approvals"
            value={stats?.pendingApprovals ?? stats?.pendingRequests ?? 0}
            icon={ClipboardList}
            color="bg-amber-500"
            label="Action Needed"
          />
          <StatCard
            title="Active Projects"
            value={stats?.totalProjects ?? stats?.activeJobs ?? 0}
            icon={Truck}
            color="bg-emerald-500"
            label="On Track"
          />
          <StatCard
            title="Total Items"
            value={stats?.totalItems ?? stats?.incomingShipments ?? 0}
            icon={Package}
            color="bg-nesma-secondary"
            label="Inventory"
          />
          <StatCard
            title="Low Stock Alerts"
            value={stats?.lowStockAlerts ?? stats?.lowStockItems ?? 0}
            icon={AlertTriangle}
            color="bg-red-500"
            label="Critical"
          />
        </div>
      )}

      {/* BLOCKS 6-7: Charts */}
      {inventoryQuery.isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <ChartSkeleton className="lg:col-span-2" />
          <ChartSkeleton />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 glass-card p-6 rounded-xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg text-white">Inventory Movement</h3>
              <div className="flex gap-4">
                <span className="text-xs flex items-center gap-2 font-medium text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span> In
                </span>
                <span className="text-xs flex items-center gap-2 font-medium text-gray-400">
                  <span className="w-2 h-2 rounded-full bg-nesma-primary"></span> Out
                </span>
              </div>
            </div>
            <div className="h-72 w-full">
              {inventoryData.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                  No inventory movement data yet
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={inventoryData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: '#0E2841',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                      itemStyle={{ color: '#80D1E9' }}
                      cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    />
                    <Bar dataKey="in" fill="#34D399" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar dataKey="out" fill="#2E3192" radius={[4, 4, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="glass-card p-6 rounded-xl">
            <h3 className="font-bold text-lg text-white mb-6">Job Orders by Type</h3>
            <div className="h-72 w-full flex justify-center">
              {jobTypesData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={jobTypesData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {jobTypesData.map((_entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend
                      layout="vertical"
                      verticalAlign="bottom"
                      height={36}
                      iconType="circle"
                      formatter={value => <span className="text-gray-400 text-xs ml-1">{value}</span>}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: '#0E2841',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        color: '#fff',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center text-gray-500 h-full">No active jobs</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Section Summary Cards */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4">Sections</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <SectionCard
            title="Inventory & Warehouses"
            icon={Warehouse}
            path="/admin/inventory"
            loading={inventoryQuery.isLoading}
            metrics={[
              { label: 'Items', value: invSummary?.totalItems ?? 0 },
              { label: 'Low Stock', value: invSummary?.lowStockCount ?? invSummary?.lowStock ?? 0 },
            ]}
          />
          <SectionCard
            title="Receiving & Inbound"
            icon={FileInput}
            path="/admin/receiving"
            loading={docCountsQuery.isLoading}
            metrics={[
              { label: 'MRRV Total', value: docCounts?.mrrv?.total ?? 0 },
              { label: 'Pending', value: docCounts?.mrrv?.pending ?? 0 },
            ]}
          />
          <SectionCard
            title="Issuing & Outbound"
            icon={FileOutput}
            path="/admin/issuing"
            loading={docCountsQuery.isLoading}
            metrics={[
              { label: 'MIRV Total', value: docCounts?.mirv?.total ?? 0 },
              { label: 'Pending', value: docCounts?.mirv?.pending ?? 0 },
            ]}
          />
          <SectionCard
            title="Returns & Quality"
            icon={ShieldCheck}
            path="/admin/quality"
            loading={docCountsQuery.isLoading}
            metrics={[
              { label: 'MRV', value: docCounts?.mrv?.total ?? 0 },
              { label: 'RFIM', value: docCounts?.rfim?.total ?? 0 },
            ]}
          />
          <SectionCard
            title="Logistics & Jobs"
            icon={Briefcase}
            path="/admin/logistics"
            loading={statsQuery.isLoading || slaQuery.isLoading}
            metrics={[
              { label: 'Active Jobs', value: stats?.activeJobs ?? 0 },
              { label: 'SLA', value: `${sla?.compliancePct ?? 0}%` },
            ]}
          />
          <SectionCard
            title="Master Data"
            icon={Database}
            path="/admin/master"
            loading={false}
            metrics={[{ label: 'Scope', value: 'Suppliers, Items, Projects' }]}
          />
        </div>
      </div>

      {/* Document Counts Row */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4">Document Pipeline</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <DocCountCard
            label="MRRV"
            total={docCounts?.mrrv?.total ?? 0}
            active={docCounts?.mrrv?.breakdown?.draft ?? 0}
            activeLabel="pending"
            color="bg-emerald-500"
            loading={docCountsQuery.isLoading}
          />
          <DocCountCard
            label="MIRV"
            total={docCounts?.mirv?.total ?? 0}
            active={docCounts?.mirv?.breakdown?.pending_approval ?? 0}
            activeLabel="pending"
            color="bg-blue-500"
            loading={docCountsQuery.isLoading}
          />
          <DocCountCard
            label="Job Orders"
            total={docCounts?.jo?.total ?? 0}
            active={docCounts?.jo?.breakdown?.in_progress ?? 0}
            activeLabel="in progress"
            color="bg-amber-500"
            loading={docCountsQuery.isLoading}
          />
          <DocCountCard
            label="MRV"
            total={docCounts?.mrv?.total ?? 0}
            active={docCounts?.mrv?.breakdown?.draft ?? 0}
            activeLabel="pending"
            color="bg-nesma-secondary"
            loading={docCountsQuery.isLoading}
          />
        </div>
      </div>

      {/* Top Projects Widget */}
      <div className="glass-card p-6 rounded-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-lg text-white">Top Projects</h3>
          <Link
            to="/admin/master?tab=projects"
            className="text-nesma-secondary text-sm hover:text-white font-medium hover:underline"
          >
            View All
          </Link>
        </div>
        {topProjectsQuery.isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 bg-white/5 rounded animate-pulse" />
            ))}
          </div>
        ) : topProjects.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 text-xs">
                  <th className="pb-2 font-medium">Project</th>
                  <th className="pb-2 font-medium">Client</th>
                  <th className="pb-2 font-medium text-center">Active JOs</th>
                  <th className="pb-2 font-medium text-center">Pending MIRV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {topProjects.map((p: Record<string, unknown>) => (
                  <tr key={p.id as string} className="hover:bg-white/5 transition-colors">
                    <td className="py-2.5 text-sm text-white font-medium">
                      {(p.projectName ?? p.name ?? '-') as string}
                    </td>
                    <td className="py-2.5 text-sm text-gray-400">{(p.projectCode ?? p.client ?? '-') as string}</td>
                    <td className="py-2.5 text-sm text-center">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
                        {(p.activeDocuments ?? p.activeJobs ?? 0) as number}
                      </span>
                    </td>
                    <td className="py-2.5 text-sm text-center">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
                        {(p.pendingMirv ?? 0) as number}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-500 text-sm text-center py-4">No project data available</p>
        )}
      </div>

      {/* BLOCK 8: Recent Activity */}
      {activityQuery.isLoading ? (
        <ActivitySkeleton />
      ) : (
        <div className="glass-card p-6 rounded-xl">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-lg text-white">Recent Activity</h3>
            <button className="text-nesma-secondary text-sm hover:text-white font-medium hover:underline">
              View Full Log
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 text-sm">
                  <th className="pb-3 font-medium">Time</th>
                  <th className="pb-3 font-medium">Type</th>
                  <th className="pb-3 font-medium">Description</th>
                  <th className="pb-3 font-medium">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {activities.length > 0 ? (
                  activities.map(log => (
                    <tr key={log.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 text-sm text-gray-400">{log.time}</td>
                      <td className="py-3">
                        <span
                          className={`text-[10px] px-2 py-1 rounded-full font-semibold border ${
                            log.action.startsWith('MRRV')
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : log.action.startsWith('MIRV')
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                : log.action.startsWith('JO')
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                          }`}
                        >
                          {log.action.split('-')[0]}
                        </span>
                      </td>
                      <td className="py-3 text-sm text-gray-300">{log.details}</td>
                      <td className="py-3 text-sm text-gray-400">{log.user}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-gray-500 text-sm">
                      No recent activity
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
