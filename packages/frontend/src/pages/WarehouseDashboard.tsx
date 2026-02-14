import React, { Suspense, useEffect, useState, useMemo } from 'react';
import {
  Package,
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  Search,
  Eye,
  CheckCircle,
  Clock,
  FileText,
  Plus,
  ChevronRight,
  ScanLine,
} from 'lucide-react';
import { useInventory } from '@/api/hooks/useMasterData';
import type { InventoryItem } from '@nit-scs-v2/shared/types';
import { useMrrvList } from '@/api/hooks/useMrrv';
import { useMirvList } from '@/api/hooks/useMirv';
import { useMrvList } from '@/api/hooks/useMrv';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { StatusBadge } from '@/components/StatusBadge';

const BarcodeScanner = React.lazy(() => import('@/components/BarcodeScanner'));

const StatCard: React.FC<{
  title: string;
  value: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  colorClass: string;
  bgClass: string;
}> = ({ title, value, icon: Icon, colorClass, bgClass }) => (
  <div className={`glass-card p-6 rounded-xl border-l-4 ${colorClass} hover:bg-white/5 transition-all`}>
    <div className="flex justify-between items-start">
      <div>
        <p className="text-gray-400 font-medium text-sm">{title}</p>
        <h3 className="text-2xl font-bold mt-2 text-white">{value}</h3>
      </div>
      <div className={`p-3 rounded-xl ${bgClass} bg-opacity-20`}>
        <Icon size={24} />
      </div>
    </div>
  </div>
);

