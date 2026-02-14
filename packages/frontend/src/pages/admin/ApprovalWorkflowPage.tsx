import React, { useState, useMemo, useCallback } from 'react';
import {
  useApprovalWorkflows,
  useCreateApprovalWorkflow,
  useUpdateApprovalWorkflow,
  useDeleteApprovalWorkflow,
} from '@/api/hooks/useApprovalWorkflows';
import type { ApprovalWorkflow } from '@/api/hooks/useApprovalWorkflows';
import { Shield, Plus, Trash2, Edit2, X, Save } from 'lucide-react';

// ── Constants ───────────────────────────────────────────────────────────

const DOCUMENT_TYPES = [
  { value: 'mirv', label: 'MI - Material Issuance' },
  { value: 'jo', label: 'JO - Job Order' },
  { value: 'mrf', label: 'MR - Material Request' },
  { value: 'mrrv', label: 'GRN - Goods Receipt' },
  { value: 'stock_transfer', label: 'WT - Warehouse Transfer' },
  { value: 'scrap', label: 'Scrap' },
  { value: 'surplus', label: 'Surplus' },
];

const APPROVER_ROLES = [
  { value: 'warehouse_staff', label: 'Warehouse Staff' },
  { value: 'warehouse_supervisor', label: 'Warehouse Supervisor' },
  { value: 'logistics_coordinator', label: 'Logistics Coordinator' },
  { value: 'qc_officer', label: 'QC Officer' },
  { value: 'transport_supervisor', label: 'Transport Supervisor' },
  { value: 'scrap_committee_member', label: 'Scrap Committee' },
  { value: 'manager', label: 'Manager' },
  { value: 'admin', label: 'Admin' },
];

type FormState = {
  id?: string;
  documentType: string;
  minAmount: string;
  maxAmount: string;
  approverRole: string;
  slaHours: string;
};

const EMPTY_FORM: FormState = {
  documentType: '',
  minAmount: '0',
  maxAmount: '',
  approverRole: 'manager',
  slaHours: '24',
};

// ── Helpers ─────────────────────────────────────────────────────────────

function getDocTypeLabel(value: string) {
  return DOCUMENT_TYPES.find(d => d.value === value)?.label ?? value;
}

function getRoleLabel(value: string) {
  return APPROVER_ROLES.find(r => r.value === value)?.label ?? value;
}

