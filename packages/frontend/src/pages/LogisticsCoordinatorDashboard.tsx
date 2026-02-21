import React, { useMemo, useState } from 'react';
import { Truck, Ship, Shield, Clock, Search, Package } from 'lucide-react';
import { KpiCard } from '@/components/KpiCard';
import { useJobOrderList } from '@/api/hooks/useJobOrders';
import { useShipmentList } from '@/api/hooks/useShipments';
import { useGatePassList } from '@/api/hooks/useGatePasses';
import { useMrrvList } from '@/api/hooks/useMrrv';
import { useSLACompliance } from '@/api/hooks/useDashboard';
import { useParams, useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { JobOrder } from '@nit-scs-v2/shared/types';
import { displayStr } from '@/utils/displayStr';

type LogTab = 'overview' | 'jobs' | 'shipments' | 'gate-passes' | 'customs' | 'receiving';
const CHART_COLORS = ['#2E3192', '#80D1E9', '#4CAF50', '#FF9800', '#F44336', '#9C27B0', '#00BCD4'];

export const LogisticsCoordinatorDashboard: React.FC = () => {
  const { tab } = useParams();
  const navigate = useNavigate();
  const activeTab: LogTab = (
    ['overview', 'jobs', 'shipments', 'gate-passes', 'customs', 'receiving'].includes(tab || '') ? tab : 'overview'
  ) as LogTab;
  const [search, setSearch] = useState('');

  const joQuery = useJobOrderList({ pageSize: 200 });
  const shipQuery = useShipmentList({ pageSize: 200 });
  const gpQuery = useGatePassList({ pageSize: 200 });
  const mrrvQuery = useMrrvList({ pageSize: 200 });
  const slaQuery = useSLACompliance();

  const allJOs = (joQuery.data?.data ?? []) as JobOrder[];
  const allShipments = (shipQuery.data?.data ?? []) as unknown as Record<string, unknown>[];
  const allGPs = (gpQuery.data?.data ?? []) as unknown as Record<string, unknown>[];
  const allMrrvs = (mrrvQuery.data?.data ?? []) as unknown as Record<string, unknown>[];

  const isLoading = joQuery.isLoading;

  const activeJobs = useMemo(
    () => allJOs.filter(j => !['Completed', 'Cancelled'].includes(j.status as string)),
    [allJOs],
  );
  const inTransit = useMemo(
    () => allShipments.filter(s => s.status === 'In Transit' || s.status === 'in_transit'),
    [allShipments],
  );
  const pendingGPs = useMemo(() => allGPs.filter(g => g.status === 'pending' || g.status === 'Pending'), [allGPs]);
  const slaCompliance = slaQuery.data?.data?.compliancePct ?? 0;

  const joByType = useMemo(() => {
    const map: Record<string, number> = {};
    allJOs.forEach(j => {
      const t = String(j.type || 'Other');
      map[t] = (map[t] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [allJOs]);

  const filteredJOs = useMemo(() => {
    if (!search) return allJOs;
    return allJOs.filter(
      j =>
        String(j.title || '')
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        String(j.type || '')
          .toLowerCase()
          .includes(search.toLowerCase()),
    );
  }, [allJOs, search]);

  const setTab = (t: LogTab) => navigate(`/logistics/${t}`, { replace: true });

  const tabs: { id: LogTab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: Truck },
    { id: 'jobs', label: 'Job Orders', icon: Truck },
    { id: 'shipments', label: 'Shipments', icon: Ship },
    { id: 'gate-passes', label: 'Gate Passes', icon: Shield },
    { id: 'receiving', label: 'Receiving (GRN)', icon: Package },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white glow-text">Logistics Coordinator</h1>
          <p className="text-sm text-gray-400 mt-1">Job orders, shipments, and gate passes</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/logistics/forms/jo')}
            className="px-4 py-2 bg-nesma-primary text-white rounded-lg text-sm hover:bg-nesma-primary/80 transition-colors"
          >
            + New Job Order
          </button>
          <button
            onClick={() => navigate('/logistics/forms/shipment')}
            className="px-3 py-2 bg-white/5 text-gray-300 rounded-lg text-sm hover:bg-white/10 transition-colors border border-white/10"
          >
            + Shipment
          </button>
          <button
            onClick={() => navigate('/logistics/forms/gatepass')}
            className="px-3 py-2 bg-white/5 text-gray-300 rounded-lg text-sm hover:bg-white/10 transition-colors border border-white/10"
          >
            + Gate Pass
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Active Jobs"
          value={activeJobs.length}
          icon={Truck}
          color="bg-nesma-primary"
          loading={isLoading}
        />
        <KpiCard
          title="In-Transit Shipments"
          value={inTransit.length}
          icon={Ship}
          color="bg-blue-500"
          loading={isLoading}
        />
        <KpiCard
          title="Pending Gate Passes"
          value={pendingGPs.length}
          icon={Shield}
          color="bg-amber-500"
          loading={isLoading}
        />
        <KpiCard
          title="SLA Compliance"
          value={`${slaCompliance}%`}
          icon={Clock}
          color="bg-emerald-500"
          loading={isLoading}
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
            </button>
          );
        })}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card rounded-2xl p-6 border border-white/10">
            <h3 className="text-white font-bold mb-4">Job Orders by Type</h3>
            {joByType.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={joByType}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={120}
                    dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      `${name ?? ''} (${((percent ?? 0) * 100).toFixed(0)}%)`
                    }
                  >
                    {joByType.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: '#0a1929',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '12px',
                      color: '#fff',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-sm text-center py-16">No job order data</p>
            )}
          </div>
          <div className="glass-card rounded-2xl p-6 border border-white/10">
            <h3 className="text-white font-bold mb-4">SLA Summary</h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                <p className="text-3xl font-bold text-emerald-400">{slaQuery.data?.data?.onTrack ?? 0}%</p>
                <p className="text-xs text-gray-500 mt-1">On Track</p>
              </div>
              <div className="text-center p-4 bg-amber-500/10 rounded-xl border border-amber-500/20">
                <p className="text-3xl font-bold text-amber-400">{slaQuery.data?.data?.atRisk ?? 0}%</p>
                <p className="text-xs text-gray-500 mt-1">At Risk</p>
              </div>
              <div className="text-center p-4 bg-red-500/10 rounded-xl border border-red-500/20">
                <p className="text-3xl font-bold text-red-400">{slaQuery.data?.data?.overdue ?? 0}%</p>
                <p className="text-xs text-gray-500 mt-1">Overdue</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Job Orders Tab */}
      {activeTab === 'jobs' && (
        <div className="space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search job orders..."
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-nesma-secondary/50"
            />
          </div>
          <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-3 text-xs text-gray-400 uppercase">Title</th>
                  <th className="px-4 py-3 text-xs text-gray-400 uppercase">Type</th>
                  <th className="px-4 py-3 text-xs text-gray-400 uppercase">Project</th>
                  <th className="px-4 py-3 text-xs text-gray-400 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredJOs.slice(0, 50).map(j => (
                  <tr key={j.id as string} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-sm text-white">{String(j.title || j.id)}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{String(j.type || '-')}</td>
                    <td className="px-4 py-3 text-sm text-gray-400">{displayStr(j.project) || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-gray-300">
                        {String(j.status)}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredJOs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                      No job orders
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Shipments Tab */}
      {activeTab === 'shipments' && (
        <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-4 py-3 text-xs text-gray-400 uppercase">Shipment</th>
                <th className="px-4 py-3 text-xs text-gray-400 uppercase">Supplier</th>
                <th className="px-4 py-3 text-xs text-gray-400 uppercase">ETA</th>
                <th className="px-4 py-3 text-xs text-gray-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {allShipments.slice(0, 50).map(s => (
                <tr key={String(s.id)} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-sm text-white">{String(s.id).slice(0, 12)}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{displayStr(s.supplier) || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{String(s.eta || '-')}</td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-gray-300">
                      {String(s.status)}
                    </span>
                  </td>
                </tr>
              ))}
              {allShipments.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                    No shipments
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Gate Passes Tab */}
      {activeTab === 'gate-passes' && (
        <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-4 py-3 text-xs text-gray-400 uppercase">GP ID</th>
                <th className="px-4 py-3 text-xs text-gray-400 uppercase">Type</th>
                <th className="px-4 py-3 text-xs text-gray-400 uppercase">Vehicle</th>
                <th className="px-4 py-3 text-xs text-gray-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {allGPs.slice(0, 50).map(g => (
                <tr key={String(g.id)} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-sm text-white">{String(g.id).slice(0, 12)}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{String(g.type || '-')}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{String(g.vehiclePlate || '-')}</td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-gray-300">
                      {String(g.status)}
                    </span>
                  </td>
                </tr>
              ))}
              {allGPs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                    No gate passes
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Receiving Tab */}
      {activeTab === 'receiving' && (
        <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-4 py-3 text-xs text-gray-400 uppercase">GRN</th>
                <th className="px-4 py-3 text-xs text-gray-400 uppercase">Supplier</th>
                <th className="px-4 py-3 text-xs text-gray-400 uppercase">Warehouse</th>
                <th className="px-4 py-3 text-xs text-gray-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {allMrrvs.slice(0, 50).map(m => (
                <tr key={String(m.id)} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-sm text-white">{String(m.id).slice(0, 12)}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{displayStr(m.supplier) || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{displayStr(m.warehouse) || '-'}</td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-gray-300">
                      {String(m.status)}
                    </span>
                  </td>
                </tr>
              ))}
              {allMrrvs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                    No GRNs
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