export const WarehouseDashboard: React.FC = () => {
  const { tab } = useParams<{ tab: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'receive' | 'issue' | 'inventory' | 'return'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);

  // API hooks
  const mrrvQuery = useMrrvList({ pageSize: 100 });
  const mirvQuery = useMirvList({ pageSize: 100 });
  const mrvQuery = useMrvList({ pageSize: 100 });
  const inventoryQuery = useInventory({ pageSize: 100 });
  const inventoryItems = (inventoryQuery.data?.data ?? []) as InventoryItem[];

  const mrrvData = (mrrvQuery.data?.data ?? []) as Array<Record<string, unknown>>;
  const mirvData = (mirvQuery.data?.data ?? []) as Array<Record<string, unknown>>;
  const mrvData = (mrvQuery.data?.data ?? []) as Array<Record<string, unknown>>;
  const isLoading = mrrvQuery.isLoading || mirvQuery.isLoading || mrvQuery.isLoading || inventoryQuery.isLoading;
  const isError = mrrvQuery.isError || mirvQuery.isError || mrvQuery.isError || inventoryQuery.isError;

  useEffect(() => {
    if (tab) {
      const mappedTab =
        tab === 'mrrv' ? 'receive' : tab === 'mirv' ? 'issue' : tab === 'mrv' ? 'return' : (tab as typeof activeTab);
      setActiveTab(mappedTab);
    } else {
      setActiveTab('overview');
    }
  }, [tab]);

  const handleTabChange = (newTab: string) => {
    navigate(`/warehouse/${newTab}`);
  };

  // Computed stats from API data
  const pendingMRRV = mrrvData.filter(m => m.status === 'Draft' || m.status === 'Pending Approval');
  const approvedMIRV = mirvData.filter(m => m.status === 'Approved');
  const pendingMRV = mrvData.filter(m => m.status === 'Pending');
  const lowStockItems = inventoryItems.filter(i => i.stockStatus === 'Low Stock' || i.stockStatus === 'Out of Stock');

  const filteredInventory = useMemo(() => {
    if (!searchTerm) return inventoryItems;
    const term = searchTerm.toLowerCase();
    return inventoryItems.filter(
      i =>
        (i.code ?? '').toLowerCase().includes(term) ||
        (i.name ?? '').includes(searchTerm) ||
        (i.warehouse ?? '').toLowerCase().includes(term) ||
        (i.category ?? '').toLowerCase().includes(term),
    );
  }, [inventoryItems, searchTerm]);

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white glow-text">Warehouse</h1>
            <p className="text-gray-400 mt-1 text-sm">Manage inventory movement and daily operations</p>
          </div>
          <button
            onClick={() => setScannerOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-nesma-primary/20 text-nesma-secondary border border-nesma-primary/30 rounded-xl text-sm font-medium hover:bg-nesma-primary/30 transition-all"
            title="Scan Barcode"
          >
            <ScanLine size={18} />
            <span className="hidden sm:inline">Scan</span>
          </button>
        </div>
        <div className="flex flex-wrap gap-2 p-1 bg-white/5 rounded-xl border border-white/10 w-full md:w-auto overflow-x-auto">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'receive', label: 'Receive (GRN)' },
            { key: 'issue', label: 'Issue (MI)' },
            { key: 'return', label: 'Return (MRN)' },
            { key: 'inventory', label: 'Inventory' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => handleTabChange(t.key)}
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

      {/* Loading / Error states */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-white/5 rounded h-8 w-full"></div>
          ))}
        </div>
      )}
      {isError && <div className="text-red-400 p-4">Failed to load data</div>}

      {/* ======================== OVERVIEW TAB ======================== */}
      {activeTab === 'overview' && !isLoading && !isError && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Pending GRN"
              value={`${pendingMRRV.length}`}
              icon={ArrowDownCircle}
              colorClass="border-emerald-500"
              bgClass="bg-emerald-500 text-emerald-400"
            />
            <StatCard
              title="Approved MI"
              value={`${approvedMIRV.length}`}
              icon={ArrowUpCircle}
              colorClass="border-blue-500"
              bgClass="bg-blue-500 text-blue-400"
            />
            <StatCard
              title="Pending MRN"
              value={`${pendingMRV.length}`}
              icon={RefreshCw}
              colorClass="border-amber-500"
              bgClass="bg-amber-500 text-amber-400"
            />
            <StatCard
              title="Stock Alerts"
              value={`${lowStockItems.length}`}
              icon={AlertCircle}
              colorClass="border-red-500"
              bgClass="bg-red-500 text-red-400"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent GRN */}
            <div className="glass-card p-6 rounded-xl">
              <h3 className="font-bold text-lg text-white mb-4 border-b border-white/10 pb-2 flex items-center justify-between">
                <span>Recent GRN</span>
                <button
                  onClick={() => handleTabChange('receive')}
                  className="text-xs text-nesma-secondary hover:text-white flex items-center gap-1"
                >
                  View All <ChevronRight size={12} />
                </button>
              </h3>
              <div className="space-y-3">
                {mrrvData.slice(0, 3).map(mrrv => (
                  <div
                    key={mrrv.id as string}
                    className="flex justify-between items-center p-3 bg-white/5 rounded-xl hover:bg-white/10 cursor-pointer transition-colors border border-transparent hover:border-emerald-500/30 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-emerald-500/20 p-2.5 rounded-lg border border-emerald-500/30">
                        <ArrowDown size={18} className="text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-200 group-hover:text-white">{mrrv.id as string}</p>
                        <p className="text-xs text-gray-500">
                          {mrrv.supplier as string} • {mrrv.date as string}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-nesma-secondary font-medium">
                        {Number(mrrv.value || 0).toLocaleString()} SAR
                      </span>
                      <StatusBadge status={mrrv.status as string} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent MI */}
            <div className="glass-card p-6 rounded-xl">
              <h3 className="font-bold text-lg text-white mb-4 border-b border-white/10 pb-2 flex items-center justify-between">
                <span>Recent MI</span>
                <button
                  onClick={() => handleTabChange('issue')}
                  className="text-xs text-nesma-secondary hover:text-white flex items-center gap-1"
                >
                  View All <ChevronRight size={12} />
                </button>
              </h3>
              <div className="space-y-3">
                {mirvData.slice(0, 3).map(mirv => (
                  <div
                    key={mirv.id as string}
                    className="flex justify-between items-center p-3 bg-white/5 rounded-xl hover:bg-white/10 cursor-pointer transition-colors border border-transparent hover:border-blue-500/30 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-blue-500/20 p-2.5 rounded-lg border border-blue-500/30">
                        <ArrowUp size={18} className="text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-200 group-hover:text-white">{mirv.id as string}</p>
                        <p className="text-xs text-gray-500">
                          {mirv.project as string} • {mirv.requester as string}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-nesma-secondary font-medium">
                        {Number(mirv.value || 0).toLocaleString()} SAR
                      </span>
                      <StatusBadge status={mirv.status as string} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Low Stock Alert */}
          {lowStockItems.length > 0 && (
            <div className="glass-card p-6 rounded-xl border border-red-500/20">
              <h3 className="font-bold text-lg text-white mb-4 flex items-center gap-2">
                <AlertCircle size={18} className="text-red-400" />
                Low Stock Alerts
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {lowStockItems.map(item => (
                  <div
                    key={item.id as string}
                    className="flex items-center justify-between p-3 bg-red-500/5 rounded-xl border border-red-500/10"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-200">{item.name as string}</p>
                      <p className="text-xs text-gray-500">
                        {item.code as string} • {item.warehouse as string}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${item.quantity === 0 ? 'text-red-400' : 'text-amber-400'}`}>
                        {item.quantity as number}
                      </p>
                      <p className="text-[10px] text-gray-500">Min: {item.minLevel as number}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ======================== RECEIVE (GRN) TAB ======================== */}
      {activeTab === 'receive' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">Material Receiving (GRN)</h2>
            <Link
              to="/warehouse/forms/mrrv"
              onClick={e => {
                e.preventDefault();
                navigate('/admin/forms/mrrv');
              }}
              className="flex items-center gap-2 px-4 py-2 bg-nesma-primary text-white rounded-xl text-sm hover:bg-nesma-accent transition-all shadow-lg shadow-nesma-primary/20"
            >
              <Plus size={16} />
              New Receipt
            </Link>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'All', count: mrrvData.length, color: 'text-white' },
              { label: 'Draft', count: mrrvData.filter(m => m.status === 'Draft').length, color: 'text-gray-400' },
              {
                label: 'Approved',
                count: mrrvData.filter(m => m.status === 'Approved').length,
                color: 'text-emerald-400',
              },
              {
                label: 'Inspected',
                count: mrrvData.filter(m => m.status === 'Inspected').length,
                color: 'text-blue-400',
              },
            ].map((stat, i) => (
              <div
                key={i}
                className="glass-card p-4 rounded-xl text-center hover:bg-white/5 transition-all cursor-pointer"
              >
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.count}</p>
                <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* GRN Table */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10 text-xs text-gray-400 uppercase tracking-wider">
                    <th className="px-6 py-4 font-medium">ID</th>
                    <th className="px-6 py-4 font-medium">Supplier</th>
                    <th className="px-6 py-4 font-medium">Date</th>
                    <th className="px-6 py-4 font-medium">Warehouse</th>
                    <th className="px-6 py-4 font-medium">Value</th>
                    <th className="px-6 py-4 font-medium">PO</th>
                    <th className="px-6 py-4 font-medium">QCI</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {mrrvData.map(mrrv => (
                    <tr key={mrrv.id as string} className="hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4 font-mono text-nesma-secondary font-medium">{mrrv.id as string}</td>
                      <td className="px-6 py-4 text-gray-200">{mrrv.supplier as string}</td>
                      <td className="px-6 py-4 text-gray-400">{mrrv.date as string}</td>
                      <td className="px-6 py-4 text-gray-400">{mrrv.warehouse as string}</td>
                      <td className="px-6 py-4 text-white font-medium">
                        {Number(mrrv.value || 0).toLocaleString()} SAR
                      </td>
                      <td className="px-6 py-4 text-gray-400 font-mono text-xs">{(mrrv.poNumber as string) || '-'}</td>
                      <td className="px-6 py-4">
                        {mrrv.rfimCreated ? (
                          <span className="text-emerald-400 flex items-center gap-1 text-xs">
                            <CheckCircle size={12} /> Created
                          </span>
                        ) : mrrv.rfimRequired ? (
                          <span className="text-amber-400 flex items-center gap-1 text-xs">
                            <Clock size={12} /> Required
                          </span>
                        ) : (
                          <span className="text-gray-600 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={mrrv.status as string} />
                      </td>
                      <td className="px-6 py-4">
                        <button className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-nesma-secondary opacity-0 group-hover:opacity-100 transition-all">
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================== ISSUE (MI) TAB ======================== */}
      {activeTab === 'issue' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">Material Issue (MI)</h2>
            <button
              onClick={() => navigate('/admin/forms/mirv')}
              className="flex items-center gap-2 px-4 py-2 bg-nesma-primary text-white rounded-xl text-sm hover:bg-nesma-accent transition-all shadow-lg shadow-nesma-primary/20"
            >
              <Plus size={16} />
              New Issue
            </button>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'All', count: mirvData.length, color: 'text-white' },
              { label: 'Draft', count: mirvData.filter(m => m.status === 'Draft').length, color: 'text-gray-400' },
              {
                label: 'Pending',
                count: mirvData.filter(m => m.status === 'Pending Approval').length,
                color: 'text-amber-400',
              },
              {
                label: 'Approved',
                count: mirvData.filter(m => m.status === 'Approved').length,
                color: 'text-emerald-400',
              },
              { label: 'Issued', count: mirvData.filter(m => m.status === 'Issued').length, color: 'text-blue-400' },
            ].map((stat, i) => (
              <div
                key={i}
                className="glass-card p-4 rounded-xl text-center hover:bg-white/5 transition-all cursor-pointer"
              >
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.count}</p>
                <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* MI Table */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/10 text-xs text-gray-400 uppercase tracking-wider">
                    <th className="px-6 py-4 font-medium">ID</th>
                    <th className="px-6 py-4 font-medium">Project</th>
                    <th className="px-6 py-4 font-medium">Requester</th>
                    <th className="px-6 py-4 font-medium">Date</th>
                    <th className="px-6 py-4 font-medium">Warehouse</th>
                    <th className="px-6 py-4 font-medium">Value</th>
                    <th className="px-6 py-4 font-medium">Approval</th>
                    <th className="px-6 py-4 font-medium">Gate Pass</th>
                    <th className="px-6 py-4 font-medium">Status</th>
                    <th className="px-6 py-4 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {mirvData.map(mirv => (
                    <tr key={mirv.id as string} className="hover:bg-white/5 transition-colors group">
                      <td className="px-6 py-4 font-mono text-nesma-secondary font-medium">{mirv.id as string}</td>
                      <td className="px-6 py-4 text-gray-200 max-w-[200px] truncate" title={mirv.project as string}>
                        {mirv.project as string}
                      </td>
                      <td className="px-6 py-4 text-gray-300">{mirv.requester as string}</td>
                      <td className="px-6 py-4 text-gray-400">{mirv.date as string}</td>
                      <td className="px-6 py-4 text-gray-400">{mirv.warehouse as string}</td>
                      <td className="px-6 py-4 text-white font-medium">
                        {Number(mirv.value || 0).toLocaleString()} SAR
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-400">{(mirv.approvalLevel as string) || '-'}</td>
                      <td className="px-6 py-4">
                        {mirv.gatePassCreated ? (
                          <span className="text-emerald-400 flex items-center gap-1 text-xs">
                            <CheckCircle size={12} /> Yes
                          </span>
                        ) : (
                          <span className="text-gray-600 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={mirv.status as string} />
                      </td>
                      <td className="px-6 py-4">
                        <button className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-nesma-secondary opacity-0 group-hover:opacity-100 transition-all">
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================== RETURN (MRN) TAB ======================== */}
      {activeTab === 'return' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold text-white">Material Return (MRN)</h2>
            <button
              onClick={() => navigate('/admin/forms/mrv')}
              className="flex items-center gap-2 px-4 py-2 bg-nesma-primary text-white rounded-xl text-sm hover:bg-nesma-accent transition-all shadow-lg shadow-nesma-primary/20"
            >
              <Plus size={16} />
              New Return
            </button>
          </div>

          {/* MRN Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mrvData.map(mrv => (
              <div
                key={mrv.id as string}
                className="glass-card p-6 rounded-xl hover:border-nesma-secondary/30 transition-all group cursor-pointer"
              >
                <div className="flex justify-between items-start mb-4">
                  <span className="font-mono text-nesma-secondary font-medium text-sm">{mrv.id as string}</span>
                  <StatusBadge status={mrv.status as string} />
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-gray-500 block">Return Type</span>
                    <span
                      className={`text-sm font-medium ${
                        mrv.returnType === 'Surplus'
                          ? 'text-blue-400'
                          : mrv.returnType === 'Damaged'
                            ? 'text-red-400'
                            : mrv.returnType === 'Wrong Item'
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                      }`}
                    >
                      {mrv.returnType as string}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Project</span>
                    <span className="text-sm text-gray-200">{mrv.project as string}</span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 block">Warehouse</span>
                    <span className="text-sm text-gray-300">{mrv.warehouse as string}</span>
                  </div>
                  <div className="pt-3 border-t border-white/10">
                    <span className="text-xs text-gray-500 block">Reason</span>
                    <span className="text-sm text-gray-400">{mrv.reason as string}</span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t border-white/10 flex justify-between items-center">
                  <span className="text-xs text-gray-500">{mrv.date as string}</span>
                  <button className="text-xs text-nesma-secondary hover:text-white flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    Details <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================== INVENTORY TAB ======================== */}
      {(activeTab === 'inventory' || activeTab === 'overview') && activeTab === 'inventory' && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-white/10 flex flex-col md:flex-row justify-between items-center gap-4 bg-white/5">
            <h3 className="font-bold text-lg text-white">Inventory Status</h3>
            <div className="flex gap-2 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search size={16} className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-black/20 border border-white/10 rounded-xl text-sm focus:border-nesma-secondary focus:ring-1 focus:ring-nesma-secondary outline-none text-white placeholder-gray-500 transition-all"
                />
              </div>
              <button
                onClick={() => setScannerOpen(true)}
                className="flex items-center gap-2 px-3 py-2 bg-nesma-primary/20 text-nesma-secondary border border-nesma-primary/30 rounded-xl text-sm hover:bg-nesma-primary/30 transition-all"
                title="Scan Barcode to Search"
              >
                <ScanLine size={16} />
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="text-nesma-secondary text-xs uppercase tracking-wider font-semibold">
                <tr>
                  <th className="px-6 py-4">Code</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4">Warehouse</th>
                  <th className="px-6 py-4">Available</th>
                  <th className="px-6 py-4">Reserved</th>
                  <th className="px-6 py-4">Min</th>
                  <th className="px-6 py-4">Location</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {filteredInventory.map(item => {
                  const isLow = item.stockStatus === 'Low Stock' || item.stockStatus === 'Out of Stock';
                  return (
                    <tr key={item.id as string} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-mono font-medium text-white">{item.code as string}</td>
                      <td className="px-6 py-4 text-gray-300">{item.name as string}</td>
                      <td className="px-6 py-4 text-gray-400">{item.warehouse as string}</td>
                      <td className="px-6 py-4 font-bold text-nesma-secondary">
                        {(item.quantity as number)?.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-gray-400">{item.reserved as number}</td>
                      <td className="px-6 py-4 text-gray-500">{item.minLevel as number}</td>
                      <td className="px-6 py-4 text-gray-400 font-mono text-xs">{item.location as string}</td>
                      <td className="px-6 py-4">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                            <AlertCircle size={12} />
                            {item.stockStatus as string}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            In Stock
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Suspense fallback={null}>
        <BarcodeScanner
          isOpen={scannerOpen}
          onClose={() => setScannerOpen(false)}
          onItemFound={item => {
            setScannerOpen(false);
            const code = String(item.itemCode || item.code || '');
            if (code) setSearchTerm(code);
            if (activeTab !== 'inventory') handleTabChange('inventory');
          }}
        />
      </Suspense>
    </div>
  );
};
