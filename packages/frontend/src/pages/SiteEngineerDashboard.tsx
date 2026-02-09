import React, { useMemo, useState } from 'react';
import { FileText, Truck, Package, Briefcase, PlusCircle, Clock, CheckCircle, Search, ArrowRight } from 'lucide-react';
import { KpiCard } from '@/components/KpiCard';
import { useMirvList } from '@/api/hooks/useMirv';
import { useJobOrderList } from '@/api/hooks/useJobOrders';
import { useMrfList } from '@/api/hooks/useMrf';
import { useProjects, useInventory } from '@/api/hooks/useMasterData';
import { useParams, useNavigate } from 'react-router-dom';
import { formatCurrency } from '@nit-scs/shared/formatters';
import { JobStatus } from '@nit-scs/shared/types';
import type { MIRV, JobOrder, Project, InventoryItem } from '@nit-scs/shared/types';

type SETab = 'dashboard' | 'new-request' | 'my-requests' | 'my-project' | 'site-inventory';

export const SiteEngineerDashboard: React.FC = () => {
  const { '*': subRoute } = useParams();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  // Determine active tab from route
  const activeTab: SETab = (() => {
    if (subRoute?.startsWith('new')) return 'new-request';
    if (subRoute?.startsWith('my-requests')) return 'my-requests';
    if (subRoute?.startsWith('project')) return 'my-project';
    if (subRoute?.startsWith('inventory')) return 'site-inventory';
    return 'dashboard';
  })();

  // API hooks
  const mirvQuery = useMirvList({ pageSize: 200 });
  const joQuery = useJobOrderList({ pageSize: 200 });
  const mrfQuery = useMrfList({ pageSize: 200 });
  const projectsQuery = useProjects({ pageSize: 200 });
  const inventoryQuery = useInventory({ pageSize: 500 });

  const allMirvs = (mirvQuery.data?.data ?? []) as MIRV[];
  const allJOs = (joQuery.data?.data ?? []) as JobOrder[];
  const allMrfs = (mrfQuery.data?.data ?? []) as Record<string, unknown>[];
  const allProjects = (projectsQuery.data?.data ?? []) as Project[];
  const inventoryItems = (inventoryQuery.data?.data ?? []) as InventoryItem[];

  const isLoading = mirvQuery.isLoading;

  // Simulated current engineer assignment
  const myProject = useMemo(() => allProjects.find(p => p.status === 'Active') || null, [allProjects]);

  // Combined requests
  const allRequests = useMemo(() => {
    const items = [
      ...allMirvs.slice(0, 50).map(m => ({ id: m.id as string, type: 'MIRV' as const, title: `Material Issue - ${m.project as string || ''}`, date: m.date as string, status: m.status as string, value: Number(m.value || 0) })),
      ...allJOs.slice(0, 50).map(j => ({ id: j.id as string, type: 'JO' as const, title: j.title as string || 'Job Order', date: j.date as string, status: j.status as string, value: Number(j.materialPriceSar || 0) })),
      ...allMrfs.slice(0, 50).map(m => ({ id: m.id as string, type: 'MRF' as const, title: `Material Requisition - ${m.project as string || ''}`, date: m.date as string, status: m.status as string, value: 0 })),
    ];
    if (search) return items.filter(i => i.title.toLowerCase().includes(search.toLowerCase()) || i.type.toLowerCase().includes(search.toLowerCase()));
    return items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [allMirvs, allJOs, allMrfs, search]);

  const stats = useMemo(() => {
    const total = allRequests.length;
    const pending = allRequests.filter(r => r.status === 'Pending Approval' || r.status === 'Draft').length;
    const completed = allRequests.filter(r => ['Completed', 'Issued', 'Approved', JobStatus.COMPLETED].includes(r.status)).length;
    return { total, pending, completed };
  }, [allRequests]);

  const setTab = (t: SETab) => {
    const paths: Record<SETab, string> = {
      dashboard: '/site-engineer',
      'new-request': '/site-engineer/new',
      'my-requests': '/site-engineer/my-requests',
      'my-project': '/site-engineer/project',
      'site-inventory': '/site-engineer/inventory',
    };
    navigate(paths[t], { replace: true });
  };

  const tabs: { id: SETab; label: string; icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: Briefcase },
    { id: 'new-request', label: 'New Request', icon: PlusCircle },
    { id: 'my-requests', label: 'My Requests', icon: FileText },
    { id: 'my-project', label: 'My Project', icon: Briefcase },
    { id: 'site-inventory', label: 'Site Inventory', icon: Package },
  ];

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      Approved: 'bg-emerald-500/20 text-emerald-400',
      Completed: 'bg-emerald-500/20 text-emerald-400',
      Issued: 'bg-emerald-500/20 text-emerald-400',
      'Pending Approval': 'bg-amber-500/20 text-amber-400',
      Draft: 'bg-gray-500/20 text-gray-400',
      Rejected: 'bg-red-500/20 text-red-400',
      Cancelled: 'bg-red-500/20 text-red-400',
    };
    return colors[status] || 'bg-white/10 text-gray-300';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-white glow-text">Site Engineer</h1>
        <p className="text-sm text-gray-400 mt-1">Material requests, job orders, and site inventory</p>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${activeTab === t.id ? 'bg-nesma-primary text-white shadow-lg shadow-nesma-primary/20 border border-nesma-primary/50' : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white'}`}>
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Dashboard */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard title="Total Requests" value={stats.total} icon={FileText} color="bg-nesma-primary" loading={isLoading} />
            <KpiCard title="Pending" value={stats.pending} icon={Clock} color="bg-amber-500" loading={isLoading} alert={stats.pending > 5} />
            <KpiCard title="Completed" value={stats.completed} icon={CheckCircle} color="bg-emerald-500" loading={isLoading} />
          </div>
          <div className="glass-card rounded-2xl p-6 border border-white/10">
            <h3 className="text-white font-bold mb-4">Recent Requests</h3>
            <div className="space-y-3">
              {allRequests.slice(0, 8).map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 text-gray-300">{r.type}</span>
                    <span className="text-sm text-white">{r.title}</span>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded ${statusBadge(r.status)}`}>{r.status}</span>
                </div>
              ))}
              {allRequests.length === 0 && <p className="text-gray-500 text-sm text-center py-8">No requests yet</p>}
            </div>
          </div>
        </div>
      )}

      {/* New Request */}
      {activeTab === 'new-request' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { title: 'Material Issue (MIRV)', desc: 'Request materials from warehouse', icon: Package, path: '/site-engineer/forms/mirv', color: 'bg-blue-500' },
            { title: 'Job Order', desc: 'Request transport, equipment, or services', icon: Truck, path: '/site-engineer/forms/jo', color: 'bg-nesma-primary' },
            { title: 'Material Requisition (MRF)', desc: 'Request materials to be purchased', icon: FileText, path: '/site-engineer/forms/mrf', color: 'bg-emerald-500' },
          ].map(card => (
            <button key={card.title} onClick={() => navigate(card.path)} className="glass-card p-8 rounded-2xl border border-white/10 text-left group hover:border-nesma-secondary/30 transition-all">
              <div className={`w-14 h-14 rounded-xl ${card.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                <card.icon size={24} className="text-white" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{card.title}</h3>
              <p className="text-sm text-gray-400">{card.desc}</p>
              <div className="flex items-center gap-1 mt-4 text-nesma-secondary text-sm">
                Create <ArrowRight size={14} />
              </div>
            </button>
          ))}
        </div>
      )}

      {/* My Requests */}
      {activeTab === 'my-requests' && (
        <div className="space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search requests..." className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-nesma-secondary/50" />
          </div>
          <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
            <table className="w-full text-left">
              <thead><tr className="border-b border-white/10 bg-white/5">
                <th className="px-4 py-3 text-xs text-gray-400 uppercase">Type</th>
                <th className="px-4 py-3 text-xs text-gray-400 uppercase">Title</th>
                <th className="px-4 py-3 text-xs text-gray-400 uppercase">Value</th>
                <th className="px-4 py-3 text-xs text-gray-400 uppercase">Date</th>
                <th className="px-4 py-3 text-xs text-gray-400 uppercase">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-white/5">
                {allRequests.slice(0, 50).map(r => (
                  <tr key={r.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3"><span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 text-gray-300">{r.type}</span></td>
                    <td className="px-4 py-3 text-sm text-white">{r.title}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{r.value > 0 ? formatCurrency(r.value) : '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{r.date}</td>
                    <td className="px-4 py-3"><span className={`text-[10px] px-2 py-0.5 rounded ${statusBadge(r.status)}`}>{r.status}</span></td>
                  </tr>
                ))}
                {allRequests.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-500">No requests</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* My Project */}
      {activeTab === 'my-project' && (
        <div className="space-y-6">
          {myProject ? (
            <>
              <div className="glass-card rounded-2xl p-6 border border-white/10">
                <h3 className="text-xl font-bold text-white mb-4">{myProject.name}</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div><p className="text-xs text-gray-500">Client</p><p className="text-sm text-white mt-1">{myProject.client}</p></div>
                  <div><p className="text-xs text-gray-500">Manager</p><p className="text-sm text-white mt-1">{myProject.manager}</p></div>
                  <div><p className="text-xs text-gray-500">Status</p><p className="text-sm text-emerald-400 mt-1">{myProject.status}</p></div>
                  <div><p className="text-xs text-gray-500">Region</p><p className="text-sm text-white mt-1">{myProject.region || '-'}</p></div>
                </div>
              </div>
            </>
          ) : (
            <div className="glass-card rounded-2xl p-12 border border-white/10 text-center">
              <p className="text-gray-500">No project assigned</p>
            </div>
          )}
        </div>
      )}

      {/* Site Inventory */}
      {activeTab === 'site-inventory' && (
        <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
          <div className="p-4 border-b border-white/10 bg-white/5">
            <h3 className="text-sm font-bold text-white">Site Inventory ({inventoryItems.length} items)</h3>
          </div>
          <table className="w-full text-left">
            <thead><tr className="border-b border-white/10 bg-white/5">
              <th className="px-4 py-3 text-xs text-gray-400 uppercase">Item</th>
              <th className="px-4 py-3 text-xs text-gray-400 uppercase">Category</th>
              <th className="px-4 py-3 text-xs text-gray-400 uppercase">Qty</th>
              <th className="px-4 py-3 text-xs text-gray-400 uppercase">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-white/5">
              {inventoryItems.slice(0, 50).map((item: InventoryItem) => (
                <tr key={item.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-sm text-white">{item.name || item.id}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{item.category || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{item.quantity ?? 0}</td>
                  <td className="px-4 py-3"><span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-gray-300">{item.stockStatus || 'In Stock'}</span></td>
                </tr>
              ))}
              {inventoryItems.length === 0 && <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-500">No inventory data</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
