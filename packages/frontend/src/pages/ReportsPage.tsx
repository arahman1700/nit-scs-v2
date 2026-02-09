import React, { useState, useCallback, useMemo } from 'react';
import {
  Package,
  Truck,
  Clock,
  DollarSign,
  Download,
  Printer,
  Filter,
  BarChart3,
  Users,
  ArrowRightLeft,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from 'recharts';
import {
  useInventoryReport,
  useJobOrderReport,
  useSlaReport,
  useMaterialMovementReport,
  useSupplierPerformanceReport,
  useFinancialReport,
} from '@/api/hooks/useReports';
import { useProjects, useWarehouses } from '@/api/hooks/useMasterData';
import { generateReportPdf } from '@/utils/pdfExport';
import type { ReportPdfOptions } from '@/utils/pdfExport';
import { formatCurrency } from '@nit-scs-v2/shared/formatters';

// ── Constants ────────────────────────────────────────────────────────────────

const CHART_COLORS = ['#2E3192', '#80D1E9', '#4CAF50', '#FF9800', '#F44336', '#9C27B0'];

const TOOLTIP_STYLE = {
  background: '#0a1929',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '12px',
  color: '#fff',
};

const AXIS_TICK = { fill: '#9CA3AF', fontSize: 11 };

type ReportTab = 'inventory' | 'job_orders' | 'sla' | 'material' | 'supplier' | 'financial';

interface TabDef {
  id: ReportTab;
  label: string;
  icon: React.ElementType;
}

const TABS: TabDef[] = [
  { id: 'inventory', label: 'Inventory Summary', icon: Package },
  { id: 'job_orders', label: 'Job Order Status', icon: Truck },
  { id: 'sla', label: 'SLA Compliance', icon: Clock },
  { id: 'material', label: 'Material Movement', icon: ArrowRightLeft },
  { id: 'supplier', label: 'Supplier Performance', icon: Users },
  { id: 'financial', label: 'Financial Summary', icon: DollarSign },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function safe(v: unknown, fallback: string | number = 0): string | number {
  if (v === null || v === undefined) return fallback;
  return v as string | number;
}

function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') return Number(v) || 0;
  return 0;
}

// ── Reusable Sub-components ──────────────────────────────────────────────────

const KpiCard: React.FC<{
  label: string;
  value: string | number;
  color?: string;
  sub?: string;
}> = ({ label, value, color, sub }) => (
  <div className="glass-card rounded-xl p-5 border border-white/10">
    <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
    <p className={`text-2xl font-bold mt-1 ${color || 'text-white'}`}>{value}</p>
    {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
  </div>
);

const ChartWrapper: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="glass-card rounded-2xl p-6 border border-white/10">
    <h3 className="text-white font-bold mb-4">{title}</h3>
    <ResponsiveContainer width="100%" height={300}>
      {children as React.ReactElement}
    </ResponsiveContainer>
  </div>
);

const DataTable: React.FC<{ columns: string[]; rows: Record<string, unknown>[] }> = ({ columns, rows }) => (
  <div className="glass-card rounded-2xl p-6 border border-white/10 overflow-x-auto">
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-white/10">
          {columns.map(col => (
            <th key={col} className="text-left text-xs text-gray-500 uppercase tracking-wider py-3 px-3">
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="text-center text-gray-500 py-8">
              No data available. Click "Generate Report" to load data.
            </td>
          </tr>
        ) : (
          rows.map((row, idx) => (
            <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
              {columns.map(col => (
                <td key={col} className="py-3 px-3 text-gray-300">
                  {String(safe(row[col], '-'))}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  </div>
);

const PieLabel = ({ name, percent }: { name?: string; percent?: number }) =>
  `${name ?? ''} (${((percent ?? 0) * 100).toFixed(0)}%)`;

// ── Main Component ───────────────────────────────────────────────────────────

export const ReportsPage: React.FC = () => {
  // Filter state
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [projectId, setProjectId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [activeTab, setActiveTab] = useState<ReportTab>('inventory');

  // Master data for dropdowns
  const projectsQuery = useProjects();
  const warehousesQuery = useWarehouses();

  const projects = (projectsQuery.data as { data?: { id: string; name: string }[] })?.data ?? [];
  const warehouses = (warehousesQuery.data as { data?: { id: string; name: string }[] })?.data ?? [];

  // Filters object
  const filters = useMemo(
    () => ({
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
      ...(projectId ? { projectId } : {}),
      ...(warehouseId ? { warehouseId } : {}),
    }),
    [dateFrom, dateTo, projectId, warehouseId],
  );

  // Report hooks - each enabled only when its tab is active
  const inventoryQ = useInventoryReport(filters, activeTab === 'inventory');
  const jobOrderQ = useJobOrderReport(filters, activeTab === 'job_orders');
  const slaQ = useSlaReport(filters, activeTab === 'sla');
  const materialQ = useMaterialMovementReport(filters, activeTab === 'material');
  const supplierQ = useSupplierPerformanceReport(filters, activeTab === 'supplier');
  const financialQ = useFinancialReport(filters, activeTab === 'financial');

  // Extract data helpers — hooks return ApiResponse<unknown> so we cast via unknown
  const extract = useCallback((q: { data?: { data?: unknown } }) => {
    const d = (q.data?.data ?? {}) as Record<string, unknown>;
    return {
      summary: ((d.summary as Record<string, unknown>) ?? {}) as Record<string, unknown>,
      rows: ((d.rows as unknown[]) ?? []) as Record<string, unknown>[],
      chartData: ((d.chartData as unknown[]) ?? []) as Record<string, unknown>[],
    };
  }, []);

  // Generate / refetch handler
  const handleGenerate = useCallback(() => {
    const hookMap: Record<ReportTab, { refetch: () => void }> = {
      inventory: inventoryQ,
      job_orders: jobOrderQ,
      sla: slaQ,
      material: materialQ,
      supplier: supplierQ,
      financial: financialQ,
    };
    hookMap[activeTab].refetch();
  }, [activeTab, inventoryQ, jobOrderQ, slaQ, materialQ, supplierQ, financialQ]);

  // Export PDF handler
  const handleExportPdf = useCallback(() => {
    const tabConfig: Record<ReportTab, { title: string; columns: string[]; dataQ: typeof inventoryQ }> = {
      inventory: {
        title: 'Inventory Summary',
        columns: ['Item', 'Category', 'Warehouse', 'Qty', 'Value'],
        dataQ: inventoryQ,
      },
      job_orders: {
        title: 'Job Order Status',
        columns: ['JO#', 'Type', 'Project', 'Status', 'Value'],
        dataQ: jobOrderQ,
      },
      sla: { title: 'SLA Compliance', columns: ['JO#', 'SLA Target', 'Actual', 'Status'], dataQ: slaQ },
      material: {
        title: 'Material Movement',
        columns: ['Date', 'MRRV Count', 'MIRV Count', 'MRV Count'],
        dataQ: materialQ,
      },
      supplier: {
        title: 'Supplier Performance',
        columns: ['Supplier', 'Deliveries', 'Avg Days', 'On-Time %'],
        dataQ: supplierQ,
      },
      financial: {
        title: 'Financial Summary',
        columns: ['Month', 'Receipts', 'Issues', 'JO Costs'],
        dataQ: financialQ,
      },
    };

    const cfg = tabConfig[activeTab];
    const d = extract(cfg.dataQ);
    const summaryArr = Object.entries(d.summary).map(([k, v]) => ({
      label: k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
      value: typeof v === 'number' ? v.toLocaleString() : String(v ?? ''),
    }));

    const filterList: { label: string; value: string }[] = [];
    if (dateFrom) filterList.push({ label: 'From', value: dateFrom });
    if (dateTo) filterList.push({ label: 'To', value: dateTo });
    if (projectId) {
      const p = projects.find(pr => pr.id === projectId);
      filterList.push({ label: 'Project', value: p?.name ?? projectId });
    }
    if (warehouseId) {
      const w = warehouses.find(wh => wh.id === warehouseId);
      filterList.push({ label: 'Warehouse', value: w?.name ?? warehouseId });
    }

    const pdfOptions: ReportPdfOptions = {
      title: cfg.title,
      subtitle: 'NIT Logistics & WMS Report',
      columns: cfg.columns,
      rows: d.rows as Array<Record<string, string | number>>,
      summary: summaryArr,
      filters: filterList,
    };
    generateReportPdf(pdfOptions);
  }, [
    activeTab,
    inventoryQ,
    jobOrderQ,
    slaQ,
    materialQ,
    supplierQ,
    financialQ,
    extract,
    dateFrom,
    dateTo,
    projectId,
    warehouseId,
    projects,
    warehouses,
  ]);

  // ── Render Tab Content ─────────────────────────────────────────────────────

  const renderInventory = () => {
    const { summary: s, rows, chartData } = extract(inventoryQ);
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KpiCard label="Total Items" value={num(s.totalItems).toLocaleString()} />
          <KpiCard label="Total Qty" value={num(s.totalQty).toLocaleString()} />
          <KpiCard label="Low Stock" value={num(s.lowStock).toLocaleString()} color="text-amber-400" />
          <KpiCard label="Out of Stock" value={num(s.outOfStock).toLocaleString()} color="text-red-400" />
        </div>
        <ChartWrapper title="Stock by Category">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="name" tick={AXIS_TICK} />
            <YAxis tick={AXIS_TICK} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="value" fill="#80D1E9" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartWrapper>
        <DataTable columns={['Item', 'Category', 'Warehouse', 'Qty', 'Value']} rows={rows} />
      </div>
    );
  };

  const renderJobOrders = () => {
    const { summary: s, rows, chartData } = extract(jobOrderQ);
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KpiCard label="Total JOs" value={num(s.totalJOs).toLocaleString()} />
          <KpiCard label="Active" value={num(s.active).toLocaleString()} color="text-nesma-secondary" />
          <KpiCard label="Completed" value={num(s.completed).toLocaleString()} color="text-emerald-400" />
          <KpiCard label="Avg Duration" value={`${num(s.avgDuration)} days`} color="text-amber-400" />
        </div>
        <ChartWrapper title="Job Orders by Type">
          <PieChart>
            <Pie data={chartData} cx="50%" cy="50%" innerRadius={70} outerRadius={120} dataKey="value" label={PieLabel}>
              {chartData.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
          </PieChart>
        </ChartWrapper>
        <DataTable columns={['JO#', 'Type', 'Project', 'Status', 'Value']} rows={rows} />
      </div>
    );
  };

  const renderSla = () => {
    const { summary: s, rows, chartData } = extract(slaQ);
    const onTrack = num(s.onTrack);
    const atRisk = num(s.atRisk);
    const overdue = num(s.overdue);
    const pieData =
      chartData.length > 0
        ? chartData
        : [
            { name: 'On Track', value: onTrack },
            { name: 'At Risk', value: atRisk },
            { name: 'Overdue', value: overdue },
          ];
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="glass-card rounded-xl p-5 border border-emerald-500/20 bg-emerald-500/5">
            <p className="text-xs text-emerald-400 uppercase tracking-wider">On Track</p>
            <p className="text-3xl font-bold text-emerald-400 mt-1">{onTrack}%</p>
          </div>
          <div className="glass-card rounded-xl p-5 border border-amber-500/20 bg-amber-500/5">
            <p className="text-xs text-amber-400 uppercase tracking-wider">At Risk</p>
            <p className="text-3xl font-bold text-amber-400 mt-1">{atRisk}%</p>
          </div>
          <div className="glass-card rounded-xl p-5 border border-red-500/20 bg-red-500/5">
            <p className="text-xs text-red-400 uppercase tracking-wider">Overdue</p>
            <p className="text-3xl font-bold text-red-400 mt-1">{overdue}%</p>
          </div>
        </div>
        <ChartWrapper title="SLA Compliance Breakdown">
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={80}
              outerRadius={130}
              dataKey="value"
              label={({ name, value }: { name?: string; value?: number }) => `${name}: ${value}%`}
            >
              <Cell fill="#4CAF50" />
              <Cell fill="#FF9800" />
              <Cell fill="#F44336" />
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
          </PieChart>
        </ChartWrapper>
        <DataTable columns={['JO#', 'SLA Target', 'Actual', 'Status']} rows={rows} />
      </div>
    );
  };

  const renderMaterial = () => {
    const { summary: s, rows, chartData } = extract(materialQ);
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KpiCard label="Total MRRV" value={num(s.totalMRRV).toLocaleString()} color="text-emerald-400" />
          <KpiCard label="Total MIRV" value={num(s.totalMIRV).toLocaleString()} color="text-nesma-secondary" />
          <KpiCard label="Total MRV" value={num(s.totalMRV).toLocaleString()} color="text-amber-400" />
          <KpiCard label="Net Movement" value={num(s.netMovement).toLocaleString()} />
        </div>
        <ChartWrapper title="Material Movement Over Time">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" tick={AXIS_TICK} />
            <YAxis tick={AXIS_TICK} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
            <Line type="monotone" dataKey="mrrv" stroke="#4CAF50" strokeWidth={2} name="MRRV" dot={false} />
            <Line type="monotone" dataKey="mirv" stroke="#80D1E9" strokeWidth={2} name="MIRV" dot={false} />
            <Line type="monotone" dataKey="mrv" stroke="#FF9800" strokeWidth={2} name="MRV" dot={false} />
          </LineChart>
        </ChartWrapper>
        <DataTable columns={['Date', 'MRRV Count', 'MIRV Count', 'MRV Count']} rows={rows} />
      </div>
    );
  };

  const renderSupplier = () => {
    const { summary: s, rows, chartData } = extract(supplierQ);
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KpiCard label="Total Suppliers" value={num(s.totalSuppliers).toLocaleString()} />
          <KpiCard label="Avg Delivery Days" value={`${num(s.avgDeliveryDays)} days`} color="text-nesma-secondary" />
          <KpiCard label="On-Time %" value={`${num(s.onTimePercent)}%`} color="text-emerald-400" />
          <KpiCard label="Active" value={num(s.active).toLocaleString()} color="text-amber-400" />
        </div>
        <ChartWrapper title="Deliveries by Supplier">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="name" tick={AXIS_TICK} />
            <YAxis tick={AXIS_TICK} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="deliveries" fill="#2E3192" radius={[6, 6, 0, 0]} />
            <Bar dataKey="onTime" fill="#4CAF50" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ChartWrapper>
        <DataTable columns={['Supplier', 'Deliveries', 'Avg Days', 'On-Time %']} rows={rows} />
      </div>
    );
  };

  const renderFinancial = () => {
    const { summary: s, rows, chartData } = extract(financialQ);
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KpiCard label="MRRV Total" value={formatCurrency(num(s.mrrvTotal))} sub={`${num(s.mrrvCount)} receipts`} />
          <KpiCard label="MIRV Total" value={formatCurrency(num(s.mirvTotal))} sub={`${num(s.mirvCount)} issuances`} />
          <KpiCard label="JO Costs" value={formatCurrency(num(s.joCosts))} sub={`${num(s.joCount)} orders`} />
          <KpiCard label="Inventory Value" value={formatCurrency(num(s.inventoryValue))} color="text-nesma-secondary" />
        </div>
        <ChartWrapper title="Monthly Cost Trend">
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="month" tick={AXIS_TICK} />
            <YAxis tick={AXIS_TICK} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ color: '#9CA3AF', fontSize: 12 }} />
            <Bar dataKey="receipts" fill="#4CAF50" name="Receipts" radius={[4, 4, 0, 0]} />
            <Bar dataKey="issues" fill="#80D1E9" name="Issues" radius={[4, 4, 0, 0]} />
            <Bar dataKey="joCosts" fill="#FF9800" name="JO Costs" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartWrapper>
        <DataTable columns={['Month', 'Receipts', 'Issues', 'JO Costs']} rows={rows} />
      </div>
    );
  };

  const TAB_RENDERERS: Record<ReportTab, () => React.ReactNode> = {
    inventory: renderInventory,
    job_orders: renderJobOrders,
    sla: renderSla,
    material: renderMaterial,
    supplier: renderSupplier,
    financial: renderFinancial,
  };

  // ── JSX ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white glow-text">Reports</h1>
          <p className="text-sm text-gray-400 mt-1">Analytics and insights across all operations</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExportPdf}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 hover:text-white transition-all"
          >
            <Download size={16} />
            Export PDF
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-white/5 text-gray-300 border border-white/10 hover:bg-white/10 hover:text-white transition-all"
          >
            <Printer size={16} />
            Print
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-nesma-primary text-white shadow-lg shadow-nesma-primary/20 border border-nesma-primary/50'
                  : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="glass-card rounded-2xl p-4 border border-white/10">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Filter size={16} />
            <span className="font-medium">Filters</span>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 uppercase tracking-wider">From</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl text-sm text-white px-3 py-2 focus:outline-none focus:border-nesma-primary/50"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 uppercase tracking-wider">To</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl text-sm text-white px-3 py-2 focus:outline-none focus:border-nesma-primary/50"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 uppercase tracking-wider">Project</label>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl text-sm text-white px-3 py-2 focus:outline-none focus:border-nesma-primary/50 min-w-[160px]"
            >
              <option value="" className="bg-[#0a1929]">
                All Projects
              </option>
              {projects.map(p => (
                <option key={p.id} value={p.id} className="bg-[#0a1929]">
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-500 uppercase tracking-wider">Warehouse</label>
            <select
              value={warehouseId}
              onChange={e => setWarehouseId(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl text-sm text-white px-3 py-2 focus:outline-none focus:border-nesma-primary/50 min-w-[160px]"
            >
              <option value="" className="bg-[#0a1929]">
                All Warehouses
              </option>
              {warehouses.map(w => (
                <option key={w.id} value={w.id} className="bg-[#0a1929]">
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handleGenerate}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium bg-nesma-primary text-white hover:bg-nesma-primary/90 transition-all shadow-lg shadow-nesma-primary/20"
          >
            <BarChart3 size={16} />
            Generate Report
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {TAB_RENDERERS[activeTab]()}
    </div>
  );
};
