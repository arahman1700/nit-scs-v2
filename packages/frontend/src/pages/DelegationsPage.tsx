import React, { useState } from 'react';
import {
  ArrowRightLeft,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  AlertCircle,
  Calendar,
  User,
} from 'lucide-react';
import {
  useDelegationList,
  useCreateDelegation,
  useToggleDelegation,
  useDeleteDelegation,
} from '@/api/hooks/useDelegations';
import { useEmployees } from '@/api/hooks/useMasterData';
import { toast } from '@/components/Toaster';
import type { DelegationRule } from '@/api/hooks/useDelegations';

const SCOPE_OPTIONS = [
  { value: 'all', label: 'All Documents' },
  { value: 'mrrv', label: 'MRRV' },
  { value: 'mirv', label: 'MIRV' },
  { value: 'mrv', label: 'MRV' },
  { value: 'rfim', label: 'RFIM' },
  { value: 'osd', label: 'OSD' },
  { value: 'job-order', label: 'Job Orders' },
  { value: 'gate-pass', label: 'Gate Pass' },
  { value: 'stock-transfer', label: 'Stock Transfer' },
  { value: 'mrf', label: 'MRF' },
  { value: 'shipment', label: 'Shipments' },
];

export const DelegationsPage: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [delegateId, setDelegateId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [scope, setScope] = useState('all');
  const [notes, setNotes] = useState('');

  const delegationsQuery = useDelegationList();
  const employeesQuery = useEmployees({ pageSize: 200 });
  const createMutation = useCreateDelegation();
  const toggleMutation = useToggleDelegation();
  const deleteMutation = useDeleteDelegation();

  const delegations = ((delegationsQuery.data as { data?: DelegationRule[] })?.data ?? []) as DelegationRule[];
  const employees = ((employeesQuery.data as unknown as { data?: { id: string; name: string; email?: string }[] })
    ?.data ?? []) as { id: string; name: string; email?: string }[];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!delegateId || !startDate || !endDate) return;

    try {
      await createMutation.mutateAsync({
        delegateId,
        startDate,
        endDate,
        scope,
        notes: notes || undefined,
      });
      toast.success('Delegation created');
      setShowForm(false);
      setDelegateId('');
      setStartDate('');
      setEndDate('');
      setScope('all');
      setNotes('');
    } catch (err) {
      toast.error('Failed to create delegation', (err as Error)?.message || 'Unknown error');
    }
  };

  const handleToggle = async (id: string) => {
    try {
      await toggleMutation.mutateAsync(id);
    } catch (err) {
      toast.error('Failed to toggle delegation', (err as Error)?.message || 'Unknown error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Delegation deleted');
    } catch (err) {
      toast.error('Failed to delete delegation', (err as Error)?.message || 'Unknown error');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const isExpired = (endDate: string) => new Date(endDate) < new Date();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ArrowRightLeft size={20} className="text-nesma-secondary" />
            Delegation Rules
          </h2>
          <p className="text-sm text-gray-400 mt-1">Manage authority delegation for document approvals</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-nesma-primary text-white rounded-lg hover:bg-nesma-accent text-sm transition-all"
        >
          <Plus size={16} />
          New Delegation
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form onSubmit={handleCreate} className="glass-card rounded-xl p-6 border border-nesma-secondary/20 space-y-4">
          <h3 className="text-sm font-semibold text-white">Create Delegation</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Delegate To *</label>
              <select
                value={delegateId}
                onChange={e => setDelegateId(e.target.value)}
                required
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-nesma-secondary/50"
              >
                <option value="">Select employee...</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                    {emp.email ? ` (${emp.email})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Scope</label>
              <select
                value={scope}
                onChange={e => setScope(e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-nesma-secondary/50"
              >
                {SCOPE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Start Date *</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                required
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-nesma-secondary/50"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">End Date *</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                required
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-nesma-secondary/50"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Reason for delegation (optional)"
                rows={2}
                className="w-full bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:border-nesma-secondary/50"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-white/10 rounded-lg hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex items-center gap-2 px-5 py-2 bg-nesma-primary hover:bg-nesma-accent text-white text-sm font-medium rounded-lg disabled:opacity-40 transition-all"
            >
              {createMutation.isPending && <Loader2 size={14} className="animate-spin" />}
              Create
            </button>
          </div>
        </form>
      )}

      {/* Delegation List */}
      {delegationsQuery.isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="text-gray-400 animate-spin" />
        </div>
      ) : delegations.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <ArrowRightLeft size={40} className="mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400">No delegation rules configured</p>
          <p className="text-xs text-gray-500 mt-1">Click "New Delegation" to create one</p>
        </div>
      ) : (
        <div className="space-y-3">
          {delegations.map(d => {
            const expired = isExpired(d.endDate);
            const scopeLabel = SCOPE_OPTIONS.find(o => o.value === d.scope)?.label ?? d.scope;
            return (
              <div
                key={d.id}
                className={`glass-card rounded-xl p-5 border transition-all ${
                  !d.isActive || expired ? 'border-white/5 opacity-60' : 'border-nesma-secondary/20'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Delegator -> Delegate */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <User size={14} className="text-gray-400" />
                        <span className="text-sm font-medium text-white">{d.delegator.fullName}</span>
                      </div>
                      <ArrowRightLeft size={14} className="text-nesma-secondary" />
                      <div className="flex items-center gap-1.5">
                        <User size={14} className="text-nesma-secondary" />
                        <span className="text-sm font-medium text-nesma-secondary">{d.delegate.fullName}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {formatDate(d.startDate)} - {formatDate(d.endDate)}
                      </span>
                      <span className="bg-white/5 px-2 py-0.5 rounded border border-white/10">{scopeLabel}</span>
                      {expired && (
                        <span className="flex items-center gap-1 text-red-400">
                          <AlertCircle size={12} /> Expired
                        </span>
                      )}
                      {!d.isActive && !expired && <span className="text-amber-400">Inactive</span>}
                      {d.isActive && !expired && <span className="text-green-400">Active</span>}
                    </div>
                    {d.notes && <p className="text-xs text-gray-500 mt-2">{d.notes}</p>}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggle(d.id)}
                      disabled={toggleMutation.isPending}
                      className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                      title={d.isActive ? 'Deactivate' : 'Activate'}
                    >
                      {d.isActive ? <ToggleRight size={18} className="text-green-400" /> : <ToggleLeft size={18} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(d.id)}
                      disabled={deleteMutation.isPending}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
