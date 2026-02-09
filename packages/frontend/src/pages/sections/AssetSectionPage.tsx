import React, { lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { Recycle, TrendingDown, Wrench, Building, Gavel, Package, Loader2 } from 'lucide-react';
import { SectionLandingPage } from '@/components/SectionLandingPage';
import { DocumentListPanel } from '@/components/DocumentListPanel';
import { RESOURCE_COLUMNS } from '@/config/resourceColumns';
import type { KpiCardProps } from '@/components/KpiCard';
import type { TabDef } from '@/components/SectionTabBar';
import { useSurplusList, useScrapList, useToolList } from '@/api/hooks';

const SscDashboard = lazy(() => import('@/pages/dashboards/SscDashboard').then(m => ({ default: m.SscDashboard })));
const DepreciationDashboard = lazy(() =>
  import('@/pages/dashboards/DepreciationDashboard').then(m => ({ default: m.DepreciationDashboard })),
);

export const AssetSectionPage: React.FC = () => {
  const navigate = useNavigate();
  const surplusQuery = useSurplusList({ pageSize: 50 });
  const scrapQuery = useScrapList({ pageSize: 50 });
  const toolQuery = useToolList({ pageSize: 50 });

  const kpis: KpiCardProps[] = [
    { title: 'Active Surplus', value: 0, icon: TrendingDown, color: 'bg-amber-500' },
    { title: 'Scrap Pending', value: 0, icon: Recycle, color: 'bg-red-500' },
    { title: 'SSC Bids', value: 0, icon: Gavel, color: 'bg-purple-500' },
    { title: 'Tools Issued', value: 0, icon: Wrench, color: 'bg-blue-500' },
  ];

  const tabs: TabDef[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'surplus', label: 'Surplus' },
    { key: 'scrap', label: 'Scrap' },
    { key: 'ssc', label: 'SSC' },
    { key: 'tools', label: 'Tools' },
    { key: 'fixed-assets', label: 'Fixed Assets' },
    { key: 'depreciation', label: 'Depreciation' },
  ];

  return (
    <SectionLandingPage
      title="Asset Lifecycle"
      subtitle="Surplus, scrap, tools, fixed assets, and depreciation management"
      kpis={kpis}
      tabs={tabs}
      loading={false}
      quickActions={[
        { label: 'Report Surplus', icon: TrendingDown, onClick: () => navigate('/admin/forms/surplus') },
        { label: 'Report Scrap', icon: Recycle, onClick: () => navigate('/admin/forms/scrap'), variant: 'secondary' },
      ]}
      children={{
        overview: (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <TrendingDown className="w-6 h-6 text-amber-400" />
                  <h3 className="text-white font-semibold">Surplus Pipeline</h3>
                </div>
                <p className="text-gray-400 text-sm">
                  Track surplus materials through evaluation, approval, and disposition.
                </p>
                <button
                  onClick={() => navigate('/admin/assets?tab=surplus')}
                  className="text-nesma-secondary text-xs hover:underline mt-3 block"
                >
                  View Surplus Items
                </button>
              </div>
              <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Recycle className="w-6 h-6 text-red-400" />
                  <h3 className="text-white font-semibold">Scrap Management</h3>
                </div>
                <p className="text-gray-400 text-sm">Monthly identification, SSC bidding, buyer pickup tracking.</p>
                <button
                  onClick={() => navigate('/admin/assets?tab=scrap')}
                  className="text-nesma-secondary text-xs hover:underline mt-3 block"
                >
                  View Scrap Items
                </button>
              </div>
              <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Wrench className="w-6 h-6 text-blue-400" />
                  <h3 className="text-white font-semibold">Tools Tracking</h3>
                </div>
                <p className="text-gray-400 text-sm">Issue, return, and utilization tracking for all tools.</p>
                <button
                  onClick={() => navigate('/admin/assets?tab=tools')}
                  className="text-nesma-secondary text-xs hover:underline mt-3 block"
                >
                  View Tools
                </button>
              </div>
            </div>
          </div>
        ),
        surplus: (
          <DocumentListPanel
            title="Surplus Items"
            icon={TrendingDown}
            columns={RESOURCE_COLUMNS.surplus.columns}
            rows={(surplusQuery.data?.data ?? []) as Record<string, unknown>[]}
            loading={surplusQuery.isLoading}
            createLabel="Report Surplus"
            createUrl="/admin/forms/surplus"
          />
        ),
        scrap: (
          <DocumentListPanel
            title="Scrap Items"
            icon={Recycle}
            columns={RESOURCE_COLUMNS.scrap.columns}
            rows={(scrapQuery.data?.data ?? []) as Record<string, unknown>[]}
            loading={scrapQuery.isLoading}
            createLabel="Report Scrap"
            createUrl="/admin/forms/scrap"
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
        tools: (
          <DocumentListPanel
            title="Tool Registry"
            icon={Wrench}
            columns={RESOURCE_COLUMNS.tools.columns}
            rows={(toolQuery.data?.data ?? []) as Record<string, unknown>[]}
            loading={toolQuery.isLoading}
          />
        ),
        'fixed-assets': (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Building className="w-5 h-5 text-nesma-secondary" />
              <h3 className="text-white font-semibold">Fixed Assets Register</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Building className="w-6 h-6 text-blue-400" />
                  <h4 className="text-white font-medium">Asset Categories</h4>
                </div>
                <div className="space-y-2">
                  {['Buildings & Structures', 'Vehicles & Equipment', 'Office Equipment', 'IT Infrastructure'].map(
                    cat => (
                      <div
                        key={cat}
                        className="flex items-center justify-between py-1.5 border-b border-white/5 last:border-0"
                      >
                        <span className="text-gray-400 text-sm">{cat}</span>
                        <span className="text-white text-sm font-medium">0</span>
                      </div>
                    ),
                  )}
                </div>
              </div>
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <Package className="w-6 h-6 text-emerald-400" />
                  <h4 className="text-white font-medium">Asset Summary</h4>
                </div>
                <div className="space-y-3">
                  <div className="text-center py-2">
                    <p className="text-3xl font-bold text-white">0</p>
                    <p className="text-gray-500 text-xs mt-1">Total Assets</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="text-center p-2 bg-white/5 rounded-lg">
                      <p className="text-lg font-bold text-emerald-400">0</p>
                      <p className="text-gray-500 text-xs">Active</p>
                    </div>
                    <div className="text-center p-2 bg-white/5 rounded-lg">
                      <p className="text-lg font-bold text-amber-400">0</p>
                      <p className="text-gray-500 text-xs">Disposed</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="glass-card rounded-xl p-6">
                <div className="flex items-center gap-3 mb-3">
                  <TrendingDown className="w-6 h-6 text-amber-400" />
                  <h4 className="text-white font-medium">Depreciation</h4>
                </div>
                <p className="text-gray-400 text-sm mb-3">
                  Track asset value over time with straight-line depreciation.
                </p>
                <button
                  onClick={() => navigate('/admin/assets?tab=depreciation')}
                  className="text-nesma-secondary text-xs hover:underline"
                >
                  View Depreciation Dashboard
                </button>
              </div>
            </div>
          </div>
        ),
        depreciation: (
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-64">
                <Loader2 className="w-7 h-7 text-nesma-secondary animate-spin" />
                <span className="ml-3 text-gray-400">Loading depreciation dashboard...</span>
              </div>
            }
          >
            <DepreciationDashboard />
          </Suspense>
        ),
      }}
    />
  );
};
