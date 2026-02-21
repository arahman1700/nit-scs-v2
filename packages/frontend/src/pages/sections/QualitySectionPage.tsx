import React, { Suspense, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw, Search, AlertTriangle, CheckCircle, Plus, ClipboardList, FileWarning } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { SectionLandingPage } from '@/components/SectionLandingPage';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import type { KpiCardProps } from '@/components/KpiCard';
import type { TabDef } from '@/components/SectionTabBar';
import { useMrvList, useRfimList, useOsdList } from '@/api/hooks';
import { CHART_PALETTE } from '@/config/chartTheme';

const LazyRfimList = React.lazy(() => import('@/pages/quality/RfimList').then(m => ({ default: m.RfimList })));

// ── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Approved: 'bg-emerald-500/20 text-emerald-400',
    Active: 'bg-emerald-500/20 text-emerald-400',
    Pending: 'bg-amber-500/20 text-amber-400',
    Rejected: 'bg-red-500/20 text-red-400',
    Open: 'bg-blue-500/20 text-blue-400',
    Closed: 'bg-gray-500/20 text-gray-400',
    Resolved: 'bg-emerald-500/20 text-emerald-400',
  };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-white/10 text-gray-300'}`}>
      {status}
    </span>
  );
}

// ── Component ────────────────────────────────────────────────────────────────

