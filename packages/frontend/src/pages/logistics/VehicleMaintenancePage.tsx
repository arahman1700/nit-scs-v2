import React, { useState, useMemo } from 'react';
import {
  Truck,
  Plus,
  Search,
  X,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Wrench,
  Calendar,
  DollarSign,
  ClipboardCheck,
} from 'lucide-react';
import {
  useVehicleMaintenanceList,
  useVehicleMaintenance,
  useCreateVehicleMaintenance,
  useCompleteVehicleMaintenance,
  useCancelVehicleMaintenance,
} from '@/api/hooks';
import { toRows, toRecord } from '@/utils/type-helpers';

// ── Types ───────────────────────────────────────────────────────────────

type MaintenanceStatus = 'scheduled' | 'in_progress' | 'completed' | 'overdue' | 'cancelled';

interface VehicleMaintenanceRecord {
  id: string;
  vehicleId: string;
  vehiclePlateNumber?: string;
  maintenanceType: string;
  scheduledDate: string;
  completedDate?: string;
  status: MaintenanceStatus;
  cost?: number;
  workPerformed?: string;
  partsUsed?: string;
  notes?: string;
  vehicle?: { id: string; plateNumber: string; vehicleType: string; make?: string; model?: string };
  createdAt: string;
  updatedAt: string;
}

// ── Status Config ───────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  MaintenanceStatus,
  { bg: string; text: string; border: string; label: string; icon: React.ReactNode }
