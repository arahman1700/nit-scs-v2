import React, { useState, useMemo } from 'react';
import {
  useAssetList,
  useAsset,
  useAssetSummary,
  useCreateAsset,
  useUpdateAsset,
  useTransferAsset,
  useRetireAsset,
  useDisposeAsset,
} from '@/api/hooks/useAssets';
import { useWarehouses } from '@/api/hooks/useMasterData';
import { toast } from '@/components/Toaster';
import {
  Archive,
  Plus,
  Search,
  Loader2,
  X,
  Eye,
  Package,
  DollarSign,
  CheckCircle,
  AlertTriangle,
  ArrowRightLeft,
  Power,
  Trash2,
  MapPin,
  Tag,
  Calendar,
  FileText,
} from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────

interface Asset {
  id: string;
  assetTag: string;
  description: string;
  category: string;
  location: string;
  warehouseId: string | null;
  purchaseValue: number;
  currentValue: number;
  purchaseDate: string;
  status: 'active' | 'retired' | 'disposed' | 'in_transfer';
  serialNumber: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AssetSummary {
  totalAssets: number;
  activeAssets: number;
  retiredAssets: number;
  totalValue: number;
}

interface AssetFormData {
  assetTag: string;
  description: string;
  category: string;
  location: string;
  warehouseId: string;
  purchaseValue: number;
  purchaseDate: string;
  serialNumber: string;
  notes: string;
}

const emptyForm: AssetFormData = {
  assetTag: '',
  description: '',
  category: '',
  location: '',
  warehouseId: '',
  purchaseValue: 0,
  purchaseDate: '',
  serialNumber: '',
  notes: '',
};

type ModalView = 'none' | 'create' | 'detail' | 'transfer' | 'retire' | 'dispose';

const statusConfig: Record<string, { label: string; classes: string }> = {
  active: { label: 'Active', classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  retired: { label: 'Retired', classes: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  disposed: { label: 'Disposed', classes: 'bg-red-500/10 text-red-400 border-red-500/20' },
  in_transfer: { label: 'In Transfer', classes: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
};

// ── Component ────────────────────────────────────────────────────────────────

export const AssetRegisterPage: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [modalView, setModalView] = useState<ModalView>('none');
  const [selectedAssetId, setSelectedAssetId] = useState<string | undefined>(undefined);
  const [formData, setFormData] = useState<AssetFormData>(emptyForm);

  // Transfer / Retire / Dispose state
  const [transferWarehouseId, setTransferWarehouseId] = useState('');
  const [transferNotes, setTransferNotes] = useState('');
  const [retireReason, setRetireReason] = useState('');
  const [disposalValue, setDisposalValue] = useState<number>(0);

  // Queries
  const { data: assetsRes, isLoading: assetsLoading } = useAssetList({ search: searchQuery || undefined });
  const assets: Asset[] = (assetsRes as unknown as { data?: Asset[] })?.data ?? [];

  const { data: summaryRes } = useAssetSummary();
  const summary: AssetSummary = (summaryRes as unknown as { data?: AssetSummary })?.data ?? {
    totalAssets: 0,
    activeAssets: 0,
    retiredAssets: 0,
    totalValue: 0,
  };

  const { data: detailRes, isLoading: detailLoading } = useAsset(selectedAssetId);
  const selectedAsset: Asset | null = (detailRes as unknown as { data?: Asset })?.data ?? null;

  const { data: warehousesRes } = useWarehouses();
  const warehouses =
    (warehousesRes as unknown as { data?: Array<{ id: string; warehouseName: string; warehouseCode: string }> })
      ?.data ?? [];

  // Mutations
  const createMutation = useCreateAsset();
  const updateMutation = useUpdateAsset();
  const transferMutation = useTransferAsset();
  const retireMutation = useRetireAsset();
  const disposeMutation = useDisposeAsset();

  // Filtered assets
  const filteredAssets = useMemo(() => {
    if (!searchQuery) return assets;
    const q = searchQuery.toLowerCase();
    return assets.filter(
      a =>
        a.assetTag.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        a.location.toLowerCase().includes(q),
    );
  }, [assets, searchQuery]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  function openCreateModal() {
    setFormData(emptyForm);
    setModalView('create');
  }

  function openDetailModal(assetId: string) {
    setSelectedAssetId(assetId);
    setModalView('detail');
  }

  function closeModal() {
    setModalView('none');
    setSelectedAssetId(undefined);
    setFormData(emptyForm);
    setTransferWarehouseId('');
    setTransferNotes('');
    setRetireReason('');
    setDisposalValue(0);
  }

  function handleCreate() {
    const payload: Record<string, unknown> = {
      assetTag: formData.assetTag,
      description: formData.description,
      category: formData.category,
      location: formData.location,
      warehouseId: formData.warehouseId || undefined,
      purchaseValue: Number(formData.purchaseValue),
      purchaseDate: formData.purchaseDate || undefined,
      serialNumber: formData.serialNumber || undefined,
      notes: formData.notes || undefined,
    };

    createMutation.mutate(payload, {
      onSuccess: () => {
        toast.success('Asset created');
        closeModal();
      },
      onError: () => toast.error('Failed to create asset'),
    });
  }

  function handleTransfer() {
    if (!selectedAssetId || !transferWarehouseId) return;
    transferMutation.mutate(
      { id: selectedAssetId, toWarehouseId: transferWarehouseId, reason: transferNotes || undefined },
      {
        onSuccess: () => {
          toast.success('Asset transferred');
          closeModal();
        },
        onError: () => toast.error('Failed to transfer asset'),
      },
    );
  }

  function handleRetire() {
    if (!selectedAssetId) return;
    retireMutation.mutate(selectedAssetId, {
      onSuccess: () => {
        toast.success('Asset retired');
        closeModal();
      },
      onError: () => toast.error('Failed to retire asset'),
    });
  }

  function handleDispose() {
    if (!selectedAssetId) return;
    disposeMutation.mutate(
      { id: selectedAssetId, disposalValue: disposalValue || undefined },
      {
        onSuccess: () => {
          toast.success('Asset disposed');
          closeModal();
        },
        onError: () => toast.error('Failed to dispose asset'),
      },
    );
  }

  // ── KPI Cards ────────────────────────────────────────────────────────────

  const kpis = [
    {
      label: 'Total Assets',
      value: summary.totalAssets,
      icon: Package,
      color: 'blue',
    },
    {
      label: 'Active',
      value: summary.activeAssets,
      icon: CheckCircle,
      color: 'emerald',
    },
    {
      label: 'Retired',
      value: summary.retiredAssets,
      icon: AlertTriangle,
      color: 'amber',
    },
    {
      label: 'Total Value',
      value: summary.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      icon: DollarSign,
      color: 'purple',
      isCurrency: true,
    },
  ];

  const colorMap: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
    emerald: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
    amber: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
    purple: { bg: 'bg-purple-500/20', text: 'text-purple-400' },
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-xl bg-nesma-primary/20 flex items-center justify-center">
            <Archive className="w-5 h-5 text-nesma-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-white">Asset Register</h1>
            <p className="text-sm text-gray-400">Track and manage company assets</p>
          </div>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2.5 bg-nesma-primary text-white rounded-lg hover:bg-nesma-primary/80 transition-all text-sm font-medium shadow-lg shadow-nesma-primary/20"
        >
          <Plus size={16} />
          Register Asset
        </button>
      </div>

      {/* KPI Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(kpi => {
          const Icon = kpi.icon;
          const colors = colorMap[kpi.color];
          return (
            <div key={kpi.label} className="glass-card rounded-2xl p-5 border border-white/10">
              <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg ${colors.bg} ${colors.text}`}>
                  <Icon size={18} />
                </div>
                <span className="text-xs text-gray-400">{kpi.label}</span>
              </div>
              <p className="text-2xl font-bold text-white">
                {kpi.isCurrency && <span className="text-sm font-normal text-gray-400 mr-1">SAR</span>}
                {kpi.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          type="text"
          placeholder="Search asset tag, description, category..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="input-field w-full pl-10"
        />
      </div>

      {/* Assets Table */}
      <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider bg-white/5">
                <th className="py-3 px-4 font-medium">Asset Tag</th>
                <th className="py-3 px-4 font-medium">Description</th>
                <th className="py-3 px-4 font-medium">Category</th>
                <th className="py-3 px-4 font-medium">Location</th>
                <th className="py-3 px-4 font-medium text-right">Purchase Value</th>
                <th className="py-3 px-4 font-medium text-right">Current Value</th>
                <th className="py-3 px-4 font-medium text-center">Status</th>
                <th className="py-3 px-4 font-medium w-16" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {assetsLoading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-gray-500 mx-auto" />
                  </td>
                </tr>
              ) : filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <Archive className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                    <p className="text-sm text-gray-500">No assets found</p>
                  </td>
                </tr>
              ) : (
                filteredAssets.map(asset => {
                  const status = statusConfig[asset.status] ?? statusConfig.active;
                  return (
                    <tr key={asset.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4">
                        <span className="text-sm text-nesma-secondary font-mono font-medium">{asset.assetTag}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-200 max-w-xs truncate block">{asset.description}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-300">{asset.category}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-300">{asset.location}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-sm text-gray-300 font-mono">
                          {asset.purchaseValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-sm text-white font-mono font-medium">
                          {asset.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${status.classes}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() => openDetailModal(asset.id)}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all"
                          aria-label={`View asset ${asset.assetTag}`}
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}

      {/* Create Asset Modal */}
      {modalView === 'create' && (
        <ModalShell title="Register New Asset" onClose={closeModal}>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">
                  <Tag size={12} className="inline mr-1" />
                  Asset Tag
                </label>
                <input
                  type="text"
                  value={formData.assetTag}
                  onChange={e => setFormData({ ...formData, assetTag: e.target.value })}
                  placeholder="e.g. AST-0001"
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={e => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g. Equipment, Vehicle"
                  className="input-field w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Description</label>
              <input
                type="text"
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                placeholder="Asset description"
                className="input-field w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">
                  <MapPin size={12} className="inline mr-1" />
                  Location
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={e => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Building / Area"
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Warehouse</label>
                <select
                  value={formData.warehouseId}
                  onChange={e => setFormData({ ...formData, warehouseId: e.target.value })}
                  className="input-field w-full"
                >
                  <option value="">None</option>
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
                <label className="block text-xs text-gray-400 mb-1.5">
                  <DollarSign size={12} className="inline mr-1" />
                  Purchase Value
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.purchaseValue}
                  onChange={e => setFormData({ ...formData, purchaseValue: Number(e.target.value) })}
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">
                  <Calendar size={12} className="inline mr-1" />
                  Purchase Date
                </label>
                <input
                  type="date"
                  value={formData.purchaseDate}
                  onChange={e => setFormData({ ...formData, purchaseDate: e.target.value })}
                  className="input-field w-full"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Serial Number</label>
              <input
                type="text"
                value={formData.serialNumber}
                onChange={e => setFormData({ ...formData, serialNumber: e.target.value })}
                placeholder="Optional"
                className="input-field w-full"
              />
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Notes</label>
              <textarea
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Optional notes"
                rows={3}
                className="input-field w-full resize-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
            <button
              onClick={closeModal}
              className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={createMutation.isPending || !formData.assetTag || !formData.description}
              className="flex items-center gap-2 px-5 py-2 bg-nesma-primary text-white rounded-lg hover:bg-nesma-primary/80 transition-all text-sm font-medium shadow-lg shadow-nesma-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createMutation.isPending && <Loader2 size={14} className="animate-spin" />}
              Register Asset
            </button>
          </div>
        </ModalShell>
      )}

      {/* Detail Modal */}
      {modalView === 'detail' && (
        <ModalShell title="Asset Details" onClose={closeModal} wide>
          {detailLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
            </div>
          ) : selectedAsset ? (
            <>
              <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
                {/* Asset header info */}
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">{selectedAsset.assetTag}</h3>
                    <p className="text-sm text-gray-400 mt-1">{selectedAsset.description}</p>
                  </div>
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
                      (statusConfig[selectedAsset.status] ?? statusConfig.active).classes
                    }`}
                  >
                    {(statusConfig[selectedAsset.status] ?? statusConfig.active).label}
                  </span>
                </div>

                {/* Detail Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <DetailField label="Category" value={selectedAsset.category} />
                  <DetailField label="Location" value={selectedAsset.location} />
                  <DetailField
                    label="Purchase Value"
                    value={`SAR ${selectedAsset.purchaseValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                  />
                  <DetailField
                    label="Current Value"
                    value={`SAR ${selectedAsset.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                  />
                  <DetailField label="Purchase Date" value={selectedAsset.purchaseDate?.slice(0, 10) ?? '-'} />
                  <DetailField label="Serial Number" value={selectedAsset.serialNumber ?? '-'} />
                </div>

                {selectedAsset.notes && (
                  <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Notes</span>
                    <p className="text-sm text-gray-300 mt-1">{selectedAsset.notes}</p>
                  </div>
                )}

                {/* Action Buttons (only for active/in-transfer assets) */}
                {(selectedAsset.status === 'active' || selectedAsset.status === 'in_transfer') && (
                  <div className="flex flex-wrap gap-3 pt-2 border-t border-white/10">
                    <button
                      onClick={() => setModalView('transfer')}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-all"
                    >
                      <ArrowRightLeft size={14} />
                      Transfer
                    </button>
                    <button
                      onClick={() => setModalView('retire')}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-all"
                    >
                      <Power size={14} />
                      Retire
                    </button>
                    <button
                      onClick={() => setModalView('dispose')}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all"
                    >
                      <Trash2 size={14} />
                      Dispose
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="py-16 text-center text-sm text-gray-500">Asset not found</div>
          )}
        </ModalShell>
      )}

      {/* Transfer Modal */}
      {modalView === 'transfer' && (
        <ModalShell title="Transfer Asset" onClose={closeModal}>
          <div className="p-6 space-y-4">
            <p className="text-sm text-gray-400">
              Transfer <span className="text-white font-medium">{selectedAsset?.assetTag}</span> to a new warehouse.
            </p>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                <MapPin size={12} className="inline mr-1" />
                Destination Warehouse
              </label>
              <select
                value={transferWarehouseId}
                onChange={e => setTransferWarehouseId(e.target.value)}
                className="input-field w-full"
              >
                <option value="">Select warehouse...</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.warehouseCode} - {w.warehouseName}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Notes</label>
              <textarea
                value={transferNotes}
                onChange={e => setTransferNotes(e.target.value)}
                placeholder="Transfer reason or notes"
                rows={3}
                className="input-field w-full resize-none"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
            <button
              onClick={() => setModalView('detail')}
              className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            >
              Back
            </button>
            <button
              onClick={handleTransfer}
              disabled={transferMutation.isPending || !transferWarehouseId}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {transferMutation.isPending && <Loader2 size={14} className="animate-spin" />}
              <ArrowRightLeft size={14} />
              Confirm Transfer
            </button>
          </div>
        </ModalShell>
      )}

      {/* Retire Modal */}
      {modalView === 'retire' && (
        <ModalShell title="Retire Asset" onClose={closeModal}>
          <div className="p-6 space-y-4">
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <p className="text-sm text-amber-400">
                Retiring <span className="font-medium">{selectedAsset?.assetTag}</span> will mark it as no longer in
                active service. This action can be undone by an administrator.
              </p>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Reason for Retirement</label>
              <textarea
                value={retireReason}
                onChange={e => setRetireReason(e.target.value)}
                placeholder="End of life, replaced, etc."
                rows={3}
                className="input-field w-full resize-none"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
            <button
              onClick={() => setModalView('detail')}
              className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            >
              Back
            </button>
            <button
              onClick={handleRetire}
              disabled={retireMutation.isPending}
              className="flex items-center gap-2 px-5 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-500 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {retireMutation.isPending && <Loader2 size={14} className="animate-spin" />}
              <Power size={14} />
              Confirm Retirement
            </button>
          </div>
        </ModalShell>
      )}

      {/* Dispose Modal */}
      {modalView === 'dispose' && (
        <ModalShell title="Dispose Asset" onClose={closeModal}>
          <div className="p-6 space-y-4">
            <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/20">
              <p className="text-sm text-red-400">
                Disposing <span className="font-medium">{selectedAsset?.assetTag}</span> is a permanent action. The
                asset will be removed from active inventory.
              </p>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                <DollarSign size={12} className="inline mr-1" />
                Disposal / Salvage Value
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={disposalValue}
                onChange={e => setDisposalValue(Number(e.target.value))}
                placeholder="0.00"
                className="input-field w-full"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
            <button
              onClick={() => setModalView('detail')}
              className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            >
              Back
            </button>
            <button
              onClick={handleDispose}
              disabled={disposeMutation.isPending}
              className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {disposeMutation.isPending && <Loader2 size={14} className="animate-spin" />}
              <Trash2 size={14} />
              Confirm Disposal
            </button>
          </div>
        </ModalShell>
      )}
    </div>
  );
};

// ── Shared Sub-Components ────────────────────────────────────────────────────

const ModalShell: React.FC<{
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}> = ({ title, onClose, wide, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center">
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
    <div
      className={`relative glass-card rounded-2xl border border-white/10 w-full mx-4 shadow-2xl ${
        wide ? 'max-w-2xl' : 'max-w-lg'
      }`}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-all"
          aria-label="Close modal"
        >
          <X size={18} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

const DetailField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
    <p className="text-sm text-white mt-0.5">{value}</p>
  </div>
);
