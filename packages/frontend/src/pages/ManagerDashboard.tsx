import React, { useMemo, useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  FileText,
  FolderOpen,
  Briefcase,
  Search,
  Warehouse,
} from 'lucide-react';
import { KpiCard } from '@/components/KpiCard';
import { useMirvList } from '@/api/hooks/useMirv';
import { useJobOrderList } from '@/api/hooks/useJobOrders';
import { useMrfList } from '@/api/hooks/useMrf';
import { useStockTransferList } from '@/api/hooks/useStockTransfers';
import { useProjects } from '@/api/hooks/useMasterData';
import { useCrossDepartment } from '@/api/hooks/useDashboard';
import type { CrossDepartmentData } from '@/api/hooks/useDashboard';
import { useParams, useNavigate } from 'react-router-dom';
import { formatCurrency } from '@nit-scs-v2/shared/formatters';
import type { MIRV, JobOrder, Project } from '@nit-scs-v2/shared/types';
import { displayStr } from '@/utils/displayStr';

type ManagerTab = 'overview' | 'approvals' | 'documents' | 'projects';

export const ManagerDashboard: React.FC = () => {
  const { tab } = useParams();
  const navigate = useNavigate();
  const activeTab: ManagerTab = (
    ['overview', 'approvals', 'documents', 'projects'].includes(tab || '') ? tab : 'overview'
  ) as ManagerTab;
  const [search, setSearch] = useState('');

  // API data
  const mirvQuery = useMirvList({ pageSize: 200 });
  const joQuery = useJobOrderList({ pageSize: 200 });
  const mrfQuery = useMrfList({ pageSize: 200 });
  const stQuery = useStockTransferList({ pageSize: 200 });
  const projectsQuery = useProjects({ pageSize: 200 });

  const crossDeptQuery = useCrossDepartment();
  const crossDept = (crossDeptQuery.data as unknown as { data?: CrossDepartmentData } | undefined)?.data;

  const allMirvs = (mirvQuery.data?.data ?? []) as MIRV[];
  const allJOs = (joQuery.data?.data ?? []) as JobOrder[];
  const allMrfs = (mrfQuery.data?.data ?? []) as Record<string, unknown>[];
  const allSTs = (stQuery.data?.data ?? []) as Record<string, unknown>[];
  const allProjects = (projectsQuery.data?.data ?? []) as Project[];

  const isLoading = mirvQuery.isLoading || joQuery.isLoading;

  // Pending approvals
  const pendingMirvs = useMemo(() => allMirvs.filter(m => m.status === 'pending_approval'), [allMirvs]);
  const pendingJOs = useMemo(() => allJOs.filter(j => j.status === 'pending_approval'), [allJOs]);
  const pendingMrfs = useMemo(
    () => allMrfs.filter(m => m.status === 'pending_approval' || m.status === 'submitted'),
    [allMrfs],
  );
  const pendingSTs = useMemo(() => allSTs.filter(s => s.status === 'pending'), [allSTs]);

  const totalPending = pendingMirvs.length + pendingJOs.length + pendingMrfs.length + pendingSTs.length;
  const totalPendingValue = useMemo(
    () =>
      pendingMirvs.reduce((s, m) => s + Number(m.value || 0), 0) +
      pendingJOs.reduce((s, j) => s + Number(j.materialPriceSar || 0), 0),
    [pendingMirvs, pendingJOs],
  );

  const approvedToday = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return (
      allMirvs.filter(m => m.status === 'approved' && String(m.date || '').startsWith(today)).length +
      allJOs.filter(j => j.status === 'approved' && String(j.date || '').startsWith(today)).length
    );
  }, [allMirvs, allJOs]);

  const rejectedThisWeek = useMemo(() => {
    const week = new Date();
    week.setDate(week.getDate() - 7);
    return allMirvs.filter(m => m.status === 'rejected').length + allJOs.filter(j => j.status === 'cancelled').length;
  }, [allMirvs, allJOs]);

  const allPendingItems = useMemo(() => {
    const items = [
      ...pendingMirvs.map(m => ({
        id: m.id as string,
        type: 'MI',
        title: `MI - ${displayStr(m.project)}`,
        value: Number(m.value || 0),
        date: m.date as string,
        status: m.status as string,
      })),
      ...pendingJOs.map(j => ({
        id: j.id as string,
        type: 'JO',
        title: j.title as string,
        value: Number(j.materialPriceSar || 0),
        date: j.date as string,
        status: j.status as string,
      })),
      ...pendingMrfs.map(m => ({
        id: m.id as string,
        type: 'MR',
        title: `MR - ${displayStr(m.project)}`,
        value: 0,
        date: m.date as string,
        status: m.status as string,
      })),
      ...pendingSTs.map(s => ({
        id: s.id as string,
        type: 'ST',
        title: `Transfer - ${s.id as string}`,
        value: 0,
        date: s.date as string,
        status: s.status as string,
      })),
    ];
    if (search)
      return items.filter(
        i =>
          i.title.toLowerCase().includes(search.toLowerCase()) || i.type.toLowerCase().includes(search.toLowerCase()),
      );
    return items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [pendingMirvs, pendingJOs, pendingMrfs, pendingSTs, search]);

  const activeProjects = useMemo(() => allProjects.filter(p => p.status === 'Active'), [allProjects]);

  const setTab = (t: ManagerTab) => navigate(`/manager/${t}`, { replace: true });

  const tabs: { id: ManagerTab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: FileText },
    { id: 'approvals', label: 'Approval Queue', icon: CheckCircle },
    { id: 'documents', label: 'Documents', icon: FolderOpen },
    { id: 'projects', label: 'Projects', icon: Briefcase },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white glow-text">Manager Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">Approvals, oversight, and project monitoring</p>
        </div>
        <button
          onClick={() => navigate('/manager/forms/jo')}
          className="px-4 py-2 bg-nesma-primary text-white rounded-lg text-sm hover:bg-nesma-primary/80 transition-colors"
        >
          + Create Job Order
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Pending Approvals"
          value={totalPending}
          icon={Clock}
          color="bg-amber-500"
          loading={isLoading}
          alert={totalPending > 10}
          onClick={() => setTab('approvals')}
        />
        <KpiCard
          title="Approved Today"
          value={approvedToday}
          icon={CheckCircle}
          color="bg-emerald-500"
          loading={isLoading}
          onClick={() => setTab('documents')}
        />
        <KpiCard
          title="Total Value Pending"
          value={formatCurrency(totalPendingValue)}
          icon={DollarSign}
          color="bg-nesma-primary"
          loading={isLoading}
          onClick={() => setTab('approvals')}
        />
        <KpiCard
          title="Rejected This Week"
          value={rejectedThisWeek}
          icon={XCircle}
          color="bg-red-500"
          loading={isLoading}
          onClick={() => setTab('documents')}
        />
      </div>

      {/* Tab Bar */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${activeTab === t.id ? 'bg-nesma-primary text-white shadow-lg shadow-nesma-primary/20 border border-nesma-primary/50' : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white'}`}
            >
              <Icon size={16} />
              {t.label}
              {t.id === 'approvals' && totalPending > 0 && (
                <span className="ml-1 text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded-full">
                  {totalPending}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="glass-card rounded-2xl p-6 border border-white/10">
            <h3 className="text-white font-bold mb-4">Approval Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'MI', count: pendingMirvs.length, color: 'text-blue-400' },
                { label: 'Job Orders', count: pendingJOs.length, color: 'text-amber-400' },
                { label: 'MR', count: pendingMrfs.length, color: 'text-emerald-400' },
                { label: 'Stock Transfers', count: pendingSTs.length, color: 'text-purple-400' },
              ].map(item => (
                <div key={item.label} className="text-center p-4 bg-white/5 rounded-xl border border-white/10">
                  <p className={`text-3xl font-bold ${item.color}`}>{item.count}</p>
                  <p className="text-xs text-gray-500 mt-1">{item.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Cross-Department Snapshot */}
          {crossDept && (
            <div className="glass-card rounded-2xl p-6 border border-white/10">
              <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                <Warehouse size={18} className="text-nesma-secondary" />
                Cross-Department Snapshot
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-2xl font-bold text-nesma-secondary">
                    {crossDept.inventory.totalInventoryValue > 1_000_000
                      ? `${(crossDept.inventory.totalInventoryValue / 1_000_000).toFixed(1)}M`
                      : `${(crossDept.inventory.totalInventoryValue / 1_000).toFixed(0)}K`}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Inventory Value (SAR)</p>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-2xl font-bold text-amber-400">{crossDept.inventory.lowStockAlerts}</p>
                  <p className="text-xs text-gray-500 mt-1">Low Stock Alerts</p>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-2xl font-bold text-red-400">{crossDept.inventory.blockedLots}</p>
                  <p className="text-xs text-gray-500 mt-1">Blocked Lots</p>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-xl border border-white/10">
                  <p className="text-2xl font-bold text-emerald-400">{crossDept.inventory.warehouses.length}</p>
                  <p className="text-xs text-gray-500 mt-1">Active Warehouses</p>
                </div>
              </div>

              {/* Document Pipeline */}
              <h4 className="text-sm font-medium text-gray-400 mb-3">Active Documents Pipeline</h4>
              <div className="flex gap-2 flex-wrap">
                {Object.entries(crossDept.documentPipeline).map(([docType, counts]) => (
                  <div
                    key={docType}
                    className="px-3 py-2 bg-white/5 rounded-lg border border-white/5 text-center min-w-[70px]"
                  >
                    <p className="text-lg font-bold text-white">{counts.total}</p>
                    <p className="text-[10px] text-gray-500 uppercase">{docType}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="glass-card rounded-2xl p-6 border border-white/10">
            <h3 className="text-white font-bold mb-4">Recent Activity</h3>
            <div className="space-y-3">
              {allPendingItems.slice(0, 8).map(item => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5 hover:border-white/10 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 text-gray-300">
                      {item.type}
                    </span>
                    <span className="text-sm text-white">{item.title}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    {item.value > 0 && <span>{formatCurrency(item.value)}</span>}
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">{item.status}</span>
                  </div>
                </div>
              ))}
              {allPendingItems.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-8">No pending items</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Approvals Tab */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search approvals..."
                className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-nesma-secondary/50"
              />
            </div>
          </div>
          <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-3 text-xs text-gray-400 uppercase">Type</th>
                  <th className="px-4 py-3 text-xs text-gray-400 uppercase">Title</th>
                  <th className="px-4 py-3 text-xs text-gray-400 uppercase">Value</th>
                  <th className="px-4 py-3 text-xs text-gray-400 uppercase">Date</th>
                  <th className="px-4 py-3 text-xs text-gray-400 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {allPendingItems.map(item => (
                  <tr key={item.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 text-gray-300">
                        {item.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-white">{item.title}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {item.value > 0 ? formatCurrency(item.value) : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{item.date}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {allPendingItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-gray-500">
                      No pending approvals
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === 'documents' && (
        <div className="glass-card rounded-2xl p-6 border border-white/10">
          <h3 className="text-white font-bold mb-4">Recent Documents</h3>
          <p className="text-gray-500 text-sm">View company documents from the Documents page in the sidebar.</p>
          <button
            onClick={() => navigate('/manager/documents')}
            className="mt-4 px-4 py-2 bg-nesma-primary/20 text-nesma-secondary rounded-lg text-sm hover:bg-nesma-primary/30 transition-colors border border-nesma-primary/30"
          >
            Go to Documents
          </button>
        </div>
      )}

      {/* Projects Tab */}
      {activeTab === 'projects' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card rounded-xl p-5 border border-white/10">
              <p className="text-xs text-gray-500 uppercase">Total Projects</p>
              <p className="text-2xl font-bold text-white mt-1">{allProjects.length}</p>
            </div>
            <div className="glass-card rounded-xl p-5 border border-emerald-500/20 bg-emerald-500/5">
              <p className="text-xs text-emerald-400 uppercase">Active</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{activeProjects.length}</p>
            </div>
            <div className="glass-card rounded-xl p-5 border border-white/10">
              <p className="text-xs text-gray-500 uppercase">On Hold / Completed</p>
              <p className="text-2xl font-bold text-gray-400 mt-1">{allProjects.length - activeProjects.length}</p>
            </div>
          </div>
          <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-3 text-xs text-gray-400 uppercase">Project</th>
                  <th className="px-4 py-3 text-xs text-gray-400 uppercase">Client</th>
                  <th className="px-4 py-3 text-xs text-gray-400 uppercase">Manager</th>
                  <th className="px-4 py-3 text-xs text-gray-400 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {activeProjects.slice(0, 20).map(p => (
                  <tr key={p.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-sm text-white font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{p.client}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{p.manager}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400">
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
