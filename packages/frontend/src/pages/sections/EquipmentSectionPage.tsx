import React, { Suspense, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Truck,
  Target,
  Bus,
  AlertTriangle,
  FileText,
  ShieldCheck,
  FileSignature,
  Zap,
  Wrench,
  Fuel,
  DoorOpen,
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { SectionLandingPage } from '@/components/SectionLandingPage';
import { StatusBadge } from '@/components/StatusBadge';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { DocumentListPanel } from '@/components/DocumentListPanel';
import { RESOURCE_COLUMNS } from '@/config/resourceColumns';
import type { KpiCardProps } from '@/components/KpiCard';
import type { TabDef } from '@/components/SectionTabBar';
import {
  useDashboardStats,
  useSLACompliance,
  useJobOrders,
  useFleet,
  useGatePassList,
  useRentalContractList,
  useGeneratorMaintenanceList,
  useGeneratorFuelList,
  useToolList,
  useToolIssueList,
} from '@/api/hooks';
import { useGenerators } from '@/api/hooks/useMasterData';
import { CHART_PALETTE } from '@/config/chartTheme';

const LazyKanban = React.lazy(() =>
  import('@/pages/transport/JobOrdersKanban').then(m => ({ default: m.JobOrdersKanban })),
);

const SuspenseFallback = (
  <div className="glass-card p-12 rounded-xl text-center text-gray-500 animate-pulse">Loading...</div>
);

export const EquipmentSectionPage: React.FC = () => {
  const navigate = useNavigate();

  const statsQuery = useDashboardStats();
  const slaQuery = useSLACompliance();
  const joQuery = useJobOrders({ pageSize: 50 });
  const fleetQuery = useFleet({ pageSize: 50 });
  const gpQuery = useGatePassList({ pageSize: 50 });
  const rcQuery = useRentalContractList({ pageSize: 50 });
  const genMainQuery = useGeneratorMaintenanceList({ pageSize: 50 });
  const genFuelQuery = useGeneratorFuelList({ pageSize: 50 });
  const genQuery = useGenerators({ pageSize: 50 });
  const toolQuery = useToolList({ pageSize: 50 });
  const toolIssueQuery = useToolIssueList({ pageSize: 50 });

  const stats = statsQuery.data?.data;
  const sla = slaQuery.data?.data;
  const joData = joQuery.data?.data ?? [];
  const fleetData = fleetQuery.data?.data ?? [];
  const generatorsData = genQuery.data?.data ?? [];

  const loading = statsQuery.isLoading || slaQuery.isLoading;

  const activeFleetCount = useMemo(() => fleetData.filter(f => f.status === 'Active').length, [fleetData]);

  const kpis: KpiCardProps[] = [
    {
      title: 'Active Jobs',
      value: stats?.activeJobs ?? 0,
      icon: Truck,
      color: 'bg-emerald-500',
      onClick: () => navigate('/admin/equipment?tab=all-jobs'),
    },
    {
      title: 'Fleet Active',
      value: activeFleetCount,
      icon: Bus,
      color: 'bg-nesma-primary',
      onClick: () => navigate('/admin/equipment?tab=fleet'),
    },
    {
      title: 'Overdue Jobs',
      value: sla?.overdue ?? 0,
      icon: AlertTriangle,
      color: 'bg-red-500',
      alert: (sla?.overdue ?? 0) > 0,
      onClick: () => navigate('/admin/equipment?tab=kanban'),
    },
    {
      title: 'Generators',
      value: generatorsData.length,
      icon: Zap,
      color: 'bg-amber-500',
      onClick: () => navigate('/admin/equipment?tab=generators'),
    },
  ];

  const tabs: TabDef[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'kanban', label: 'Kanban' },
    { key: 'all-jobs', label: 'All Jobs', badge: joQuery.data?.meta?.total },
    { key: 'gate-passes', label: 'Gate Passes' },
    { key: 'fleet', label: 'Fleet', badge: fleetData.length },
    { key: 'rental-contracts', label: 'Rental Contracts' },
    { key: 'generators', label: 'Generators' },
    { key: 'generator-fuel', label: 'Generator Fuel' },
    { key: 'generator-maintenance', label: 'Generator Maintenance' },
    { key: 'tools', label: 'Tools' },
    { key: 'tool-issues', label: 'Tool Issues' },
  ];

  const joByType = useMemo(() => {
    const counts: Record<string, number> = {};
    joData.forEach(j => {
      const t = ((j as unknown as Record<string, unknown>).type as string) || 'Other';
      counts[t] = (counts[t] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [joData]);

  const overdueJobs = useMemo(
    () =>
      joData
        .filter(j => {
          const rec = j as unknown as Record<string, unknown>;
          return rec.slaStatus === 'Overdue' || rec.status === 'Overdue';
        })
        .slice(0, 5),
    [joData],
  );

  const quickActions = [
    { label: 'New Job Order', icon: FileText, onClick: () => navigate('/admin/forms/jo') },
    {
      label: 'Gate Pass',
      icon: DoorOpen,
      onClick: () => navigate('/admin/forms/gatepass'),
      variant: 'secondary' as const,
    },
    {
      label: 'Log Fuel',
      icon: Fuel,
      onClick: () => navigate('/admin/forms/generator-fuel'),
      variant: 'secondary' as const,
    },
  ];

  const children: Record<string, React.ReactNode> = {
    overview: (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="glass-card p-6 rounded-xl">
            <h3 className="text-white font-semibold mb-4">Job Orders by Type</h3>
            {joByType.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={joByType}
                    cx="50%"
                    cy="50%"
                    outerRadius={95}
                    dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {joByType.map((_, i) => (
                      <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500 text-sm text-center py-12">No job order data yet</p>
            )}
          </div>

          <div className="glass-card p-6 rounded-xl">
            <h3 className="text-white font-semibold mb-4">Overdue Jobs</h3>
            {overdueJobs.length > 0 ? (
              <div className="space-y-3">
                {overdueJobs.map(j => {
                  const rec = j as unknown as Record<string, unknown>;
                  return (
                    <div
                      key={rec.id as string}
                      className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                    >
                      <div>
                        <p className="text-white text-sm font-medium">
                          {(rec.documentNumber as string) || (rec.id as string)}
                        </p>
                        <p className="text-gray-400 text-xs">
                          {(rec.type as string) || 'N/A'} - {(rec.projectName as string) || ''}
                        </p>
                      </div>
                      <StatusBadge status="Overdue" />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center py-12 text-gray-500">
                <ShieldCheck size={32} className="mb-2 text-emerald-400" />
                <p className="text-sm">No overdue jobs</p>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'On Track', value: sla?.onTrack ?? 0, cls: 'text-emerald-400 bg-emerald-500/20' },
            { label: 'At Risk', value: sla?.atRisk ?? 0, cls: 'text-amber-400 bg-amber-500/20' },
            { label: 'Overdue', value: sla?.overdue ?? 0, cls: 'text-red-400 bg-red-500/20' },
          ].map(s => (
            <div key={s.label} className="glass-card p-5 rounded-xl flex items-center gap-4">
              <div className={`p-3 rounded-lg ${s.cls}`}>
                <Target size={20} />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{s.value}</p>
                <p className="text-gray-400 text-xs">{s.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),

    kanban: (
      <RouteErrorBoundary label="Kanban Board">
        <Suspense fallback={SuspenseFallback}>
          <LazyKanban />
        </Suspense>
      </RouteErrorBoundary>
    ),

    'all-jobs': (
      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left p-4 text-nesma-secondary font-medium">ID</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Type</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Project</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Requester</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Date</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Status</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">SLA</th>
            </tr>
          </thead>
          <tbody>
            {joData.slice(0, 15).map(j => {
              const rec = j as unknown as Record<string, unknown>;
              return (
                <tr key={rec.id as string} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="p-4 text-white font-medium">{(rec.documentNumber as string) || (rec.id as string)}</td>
                  <td className="p-4 text-gray-300">{(rec.type as string) || '-'}</td>
                  <td className="p-4 text-gray-300">{(rec.projectName as string) || '-'}</td>
                  <td className="p-4 text-gray-300">{(rec.requesterName as string) || '-'}</td>
                  <td className="p-4 text-gray-300">
                    {rec.createdAt ? new Date(rec.createdAt as string).toLocaleDateString() : '-'}
                  </td>
                  <td className="p-4">
                    <StatusBadge status={(rec.status as string) || 'Pending'} />
                  </td>
                  <td className="p-4">
                    <StatusBadge status={(rec.slaStatus as string) || 'On Track'} />
                  </td>
                </tr>
              );
            })}
            {joData.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-gray-500">
                  No job orders found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    ),

    'gate-passes': (
      <DocumentListPanel
        title="Gate Passes"
        icon={ShieldCheck}
        columns={RESOURCE_COLUMNS['gate-passes'].columns}
        rows={(gpQuery.data?.data ?? []) as unknown as Record<string, unknown>[]}
        loading={gpQuery.isLoading}
        createLabel="New Gate Pass"
        createUrl="/admin/forms/gatepass"
        entityType="gate_pass"
      />
    ),

    fleet: (
      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left p-4 text-nesma-secondary font-medium">Plate Number</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Type</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Category</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Project</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Status</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Driver</th>
            </tr>
          </thead>
          <tbody>
            {fleetData.slice(0, 15).map(f => (
              <tr key={f.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="p-4 text-white font-medium">{f.plateNumber || '-'}</td>
                <td className="p-4 text-gray-300">{f.type || '-'}</td>
                <td className="p-4 text-gray-300">{f.category || '-'}</td>
                <td className="p-4 text-gray-300">{f.projectName || '-'}</td>
                <td className="p-4">
                  <StatusBadge status={f.status || 'Active'} />
                </td>
                <td className="p-4 text-gray-300">{f.driver || '-'}</td>
              </tr>
            ))}
            {fleetData.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-500">
                  No fleet records found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    ),

    'rental-contracts': (
      <DocumentListPanel
        title="Rental Contracts"
        icon={FileSignature}
        columns={RESOURCE_COLUMNS['rental-contracts'].columns}
        rows={(rcQuery.data?.data ?? []) as unknown as Record<string, unknown>[]}
        loading={rcQuery.isLoading}
        createLabel="New Rental Contract"
        createUrl="/admin/forms/rental-contract"
        entityType="rental_contract"
      />
    ),

    generators: (
      <div className="glass-card rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left p-4 text-nesma-secondary font-medium">Asset ID</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Model</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Capacity (kVA)</th>
              <th className="text-left p-4 text-nesma-secondary font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {generatorsData.slice(0, 15).map(g => (
              <tr key={g.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="p-4 text-white font-medium">{g.assetId || '-'}</td>
                <td className="p-4 text-gray-300">{g.model || '-'}</td>
                <td className="p-4 text-gray-300">{g.capacityKva ?? '-'}</td>
                <td className="p-4">
                  <StatusBadge status={g.status || 'Active'} />
                </td>
              </tr>
            ))}
            {generatorsData.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-500">
                  No generators found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    ),

    'generator-fuel': (
      <DocumentListPanel
        title="Generator Fuel Logs"
        icon={Fuel}
        columns={RESOURCE_COLUMNS['generator-fuel'].columns}
        rows={(genFuelQuery.data?.data ?? []) as unknown as Record<string, unknown>[]}
        loading={genFuelQuery.isLoading}
        createLabel="Log Fuel"
        createUrl="/admin/forms/generator-fuel"
        entityType="generator_fuel"
      />
    ),

    'generator-maintenance': (
      <DocumentListPanel
        title="Generator Maintenance"
        icon={Zap}
        columns={RESOURCE_COLUMNS.generators.columns}
        rows={(genMainQuery.data?.data ?? []) as unknown as Record<string, unknown>[]}
        loading={genMainQuery.isLoading}
        createLabel="New Maintenance"
        createUrl="/admin/forms/generator-maintenance"
        entityType="generator_maintenance"
      />
    ),

    tools: (
      <DocumentListPanel
        title="Tool Registry"
        icon={Wrench}
        columns={RESOURCE_COLUMNS.tools.columns}
        rows={(toolQuery.data?.data ?? []) as unknown as Record<string, unknown>[]}
        loading={toolQuery.isLoading}
        createLabel="New Tool"
        createUrl="/admin/forms/tool"
        entityType="tool"
      />
    ),

    'tool-issues': (
      <DocumentListPanel
        title="Tool Issues"
        icon={Wrench}
        columns={RESOURCE_COLUMNS['tool-issues'].columns}
        rows={(toolIssueQuery.data?.data ?? []) as unknown as Record<string, unknown>[]}
        loading={toolIssueQuery.isLoading}
        createLabel="Issue Tool"
        createUrl="/admin/forms/tool-issue"
        entityType="tool_issue"
      />
    ),
  };

  return (
    <SectionLandingPage
      title="Equipment & Transport"
      subtitle="Job orders, fleet, generators, tools, and gate passes"
      kpis={kpis}
      tabs={tabs}
      quickActions={quickActions}
      loading={loading}
      children={children}
      defaultTab="overview"
    />
  );
};
