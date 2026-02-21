import React, { useMemo, useState } from 'react';
import { ClipboardCheck, AlertTriangle, CheckCircle, Eye, Package, Search } from 'lucide-react';
import { KpiCard } from '@/components/KpiCard';
import { useRfimList } from '@/api/hooks/useRfim';
import { useOsdList } from '@/api/hooks/useOsd';
import { useMrrvList } from '@/api/hooks/useMrrv';
import { useParams, useNavigate } from 'react-router-dom';
import { displayStr } from '@/utils/displayStr';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

type QCTab = 'overview' | 'inspections' | 'osd' | 'incoming';
const CHART_COLORS = ['#4CAF50', '#F44336', '#FF9800', '#80D1E9'];

export const QCOfficerDashboard: React.FC = () => {
  const { tab } = useParams();
  const navigate = useNavigate();
  const activeTab: QCTab = (
    ['overview', 'inspections', 'osd', 'incoming'].includes(tab || '') ? tab : 'overview'
  ) as QCTab;
  const [search, setSearch] = useState('');

  const rfimQuery = useRfimList({ pageSize: 200 });
  const osdQuery = useOsdList({ pageSize: 200 });
  const mrrvQuery = useMrrvList({ pageSize: 200 });

  const allRfims = (rfimQuery.data?.data ?? []) as unknown as Record<string, unknown>[];
  const allOsds = (osdQuery.data?.data ?? []) as unknown as Record<string, unknown>[];
  const allMrrvs = (mrrvQuery.data?.data ?? []) as unknown as Record<string, unknown>[];

  const isLoading = rfimQuery.isLoading;

  const openInspections = useMemo(
    () => allRfims.filter(r => r.status === 'Pending' || r.status === 'pending'),
    [allRfims],
  );
  const completedInspections = useMemo(
    () => allRfims.filter(r => r.status === 'Completed' || r.status === 'Inspected'),
    [allRfims],
  );
  const passRate = useMemo(() => {
    if (completedInspections.length === 0) return 0;
    const passed = completedInspections.filter(r => r.result === 'pass').length;
    return Math.round((passed / completedInspections.length) * 100);
  }, [completedInspections]);

  const pendingQcMrrvs = useMemo(
    () => allMrrvs.filter(m => m.status === 'Pending QC' || m.rfimRequired === true),
    [allMrrvs],
  );

  const osdByType = useMemo(() => {
    const map: Record<string, number> = {};
    allOsds.forEach(o => {
      const type = String(o.reportType || o.type || 'Unknown');
      map[type] = (map[type] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [allOsds]);

  const filteredRfims = useMemo(() => {
    if (!search) return allRfims;
    return allRfims.filter(
      r =>
        String(r.id || '')
          .toLowerCase()
          .includes(search.toLowerCase()) ||
        String(r.mrrvId || '')
          .toLowerCase()
          .includes(search.toLowerCase()),
    );
  }, [allRfims, search]);

  const setTab = (t: QCTab) => navigate(`/qc/${t}`, { replace: true });

  const tabs: { id: QCTab; label: string; icon: React.ElementType }[] = [
    { id: 'overview', label: 'Overview', icon: Eye },
    { id: 'inspections', label: 'Inspections (QCI)', icon: ClipboardCheck },
    { id: 'osd', label: 'DR Reports', icon: AlertTriangle },
    { id: 'incoming', label: 'Incoming (GRN)', icon: Package },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white glow-text">QC Officer Dashboard</h1>
          <p className="text-sm text-gray-400 mt-1">Quality inspections and DR management</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => navigate('/qc/forms/osd')}
            className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition-colors border border-red-500/30"
          >
            + New DR Report
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Open Inspections"
          value={openInspections.length}
          icon={ClipboardCheck}
          color="bg-amber-500"
          loading={isLoading}
          alert={openInspections.length > 5}
        />
        <KpiCard
          title="DR Reports"
          value={allOsds.length}
          icon={AlertTriangle}
          color="bg-red-500"
          loading={isLoading}
        />
        <KpiCard
          title="QC Pass Rate"
          value={`${passRate}%`}
          icon={CheckCircle}
          color="bg-emerald-500"
          loading={isLoading}
        />
        <KpiCard
          title="Awaiting Inspection"
          value={pendingQcMrrvs.length}
          icon={Package}
          color="bg-nesma-primary"
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
            <h3 className="text-white font-bold mb-4">Inspection Queue</h3>
            <div className="space-y-3">
              {openInspections.slice(0, 6).map(r => (
                <div
                  key={String(r.id)}
                  className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5"
                >
                  <div>
                    <p className="text-sm text-white">{String(r.id).slice(0, 12)}</p>
                    <p className="text-xs text-gray-500">GRN: {String(r.mrrvId || '-').slice(0, 12)}</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-400">
                    {String(r.status)}
                  </span>
                </div>
              ))}
              {openInspections.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-8">No pending inspections</p>
              )}
            </div>
          </div>
          <div className="glass-card rounded-2xl p-6 border border-white/10">
            <h3 className="text-white font-bold mb-4">DR Reports by Type</h3>
            {osdByType.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={osdByType}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      `${name ?? ''} (${((percent ?? 0) * 100).toFixed(0)}%)`
                    }
                  >
                    {osdByType.map((_, i) => (
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
              <p className="text-gray-500 text-sm text-center py-16">No DR data</p>
            )}
          </div>
        </div>
      )}

      {/* Inspections Tab */}
      {activeTab === 'inspections' && (
        <div className="space-y-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search inspections..."
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-nesma-secondary/50"
            />
          </div>
          <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="px-4 py-3 text-xs text-gray-400 uppercase">QCI ID</th>
                  <th className="px-4 py-3 text-xs text-gray-400 uppercase">GRN</th>
                  <th className="px-4 py-3 text-xs text-gray-400 uppercase">Result</th>
                  <th className="px-4 py-3 text-xs text-gray-400 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredRfims.slice(0, 50).map(r => (
                  <tr key={String(r.id)} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-sm text-white">{String(r.id).slice(0, 12)}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{String(r.mrrvId || '-').slice(0, 12)}</td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] ${r.result === 'pass' ? 'bg-emerald-500/20 text-emerald-400' : r.result === 'fail' ? 'bg-red-500/20 text-red-400' : 'bg-gray-500/20 text-gray-400'}`}
                      >
                        {String(r.result || '-')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="px-2 py-0.5 rounded text-[10px] bg-white/10 text-gray-300">
                        {String(r.status)}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredRfims.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                      No inspections found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* OSD Tab */}
      {activeTab === 'osd' && (
        <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="px-4 py-3 text-xs text-gray-400 uppercase">DR ID</th>
                <th className="px-4 py-3 text-xs text-gray-400 uppercase">Type</th>
                <th className="px-4 py-3 text-xs text-gray-400 uppercase">GRN</th>
                <th className="px-4 py-3 text-xs text-gray-400 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {allOsds.slice(0, 50).map(o => (
                <tr key={String(o.id)} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3 text-sm text-white">{String(o.id).slice(0, 12)}</td>
                  <td className="px-4 py-3 text-sm text-gray-300">{String(o.reportType || o.type || '-')}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{String(o.mrrvId || '-').slice(0, 12)}</td>
                  <td className="px-4 py-3">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-white/10 text-gray-300">
                      {String(o.status)}
                    </span>
                  </td>
                </tr>
              ))}
              {allOsds.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                    No DR reports
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Incoming Tab */}
      {activeTab === 'incoming' && (
        <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
          <div className="p-4 border-b border-white/10 bg-white/5">
            <h3 className="text-sm font-bold text-white">Incoming Materials (GRN) — Pending QC</h3>
          </div>
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
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded ${m.status === 'Pending QC' ? 'bg-amber-500/20 text-amber-400' : 'bg-white/10 text-gray-300'}`}
                    >
                      {String(m.status)}
                    </span>
                  </td>
                </tr>
              ))}
              {allMrrvs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center text-gray-500">
                    No incoming materials
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
