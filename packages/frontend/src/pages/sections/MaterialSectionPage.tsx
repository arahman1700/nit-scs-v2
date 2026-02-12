import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  ArrowDownCircle,
  ArrowUpCircle,
  RotateCcw,
  ClipboardCheck,
  AlertTriangle,
  FileText,
  Truck,
  ArrowRightLeft,
  Recycle,
} from 'lucide-react';
import { SectionLandingPage } from '@/components/SectionLandingPage';
import { DocumentListPanel } from '@/components/DocumentListPanel';
import { StatusBadge } from '@/components/StatusBadge';
import type { KpiCardProps } from '@/components/KpiCard';
import type { TabDef } from '@/components/SectionTabBar';
import { RESOURCE_COLUMNS } from '@/config/resourceColumns';
import {
  useMrrvList,
  useRfimList,
  useGrnList,
  useQciList,
  useDrList,
  useMiList,
  useMrnList,
  useMrList,
  useBinCardList,
  useImsfList,
  useWtList,
  useScrapList,
} from '@/api/hooks';
import { useInventory, useItems } from '@/api/hooks/useMasterData';
import type { ColumnDef } from '@/config/resourceColumns';

export const MaterialSectionPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: grnAll, isLoading } = useMrrvList({ pageSize: 10, sortBy: 'createdAt', sortDir: 'desc' });
  const { data: grnPending } = useMrrvList({ pageSize: 1, status: 'pending_qc' });
  const { data: qciPending } = useRfimList({ pageSize: 1, status: 'pending' });

  const grnQuery = useGrnList({ pageSize: 50, sortBy: 'createdAt', sortDir: 'desc' });
  const qciQuery = useQciList({ pageSize: 50 });
  const drQuery = useDrList({ pageSize: 50 });
  const miQuery = useMiList({ pageSize: 50 });
  const mrnQuery = useMrnList({ pageSize: 50 });
  const mrQuery = useMrList({ pageSize: 50 });

  const inventoryQuery = useInventory({ pageSize: 100 });
  const itemsQuery = useItems({ pageSize: 100 });
  const binCardQuery = useBinCardList({ pageSize: 100 });
  const imsfQuery = useImsfList({ pageSize: 50 });
  const wtQuery = useWtList({ pageSize: 50 });
  const scrapQuery = useScrapList({ pageSize: 50 });

  const itemColumns: ColumnDef[] = [
    { key: 'itemCode', label: 'Item Code' },
    { key: 'itemDescription', label: 'Description' },
    { key: 'category', label: 'Category' },
  ];

  const grnRows = (grnAll?.data ?? []) as Record<string, unknown>[];

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    grnRows.forEach(r => {
      const s = (r.status as string) ?? 'draft';
      counts[s] = (counts[s] ?? 0) + 1;
    });
    return counts;
  }, [grnRows]);

  const kpis: KpiCardProps[] = [
    { title: 'Pending GRN', value: grnPending?.meta?.total ?? 0, icon: ArrowDownCircle, color: 'bg-amber-500' },
    { title: 'Total Receipts', value: grnAll?.meta?.total ?? 0, icon: Package, color: 'bg-emerald-500' },
    { title: 'Pending QCI', value: qciPending?.meta?.total ?? 0, icon: ClipboardCheck, color: 'bg-purple-500' },
  ];

  const tabs: TabDef[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'grn', label: 'GRN', badge: grnPending?.meta?.total },
    { key: 'qci', label: 'QCI', badge: qciPending?.meta?.total },
    { key: 'dr', label: 'DR' },
    { key: 'mi', label: 'MI' },
    { key: 'mrn', label: 'MRN' },
    { key: 'mr', label: 'MR' },
    { key: 'inventory', label: 'Inventory' },
    { key: 'bin-cards', label: 'Bin Cards' },
    { key: 'non-moving', label: 'Non-Moving' },
    { key: 'items', label: 'Item Master' },
    { key: 'imsf', label: 'IMSF' },
    { key: 'wt', label: 'WT' },
    { key: 'scrap', label: 'Scrap' },
  ];

  return (
    <SectionLandingPage
      title="Material Management"
      subtitle="Goods receipt, quality inspection, issuance, returns, and inventory"
      kpis={kpis}
      tabs={tabs}
      loading={isLoading}
      quickActions={[
        { label: 'New GRN', icon: ArrowDownCircle, onClick: () => navigate('/admin/forms/grn') },
        { label: 'New MI', icon: ArrowUpCircle, onClick: () => navigate('/admin/forms/mi'), variant: 'secondary' },
        { label: 'New MR', icon: FileText, onClick: () => navigate('/admin/forms/mr'), variant: 'secondary' },
        { label: 'New MRN', icon: RotateCcw, onClick: () => navigate('/admin/forms/mrn'), variant: 'secondary' },
        { label: 'New DR', icon: AlertTriangle, onClick: () => navigate('/admin/forms/dr'), variant: 'secondary' },
        { label: 'New IMSF', icon: Truck, onClick: () => navigate('/admin/forms/imsf'), variant: 'secondary' },
        { label: 'New WT', icon: ArrowRightLeft, onClick: () => navigate('/admin/forms/wt'), variant: 'secondary' },
        { label: 'Report Scrap', icon: Recycle, onClick: () => navigate('/admin/forms/scrap'), variant: 'secondary' },
      ]}
      children={{
        overview: (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(statusCounts).map(([status, count]) => (
                <div key={status} className="glass-card p-4 rounded-xl text-center">
                  <p className="text-2xl font-bold text-white">{count}</p>
                  <p className="text-gray-400 text-xs mt-1">
                    {status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </p>
                </div>
              ))}
            </div>
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h3 className="text-white font-semibold">Recent GRN Queue</h3>
                <button
                  onClick={() => navigate('/admin/material?tab=grn')}
                  className="text-nesma-secondary text-xs hover:underline"
                >
                  View All
                </button>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    {['Document #', 'Supplier', 'Warehouse', 'Date', 'Status'].map(h => (
                      <th key={h} className="text-nesma-secondary text-xs uppercase tracking-wider text-left px-4 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grnRows.slice(0, 10).map(r => (
                    <tr key={r.id as string} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3 text-sm text-gray-300">
                        {(r.mrrvNumber as string) ?? (r.documentNumber as string) ?? (r.id as string).slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-sm text-white">
                        {((r.supplier as Record<string, unknown>)?.supplierName as string) ??
                          (r.supplierName as string) ??
                          '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {((r.warehouse as Record<string, unknown>)?.warehouseName as string) ??
                          (r.warehouseName as string) ??
                          '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {(() => {
                          const d = (r.receiveDate as string) ?? (r.createdAt as string);
                          if (!d) return '-';
                          return new Date(d).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          });
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={(r.status as string) ?? 'draft'} />
                      </td>
                    </tr>
                  ))}
                  {grnRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-gray-500 py-8">
                        No receipts
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ),
        grn: (
          <DocumentListPanel
            title="Goods Receipt Notes"
            icon={ArrowDownCircle}
            columns={RESOURCE_COLUMNS.grn.columns}
            rows={(grnQuery.data?.data ?? []) as Record<string, unknown>[]}
            loading={grnQuery.isLoading}
            createLabel="New GRN"
            createUrl="/admin/forms/grn"
          />
        ),
        qci: (
          <DocumentListPanel
            title="Quality Control Inspections"
            icon={ClipboardCheck}
            columns={RESOURCE_COLUMNS.qci.columns}
            rows={(qciQuery.data?.data ?? []) as Record<string, unknown>[]}
            loading={qciQuery.isLoading}
          />
        ),
        dr: (
          <DocumentListPanel
            title="Discrepancy Reports"
            icon={AlertTriangle}
            columns={RESOURCE_COLUMNS.dr.columns}
            rows={(drQuery.data?.data ?? []) as Record<string, unknown>[]}
            loading={drQuery.isLoading}
            createLabel="New DR"
            createUrl="/admin/forms/dr"
          />
        ),
        mi: (
          <DocumentListPanel
            title="Material Issuance"
            icon={ArrowUpCircle}
            columns={RESOURCE_COLUMNS.mi.columns}
            rows={(miQuery.data?.data ?? []) as Record<string, unknown>[]}
            loading={miQuery.isLoading}
            createLabel="New MI"
            createUrl="/admin/forms/mi"
          />
        ),
        mrn: (
          <DocumentListPanel
            title="Material Return Notes"
            icon={RotateCcw}
            columns={RESOURCE_COLUMNS.mrn.columns}
            rows={(mrnQuery.data?.data ?? []) as Record<string, unknown>[]}
            loading={mrnQuery.isLoading}
            createLabel="New MRN"
            createUrl="/admin/forms/mrn"
          />
        ),
        mr: (
          <DocumentListPanel
            title="Material Requests"
            icon={FileText}
            columns={RESOURCE_COLUMNS.mr.columns}
            rows={(mrQuery.data?.data ?? []) as Record<string, unknown>[]}
            loading={mrQuery.isLoading}
            createLabel="New MR"
            createUrl="/admin/forms/mr"
          />
        ),
        inventory: (
          <DocumentListPanel
            title="Stock Levels"
            icon={Package}
            columns={RESOURCE_COLUMNS.inventory.columns}
            rows={(inventoryQuery.data?.data ?? []) as unknown as Record<string, unknown>[]}
            loading={inventoryQuery.isLoading}
          />
        ),
        'bin-cards': (
          <DocumentListPanel
            title="Bin Cards"
            icon={Package}
            columns={RESOURCE_COLUMNS['bin-cards'].columns}
            rows={(binCardQuery.data?.data ?? []) as Record<string, unknown>[]}
            loading={binCardQuery.isLoading}
          />
        ),
        'non-moving': (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Package className="w-5 h-5 text-nesma-secondary" />
              <h3 className="text-white font-semibold">Non-Moving Materials</h3>
              <span className="text-xs text-gray-500">Items with no movement beyond threshold</span>
            </div>
            <div className="glass-card rounded-2xl p-8 text-center">
              <Package className="w-12 h-12 mx-auto mb-4 text-gray-600" />
              <h4 className="text-white font-medium mb-2">Non-Moving Analysis</h4>
              <p className="text-gray-400 text-sm mb-4">
                Identifies materials with no receipt or issuance activity exceeding the configured threshold period
                (default: 180 days).
              </p>
              <div className="grid grid-cols-3 gap-4 max-w-md mx-auto mt-6">
                <div className="text-center">
                  <p className="text-2xl font-bold text-amber-400">0</p>
                  <p className="text-gray-500 text-xs">90+ Days</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-400">0</p>
                  <p className="text-gray-500 text-xs">180+ Days</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-red-400">0</p>
                  <p className="text-gray-500 text-xs">365+ Days</p>
                </div>
              </div>
            </div>
          </div>
        ),
        items: (
          <DocumentListPanel
            title="Item Master Catalog"
            icon={Package}
            columns={itemColumns}
            rows={(itemsQuery.data?.data ?? []) as Record<string, unknown>[]}
            loading={itemsQuery.isLoading}
          />
        ),
        imsf: (
          <DocumentListPanel
            title="Internal Material Shifting"
            icon={Truck}
            columns={RESOURCE_COLUMNS.imsf.columns}
            rows={(imsfQuery.data?.data ?? []) as Record<string, unknown>[]}
            loading={imsfQuery.isLoading}
            createLabel="New IMSF"
            createUrl="/admin/forms/imsf"
          />
        ),
        wt: (
          <DocumentListPanel
            title="Warehouse Transfers"
            icon={ArrowRightLeft}
            columns={RESOURCE_COLUMNS.wt.columns}
            rows={(wtQuery.data?.data ?? []) as Record<string, unknown>[]}
            loading={wtQuery.isLoading}
            createLabel="New WT"
            createUrl="/admin/forms/wt"
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
      }}
    />
  );
};
