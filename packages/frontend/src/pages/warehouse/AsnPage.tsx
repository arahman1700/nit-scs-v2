import React, { useState, useMemo } from 'react';
import { Plus, Search, Package, Clock, Truck, MapPin, CheckCircle2, XCircle, BarChart3, X, Trash2 } from 'lucide-react';
import {
  useAsnList,
  useAsn,
  useCreateAsn,
  useMarkInTransit,
  useMarkArrived,
  useReceiveAsn,
  useCancelAsn,
  useAsnVariance,
  useSuppliers,
  useWarehouses,
  useItems,
} from '@/api/hooks';

// ── Types ───────────────────────────────────────────────────────────────

type AsnStatus = 'pending' | 'in_transit' | 'arrived' | 'received' | 'cancelled';

interface AsnItem {
  id: string;
  asnNumber: string;
  status: AsnStatus;
  expectedArrival: string;
  actualArrival?: string;
  carrierName?: string;
  trackingNumber?: string;
  purchaseOrderRef?: string;
  notes?: string;
  grnId?: string;
  supplier?: { id: string; supplierName: string; supplierCode: string };
  warehouse?: { id: string; warehouseName: string; warehouseCode: string };
  lines?: AsnLineItem[];
  _count?: { lines: number };
  createdAt: string;
}

interface AsnLineItem {
  id: string;
  item: { id: string; itemCode: string; itemDescription: string };
  qtyExpected: number;
  qtyReceived?: number;
  lotNumber?: string;
  expiryDate?: string;
}

// ── Status Config ───────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
  pending: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: <Clock className="w-3 h-3" />, label: 'Pending' },
  in_transit: {
    bg: 'bg-amber-500/20',
    text: 'text-amber-400',
    icon: <Truck className="w-3 h-3" />,
    label: 'In Transit',
  },
  arrived: { bg: 'bg-purple-500/20', text: 'text-purple-400', icon: <MapPin className="w-3 h-3" />, label: 'Arrived' },
  received: {
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-400',
    icon: <CheckCircle2 className="w-3 h-3" />,
    label: 'Received',
  },
  cancelled: { bg: 'bg-red-500/20', text: 'text-red-400', icon: <XCircle className="w-3 h-3" />, label: 'Cancelled' },
};

const TABS: AsnStatus[] = ['pending', 'in_transit', 'arrived', 'received'];

// ── Main Page ───────────────────────────────────────────────────────────

