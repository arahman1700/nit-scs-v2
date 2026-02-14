import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import { Activity, Package, AlertTriangle, Warehouse, FileText, Clock, TrendingUp, Shield } from 'lucide-react';
import { KpiCard } from '@/components/KpiCard';
import { useCrossDepartment } from '@/api/hooks/useDashboard';
import type { CrossDepartmentData } from '@/api/hooks/useDashboard';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#14b8a6'];

export function OperationsDashboard() {
  const navigate = useNavigate();
  const query = useCrossDepartment();
  const data = (query.data as unknown as { data?: CrossDepartmentData } | undefined)?.data;
  const isLoading = query.isLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nesma-secondary" />
      </div>
    );
  }

  if (!data) {
    return <div className="glass-card rounded-2xl p-10 text-center text-gray-400">No data available</div>;
  }

  const totalActiveDocuments = Object.values(data.documentPipeline).reduce((sum, d) => sum + d.total, 0);

  const warehouseChartData = data.inventory.warehouses
    .filter(w => w.totalValue > 0)
    .map(w => ({
      name: w.warehouseCode || w.warehouseName.slice(0, 12),
      value: Math.round(w.totalValue),
      items: w.itemCount,
      qty: Math.round(w.totalQty),
    }));

  const pipelineChartData = Object.entries(data.documentPipeline).map(([type, counts]) => ({
    name: type.toUpperCase(),
    total: counts.total,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Activity size={24} className="text-nesma-secondary" />
          Operations Dashboard
        </h1>
        <p className="text-sm text-gray-400 mt-1">Cross-department overview of inventory, documents, and activities</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={Package}
          title="Inventory Value"
          value={
            data.inventory.totalInventoryValue > 1_000_000
              ? `${(data.inventory.totalInventoryValue / 1_000_000).toFixed(1)}M SAR`
              : `${(data.inventory.totalInventoryValue / 1_000).toFixed(0)}K SAR`
          }
          color="bg-blue-600/20"
          onClick={() => navigate('/admin/warehouses?tab=inventory')}
        />
        <KpiCard
          icon={FileText}
          title="Active Documents"
          value={totalActiveDocuments}
          color="bg-emerald-600/20"
          sublabel="Across all departments"
          onClick={() => navigate('/admin/documents')}
        />
        <KpiCard
          icon={AlertTriangle}
          title="Low Stock Alerts"
          value={data.inventory.lowStockAlerts}
          color="bg-amber-600/20"
          onClick={() => navigate('/admin/warehouses?tab=non-moving')}
        />
        <KpiCard
          icon={Shield}
          title="Blocked Lots"
          value={data.inventory.blockedLots}
          color="bg-red-600/20"
          sublabel="Pending inspection"
          onClick={() => navigate('/admin/warehouses?tab=inventory')}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Warehouse Inventory Comparison */}
        <div className="glass-card rounded-2xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Warehouse size={18} className="text-nesma-secondary" />
            Inventory Value by Warehouse
          </h2>
          {warehouseChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={warehouseChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip
                  contentStyle={{
                    background: '#0a1929',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                  }}
                  labelStyle={{ color: '#fff' }}
                  formatter={value => [`${Number(value).toLocaleString()} SAR`, 'Value']}
                />
                <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-sm text-center py-10">No inventory data</p>
          )}
        </div>

        {/* Document Pipeline */}
        <div className="glass-card rounded-2xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FileText size={18} className="text-nesma-secondary" />
            Active Documents by Type
          </h2>
          {pipelineChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pipelineChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="total"
                  nameKey="name"
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {pipelineChartData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#0a1929',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                  }}
                  labelStyle={{ color: '#fff' }}
                />
                <Legend wrapperStyle={{ color: '#9ca3af' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-sm text-center py-10">No active documents</p>
          )}
        </div>
      </div>

      {/* Warehouse Detail Table */}
      <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
        <div className="px-6 py-4 border-b border-white/10">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <TrendingUp size={18} className="text-nesma-secondary" />
            Warehouse Breakdown
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Warehouse
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Items
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Total Qty
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Value (SAR)
                </th>
              </tr>
            </thead>
            <tbody>
              {data.inventory.warehouses.map(w => (
                <tr key={w.warehouseId} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-white">{w.warehouseName}</div>
                    <div className="text-xs text-gray-500">{w.warehouseCode}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-white text-center">{w.itemCount}</td>
                  <td className="px-4 py-3 text-sm text-white text-center">
                    {Math.round(w.totalQty).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-white text-right">
                    {Math.round(w.totalValue).toLocaleString()}
                  </td>
                </tr>
              ))}
              {data.inventory.warehouses.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-gray-500 text-sm">
                    No warehouse data available
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Cross-Department Activity */}
      <div className="glass-card rounded-2xl p-6 border border-white/10">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Clock size={18} className="text-nesma-secondary" />
          Recent Activity
        </h2>
        <div className="space-y-2">
          {data.recentActivity.map(item => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5"
            >
              <div className="flex items-center gap-3">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 text-gray-300 uppercase">
                  {item.tableName}
                </span>
                <span className="text-sm text-white capitalize">{item.action.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span>{item.performedBy?.fullName ?? 'System'}</span>
                <span>{new Date(item.performedAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
          {data.recentActivity.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
}
