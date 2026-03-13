import React, { useState, useMemo } from 'react';
import { RefreshCw, ShoppingCart, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { SmartGrid } from '@/components/smart-grid/SmartGrid';
import type { ColumnDef } from '@/config/resourceColumns';
import { usePoReconciliation, useTriggerPoSync } from '@/domains/inbound/hooks/usePurchaseOrders';
import type { PoReconciliationLine } from '@/domains/inbound/hooks/usePurchaseOrders';

// ── Status badge ────────────────────────────────────────────────────────────

const RECON_STATUS_CONFIG = {
  fully_received: {
    label: 'Fully Received',
    classes: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  },
  partially_received: {
    label: 'Partial',
    classes: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  },
  not_received: {
    label: 'Not Received',
    classes: 'bg-white/10 text-gray-400 border border-white/10',
  },
  over_received: {
    label: 'Over-Received',
    classes: 'bg-red-500/20 text-red-400 border border-red-500/30',
  },
};

function ReconStatusBadge({ status }: { status: PoReconciliationLine['status'] }) {
  const cfg = RECON_STATUS_CONFIG[status] ?? RECON_STATUS_CONFIG['not_received'];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${cfg.classes}`}>
      {cfg.label}
    </span>
  );
}

// ── KPI summary cards ───────────────────────────────────────────────────────

function KpiCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400">{title}</span>
        <div className={`p-2 rounded-xl ${color}`}>
          <Icon size={16} className="text-white" />
        </div>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

// ── Columns ──────────────────────────────────────────────────────────────────

const COLUMNS: ColumnDef[] = [
  { key: 'poNumber', label: 'PO Number' },
  { key: 'supplierCode', label: 'Supplier Code' },
  { key: 'supplierName', label: 'Supplier Name' },
  { key: 'itemCode', label: 'Item Code' },
  { key: 'description', label: 'Description' },
  { key: 'uom', label: 'UOM' },
  { key: 'orderedQty', label: 'Ordered Qty' },
  { key: 'receivedQty', label: 'Received Qty' },
  { key: 'variance', label: 'Variance' },
  {
    key: 'status',
    label: 'Status',
    component: (value: unknown) => <ReconStatusBadge status={value as PoReconciliationLine['status']} />,
  },
  { key: 'unitPrice', label: 'Unit Price' },
];

// ── Filter bar ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'fully_received', label: 'Fully Received' },
  { value: 'partially_received', label: 'Partial' },
  { value: 'not_received', label: 'Not Received' },
  { value: 'over_received', label: 'Over-Received' },
];

// ── Main page ──────────────────────────────────────────────────────────────

export const PurchaseOrderReconciliation: React.FC = () => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [supplierFilter, setSupplierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { data, isLoading } = usePoReconciliation({
    page,
    pageSize,
    supplierCode: supplierFilter || undefined,
    status: statusFilter || undefined,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
  });

  const triggerSync = useTriggerPoSync();

  const rows = useMemo(() => (data?.data ?? []) as unknown as Record<string, unknown>[], [data]);
  const total = (data as { meta?: { total?: number } })?.meta?.total ?? rows.length;

  // Compute KPI summaries from current page data
  const lines = (data?.data ?? []) as PoReconciliationLine[];
  const fullyReceived = lines.filter(l => l.status === 'fully_received').length;
  const partial = lines.filter(l => l.status === 'partially_received').length;
  const overReceived = lines.filter(l => l.status === 'over_received').length;
  const notReceived = lines.filter(l => l.status === 'not_received').length;

  const handleSync = () => {
    triggerSync.mutate();
  };

  return (
    <div className="p-4 md:p-6 space-y-6 bg-nesma-dark min-h-screen">
      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShoppingCart size={24} className="text-nesma-secondary" />
            PO Reconciliation
          </h1>
          <p className="text-sm text-gray-400 mt-1">Oracle PO mirror — compare ordered quantities against received</p>
        </div>
        <button
          onClick={handleSync}
          disabled={triggerSync.isPending}
          className="flex items-center gap-2 bg-nesma-primary hover:bg-nesma-primary/80 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300"
          aria-label="Trigger Oracle PO sync"
        >
          <RefreshCw size={16} className={triggerSync.isPending ? 'animate-spin' : ''} />
          {triggerSync.isPending ? 'Syncing…' : 'Sync Now'}
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <KpiCard title="Fully Received" value={fullyReceived} icon={CheckCircle} color="bg-emerald-500" />
        <KpiCard title="Partial Receipt" value={partial} icon={Clock} color="bg-amber-500" />
        <KpiCard title="Over-Received" value={overReceived} icon={AlertTriangle} color="bg-red-500" />
        <KpiCard title="Not Received" value={notReceived} icon={ShoppingCart} color="bg-nesma-secondary" />
      </div>

      {/* ── Filters ── */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex flex-col md:flex-row gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Filter by supplier code…"
            value={supplierFilter}
            onChange={e => {
              setSupplierFilter(e.target.value);
              setPage(1);
            }}
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-nesma-secondary/50 w-full md:w-48"
          />
          <select
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-nesma-secondary/50 w-full md:w-48"
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value} className="bg-nesma-dark">
                {opt.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={fromDate}
            onChange={e => {
              setFromDate(e.target.value);
              setPage(1);
            }}
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-nesma-secondary/50 w-full md:w-40"
            aria-label="From date"
          />
          <input
            type="date"
            value={toDate}
            onChange={e => {
              setToDate(e.target.value);
              setPage(1);
            }}
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-nesma-secondary/50 w-full md:w-40"
            aria-label="To date"
          />
        </div>
      </div>

      {/* ── Data Grid ── */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <SmartGrid
          columns={COLUMNS}
          rowData={rows}
          loading={isLoading}
          isDocument
          serverPagination={{
            total,
            page,
            pageSize,
            onPageChange: setPage,
            onPageSizeChange: ps => {
              setPageSize(ps);
              setPage(1);
            },
          }}
        />
      </div>
    </div>
  );
};