export const AsnPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AsnStatus>('pending');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAsnId, setSelectedAsnId] = useState<string | null>(null);

  const params = useMemo(
    () => ({
      page,
      pageSize,
      status: activeTab,
      ...(search && { search }),
    }),
    [page, pageSize, activeTab, search],
  );

  const { data: listData, isLoading } = useAsnList(params);
  const items = (listData?.data ?? []) as unknown as AsnItem[];
  const meta = (listData as unknown as Record<string, unknown>)?.meta as
    | { page: number; pageSize: number; total: number; totalPages: number }
    | undefined;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleTabChange = (tab: AsnStatus) => {
    setActiveTab(tab);
    setPage(1);
  };

  if (selectedAsnId) {
    return <AsnDetail id={selectedAsnId} onBack={() => setSelectedAsnId(null)} />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Advance Shipping Notices</h1>
          <p className="text-sm text-gray-400 mt-1">Track inbound shipments from suppliers</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm"
        >
          <Plus className="w-4 h-4" />
          New ASN
        </button>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 p-1 glass-card rounded-2xl">
        {TABS.map(tab => {
          const config = STATUS_CONFIG[tab];
          return (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab
                  ? `${config.bg} ${config.text} border border-white/10`
                  : 'text-gray-400 hover:text-gray-300 hover:bg-white/5'
              }`}
            >
              {config.icon}
              {config.label}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="glass-card rounded-2xl p-4">
        <form onSubmit={handleSearch} className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search by ASN#, supplier, tracking#..."
            className="input-field w-full pl-9 pr-3 py-2 text-sm rounded-xl"
          />
        </form>
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-3 text-gray-400 font-medium">ASN #</th>
                <th className="text-left py-3 px-3 text-gray-400 font-medium">Supplier</th>
                <th className="text-left py-3 px-3 text-gray-400 font-medium">Warehouse</th>
                <th className="text-left py-3 px-3 text-gray-400 font-medium">Expected</th>
                <th className="text-center py-3 px-3 text-gray-400 font-medium">Items</th>
                <th className="text-left py-3 px-3 text-gray-400 font-medium">Carrier</th>
                <th className="text-center py-3 px-3 text-gray-400 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/5">
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="py-3 px-3">
                        <div className="h-4 bg-white/10 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    No ASNs found in this status.
                  </td>
                </tr>
              ) : (
                items.map(item => {
                  const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedAsnId(item.id)}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-3 text-white font-mono text-xs">{item.asnNumber}</td>
                      <td className="py-3 px-3 text-gray-300">{item.supplier?.supplierName || '-'}</td>
                      <td className="py-3 px-3 text-gray-300">{item.warehouse?.warehouseCode || '-'}</td>
                      <td className="py-3 px-3 text-gray-300">
                        {new Date(item.expectedArrival).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="py-3 px-3 text-center text-gray-300">{item._count?.lines ?? 0}</td>
                      <td className="py-3 px-3 text-gray-400 text-xs">{item.carrierName || '-'}</td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusCfg.bg} ${statusCfg.text}`}
                        >
                          {statusCfg.icon}
                          {statusCfg.label}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
            <span className="text-xs text-gray-500">
              Showing {(meta.page - 1) * meta.pageSize + 1}
              {' - '}
              {Math.min(meta.page * meta.pageSize, meta.total)} of {meta.total}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 rounded-lg text-xs text-gray-300 border border-white/10 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-xs text-gray-400">
                Page {meta.page} of {meta.totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                disabled={page >= meta.totalPages}
                className="px-3 py-1.5 rounded-lg text-xs text-gray-300 border border-white/10 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreateModal && <CreateAsnModal onClose={() => setShowCreateModal(false)} />}
    </div>
  );
};

// ── Detail View ─────────────────────────────────────────────────────────

const AsnDetail: React.FC<{ id: string; onBack: () => void }> = ({ id, onBack }) => {
  const { data: asnData, isLoading } = useAsn(id);
  const asn = (asnData as unknown as { data?: AsnItem })?.data;

  const [showVariance, setShowVariance] = useState(false);

  const markInTransitMutation = useMarkInTransit();
  const markArrivedMutation = useMarkArrived();
  const receiveAsnMutation = useReceiveAsn();
  const cancelAsnMutation = useCancelAsn();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-white/10 rounded animate-pulse" />
        <div className="glass-card rounded-2xl p-6">
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-5 bg-white/10 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!asn) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">ASN not found</p>
        <button onClick={onBack} className="mt-4 text-nesma-primary hover:underline text-sm">
          Back to list
        </button>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[asn.status] || STATUS_CONFIG.pending;

  const handleAction = async (action: 'in-transit' | 'arrived' | 'receive' | 'cancel') => {
    try {
      if (action === 'in-transit') await markInTransitMutation.mutateAsync(id);
      else if (action === 'arrived') await markArrivedMutation.mutateAsync(id);
      else if (action === 'receive') await receiveAsnMutation.mutateAsync(id);
      else if (action === 'cancel') await cancelAsnMutation.mutateAsync(id);
    } catch {
      // errors handled by query client
    }
  };

  const isPending =
    markInTransitMutation.isPending ||
    markArrivedMutation.isPending ||
    receiveAsnMutation.isPending ||
    cancelAsnMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors text-sm">
            &larr; Back
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{asn.asnNumber}</h1>
            <p className="text-sm text-gray-400 mt-0.5">{asn.supplier?.supplierName}</p>
          </div>
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusCfg.bg} ${statusCfg.text}`}
          >
            {statusCfg.icon}
            {statusCfg.label}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {asn.status === 'received' && (
            <button
              onClick={() => setShowVariance(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-gray-300 border border-white/10 hover:bg-white/5"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Variance Report
            </button>
          )}

          {asn.status === 'pending' && (
            <button
              onClick={() => handleAction('in-transit')}
              disabled={isPending}
              className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm disabled:opacity-50"
            >
              <Truck className="w-4 h-4" />
              Mark In Transit
            </button>
          )}
          {asn.status === 'in_transit' && (
            <button
              onClick={() => handleAction('arrived')}
              disabled={isPending}
              className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm disabled:opacity-50"
            >
              <MapPin className="w-4 h-4" />
              Mark Arrived
            </button>
          )}
          {asn.status === 'arrived' && (
            <button
              onClick={() => handleAction('receive')}
              disabled={isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              Receive (Create GRN)
            </button>
          )}
          {asn.status !== 'received' && asn.status !== 'cancelled' && (
            <button
              onClick={() => handleAction('cancel')}
              disabled={isPending}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-red-400 border border-red-500/30 hover:bg-red-500/10 disabled:opacity-50"
            >
              <XCircle className="w-3.5 h-3.5" />
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-gray-400 mb-1">Warehouse</p>
          <p className="text-white font-medium">{asn.warehouse?.warehouseName || '-'}</p>
          <p className="text-xs text-gray-500">{asn.warehouse?.warehouseCode}</p>
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-gray-400 mb-1">Expected Arrival</p>
          <p className="text-white font-medium">
            {new Date(asn.expectedArrival).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
          {asn.actualArrival && (
            <p className="text-xs text-emerald-400 mt-0.5">
              Arrived:{' '}
              {new Date(asn.actualArrival).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </p>
          )}
        </div>
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-gray-400 mb-1">Shipping Info</p>
          <p className="text-white font-medium">{asn.carrierName || 'N/A'}</p>
          {asn.trackingNumber && <p className="text-xs text-gray-500">Tracking: {asn.trackingNumber}</p>}
          {asn.purchaseOrderRef && <p className="text-xs text-gray-500">PO: {asn.purchaseOrderRef}</p>}
        </div>
      </div>

      {asn.notes && (
        <div className="glass-card rounded-2xl p-4">
          <p className="text-xs text-gray-400 mb-1">Notes</p>
          <p className="text-gray-300 text-sm">{asn.notes}</p>
        </div>
      )}

      {/* Lines Table */}
      <div className="glass-card rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Line Items</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-3 text-gray-400 font-medium">#</th>
                <th className="text-left py-3 px-3 text-gray-400 font-medium">Item Code</th>
                <th className="text-left py-3 px-3 text-gray-400 font-medium">Description</th>
                <th className="text-right py-3 px-3 text-gray-400 font-medium">Qty Expected</th>
                {asn.status === 'received' && (
                  <th className="text-right py-3 px-3 text-gray-400 font-medium">Qty Received</th>
                )}
                <th className="text-left py-3 px-3 text-gray-400 font-medium">Lot #</th>
                <th className="text-left py-3 px-3 text-gray-400 font-medium">Expiry</th>
              </tr>
            </thead>
            <tbody>
              {(asn.lines || []).map((line, idx) => (
                <tr key={line.id} className="border-b border-white/5">
                  <td className="py-3 px-3 text-gray-500">{idx + 1}</td>
                  <td className="py-3 px-3 text-white font-mono text-xs">{line.item?.itemCode}</td>
                  <td className="py-3 px-3 text-gray-300">{line.item?.itemDescription}</td>
                  <td className="py-3 px-3 text-right text-gray-300">{Number(line.qtyExpected).toLocaleString()}</td>
                  {asn.status === 'received' && (
                    <td className="py-3 px-3 text-right text-emerald-400">
                      {line.qtyReceived != null ? Number(line.qtyReceived).toLocaleString() : '-'}
                    </td>
                  )}
                  <td className="py-3 px-3 text-gray-400 text-xs">{line.lotNumber || '-'}</td>
                  <td className="py-3 px-3 text-gray-400 text-xs">
                    {line.expiryDate
                      ? new Date(line.expiryDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showVariance && <VarianceModal asnId={id} onClose={() => setShowVariance(false)} />}
    </div>
  );
};

// ── Variance Modal ──────────────────────────────────────────────────────

interface VarianceLine {
  id: string;
  item: { itemCode: string; itemDescription: string };
  qtyExpected: number;
  qtyReceived: number;
  variance: number;
  variancePercent: number;
}

interface VarianceReport {
  summary: {
    totalExpected: number;
    totalReceived: number;
    totalVariance: number;
    totalVariancePercent: number;
  };
  lines: VarianceLine[];
}

const VarianceModal: React.FC<{ asnId: string; onClose: () => void }> = ({ asnId, onClose }) => {
  const { data: varianceData, isLoading } = useAsnVariance(asnId);
  const report = (varianceData as unknown as { data?: VarianceReport })?.data;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-card rounded-2xl p-6 w-full max-w-3xl border border-white/10 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Variance Report</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-5 bg-white/10 rounded animate-pulse" />
            ))}
          </div>
        ) : report ? (
          <>
            {/* Summary */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400">Expected</p>
                <p className="text-lg font-bold text-white">{report.summary.totalExpected}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400">Received</p>
                <p className="text-lg font-bold text-emerald-400">{report.summary.totalReceived}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400">Variance</p>
                <p
                  className={`text-lg font-bold ${report.summary.totalVariance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                >
                  {report.summary.totalVariance >= 0 ? '+' : ''}
                  {report.summary.totalVariance}
                </p>
              </div>
              <div className="bg-white/5 rounded-xl p-3 text-center">
                <p className="text-xs text-gray-400">Variance %</p>
                <p
                  className={`text-lg font-bold ${report.summary.totalVariancePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                >
                  {report.summary.totalVariancePercent >= 0 ? '+' : ''}
                  {report.summary.totalVariancePercent}%
                </p>
              </div>
            </div>

            {/* Lines */}
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-2 text-gray-400 font-medium">Item</th>
                  <th className="text-right py-2 px-2 text-gray-400 font-medium">Expected</th>
                  <th className="text-right py-2 px-2 text-gray-400 font-medium">Received</th>
                  <th className="text-right py-2 px-2 text-gray-400 font-medium">Variance</th>
                  <th className="text-right py-2 px-2 text-gray-400 font-medium">%</th>
                </tr>
              </thead>
              <tbody>
                {report.lines.map((line: VarianceLine) => (
                  <tr key={line.id} className="border-b border-white/5">
                    <td className="py-2 px-2">
                      <span className="text-white font-mono text-xs">{line.item.itemCode}</span>
                      <span className="text-gray-400 text-xs ml-2">{line.item.itemDescription}</span>
                    </td>
                    <td className="py-2 px-2 text-right text-gray-300">{line.qtyExpected}</td>
                    <td className="py-2 px-2 text-right text-gray-300">{line.qtyReceived}</td>
                    <td className={`py-2 px-2 text-right ${line.variance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {line.variance >= 0 ? '+' : ''}
                      {line.variance}
                    </td>
                    <td
                      className={`py-2 px-2 text-right ${line.variancePercent >= 0 ? 'text-emerald-400' : 'text-red-400'}`}
                    >
                      {line.variancePercent >= 0 ? '+' : ''}
                      {line.variancePercent}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <p className="text-gray-400 text-sm">No variance data available.</p>
        )}
      </div>
    </div>
  );
};

