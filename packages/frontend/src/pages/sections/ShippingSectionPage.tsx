import React, { Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ship, Target, Anchor, FileCheck } from 'lucide-react';
import { SectionLandingPage } from '@/components/SectionLandingPage';
import { DocumentListPanel } from '@/components/DocumentListPanel';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { RESOURCE_COLUMNS } from '@/config/resourceColumns';
import type { KpiCardProps } from '@/components/KpiCard';
import type { TabDef } from '@/components/SectionTabBar';
import { useShipmentList, useSLACompliance, flattenSLA } from '@/api/hooks';

const LazySla = React.lazy(() => import('@/pages/SlaDashboard').then(m => ({ default: m.SlaDashboard })));

const SuspenseFallback = (
  <div className="glass-card p-12 rounded-xl text-center text-gray-500 animate-pulse">Loading...</div>
);

export const ShippingSectionPage: React.FC = () => {
  const navigate = useNavigate();
  const shipQuery = useShipmentList({ pageSize: 50 });
  const slaQuery = useSLACompliance();

  const sla = flattenSLA(slaQuery.data?.data);
  const shipData = shipQuery.data?.data ?? [];
  const inTransitCount = shipData.filter(s => (s as unknown as Record<string, unknown>).status === 'in_transit').length;

  const kpis: KpiCardProps[] = [
    {
      title: 'Active Shipments',
      value: shipQuery.data?.meta?.total ?? 0,
      icon: Ship,
      color: 'bg-blue-500',
      onClick: () => navigate('/admin/shipping?tab=shipments'),
    },
    {
      title: 'In Transit',
      value: inTransitCount,
      icon: Ship,
      color: 'bg-emerald-500',
      onClick: () => navigate('/admin/shipping?tab=shipments'),
    },
    {
      title: 'SLA Compliance',
      value: `${sla?.compliancePct ?? 0}%`,
      icon: Target,
      color: 'bg-nesma-primary',
      onClick: () => navigate('/admin/shipping?tab=sla'),
    },
    {
      title: 'Customs Pending',
      value: 0,
      icon: Anchor,
      color: 'bg-amber-500',
      onClick: () => navigate('/admin/shipping?tab=customs'),
    },
  ];

  const tabs: TabDef[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'shipments', label: 'Shipments' },
    { key: 'customs', label: 'Customs' },
    { key: 'sla', label: 'SLA' },
  ];

  return (
    <SectionLandingPage
      title="Shipping & Customs"
      subtitle="Shipment tracking, customs clearance, and SLA performance"
      kpis={kpis}
      tabs={tabs}
      loading={shipQuery.isLoading || slaQuery.isLoading}
      quickActions={[
        { label: 'New Shipment', icon: Ship, onClick: () => navigate('/admin/forms/shipment') },
        {
          label: 'New Customs',
          icon: FileCheck,
          onClick: () => navigate('/admin/forms/customs'),
          variant: 'secondary',
        },
      ]}
      children={{
        overview: (
          <div className="space-y-6">
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
            <div className="glass-card rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-4">Recent Shipments</h3>
              {shipData.length > 0 ? (
                <div className="space-y-3">
                  {shipData.slice(0, 5).map(s => {
                    const rec = s as unknown as Record<string, unknown>;
                    return (
                      <div
                        key={rec.id as string}
                        className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                      >
                        <div>
                          <p className="text-white text-sm font-medium">
                            {(rec.documentNumber as string) || (rec.id as string)}
                          </p>
                          <p className="text-gray-400 text-xs">{(rec.origin as string) || ''}</p>
                        </div>
                        <span className="text-xs text-gray-400">
                          {rec.createdAt ? new Date(rec.createdAt as string).toLocaleDateString() : '-'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-gray-500 text-sm text-center py-8">No shipments yet</p>
              )}
            </div>
          </div>
        ),
        shipments: (
          <DocumentListPanel
            title="Shipments"
            icon={Ship}
            columns={RESOURCE_COLUMNS.shipments.columns}
            rows={(shipQuery.data?.data ?? []) as unknown as Record<string, unknown>[]}
            loading={shipQuery.isLoading}
            createLabel="New Shipment"
            createUrl="/admin/forms/shipment"
            entityType="shipment"
          />
        ),
        customs: (
          <div className="glass-card rounded-2xl p-8 text-center">
            <Anchor className="w-12 h-12 mx-auto mb-4 text-gray-600" />
            <h4 className="text-white font-medium mb-2">Customs Clearance</h4>
            <p className="text-gray-400 text-sm mb-4">
              Track customs documentation and clearance status for incoming shipments.
            </p>
            <button onClick={() => navigate('/admin/forms/customs')} className="btn-primary text-sm">
              New Customs Entry
            </button>
          </div>
        ),
        sla: (
          <RouteErrorBoundary label="SLA Dashboard">
            <Suspense fallback={SuspenseFallback}>
              <LazySla />
            </Suspense>
          </RouteErrorBoundary>
        ),
      }}
    />
  );
};