export const QualitySectionPage: React.FC = () => {
  const navigate = useNavigate();

  const mrvQuery = useMrvList({ pageSize: 50 });
  const rfimQuery = useRfimList({ pageSize: 50 });
  const osdQuery = useOsdList({ pageSize: 50 });

  const mrvData = mrvQuery.data?.data ?? [];
  const rfimData = rfimQuery.data?.data ?? [];
  const osdData = osdQuery.data?.data ?? [];
  const osdTotal = osdQuery.data?.meta?.total ?? osdData.length;

  const loading = mrvQuery.isLoading || rfimQuery.isLoading || osdQuery.isLoading;

  // ── KPI calculations ──────────────────────────────────────────────────────

  const pendingReturns = useMemo(
    () => mrvData.filter(r => (r as unknown as Record<string, unknown>).status === 'Pending').length,
    [mrvData],
  );

  const openInspections = useMemo(
    () =>
      rfimData.filter(r => {
        const s = (r as unknown as Record<string, unknown>).status as string;
        return s === 'Pending' || s === 'Open';
      }).length,
    [rfimData],
  );

  const qcPassRate = useMemo(() => {
    if (rfimData.length === 0) return 0;
    const passed = rfimData.filter(r => (r as unknown as Record<string, unknown>).result === 'Pass').length;
    return Math.round((passed / rfimData.length) * 100);
  }, [rfimData]);

  const kpis: KpiCardProps[] = [
    {
      title: 'Pending Returns',
      value: pendingReturns,
      icon: RotateCcw,
      color: 'bg-amber-500',
      onClick: () => navigate('/admin/warehouses?tab=mrn'),
    },
    {
      title: 'Open Inspections',
      value: openInspections,
      icon: Search,
      color: 'bg-blue-500',
      onClick: () => navigate('/admin/warehouses?tab=qci'),
    },
    {
      title: 'DR Reports',
      value: osdTotal,
      icon: AlertTriangle,
      color: 'bg-red-500',
      onClick: () => navigate('/admin/warehouses?tab=dr'),
    },
    {
      title: 'QC Pass Rate',
      value: `${qcPassRate}%`,
      icon: CheckCircle,
      color: 'bg-emerald-500',
      onClick: () => navigate('/admin/warehouses?tab=qci'),
    },
  ];

  // ── Tab definitions ───────────────────────────────────────────────────────

  const tabs: TabDef[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'mrv', label: 'Returns', badge: pendingReturns },
    { key: 'rfim', label: 'Inspections', badge: openInspections },
    { key: 'osd', label: 'DR Reports' },
  ];

  // ── Overview: Returns by type chart data ──────────────────────────────────

  const returnsByType = useMemo(() => {
    const counts: Record<string, number> = {};
    mrvData.forEach(r => {
      const t = ((r as unknown as Record<string, unknown>).returnType as string) || 'Other';
      counts[t] = (counts[t] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [mrvData]);

  const recentRfims = useMemo(() => rfimData.slice(0, 5), [rfimData]);

  const osdSummary = useMemo(() => {
    const counts: Record<string, number> = { Overage: 0, Shortage: 0, Damage: 0 };
    osdData.forEach(r => {
      const t = (r as unknown as Record<string, unknown>).reportType as string;
      if (t && counts[t] !== undefined) counts[t]++;
    });
    return counts;
  }, [osdData]);

  // ── Quick actions ─────────────────────────────────────────────────────────

  const quickActions = [
    { label: 'New Return', icon: RotateCcw, onClick: () => navigate('/admin/forms/mrn') },
    {
      label: 'Inspection Request',
      icon: ClipboardList,
      onClick: () => navigate('/admin/forms/qci'),
      variant: 'secondary' as const,
    },
    {
      label: 'DR Report',
      icon: FileWarning,
      onClick: () => navigate('/admin/forms/dr'),
      variant: 'secondary' as const,
    },
  ];

  // ── Tab content ───────────────────────────────────────────────────────────

  const children: Record<string, React.ReactNode> = {
    overview: (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Returns by type chart */}
          <div className="glass-card p-6 rounded-xl">
            <h3 className="text-white font-semibold mb-4">Returns by Type</h3>
            {returnsByType.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={returnsByType}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {returnsByType.map((_, i) => (
                      <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-sm text-center py-12">No return data yet</p>
            )}
          </div>

          {/* Recent inspections queue */}
          <div className="glass-card p-6 rounded-xl">
            <h3 className="text-white font-semibold mb-4">Recent Inspections Queue</h3>
            {recentRfims.length > 0 ? (
              <div className="space-y-3">
                {recentRfims.map(r => {
                  const rec = r as unknown as Record<string, unknown>;
                  return (
                    <div
                      key={rec.id as string}
                      className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                    >
                      <div>
                        <p className="text-white text-sm font-medium">
                          {(rec.documentNumber as string) || (rec.id as string)}
                        </p>
                        <p className="text-gray-400 text-xs">{(rec.itemName as string) || 'N/A'}</p>
                      </div>
                      <StatusBadge status={(rec.status as string) || 'Pending'} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-gray-500 text-sm text-center py-12">No inspections queued</p>
            )}
          </div>
        </div>

        {/* OSD summary cards */}
        <div className="grid grid-cols-3 gap-4">
          {Object.entries(osdSummary).map(([type, count]) => {
            const icons: Record<string, React.ElementType> = {
              Overage: Plus,
              Shortage: AlertTriangle,
              Damage: FileWarning,
            };
            const Icon = icons[type] || AlertTriangle;
            return (
              <div key={type} className="glass-card p-5 rounded-xl flex items-center gap-4">
                <div className="p-3 rounded-lg bg-red-500/20 text-red-400">
                  <Icon size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{count}</p>
                  <p className="text-gray-400 text-xs">{type}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ),

    mrv: (
      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left p-4 text-nesma-secondary font-medium">ID</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Return Type</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Date</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Project</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Warehouse</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {mrvData.slice(0, 15).map(r => {
              const rec = r as unknown as Record<string, unknown>;
              return (
                <tr key={rec.id as string} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4 text-white font-medium">{(rec.documentNumber as string) || (rec.id as string)}</td>
                  <td className="p-4 text-gray-300">{(rec.returnType as string) || '-'}</td>
                  <td className="p-4 text-gray-300">
                    {rec.createdAt ? new Date(rec.createdAt as string).toLocaleDateString() : '-'}
                  </td>
                  <td className="p-4 text-gray-300">{(rec.projectName as string) || '-'}</td>
                  <td className="p-4 text-gray-300">{(rec.warehouseName as string) || '-'}</td>
                  <td className="p-4">
                    <StatusBadge status={(rec.status as string) || 'Pending'} />
                  </td>
                </tr>
              );
            })}
            {mrvData.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  No return records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {mrvData.length > 15 && (
          <div className="p-3 text-center border-t border-white/10">
            <button
              onClick={() => navigate('/admin/list/mrn')}
              className="text-nesma-secondary text-sm hover:underline"
            >
              View All {mrvQuery.data?.meta?.total ?? mrvData.length} Returns
            </button>
          </div>
        )}
      </div>
    ),

    rfim: (
      <RouteErrorBoundary label="Inspections">
        <Suspense
          fallback={
            <div className="glass-card p-12 rounded-xl text-center text-gray-500 animate-pulse">
              Loading inspections...
            </div>
          }
        >
          <LazyRfimList />
        </Suspense>
      </RouteErrorBoundary>
    ),

    osd: (
      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left p-4 text-nesma-secondary font-medium">ID</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">GRN Ref</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Report Type</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Qty Affected</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Action</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {osdData.slice(0, 15).map(r => {
              const rec = r as unknown as Record<string, unknown>;
              return (
                <tr key={rec.id as string} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4 text-white font-medium">{(rec.documentNumber as string) || (rec.id as string)}</td>
                  <td className="p-4 text-gray-300">{(rec.mrrvId as string) || '-'}</td>
                  <td className="p-4 text-gray-300">{(rec.reportType as string) || '-'}</td>
                  <td className="p-4 text-gray-300">{(rec.qtyAffected as number) ?? '-'}</td>
                  <td className="p-4 text-gray-300">{(rec.action as string) || '-'}</td>
                  <td className="p-4">
                    <StatusBadge status={(rec.status as string) || 'Open'} />
                  </td>
                </tr>
              );
            })}
            {osdData.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  No DR reports found
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {osdData.length > 15 && (
          <div className="p-3 text-center border-t border-white/10">
            <button onClick={() => navigate('/admin/list/dr')} className="text-nesma-secondary text-sm hover:underline">
              View All {osdTotal} DR Reports
            </button>
          </div>
        )}
      </div>
    ),
  };

  return (
    <SectionLandingPage
      title="Quality & Returns"
      subtitle="Material returns, inspections, and over/short/damage reports"
      kpis={kpis}
      tabs={tabs}
      quickActions={quickActions}
      loading={loading}
      children={children}
      defaultTab="overview"
    />
  );
};
