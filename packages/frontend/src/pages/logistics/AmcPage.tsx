import React, { useState, useMemo } from 'react';
import {
  Wrench,
  Plus,
  Search,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  Calendar,
  DollarSign,
  Shield,
} from 'lucide-react';
import { useAmcList, useAmc, useCreateAmc, useActivateAmc, useTerminateAmc } from '@/api/hooks';
import type { Amc } from '@/api/hooks';
import { toRows, toRecord } from '@/utils/type-helpers';

// ── Status Config ───────────────────────────────────────────────────────

type AmcStatus = Amc['status'];

const STATUS_CONFIG: Record<AmcStatus, { bg: string; text: string; border: string; label: string }> = {
  draft: {
    bg: 'bg-gray-500/20',
    text: 'text-gray-400',
    border: 'border-gray-500/20',
    label: 'Draft',
  },
  active: {
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    label: 'Active',
  },
  expired: {
    bg: 'bg-amber-500/20',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    label: 'Expired',
  },
  terminated: {
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    border: 'border-red-500/20',
    label: 'Terminated',
  },
};

// ── Helpers ─────────────────────────────────────────────────────────────

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatCurrency(value: number) {
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ── Main Page ───────────────────────────────────────────────────────────

export const AmcPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const params = useMemo(
    () => ({
      page,
      pageSize,
      ...(search && { search }),
    }),
    [page, pageSize, search],
  );

  const { data: listData, isLoading } = useAmcList(params);
  const items = toRows<Amc>(listData?.data);
  const meta = toRecord(listData).meta as
    | { page: number; pageSize: number; total: number; totalPages: number }
    | undefined;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-nesma-primary/20 flex items-center justify-center">
            <Wrench className="w-5 h-5 text-nesma-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Maintenance Contracts</h1>
            <p className="text-sm text-gray-400 mt-0.5">Manage annual maintenance contracts with suppliers</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm"
        >
          <Plus className="w-4 h-4" />
          New Contract
        </button>
      </div>

      {/* Search */}
      <div className="glass-card rounded-2xl p-4">
        <form onSubmit={handleSearch} className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search by contract#, supplier..."
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
                <th className="text-left py-3 px-3 text-gray-400 font-medium">Contract #</th>
                <th className="text-left py-3 px-3 text-gray-400 font-medium">Supplier</th>
                <th className="text-left py-3 px-3 text-gray-400 font-medium">Equipment Type</th>
                <th className="text-left py-3 px-3 text-gray-400 font-medium">Start Date</th>
                <th className="text-left py-3 px-3 text-gray-400 font-medium">End Date</th>
                <th className="text-center py-3 px-3 text-gray-400 font-medium">Status</th>
                <th className="text-right py-3 px-3 text-gray-400 font-medium">Contract Value</th>
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
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    No contracts found.
                  </td>
                </tr>
              ) : (
                items.map(item => {
                  const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.draft;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-3 text-white font-mono text-xs">{item.contractNumber}</td>
                      <td className="py-3 px-3 text-gray-300">{item.supplier?.supplierName || '-'}</td>
                      <td className="py-3 px-3 text-gray-300">{item.equipmentType?.typeName || '-'}</td>
                      <td className="py-3 px-3 text-gray-300">{formatDate(item.startDate)}</td>
                      <td className="py-3 px-3 text-gray-300">{formatDate(item.endDate)}</td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                        >
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-gray-300 font-mono">
                        {formatCurrency(item.contractValue)}
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

      {/* Detail Modal */}
      {selectedId && <AmcDetailModal id={selectedId} onClose={() => setSelectedId(null)} />}

      {/* Create Modal */}
      {showCreateModal && <CreateAmcModal onClose={() => setShowCreateModal(false)} />}
    </div>
  );
};

// ── Detail Modal ────────────────────────────────────────────────────────

const AmcDetailModal: React.FC<{ id: string; onClose: () => void }> = ({ id, onClose }) => {
  const { data: amcData, isLoading } = useAmc(id);
  const amc = toRecord(amcData).data as Amc | undefined;

  const activateMutation = useActivateAmc();
  const terminateMutation = useTerminateAmc();

  const [showTerminate, setShowTerminate] = useState(false);
  const [terminateReason, setTerminateReason] = useState('');

  const handleActivate = async () => {
    try {
      await activateMutation.mutateAsync(id);
    } catch {
      // handled by query client
    }
  };

  const handleTerminate = async () => {
    try {
      await terminateMutation.mutateAsync({ id, reason: terminateReason || undefined });
      setShowTerminate(false);
      setTerminateReason('');
    } catch {
      // handled by query client
    }
  };

  const isPending = activateMutation.isPending || terminateMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-card rounded-2xl p-6 w-full max-w-2xl border border-white/10 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Contract Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-5 bg-white/10 rounded animate-pulse" />
            ))}
          </div>
        ) : !amc ? (
          <p className="text-gray-400 text-sm">Contract not found.</p>
        ) : (
          <>
            {/* Status + Contract Number */}
            <div className="flex items-center gap-3 mb-6">
              <span className="text-white font-mono text-lg font-bold">{amc.contractNumber}</span>
              {(() => {
                const statusCfg = STATUS_CONFIG[amc.status] || STATUS_CONFIG.draft;
                return (
                  <span
                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                  >
                    {statusCfg.label}
                  </span>
                );
              })()}
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4 text-gray-400" />
                  <p className="text-xs text-gray-400">Supplier</p>
                </div>
                <p className="text-white font-medium">{amc.supplier?.supplierName || '-'}</p>
                {amc.supplier?.supplierCode && (
                  <p className="text-xs text-gray-500 mt-0.5">{amc.supplier.supplierCode}</p>
                )}
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wrench className="w-4 h-4 text-gray-400" />
                  <p className="text-xs text-gray-400">Equipment Type</p>
                </div>
                <p className="text-white font-medium">{amc.equipmentType?.typeName || '-'}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <p className="text-xs text-gray-400">Contract Period</p>
                </div>
                <p className="text-white font-medium">
                  {formatDate(amc.startDate)} - {formatDate(amc.endDate)}
                </p>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-gray-400" />
                  <p className="text-xs text-gray-400">Contract Value</p>
                </div>
                <p className="text-white font-bold text-lg">{formatCurrency(amc.contractValue)}</p>
              </div>
            </div>

            {/* Additional Details */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-sm text-gray-400">Coverage Type</span>
                <span className="text-sm text-white capitalize">{amc.coverageType.replace(/_/g, ' ')}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-sm text-gray-400">Response Time SLA</span>
                <span className="text-sm text-white">{amc.responseTimeSlaHours} hours</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-sm text-gray-400">PM Frequency</span>
                <span className="text-sm text-white capitalize">{amc.preventiveMaintenanceFrequency}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <span className="text-sm text-gray-400">Includes Spares</span>
                <span className="text-sm text-white">{amc.includesSpares ? 'Yes' : 'No'}</span>
              </div>
              {amc.maxCallouts !== null && (
                <div className="flex items-center justify-between py-2 border-b border-white/5">
                  <span className="text-sm text-gray-400">Max Callouts</span>
                  <span className="text-sm text-white">{amc.maxCallouts}</span>
                </div>
              )}
              {amc.notes && (
                <div className="py-2">
                  <span className="text-sm text-gray-400 block mb-1">Notes</span>
                  <p className="text-sm text-gray-300">{amc.notes}</p>
                </div>
              )}
              {amc.terminationReason && (
                <div className="py-2 bg-red-500/5 rounded-xl p-3 border border-red-500/20">
                  <span className="text-sm text-red-400 block mb-1">Termination Reason</span>
                  <p className="text-sm text-gray-300">{amc.terminationReason}</p>
                </div>
              )}
            </div>

            {/* Terminate Reason Input */}
            {showTerminate && (
              <div className="mb-4 bg-red-500/5 rounded-xl p-4 border border-red-500/20">
                <label className="block text-sm text-red-400 mb-2">Reason for Termination</label>
                <textarea
                  value={terminateReason}
                  onChange={e => setTerminateReason(e.target.value)}
                  placeholder="Enter reason for terminating this contract..."
                  className="input-field w-full py-2 px-3 rounded-xl text-sm"
                  rows={2}
                />
                <div className="flex items-center gap-2 mt-3">
                  <button
                    onClick={handleTerminate}
                    disabled={terminateMutation.isPending}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-red-600 text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    {terminateMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    Confirm Terminate
                  </button>
                  <button
                    onClick={() => {
                      setShowTerminate(false);
                      setTerminateReason('');
                    }}
                    className="px-4 py-2 rounded-xl text-sm text-gray-300 border border-white/10 hover:bg-white/5"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              {amc.status === 'draft' && (
                <button
                  onClick={handleActivate}
                  disabled={isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {activateMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  Activate Contract
                </button>
              )}
              {amc.status === 'active' && !showTerminate && (
                <button
                  onClick={() => setShowTerminate(true)}
                  disabled={isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-red-400 border border-red-500/30 hover:bg-red-500/10 disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  Terminate
                </button>
              )}
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm text-gray-300 border border-white/10 hover:bg-white/5"
              >
                Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ── Create Modal ────────────────────────────────────────────────────────

const CreateAmcModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const createMutation = useCreateAmc();

  const [form, setForm] = useState({
    supplierId: '',
    equipmentTypeId: '',
    startDate: '',
    endDate: '',
    contractValue: '',
    coverageType: 'comprehensive' as 'comprehensive' | 'parts_only' | 'labor_only',
    responseTimeSlaHours: '24',
    preventiveMaintenanceFrequency: 'monthly' as 'weekly' | 'monthly' | 'quarterly' | 'yearly',
    includesSpares: false,
    maxCallouts: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.supplierId || !form.equipmentTypeId || !form.startDate || !form.endDate || !form.contractValue) return;

    await createMutation.mutateAsync({
      supplierId: form.supplierId,
      equipmentTypeId: form.equipmentTypeId,
      startDate: form.startDate,
      endDate: form.endDate,
      contractValue: Number(form.contractValue),
      coverageType: form.coverageType,
      responseTimeSlaHours: Number(form.responseTimeSlaHours),
      preventiveMaintenanceFrequency: form.preventiveMaintenanceFrequency,
      includesSpares: form.includesSpares,
      ...(form.maxCallouts && { maxCallouts: Number(form.maxCallouts) }),
      ...(form.notes && { notes: form.notes }),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-card rounded-2xl p-6 w-full max-w-2xl border border-white/10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">New Maintenance Contract</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Supplier</label>
              <input
                type="text"
                value={form.supplierId}
                onChange={e => setForm(f => ({ ...f, supplierId: e.target.value }))}
                placeholder="Supplier ID"
                className="input-field w-full py-2 px-3 rounded-xl text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Equipment Type</label>
              <input
                type="text"
                value={form.equipmentTypeId}
                onChange={e => setForm(f => ({ ...f, equipmentTypeId: e.target.value }))}
                placeholder="Equipment Type ID"
                className="input-field w-full py-2 px-3 rounded-xl text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="input-field w-full py-2 px-3 rounded-xl text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">End Date</label>
              <input
                type="date"
                value={form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className="input-field w-full py-2 px-3 rounded-xl text-sm"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Contract Value (SAR)</label>
              <input
                type="number"
                value={form.contractValue}
                onChange={e => setForm(f => ({ ...f, contractValue: e.target.value }))}
                placeholder="0.00"
                min="0"
                step="0.01"
                className="input-field w-full py-2 px-3 rounded-xl text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Coverage Type</label>
              <select
                value={form.coverageType}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    coverageType: e.target.value as 'comprehensive' | 'parts_only' | 'labor_only',
                  }))
                }
                className="input-field w-full py-2 px-3 rounded-xl text-sm"
              >
                <option value="comprehensive">Comprehensive</option>
                <option value="parts_only">Parts Only</option>
                <option value="labor_only">Labor Only</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Response Time SLA (hours)</label>
              <input
                type="number"
                value={form.responseTimeSlaHours}
                onChange={e => setForm(f => ({ ...f, responseTimeSlaHours: e.target.value }))}
                min="1"
                className="input-field w-full py-2 px-3 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">PM Frequency</label>
              <select
                value={form.preventiveMaintenanceFrequency}
                onChange={e =>
                  setForm(f => ({
                    ...f,
                    preventiveMaintenanceFrequency: e.target.value as 'weekly' | 'monthly' | 'quarterly' | 'yearly',
                  }))
                }
                className="input-field w-full py-2 px-3 rounded-xl text-sm"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Max Callouts (optional)</label>
              <input
                type="number"
                value={form.maxCallouts}
                onChange={e => setForm(f => ({ ...f, maxCallouts: e.target.value }))}
                placeholder="Unlimited"
                min="0"
                className="input-field w-full py-2 px-3 rounded-xl text-sm"
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.includesSpares}
                  onChange={e => setForm(f => ({ ...f, includesSpares: e.target.checked }))}
                  className="rounded border-white/20 bg-white/10 text-nesma-primary focus:ring-nesma-primary/50"
                />
                <span className="text-sm text-gray-300">Includes Spares</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Additional contract notes..."
              className="input-field w-full py-2 px-3 rounded-xl text-sm"
              rows={2}
            />
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
              disabled={
                createMutation.isPending ||
                !form.supplierId ||
                !form.equipmentTypeId ||
                !form.startDate ||
                !form.endDate ||
                !form.contractValue
              }
              className="btn-primary px-4 py-2 rounded-xl text-sm disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Contract'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