function formatAmount(val: number | null) {
  if (val == null) return 'No limit';
  return Number(val).toLocaleString('en-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 });
}

// ── Component ───────────────────────────────────────────────────────────

export function ApprovalWorkflowPage() {
  const { data: allWorkflows, isLoading } = useApprovalWorkflows();
  const createMutation = useCreateApprovalWorkflow();
  const updateMutation = useUpdateApprovalWorkflow();
  const deleteMutation = useDeleteApprovalWorkflow();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  // Group workflows by documentType
  const grouped = useMemo(() => {
    const workflows = (allWorkflows?.data as ApprovalWorkflow[] | undefined) ?? [];
    const map = new Map<string, ApprovalWorkflow[]>();
    for (const wf of workflows) {
      const list = map.get(wf.documentType) ?? [];
      list.push(wf);
      map.set(wf.documentType, list);
    }
    // Sort levels within each group by minAmount
    for (const [, list] of map) {
      list.sort((a, b) => Number(a.minAmount) - Number(b.minAmount));
    }
    // Return in DOCUMENT_TYPES order, only include groups with levels
    // Also include empty groups that exist in DOCUMENT_TYPES for completeness
    return DOCUMENT_TYPES.map(dt => ({
      documentType: dt.value,
      label: dt.label,
      levels: map.get(dt.value) ?? [],
    })).filter(g => g.levels.length > 0);
  }, [allWorkflows?.data]);

  const handleOpenAdd = useCallback((docType?: string) => {
    setForm({ ...EMPTY_FORM, documentType: docType ?? '' });
    setShowForm(true);
  }, []);

  const handleOpenEdit = useCallback((wf: ApprovalWorkflow) => {
    setForm({
      id: wf.id,
      documentType: wf.documentType,
      minAmount: String(Number(wf.minAmount)),
      maxAmount: wf.maxAmount != null ? String(Number(wf.maxAmount)) : '',
      approverRole: wf.approverRole,
      slaHours: String(wf.slaHours),
    });
    setShowForm(true);
  }, []);

  const handleSave = useCallback(async () => {
    const payload = {
      documentType: form.documentType,
      minAmount: Number(form.minAmount) || 0,
      maxAmount: form.maxAmount ? Number(form.maxAmount) : null,
      approverRole: form.approverRole,
      slaHours: Number(form.slaHours) || 24,
    };

    if (form.id) {
      await updateMutation.mutateAsync({ id: form.id, ...payload });
    } else {
      await createMutation.mutateAsync(payload);
    }
    setShowForm(false);
  }, [form, updateMutation, createMutation]);

  const handleDelete = useCallback(
    async (id: string) => {
      if (!window.confirm('Are you sure you want to delete this approval level?')) return;
      await deleteMutation.mutateAsync(id);
    },
    [deleteMutation],
  );

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Shield size={24} className="text-nesma-secondary" />
            <h1 className="text-2xl font-bold text-white">Approval Workflows</h1>
          </div>
          <p className="text-sm text-gray-400 mt-1">
            Configure multi-level approval chains per document type and amount threshold
          </p>
        </div>
        <button onClick={() => handleOpenAdd()} className="btn-primary flex items-center gap-2">
          <Plus size={16} />
          Add Level
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="glass-card rounded-2xl p-6 animate-pulse">
              <div className="h-5 w-48 bg-white/10 rounded mb-4" />
              <div className="h-10 bg-white/10 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && grouped.length === 0 && (
        <div className="glass-card rounded-2xl p-12 text-center">
          <Shield size={32} className="mx-auto mb-3 text-gray-600" />
          <p className="text-gray-400">No approval workflows configured yet.</p>
          <button onClick={() => handleOpenAdd()} className="text-nesma-secondary text-sm hover:underline mt-2">
            Create the first level
          </button>
        </div>
      )}

      {/* Grouped Cards */}
      {grouped.map(group => (
        <div key={group.documentType} className="glass-card rounded-2xl p-6 space-y-4">
          {/* Group Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">{group.label}</h2>
              <p className="text-sm text-gray-400">{group.levels.length} level(s)</p>
            </div>
            <button
              onClick={() => handleOpenAdd(group.documentType)}
              className="px-3 py-1.5 bg-nesma-primary/20 text-nesma-secondary rounded-lg text-xs hover:bg-nesma-primary/30 border border-nesma-primary/30 flex items-center gap-1 transition-colors"
            >
              <Plus size={12} /> Add Level
            </button>
          </div>

          {/* Chain Preview */}
          <div className="flex items-center gap-2 flex-wrap">
            {group.levels.map((level, i) => (
              <React.Fragment key={level.id}>
                {i > 0 && <span className="text-gray-600">&rarr;</span>}
                <span className="text-xs bg-nesma-primary/20 text-nesma-secondary px-3 py-1.5 rounded-lg border border-nesma-primary/30">
                  L{i + 1}: {getRoleLabel(level.approverRole)} ({level.slaHours}h)
                </span>
              </React.Fragment>
            ))}
          </div>

          {/* Level Rows */}
          <div className="space-y-2">
            {group.levels.map((wf, idx) => (
              <div
                key={wf.id}
                className="flex items-center justify-between bg-white/5 rounded-xl px-4 py-3 hover:bg-white/10 transition-all duration-300"
              >
                <div className="flex items-center gap-6 flex-wrap">
                  <span className="text-sm text-gray-400 font-medium w-8">L{idx + 1}</span>
                  <div className="text-sm">
                    <span className="text-gray-400">Range: </span>
                    <span className="text-white">{formatAmount(Number(wf.minAmount))}</span>
                    <span className="text-gray-500 mx-1">&ndash;</span>
                    <span className="text-gray-300">{formatAmount(wf.maxAmount)}</span>
                  </div>
                  <span className="text-xs bg-nesma-primary/20 text-nesma-secondary px-2 py-1 rounded border border-nesma-primary/30">
                    {getRoleLabel(wf.approverRole)}
                  </span>
                  <span className="text-sm text-gray-400">{wf.slaHours}h SLA</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(wf)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-all"
                    aria-label="Edit level"
                  >
                    <Edit2 size={16} className="text-gray-400" />
                  </button>
                  <button
                    onClick={() => handleDelete(wf.id)}
                    disabled={deleteMutation.isPending}
                    className="p-2 hover:bg-red-500/20 rounded-lg transition-all"
                    aria-label="Delete level"
                  >
                    <Trash2 size={16} className="text-red-400" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Modal Form */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
          onClick={() => setShowForm(false)}
        >
          <div
            className="glass-panel rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-5"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-white">
                {form.id ? 'Edit Approval Level' : 'New Approval Level'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-1 hover:bg-white/10 rounded-lg">
                <X size={20} className="text-gray-400" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Document Type */}
              <div>
                <label className="text-sm text-gray-300 block mb-1">Document Type</label>
                <select
                  className="input-field w-full"
                  value={form.documentType}
                  onChange={e => setForm(p => ({ ...p, documentType: e.target.value }))}
                  disabled={!!form.id}
                >
                  <option value="" disabled>
                    Select document type
                  </option>
                  {DOCUMENT_TYPES.map(dt => (
                    <option key={dt.value} value={dt.value}>
                      {dt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount Range */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-300 block mb-1">Min Amount (SAR)</label>
                  <input
                    type="number"
                    className="input-field w-full"
                    value={form.minAmount}
                    onChange={e => setForm(p => ({ ...p, minAmount: e.target.value }))}
                    placeholder="0"
                    min={0}
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-300 block mb-1">Max Amount (SAR)</label>
                  <input
                    type="number"
                    className="input-field w-full"
                    value={form.maxAmount}
                    onChange={e => setForm(p => ({ ...p, maxAmount: e.target.value }))}
                    placeholder="No limit"
                    min={0}
                  />
                </div>
              </div>

              {/* Approver Role */}
              <div>
                <label className="text-sm text-gray-300 block mb-1">Approver Role</label>
                <select
                  className="input-field w-full"
                  value={form.approverRole}
                  onChange={e => setForm(p => ({ ...p, approverRole: e.target.value }))}
                >
                  {APPROVER_ROLES.map(r => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* SLA Hours */}
              <div>
                <label className="text-sm text-gray-300 block mb-1">SLA (hours)</label>
                <input
                  type="number"
                  className="input-field w-full"
                  value={form.slaHours}
                  onChange={e => setForm(p => ({ ...p, slaHours: e.target.value }))}
                  placeholder="24"
                  min={1}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-gray-400 hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !form.documentType}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                <Save size={16} />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