> = {
  scheduled: {
    bg: 'bg-blue-500/20',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
    label: 'Scheduled',
    icon: <Clock className="w-3 h-3" />,
  },
  in_progress: {
    bg: 'bg-amber-500/20',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
    label: 'In Progress',
    icon: <Wrench className="w-3 h-3" />,
  },
  completed: {
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
    label: 'Completed',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  overdue: {
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    border: 'border-red-500/20',
    label: 'Overdue',
    icon: <AlertTriangle className="w-3 h-3" />,
  },
  cancelled: {
    bg: 'bg-gray-500/20',
    text: 'text-gray-400',
    border: 'border-gray-500/20',
    label: 'Cancelled',
    icon: <XCircle className="w-3 h-3" />,
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

function formatCurrency(value: number | undefined) {
  if (value == null) return '-';
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ── Main Page ───────────────────────────────────────────────────────────

export const VehicleMaintenancePage: React.FC = () => {
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

  const { data: listData, isLoading } = useVehicleMaintenanceList(params);
  const items = toRows<VehicleMaintenanceRecord>(listData?.data);
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
            <Truck className="w-5 h-5 text-nesma-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Vehicle Maintenance</h1>
            <p className="text-sm text-gray-400 mt-0.5">Schedule and track vehicle maintenance activities</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm"
        >
          <Plus className="w-4 h-4" />
          New Maintenance
        </button>
      </div>

      {/* Search */}
      <div className="glass-card rounded-2xl p-4">
        <form onSubmit={handleSearch} className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search by vehicle, type..."
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
                <th className="text-left py-3 px-3 text-gray-400 font-medium">Vehicle</th>
                <th className="text-left py-3 px-3 text-gray-400 font-medium">Maintenance Type</th>
                <th className="text-left py-3 px-3 text-gray-400 font-medium">Scheduled Date</th>
                <th className="text-center py-3 px-3 text-gray-400 font-medium">Status</th>
                <th className="text-right py-3 px-3 text-gray-400 font-medium">Cost</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/5">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="py-3 px-3">
                        <div className="h-4 bg-white/10 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400">
                    <Truck className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    No maintenance records found.
                  </td>
                </tr>
              ) : (
                items.map(item => {
                  const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.scheduled;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-3">
                        <div>
                          <span className="text-white font-medium">
                            {item.vehicle?.plateNumber || item.vehiclePlateNumber || '-'}
                          </span>
                          {item.vehicle?.vehicleType && (
                            <span className="text-xs text-gray-400 ml-2">{item.vehicle.vehicleType}</span>
                          )}
                        </div>
                        {item.vehicle?.make && (
                          <p className="text-xs text-gray-400">
                            {item.vehicle.make} {item.vehicle.model || ''}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-3 text-gray-300 capitalize">{item.maintenanceType.replace(/_/g, ' ')}</td>
                      <td className="py-3 px-3 text-gray-300">{formatDate(item.scheduledDate)}</td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                        >
                          {statusCfg.icon}
                          {statusCfg.label}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-gray-300 font-mono">{formatCurrency(item.cost)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
            <span className="text-xs text-gray-400">
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
      {selectedId && <MaintenanceDetailModal id={selectedId} onClose={() => setSelectedId(null)} />}

      {/* Create Modal */}
      {showCreateModal && <CreateMaintenanceModal onClose={() => setShowCreateModal(false)} />}
    </div>
  );
};

// ── Detail Modal ────────────────────────────────────────────────────────

const MaintenanceDetailModal: React.FC<{ id: string; onClose: () => void }> = ({ id, onClose }) => {
  const { data: maintenanceData, isLoading } = useVehicleMaintenance(id);
  const record = toRecord(maintenanceData).data as VehicleMaintenanceRecord | undefined;

  const completeMutation = useCompleteVehicleMaintenance();
  const cancelMutation = useCancelVehicleMaintenance();

  const [showComplete, setShowComplete] = useState(false);
  const [completeForm, setCompleteForm] = useState({
    workPerformed: '',
    partsUsed: '',
    cost: '',
  });

  const handleComplete = async () => {
    if (!completeForm.workPerformed) return;
    try {
      await completeMutation.mutateAsync({
        id,
        workPerformed: completeForm.workPerformed,
        ...(completeForm.partsUsed && { partsUsed: completeForm.partsUsed }),
        ...(completeForm.cost && { cost: Number(completeForm.cost) }),
      });
      setShowComplete(false);
    } catch {
      // handled by query client
    }
  };

  const handleCancel = async () => {
    try {
      await cancelMutation.mutateAsync(id);
    } catch {
      // handled by query client
    }
  };

  const isPending = completeMutation.isPending || cancelMutation.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-card rounded-2xl p-6 w-full max-w-2xl border border-white/10 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Maintenance Details</h2>
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
        ) : !record ? (
          <p className="text-gray-400 text-sm">Maintenance record not found.</p>
        ) : (
          <>
            {/* Status Badge */}
            <div className="flex items-center gap-3 mb-6">
              {(() => {
                const statusCfg = STATUS_CONFIG[record.status] || STATUS_CONFIG.scheduled;
                return (
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                  >
                    {statusCfg.icon}
                    {statusCfg.label}
                  </span>
                );
              })()}
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Truck className="w-4 h-4 text-gray-400" />
                  <p className="text-xs text-gray-400">Vehicle</p>
                </div>
                <p className="text-white font-medium">
                  {record.vehicle?.plateNumber || record.vehiclePlateNumber || '-'}
                </p>
                {record.vehicle && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {record.vehicle.vehicleType}
                    {record.vehicle.make && ` - ${record.vehicle.make}`}
                    {record.vehicle.model && ` ${record.vehicle.model}`}
                  </p>
                )}
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Wrench className="w-4 h-4 text-gray-400" />
                  <p className="text-xs text-gray-400">Maintenance Type</p>
                </div>
                <p className="text-white font-medium capitalize">{record.maintenanceType.replace(/_/g, ' ')}</p>
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <p className="text-xs text-gray-400">Scheduled Date</p>
                </div>
                <p className="text-white font-medium">{formatDate(record.scheduledDate)}</p>
                {record.completedDate && (
                  <p className="text-xs text-emerald-400 mt-0.5">Completed: {formatDate(record.completedDate)}</p>
                )}
              </div>
              <div className="bg-white/5 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-gray-400" />
                  <p className="text-xs text-gray-400">Cost</p>
                </div>
                <p className="text-white font-bold text-lg">{formatCurrency(record.cost)}</p>
              </div>
            </div>

            {/* Additional Details */}
            <div className="space-y-3 mb-6">
              {record.workPerformed && (
                <div className="py-2 border-b border-white/5">
                  <span className="text-sm text-gray-400 block mb-1">Work Performed</span>
                  <p className="text-sm text-gray-300">{record.workPerformed}</p>
                </div>
              )}
              {record.partsUsed && (
                <div className="py-2 border-b border-white/5">
                  <span className="text-sm text-gray-400 block mb-1">Parts Used</span>
                  <p className="text-sm text-gray-300">{record.partsUsed}</p>
                </div>
              )}
              {record.notes && (
                <div className="py-2">
                  <span className="text-sm text-gray-400 block mb-1">Notes</span>
                  <p className="text-sm text-gray-300">{record.notes}</p>
                </div>
              )}
            </div>

            {/* Complete Form */}
            {showComplete && (
              <div className="mb-4 bg-emerald-500/5 rounded-xl p-4 border border-emerald-500/20">
                <span className="block text-sm text-emerald-400 mb-3 font-medium">Complete Maintenance</span>
                <div className="space-y-3">
                  <div>
                    <label htmlFor="work-performed-field" className="block text-xs text-gray-400 mb-1">
                      Work Performed
                    </label>
                    <textarea
                      id="work-performed-field"
                      value={completeForm.workPerformed}
                      onChange={e => setCompleteForm(f => ({ ...f, workPerformed: e.target.value }))}
                      placeholder="Describe work performed..."
                      className="input-field w-full py-2 px-3 rounded-xl text-sm"
                      rows={2}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="parts-used-field" className="block text-xs text-gray-400 mb-1">
                        Parts Used (optional)
                      </label>
                      <input
                        id="parts-used-field"
                        type="text"
                        value={completeForm.partsUsed}
                        onChange={e => setCompleteForm(f => ({ ...f, partsUsed: e.target.value }))}
                        placeholder="e.g. Oil filter, brake pads"
                        className="input-field w-full py-2 px-3 rounded-xl text-sm"
                      />
                    </div>
                    <div>
                      <label htmlFor="maintenance-cost-field" className="block text-xs text-gray-400 mb-1">
                        Cost (optional)
                      </label>
                      <input
                        id="maintenance-cost-field"
                        type="number"
                        value={completeForm.cost}
                        onChange={e => setCompleteForm(f => ({ ...f, cost: e.target.value }))}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        className="input-field w-full py-2 px-3 rounded-xl text-sm"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={handleComplete}
                      disabled={completeMutation.isPending || !completeForm.workPerformed}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
                    >
                      {completeMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      Confirm Complete
                    </button>
                    <button
                      onClick={() => setShowComplete(false)}
                      className="px-4 py-2 rounded-xl text-sm text-gray-300 border border-white/10 hover:bg-white/5"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
              {(record.status === 'scheduled' || record.status === 'in_progress' || record.status === 'overdue') &&
                !showComplete && (
                  <button
                    onClick={() => setShowComplete(true)}
                    disabled={isPending}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    <ClipboardCheck className="w-4 h-4" />
                    Complete
                  </button>
                )}
              {(record.status === 'scheduled' || record.status === 'in_progress') && (
                <button
                  onClick={handleCancel}
                  disabled={isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm text-red-400 border border-red-500/30 hover:bg-red-500/10 disabled:opacity-50"
                >
                  {cancelMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XCircle className="w-4 h-4" />
                  )}
                  Cancel Maintenance
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

const CreateMaintenanceModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const createMutation = useCreateVehicleMaintenance();

  const [form, setForm] = useState({
    vehicleId: '',
    maintenanceType: 'preventive',
    scheduledDate: '',
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.vehicleId || !form.maintenanceType || !form.scheduledDate) return;

    await createMutation.mutateAsync({
      vehicleId: form.vehicleId,
      maintenanceType: form.maintenanceType,
      scheduledDate: form.scheduledDate,
      ...(form.notes && { notes: form.notes }),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-card rounded-2xl p-6 w-full max-w-lg border border-white/10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Schedule Maintenance</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="vehicle-field" className="block text-sm text-gray-400 mb-1">
              Vehicle
            </label>
            <input
              id="vehicle-field"
              type="text"
              value={form.vehicleId}
              onChange={e => setForm(f => ({ ...f, vehicleId: e.target.value }))}
              placeholder="Vehicle ID"
              className="input-field w-full py-2 px-3 rounded-xl text-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="maintenance-type-field" className="block text-sm text-gray-400 mb-1">
              Maintenance Type
            </label>
            <select
              id="maintenance-type-field"
              value={form.maintenanceType}
              onChange={e => setForm(f => ({ ...f, maintenanceType: e.target.value }))}
              className="input-field w-full py-2 px-3 rounded-xl text-sm"
              required
            >
              <option value="preventive">Preventive</option>
              <option value="corrective">Corrective</option>
              <option value="oil_change">Oil Change</option>
              <option value="tire_replacement">Tire Replacement</option>
              <option value="brake_service">Brake Service</option>
              <option value="engine_overhaul">Engine Overhaul</option>
              <option value="inspection">Inspection</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div>
            <label htmlFor="scheduled-date-field" className="block text-sm text-gray-400 mb-1">
              Scheduled Date
            </label>
            <input
              id="scheduled-date-field"
              type="date"
              value={form.scheduledDate}
              onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))}
              className="input-field w-full py-2 px-3 rounded-xl text-sm"
              required
            />
          </div>

          <div>
            <label htmlFor="maintenance-notes-field" className="block text-sm text-gray-400 mb-1">
              Notes
            </label>
            <textarea
              id="maintenance-notes-field"
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Additional notes..."
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
              disabled={createMutation.isPending || !form.vehicleId || !form.maintenanceType || !form.scheduledDate}
              className="btn-primary px-4 py-2 rounded-xl text-sm disabled:opacity-50"
            >
              {createMutation.isPending ? 'Scheduling...' : 'Schedule Maintenance'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