// ── Create Modal ────────────────────────────────────────────────────────

interface LineFormItem {
  itemId: string;
  qtyExpected: string;
  lotNumber: string;
  expiryDate: string;
}

const CreateAsnModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const createMutation = useCreateAsn();
  const { data: suppliersData } = useSuppliers();
  const { data: warehousesData } = useWarehouses();
  const { data: itemsData } = useItems();

  const suppliers = (suppliersData?.data ?? []) as unknown as Array<{
    id: string;
    supplierCode: string;
    supplierName: string;
  }>;
  const warehouses = (warehousesData?.data ?? []) as unknown as Array<{
    id: string;
    warehouseCode: string;
    warehouseName: string;
  }>;
  const allItems = (itemsData?.data ?? []) as unknown as Array<{ id: string; code: string; name: string }>;

  const [form, setForm] = useState({
    supplierId: '',
    warehouseId: '',
    expectedArrival: '',
    carrierName: '',
    trackingNumber: '',
    purchaseOrderRef: '',
    notes: '',
  });

  const [lines, setLines] = useState<LineFormItem[]>([{ itemId: '', qtyExpected: '', lotNumber: '', expiryDate: '' }]);

  const addLine = () => setLines(prev => [...prev, { itemId: '', qtyExpected: '', lotNumber: '', expiryDate: '' }]);
  const removeLine = (idx: number) => setLines(prev => prev.filter((_, i) => i !== idx));
  const updateLine = (idx: number, field: keyof LineFormItem, value: string) => {
    setLines(prev => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.supplierId || !form.warehouseId || !form.expectedArrival) return;

    const validLines = lines.filter(l => l.itemId && l.qtyExpected);
    if (validLines.length === 0) return;

    await createMutation.mutateAsync({
      ...form,
      lines: validLines.map(l => ({
        itemId: l.itemId,
        qtyExpected: Number(l.qtyExpected),
        ...(l.lotNumber && { lotNumber: l.lotNumber }),
        ...(l.expiryDate && { expiryDate: l.expiryDate }),
      })),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-card rounded-2xl p-6 w-full max-w-2xl border border-white/10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Create Advance Shipping Notice</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Supplier</label>
              <select
                value={form.supplierId}
                onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}
                className="input-field w-full py-2 px-3 rounded-xl text-sm"
                required
              >
                <option value="">Select supplier...</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.supplierCode} - {s.supplierName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Warehouse</label>
              <select
                value={form.warehouseId}
                onChange={e => setForm(f => ({ ...f, warehouseId: e.target.value }))}
                className="input-field w-full py-2 px-3 rounded-xl text-sm"
                required
              >
                <option value="">Select warehouse...</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.warehouseCode} - {w.warehouseName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Expected Arrival</label>
              <input
                type="date"
                value={form.expectedArrival}
                onChange={e => setForm(f => ({ ...f, expectedArrival: e.target.value }))}
                className="input-field w-full py-2 px-3 rounded-xl text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">PO Reference</label>
              <input
                type="text"
                value={form.purchaseOrderRef}
                onChange={e => setForm(f => ({ ...f, purchaseOrderRef: e.target.value }))}
                placeholder="PO-2026-001"
                className="input-field w-full py-2 px-3 rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Carrier Name</label>
              <input
                type="text"
                value={form.carrierName}
                onChange={e => setForm(f => ({ ...f, carrierName: e.target.value }))}
                placeholder="e.g. DHL, FedEx"
                className="input-field w-full py-2 px-3 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Tracking Number</label>
              <input
                type="text"
                value={form.trackingNumber}
                onChange={e => setForm(f => ({ ...f, trackingNumber: e.target.value }))}
                className="input-field w-full py-2 px-3 rounded-xl text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="input-field w-full py-2 px-3 rounded-xl text-sm"
              rows={2}
            />
          </div>

          {/* Line Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">Line Items</label>
              <button
                type="button"
                onClick={addLine}
                className="text-xs text-nesma-primary hover:underline flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                Add Line
              </button>
            </div>
            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div key={idx} className="flex items-start gap-2 bg-white/5 rounded-xl p-3">
                  <div className="flex-1 grid grid-cols-4 gap-2">
                    <select
                      value={line.itemId}
                      onChange={e => updateLine(idx, 'itemId', e.target.value)}
                      className="input-field py-1.5 px-2 rounded-lg text-xs col-span-2"
                      required
                    >
                      <option value="">Select item...</option>
                      {allItems.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.code} - {item.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={line.qtyExpected}
                      onChange={e => updateLine(idx, 'qtyExpected', e.target.value)}
                      placeholder="Qty"
                      min="0.001"
                      step="0.001"
                      className="input-field py-1.5 px-2 rounded-lg text-xs"
                      required
                    />
                    <input
                      type="text"
                      value={line.lotNumber}
                      onChange={e => updateLine(idx, 'lotNumber', e.target.value)}
                      placeholder="Lot # (opt)"
                      className="input-field py-1.5 px-2 rounded-lg text-xs"
                    />
                  </div>
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      className="mt-1 text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm text-gray-300 border border-white/10 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !form.supplierId || !form.warehouseId || !form.expectedArrival}
              className="btn-primary px-4 py-2 rounded-xl text-sm disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create ASN'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
