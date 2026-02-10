import React, { Suspense, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package,
  DollarSign,
  AlertTriangle,
  Warehouse as WarehouseIcon,
  ArrowDownCircle,
  ArrowRightLeft,
  ScanLine,
} from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { SectionLandingPage } from '@/components/SectionLandingPage';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';
import type { KpiCardProps } from '@/components/KpiCard';
import type { TabDef } from '@/components/SectionTabBar';
import { useInventorySummary, useWarehouses, useInventory, useGatePasses, useStockTransfers } from '@/api/hooks';
import type { InventoryItem } from '@nit-scs-v2/shared/types';
import type { Warehouse as WarehouseType } from '@nit-scs-v2/shared/types';

const InventoryDashboard = React.lazy(() =>
  import('@/pages/warehouse/InventoryDashboard').then(m => ({ default: m.InventoryDashboard })),
);
const ShiftingMaterialDashboard = React.lazy(() =>
  import('@/pages/warehouse/ShiftingMaterialDashboard').then(m => ({ default: m.ShiftingMaterialDashboard })),
);
const NonMovingMaterialsDashboard = React.lazy(() =>
  import('@/pages/warehouse/NonMovingMaterialsDashboard').then(m => ({ default: m.NonMovingMaterialsDashboard })),
);
const BarcodeScanner = React.lazy(() => import('@/components/BarcodeScanner'));

