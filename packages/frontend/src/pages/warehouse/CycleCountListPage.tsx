import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, ClipboardList, Clock, CheckCircle2, XCircle, Play } from 'lucide-react';
import { useCycleCountList, useCreateCycleCount, useWarehouses } from '@/api/hooks';

const STATUS_CONFIG: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  scheduled: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: <Clock className="w-3 h-3" /> },
  in_progress: { bg: 'bg-amber-500/20', text: 'text-amber-400', icon: <Play className="w-3 h-3" /> },
  completed: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', icon: <CheckCircle2 className="w-3 h-3" /> },
  cancelled: { bg: 'bg-red-500/20', text: 'text-red-400', icon: <XCircle className="w-3 h-3" /> },
};

const COUNT_TYPE_LABELS: Record<string, string> = {
  full: 'Full Count',
  abc_based: 'ABC-Based',
  zone: 'Zone Count',
  random: 'Random Sample',
};

export const CycleCountListPage: React.FC = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const params = useMemo(
    () => ({
      page,
      pageSize,
      ...(statusFilter && { status: statusFilter }),
      ...(search && { search }),
    }),
    [page, pageSize, statusFilter, search],
  );

  const { data: listData, isLoading } = useCycleCountList(params);
  const items = listData?.data ?? [];
  const meta = (listData as unknown as Record<string, unknown>)?.meta as
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Cycle Counts</h1>
          <p className="text-sm text-gray-400 mt-1">Physical inventory counting and variance tracking</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm"
        >
          <Plus className="w-4 h-4" />
          New Cycle Count
        </button>
      </div>

      {/* Status KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {['scheduled', 'in_progress', 'completed', 'cancelled'].map(status => {
          const config = STATUS_CONFIG[status];
          const count = items.filter(i => i.status === status).length;
          return (
            <button
              key={status}
              onClick={() => {
                setStatusFilter(statusFilter === status ? '' : status);
                setPage(1);
              }}
              className={`glass-card rounded-2xl p-4 text-left transition-all border ${
                statusFilter === status ? 'border-nesma-primary/50' : 'border-transparent'
              } hover:border-white/10`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-7 h-7 rounded-lg ${config.bg} flex items-center justify-center`}>{config.icon}</div>
                <span className="text-xs text-gray-400 capitalize">{status.replace('_', ' ')}</span>
              </div>
              <div className={`text-xl font-bold ${config.text}`}>{count}</div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex items-center gap-3">
          <form onSubmit={handleSearch} className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search by count number..."
              className="input-field w-full pl-9 pr-3 py-2 text-sm rounded-xl"
            />
          </form>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <select
              value={statusFilter}
              onChange={e => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="input-field pl-9 pr-8 py-2 text-sm rounded-xl appearance-none"
            >
              <option value="">All Statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-2xl p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-3 text-gray-400 font-medium">Count #</th>
                <th className="text-left py-3 px-3 text-gray-400 font-medium">Type</th>
                <th className="text-left py-3 px-3 text-gray-400 font-medium">Warehouse</th>
                <th className="text-left py-3 px-3 text-gray-400 font-medium">Scheduled</th>
                <th className="text-center py-3 px-3 text-gray-400 font-medium">Lines</th>
                <th className="text-center py-3 px-3 text-gray-400 font-medium">Status</th>
                <th className="text-left py-3 px-3 text-gray-400 font-medium">Created By</th>
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
                    <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    No cycle counts found. Create one to get started.
                  </td>
                </tr>
              ) : (
                items.map(item => {
                  const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.scheduled;
                  return (
                    <tr
                      key={item.id}
                      onClick={() => navigate(`/warehouse/cycle-counts/${item.id}`)}
                      className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-3 text-white font-mono text-xs">{item.countNumber}</td>
                      <td className="py-3 px-3 text-gray-300">{COUNT_TYPE_LABELS[item.countType] || item.countType}</td>
                      <td className="py-3 px-3 text-gray-300">{item.warehouse?.warehouseCode || '-'}</td>
                      <td className="py-3 px-3 text-gray-300">
                        {new Date(item.scheduledDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                      <td className="py-3 px-3 text-center text-gray-300">{item._count?.lines ?? 0}</td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusCfg.bg} ${statusCfg.text}`}
                        >
                          {statusCfg.icon}
                          {item.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-gray-400 text-xs">{item.createdBy?.fullName || '-'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
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

      {/* Create Modal */}
      {showCreateModal && <CreateCycleCountModal onClose={() => setShowCreateModal(false)} />}
    </div>
  );
};

// ── Create Modal ──────────────────────────────────────────────────────────

const CreateCycleCountModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const navigate = useNavigate();
  const createMutation = useCreateCycleCount();
  const { data: warehousesData } = useWarehouses();
  const warehouses = (warehousesData?.data ?? []) as unknown as Array<{
    id: string;
    warehouseCode: string;
    warehouseName: string;
  }>;

  const [form, setForm] = useState({
    countType: 'full' as string,
    warehouseId: '',
    scheduledDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.warehouseId) return;

    const result = await createMutation.mutateAsync(form);
    const created = (result as unknown as { data?: { id: string } })?.data;
    if (created?.id) {
      navigate(`/warehouse/cycle-counts/${created.id}`);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-card rounded-2xl p-6 w-full max-w-md border border-white/10">
        <h2 className="text-lg font-semibold text-white mb-4">Create Cycle Count</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Count Type</label>
            <select
              value={form.countType}
              onChange={e => setForm(f => ({ ...f, countType: e.target.value }))}
              className="input-field w-full py-2 px-3 rounded-xl text-sm"
            >
              <option value="full">Full Count</option>
              <option value="abc_based">ABC-Based (Class A)</option>
              <option value="zone">Zone Count</option>
              <option value="random">Random Sample (20%)</option>
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

          <div>
            <label className="block text-sm text-gray-400 mb-1">Scheduled Date</label>
            <input
              type="date"
              value={form.scheduledDate}
              onChange={e => setForm(f => ({ ...f, scheduledDate: e.target.value }))}
              className="input-field w-full py-2 px-3 rounded-xl text-sm"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
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
              disabled={createMutation.isPending || !form.warehouseId}
              className="btn-primary px-4 py-2 rounded-xl text-sm disabled:opacity-50"
            >
              {createMutation.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
