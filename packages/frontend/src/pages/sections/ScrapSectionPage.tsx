import React, { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Recycle, TrendingDown, Gavel, Loader2 } from 'lucide-react';
import { SectionLandingPage } from '@/components/SectionLandingPage';
import { DocumentListPanel } from '@/components/DocumentListPanel';
import { RESOURCE_COLUMNS } from '@/config/resourceColumns';
import type { KpiCardProps } from '@/components/KpiCard';
import type { TabDef } from '@/components/SectionTabBar';
import { useScrapList, useSurplusList } from '@/api/hooks';

const SscDashboard = lazy(() => import('@/pages/dashboards/SscDashboard').then(m => ({ default: m.SscDashboard })));

export const ScrapSectionPage: React.FC = () => {
  const navigate = useNavigate();
  const scrapQuery = useScrapList({ pageSize: 50 });
  const surplusQuery = useSurplusList({ pageSize: 50 });

  const kpis: KpiCardProps[] = [
    {
      title: 'Active Scrap',
      value: scrapQuery.data?.meta?.total ?? 0,
      icon: Recycle,
      color: 'bg-red-500',
      onClick: () => navigate('/admin/scrap?tab=scrap'),
    },
    {
      title: 'SSC Bids',
      value: 0,
      icon: Gavel,
      color: 'bg-purple-500',
      onClick: () => navigate('/admin/scrap?tab=ssc'),
    },
    {
      title: 'Surplus Items',
      value: surplusQuery.data?.meta?.total ?? 0,
      icon: TrendingDown,
      color: 'bg-amber-500',
      onClick: () => navigate('/admin/scrap?tab=surplus'),
    },
  ];

  const tabs: TabDef[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'scrap', label: 'Scrap' },
    { key: 'ssc', label: 'SSC' },
    { key: 'surplus', label: 'Surplus' },
  ];

  return (
    <SectionLandingPage
      title="Scrap & Surplus"
      subtitle="Scrap disposal, SSC bids, and surplus material management"
      kpis={kpis}
      tabs={tabs}
      loading={scrapQuery.isLoading || surplusQuery.isLoading}
      quickActions={[
        { label: 'Report Scrap', icon: Recycle, onClick: () => navigate('/admin/forms/scrap') },
        {
          label: 'New Surplus',
          icon: TrendingDown,
          onClick: () => navigate('/admin/forms/surplus'),
          variant: 'secondary',
        },
      ]}
      children={{
        overview: (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Recycle className="w-6 h-6 text-red-400" />
                  <h3 className="text-white font-semibold">Scrap Pipeline</h3>
                </div>
                <p className="text-gray-400 text-sm">
                  Track scrap items through inspection, committee approval, and disposal.
                </p>
                <button
                  onClick={() => navigate('/admin/scrap?tab=scrap')}
                  className="text-nesma-secondary text-xs hover:underline mt-3 block"
                >
                  View Scrap Items
                </button>
              </div>
              <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <TrendingDown className="w-6 h-6 text-amber-400" />
                  <h3 className="text-white font-semibold">Surplus Pipeline</h3>
                </div>
                <p className="text-gray-400 text-sm">
                  Track surplus materials through evaluation, approval, and disposition.
                </p>
                <button
                  onClick={() => navigate('/admin/scrap?tab=surplus')}
                  className="text-nesma-secondary text-xs hover:underline mt-3 block"
                >
                  View Surplus Items
                </button>
              </div>
            </div>
          </div>
        ),
        scrap: (
          <DocumentListPanel
            title="Scrap Items"
            icon={Recycle}
            columns={RESOURCE_COLUMNS.scrap.columns}
            rows={(scrapQuery.data?.data ?? []) as unknown as Record<string, unknown>[]}
            loading={scrapQuery.isLoading}
            createLabel="Report Scrap"
            createUrl="/admin/forms/scrap"
            entityType="scrap_item"
          />
        ),
        ssc: (
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-7 h-7 text-nesma-secondary animate-spin" />
                <span className="ml-3 text-gray-400">Loading SSC dashboard...</span>
              </div>
            }
          >
            <SscDashboard />
          </Suspense>
        ),
        surplus: (
          <DocumentListPanel
            title="Surplus Items"
            icon={TrendingDown}
            columns={RESOURCE_COLUMNS.surplus.columns}
            rows={(surplusQuery.data?.data ?? []) as unknown as Record<string, unknown>[]}
            loading={surplusQuery.isLoading}
            createLabel="Report Surplus"
            createUrl="/admin/forms/surplus"
            entityType="surplus"
          />
        ),
      }}
    />
  );
};