const PIE_COLORS = ['#2E3192', '#80D1E9', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Active: 'bg-emerald-500/20 text-emerald-400',
    Available: 'bg-emerald-500/20 text-emerald-400',
    'Low Stock': 'bg-amber-500/20 text-amber-400',
    Pending: 'bg-amber-500/20 text-amber-400',
    'Out of Stock': 'bg-red-500/20 text-red-400',
    Approved: 'bg-emerald-500/20 text-emerald-400',
    'In Transit': 'bg-blue-500/20 text-blue-400',
    Completed: 'bg-emerald-500/20 text-emerald-400',
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${colors[status] || 'bg-white/10 text-gray-400'}`}
    >
      {status}
    </span>
  );
}

const Spinner = () => (
  <div className="flex justify-center py-12">
    <div className="w-8 h-8 border-2 border-nesma-secondary border-t-transparent rounded-full animate-spin" />
  </div>
);

export const InventorySectionPage: React.FC = () => {
  const navigate = useNavigate();
  const [scannerOpen, setScannerOpen] = useState(false);
  const { data: invSummary, isLoading: invLoading } = useInventorySummary();
  const { data: whData } = useWarehouses({ pageSize: 1 });
  const { data: invItems } = useInventory({ pageSize: 10, sortBy: 'updatedAt', sortDir: 'desc' });
  const { data: gpData } = useGatePasses({ pageSize: 5, sortBy: 'createdAt', sortDir: 'desc' });
  const { data: stData } = useStockTransfers({ pageSize: 5, sortBy: 'createdAt', sortDir: 'desc' });
  const { data: lowStockData } = useInventory({ pageSize: 6, stockStatus: 'low' });

  const inv = invSummary?.data;
  const kpis: KpiCardProps[] = [
    { title: 'Total Items', value: inv?.totalItems ?? 0, icon: Package, color: 'bg-nesma-secondary' },
    {
      title: 'Inventory Value',
      value: `SAR ${(inv?.totalValue ?? 0).toLocaleString()}`,
      icon: DollarSign,
      color: 'bg-emerald-500',
    },
    {
      title: 'Low Stock Alerts',
      value: inv?.lowStock ?? 0,
      icon: AlertTriangle,
      color: 'bg-red-500',
      alert: (inv?.lowStock ?? 0) > 0,
    },
    { title: 'Warehouses', value: whData?.meta?.total ?? 0, icon: WarehouseIcon, color: 'bg-nesma-primary' },
  ];

  const tabs: TabDef[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'stock-levels', label: 'Stock Levels', badge: inv?.totalItems },
    { key: 'warehouses', label: 'Warehouses' },
    { key: 'movements', label: 'Movements' },
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'shifting', label: 'Shifting' },
    { key: 'non-moving', label: 'Non-Moving' },
  ];

  const byCategory = useMemo(() => inv?.byCategory ?? [], [inv]);
  const lowStockItems: InventoryItem[] = (lowStockData?.data ?? []) as unknown as InventoryItem[];
  const inventoryRows: InventoryItem[] = (invItems?.data ?? []) as unknown as InventoryItem[];
  const warehouseRows: WarehouseType[] = (whData?.data ?? []) as unknown as WarehouseType[];
  const gatePassRows = (gpData?.data ?? []) as Array<Record<string, unknown>>;
  const stockTransferRows = (stData?.data ?? []) as Array<Record<string, unknown>>;

  const renderPieLabel = ({ name, percent }: { name?: string; percent?: number }) =>
    `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`;

  return (
    <>
      <SectionLandingPage
        title="Inventory & Warehouses"
        subtitle="Stock levels, movements, and warehouse management"
        kpis={kpis}
        tabs={tabs}
        loading={invLoading}
        quickActions={[
          { label: 'New Receipt (GRN)', icon: ArrowDownCircle, onClick: () => navigate('/admin/forms/grn') },
          {
            label: 'Stock Transfer',
            icon: ArrowRightLeft,
            onClick: () => navigate('/admin/forms/stock-transfer'),
            variant: 'secondary',
          },
          {
            label: 'Scan Barcode',
            icon: ScanLine,
            onClick: () => setScannerOpen(true),
            variant: 'secondary',
          },
        ]}
        children={{
          overview: (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card p-6 rounded-xl">
                <h3 className="text-white font-semibold mb-4">Inventory by Category</h3>
                {byCategory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={byCategory}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={renderPieLabel}
                      >
                        {byCategory.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: '#0a1628',
                          border: '1px solid rgba(255,255,255,.1)',
                          borderRadius: 8,
                          color: '#fff',
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-gray-500 text-sm">No category data</p>
                )}
              </div>
              <div className="glass-card p-6 rounded-xl">
                <h3 className="text-white font-semibold mb-4">Low Stock Alerts</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {lowStockItems.length > 0 ? (
                    lowStockItems.map(item => (
                      <div key={item.id} className="bg-white/5 rounded-lg p-3 border border-red-500/20">
                        <p className="text-white text-sm font-medium truncate">{item.name || item.code}</p>
                        <p className="text-red-400 text-xs mt-1">Qty: {item.quantity ?? 0}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-500 text-sm col-span-2">No low stock items</p>
                  )}
                </div>
              </div>
            </div>
          ),
          'stock-levels': (
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h3 className="text-white font-semibold">Stock Levels</h3>
                <button
                  onClick={() => navigate('/admin/inventory/inventory')}
                  className="text-nesma-secondary text-xs hover:underline"
                >
                  View All
                </button>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    {['Code', 'Name', 'Warehouse', 'Qty', 'Status'].map(h => (
                      <th key={h} className="text-nesma-secondary text-xs uppercase tracking-wider text-left px-4 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inventoryRows.map(r => (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3 text-sm text-gray-300">{r.code ?? '-'}</td>
                      <td className="px-4 py-3 text-sm text-white">{r.name ?? '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-400">{r.warehouse ?? '-'}</td>
                      <td className="px-4 py-3 text-sm text-white">{(r.quantity ?? 0).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.stockStatus ?? 'Active'} />
                      </td>
                    </tr>
                  ))}
                  {inventoryRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center text-gray-500 py-8">
                        No items
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ),
          warehouses: (
            <div className="glass-card rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-white/10">
                <h3 className="text-white font-semibold">Warehouses</h3>
                <button
                  onClick={() => navigate('/admin/inventory/warehouses')}
                  className="text-nesma-secondary text-xs hover:underline"
                >
                  View All
                </button>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/10">
                    {['Name', 'City', 'Type', 'Status'].map(h => (
                      <th key={h} className="text-nesma-secondary text-xs uppercase tracking-wider text-left px-4 py-3">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {warehouseRows.map(r => (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3 text-sm text-white">{r.name ?? '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-400">{r.city ?? '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-400">{r.type ?? '-'}</td>
                      <td className="px-4 py-3">
                        <StatusBadge status={r.status ?? 'Active'} />
                      </td>
                    </tr>
                  ))}
                  {warehouseRows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center text-gray-500 py-8">
                        No warehouses
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ),
          movements: (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                  <h3 className="text-white font-semibold">Gate Passes</h3>
                  <button
                    onClick={() => navigate('/admin/logistics/gate-pass')}
                    className="text-nesma-secondary text-xs hover:underline"
                  >
                    View All
                  </button>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      {['ID', 'Type', 'Date', 'Status'].map(h => (
                        <th
                          key={h}
                          className="text-nesma-secondary text-xs uppercase tracking-wider text-left px-4 py-3"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gatePassRows.map(r => (
                      <tr key={r.id as string} className="border-b border-white/5 hover:bg-white/5">
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {(r.documentNumber as string) ?? (r.id as string).slice(0, 8)}
                        </td>
                        <td className="px-4 py-3 text-sm text-white">{(r.type as string) ?? '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-400">{(r.date as string) ?? '-'}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={(r.status as string) ?? 'Pending'} />
                        </td>
                      </tr>
                    ))}
                    {gatePassRows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center text-gray-500 py-8">
                          No gate passes
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                  <h3 className="text-white font-semibold">Stock Transfers</h3>
                  <button
                    onClick={() => navigate('/admin/logistics/stock-transfer')}
                    className="text-nesma-secondary text-xs hover:underline"
                  >
                    View All
                  </button>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/10">
                      {['ID', 'From', 'To', 'Status'].map(h => (
                        <th
                          key={h}
                          className="text-nesma-secondary text-xs uppercase tracking-wider text-left px-4 py-3"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stockTransferRows.map(r => (
                      <tr key={r.id as string} className="border-b border-white/5 hover:bg-white/5">
                        <td className="px-4 py-3 text-sm text-gray-300">
                          {(r.documentNumber as string) ?? (r.id as string).slice(0, 8)}
                        </td>
                        <td className="px-4 py-3 text-sm text-white">{(r.fromWarehouse as string) ?? '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-400">{(r.toWarehouse as string) ?? '-'}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={(r.status as string) ?? 'Pending'} />
                        </td>
                      </tr>
                    ))}
                    {stockTransferRows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center text-gray-500 py-8">
                          No transfers
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ),
          dashboard: (
            <RouteErrorBoundary label="Inventory Dashboard">
              <Suspense fallback={<Spinner />}>
                <InventoryDashboard />
              </Suspense>
            </RouteErrorBoundary>
          ),
          shifting: (
            <RouteErrorBoundary label="Shifting Materials">
              <Suspense fallback={<Spinner />}>
                <ShiftingMaterialDashboard />
              </Suspense>
            </RouteErrorBoundary>
          ),
          'non-moving': (
            <RouteErrorBoundary label="Non-Moving Materials">
              <Suspense fallback={<Spinner />}>
                <NonMovingMaterialsDashboard />
              </Suspense>
            </RouteErrorBoundary>
          ),
        }}
      />
      <Suspense fallback={null}>
        <BarcodeScanner
          isOpen={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onItemFound={item => {
            setScannerOpen(false);
            const code = String(item.itemCode || item.code || '');
            if (code) navigate(`/admin/inventory/inventory?search=${encodeURIComponent(code)}`);
          }}
        />
      </Suspense>
    </>
  );
};
