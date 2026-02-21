import React, { useState, useMemo } from 'react';
import { Package, Recycle, Wrench, Building, Loader2, ChevronRight } from 'lucide-react';
import { useSurplusList, useScrapList, useToolList } from '@/api/hooks';
import { KpiCard } from '@/components/KpiCard';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import { StatusBadge } from '@/components/StatusBadge';

// ── Asset Lifecycle Dashboard ──────────────────────────────────────────────
// Unified view across Surplus, Scrap, Tools, and Fixed Assets.

export const AssetDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'surplus' | 'scrap' | 'tools' | 'fixed_assets'>('overview');

  // API hooks
  const { data: surplusResponse, isLoading: surplusLoading } = useSurplusList({ pageSize: 100 });
  const { data: scrapResponse, isLoading: scrapLoading } = useScrapList({ pageSize: 100 });
  const { data: toolResponse, isLoading: toolLoading } = useToolList({ pageSize: 100 });

  const surplusRows = (surplusResponse?.data ?? []) as Record<string, unknown>[];
  const scrapRows = (scrapResponse?.data ?? []) as Record<string, unknown>[];
  const toolRows = (toolResponse?.data ?? []) as Record<string, unknown>[];

  const isLoading = surplusLoading || scrapLoading || toolLoading;

  // ── KPI calculations ─────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const totalSurplus = surplusRows.length;
    const activeScrap = scrapRows.filter(
      r => !['closed', 'disposed', 'sold', 'rejected'].includes(String(r.status ?? '').toLowerCase()),
    ).length;
    const toolsIssued = toolRows.filter(r => String(r.status ?? '').toLowerCase() === 'issued').length;
    // Fixed Assets is a placeholder count -- no dedicated hook yet
    const fixedAssets = 0;
    return { totalSurplus, activeScrap, toolsIssued, fixedAssets };
  }, [surplusRows, scrapRows, toolRows]);

  const formatDate = (dateStr: unknown) => {
    if (!dateStr || typeof dateStr !== 'string') return '--';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // ── Loading state ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-7 h-7 text-nesma-secondary animate-spin" />
        <span className="ml-3 text-gray-400">Loading asset data...</span>
      </div>
    );
  }

  return (
    <RouteErrorBoundary label="Asset Dashboard">
      <div className="space-y-8 animate-fade-in">
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row justify-between items-end gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-nesma-primary/20 text-nesma-secondary">
              <Package size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white glow-text">Asset Lifecycle</h1>
              <p className="text-gray-400 mt-1 text-sm">Surplus, scrap, tools, and fixed asset management</p>
            </div>
          </div>

          {/* ── Tab Navigation ────────────────────────────────────────────── */}
          <div className="flex flex-wrap gap-2 p-1 bg-white/5 rounded-xl border border-white/10 w-full md:w-auto overflow-x-auto">
            {[
              { key: 'overview', label: 'Overview' },
              { key: 'surplus', label: 'Surplus' },
              { key: 'scrap', label: 'Scrap' },
              { key: 'tools', label: 'Tools' },
              { key: 'fixed_assets', label: 'Fixed Assets' },
            ].map(t => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key as typeof activeTab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap flex-1 md:flex-none ${
                  activeTab === t.key
                    ? 'bg-nesma-primary text-white shadow-lg shadow-nesma-primary/20'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── KPI Cards ───────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <KpiCard
                title="Total Surplus"
                value={kpis.totalSurplus}
                icon={Package}
                color="bg-blue-500"
                onClick={() => setActiveTab('surplus')}
              />
              <KpiCard
                title="Active Scrap"
                value={kpis.activeScrap}
                icon={Recycle}
                color="bg-amber-500"
                alert={kpis.activeScrap > 10}
                onClick={() => setActiveTab('scrap')}
              />
              <KpiCard
                title="Tools Issued"
                value={kpis.toolsIssued}
                icon={Wrench}
                color="bg-emerald-500"
                onClick={() => setActiveTab('tools')}
              />
              <KpiCard
                title="Fixed Assets"
                value={kpis.fixedAssets}
                icon={Building}
                color="bg-purple-500"
                sublabel="Coming soon"
                onClick={() => setActiveTab('fixed_assets')}
              />
            </div>

            {/* ── Recent Surplus & Scrap ──────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Surplus */}
              <div className="glass-card rounded-2xl p-6">
                <h3 className="font-bold text-lg text-white mb-4 border-b border-white/10 pb-2 flex items-center justify-between">
                  <span>Recent Surplus</span>
                  <button
                    onClick={() => setActiveTab('surplus')}
                    className="text-xs text-nesma-secondary hover:text-white flex items-center gap-1"
                  >
                    View All <ChevronRight size={12} />
                  </button>
                </h3>
                <div className="space-y-3">
                  {surplusRows.slice(0, 5).map((row, idx) => (
                    <div
                      key={String(row.id ?? idx)}
                      className="flex justify-between items-center p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors border border-transparent hover:border-blue-500/30"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-200">{String(row.formNumber ?? row.id ?? '--')}</p>
                        <p className="text-xs text-gray-500">{String(row.description ?? row.materialType ?? '--')}</p>
                      </div>
                      <StatusBadge status={String(row.status ?? 'Draft')} />
                    </div>
                  ))}
                  {surplusRows.length === 0 && (
                    <p className="text-sm text-gray-500 text-center py-4">No surplus records</p>
                  )}
                </div>
              </div>

              {/* Recent Scrap */}
              <div className="glass-card rounded-2xl p-6">
                <h3 className="font-bold text-lg text-white mb-4 border-b border-white/10 pb-2 flex items-center justify-between">
                  <span>Recent Scrap</span>
                  <button
                    onClick={() => setActiveTab('scrap')}
                    className="text-xs text-nesma-secondary hover:text-white flex items-center gap-1"
                  >
                    View All <ChevronRight size={12} />
                  </button>
                </h3>
                <div className="space-y-3">
                  {scrapRows.slice(0, 5).map((row, idx) => (
                    <div
                      key={String(row.id ?? idx)}
                      className="flex justify-between items-center p-3 bg-white/5 rounded-xl hover:bg-white/10 transition-colors border border-transparent hover:border-amber-500/30"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-200">{String(row.formNumber ?? row.id ?? '--')}</p>
                        <p className="text-xs text-gray-500">
                          {String(row.materialType ?? '--')} -- {String(row.condition ?? '--')}
                        </p>
                      </div>
                      <StatusBadge status={String(row.status ?? 'Draft')} />
                    </div>
                  ))}
                  {scrapRows.length === 0 && <p className="text-sm text-gray-500 text-center py-4">No scrap records</p>}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── SURPLUS TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'surplus' && (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">Surplus Items</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-gray-400 border-b border-white/10">
                  <tr>
                    <th className="pb-3 pt-3 pl-4">ID</th>
                    <th className="pb-3 pt-3">Description</th>
                    <th className="pb-3 pt-3">Warehouse</th>
                    <th className="pb-3 pt-3">Date</th>
                    <th className="pb-3 pt-3 pr-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="text-white divide-y divide-white/5">
                  {surplusRows.length > 0 ? (
                    surplusRows.map((row, idx) => (
                      <tr key={String(row.id ?? idx)} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 pl-4 font-mono text-nesma-secondary">
                          {String(row.formNumber ?? row.id ?? '--')}
                        </td>
                        <td className="py-3 text-gray-300">{String(row.description ?? '--')}</td>
                        <td className="py-3 text-gray-400">{String(row.warehouseName ?? row.warehouseId ?? '--')}</td>
                        <td className="py-3 text-gray-400">{formatDate(row.createdAt ?? row.date)}</td>
                        <td className="py-3 pr-4 text-center">
                          <StatusBadge status={String(row.status ?? 'Draft')} />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-500">
                        No surplus items found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── SCRAP TAB ───────────────────────────────────────────────────── */}
        {activeTab === 'scrap' && (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">Scrap Reports</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-gray-400 border-b border-white/10">
                  <tr>
                    <th className="pb-3 pt-3 pl-4">ID</th>
                    <th className="pb-3 pt-3">Material Type</th>
                    <th className="pb-3 pt-3">Condition</th>
                    <th className="pb-3 pt-3 text-right">Qty</th>
                    <th className="pb-3 pt-3">Date</th>
                    <th className="pb-3 pt-3 pr-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="text-white divide-y divide-white/5">
                  {scrapRows.length > 0 ? (
                    scrapRows.map((row, idx) => (
                      <tr key={String(row.id ?? idx)} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 pl-4 font-mono text-nesma-secondary">
                          {String(row.formNumber ?? row.id ?? '--')}
                        </td>
                        <td className="py-3 text-gray-300">{String(row.materialType ?? '--')}</td>
                        <td className="py-3 text-gray-400">{String(row.condition ?? '--')}</td>
                        <td className="py-3 text-right font-medium">{Number(row.qty ?? 0).toLocaleString()}</td>
                        <td className="py-3 text-gray-400">{formatDate(row.createdAt ?? row.date)}</td>
                        <td className="py-3 pr-4 text-center">
                          <StatusBadge status={String(row.status ?? 'Draft')} />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-gray-500">
                        No scrap reports found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TOOLS TAB ───────────────────────────────────────────────────── */}
        {activeTab === 'tools' && (
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10">
              <h3 className="text-lg font-semibold text-white">Tools Inventory</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-gray-400 border-b border-white/10">
                  <tr>
                    <th className="pb-3 pt-3 pl-4">Code</th>
                    <th className="pb-3 pt-3">Name</th>
                    <th className="pb-3 pt-3">Category</th>
                    <th className="pb-3 pt-3 text-right">Qty</th>
                    <th className="pb-3 pt-3 pr-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="text-white divide-y divide-white/5">
                  {toolRows.length > 0 ? (
                    toolRows.map((row, idx) => (
                      <tr key={String(row.id ?? idx)} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 pl-4 font-mono text-nesma-secondary">
                          {String(row.code ?? row.id ?? '--')}
                        </td>
                        <td className="py-3 text-gray-300">{String(row.name ?? '--')}</td>
                        <td className="py-3 text-gray-400">{String(row.category ?? '--')}</td>
                        <td className="py-3 text-right font-medium">{Number(row.quantity ?? 0).toLocaleString()}</td>
                        <td className="py-3 pr-4 text-center">
                          <StatusBadge status={String(row.status ?? 'Available')} />
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-gray-500">
                        No tools found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── FIXED ASSETS TAB ────────────────────────────────────────────── */}
        {activeTab === 'fixed_assets' && (
          <div className="glass-card rounded-2xl p-6 flex items-start gap-4 border border-blue-500/20">
            <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400 shrink-0 mt-0.5">
              <Building className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-white font-semibold mb-1">Coming Soon</h4>
              <p className="text-gray-400 text-sm">
                Fixed Asset tracking will be integrated with the Depreciation module. Once connected, this tab will show
                registered fixed assets, their depreciation schedules, and net book values across all projects and
                warehouses.
              </p>
            </div>
          </div>
        )}
      </div>
    </RouteErrorBoundary>
  );
};
