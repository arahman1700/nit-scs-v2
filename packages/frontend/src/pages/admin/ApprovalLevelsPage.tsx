import React, { useState, useMemo } from 'react';
import { GitBranch, Plus, Trash2, Save, Search, AlertTriangle, ChevronDown } from 'lucide-react';
import {
  useApprovalWorkflows,
  useCreateApprovalWorkflow,
  useUpdateApprovalWorkflow,
  useDeleteApprovalWorkflow,
  useApprovalChainPreview,
} from '@/api/hooks';
import type { ApprovalWorkflow } from '@/api/hooks/useApprovalWorkflows';

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

// ── Component ───────────────────────────────────────────────────────────

export const ApprovalLevelsPage: React.FC = () => {
  const [selectedType, setSelectedType] = useState(DOCUMENT_TYPES[0].value);
  const [previewAmount, setPreviewAmount] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ApprovalWorkflow>>({});
  const [showAddRow, setShowAddRow] = useState(false);
  const [newRow, setNewRow] = useState({
    minAmount: '',
    maxAmount: '',
    approverRole: 'manager',
    slaHours: '24',
  });

  const { data: allWorkflows, isLoading } = useApprovalWorkflows();
  const createMutation = useCreateApprovalWorkflow();
  const updateMutation = useUpdateApprovalWorkflow();
  const deleteMutation = useDeleteApprovalWorkflow();

  const previewAmountNum = Number(previewAmount) || 0;
  const chainPreview = useApprovalChainPreview(selectedType, previewAmountNum);

  // Filter workflows by selected document type
  const filteredWorkflows = useMemo(() => {
    if (!allWorkflows?.data) return [];
    return (allWorkflows.data as ApprovalWorkflow[])
      .filter(w => w.documentType === selectedType)
      .sort((a, b) => Number(a.minAmount) - Number(b.minAmount));
  }, [allWorkflows?.data, selectedType]);

  const selectedLabel = DOCUMENT_TYPES.find(d => d.value === selectedType)?.label ?? selectedType;

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleAdd = () => {
    createMutation.mutate(
      {
        documentType: selectedType,
        minAmount: Number(newRow.minAmount),
        maxAmount: newRow.maxAmount ? Number(newRow.maxAmount) : null,
        approverRole: newRow.approverRole,
        slaHours: Number(newRow.slaHours),
      },
      {
        onSuccess: () => {
          setShowAddRow(false);
          setNewRow({ minAmount: '', maxAmount: '', approverRole: 'manager', slaHours: '24' });
        },
      },
    );
  };

  const handleSaveEdit = () => {
    if (!editingId) return;
    updateMutation.mutate(
      { id: editingId, ...editForm },
      {
        onSuccess: () => {
          setEditingId(null);
          setEditForm({});
        },
      },
    );
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const startEdit = (wf: ApprovalWorkflow) => {
    setEditingId(wf.id);
    setEditForm({
      minAmount: Number(wf.minAmount),
      maxAmount: wf.maxAmount ? Number(wf.maxAmount) : undefined,
      approverRole: wf.approverRole,
      slaHours: wf.slaHours,
    });
  };

  const formatAmount = (val: number | string | null) => {
    if (val == null) return 'No limit';
    return Number(val).toLocaleString('en-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 });
  };

  const getRoleLabel = (role: string) => APPROVER_ROLES.find(r => r.value === role)?.label ?? role;

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Approval Levels</h1>
        <p className="text-sm text-gray-400 mt-1">
          Configure multi-level approval chains per document type and amount threshold
        </p>
      </div>

      {/* Document Type Selector */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="glass-card rounded-xl p-4 flex-1">
          <label className="text-xs text-gray-400 block mb-2">Document Type</label>
          <div className="relative">
            <select
              value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
              className="input-field w-full appearance-none pr-10"
            >
              {DOCUMENT_TYPES.map(dt => (
                <option key={dt.value} value={dt.value}>
                  {dt.label}
                </option>
              ))}
            </select>
            <ChevronDown
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"
            />
          </div>
        </div>

        {/* Chain Preview */}
        <div className="glass-card rounded-xl p-4 flex-1">
          <label className="text-xs text-gray-400 block mb-2">Preview Chain for Amount</label>
          <div className="flex gap-2">
            <input
              type="number"
              value={previewAmount}
              onChange={e => setPreviewAmount(e.target.value)}
              placeholder="Enter amount (SAR)"
              className="input-field flex-1"
            />
            <button className="btn-primary px-3 py-2 flex items-center gap-1">
              <Search size={14} />
            </button>
          </div>
          {previewAmountNum > 0 && chainPreview.data?.data && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              {(
                chainPreview.data.data as { steps: Array<{ level: number; approverRole: string; slaHours: number }> }
              ).steps.map((step, i) => (
                <React.Fragment key={step.level}>
                  {i > 0 && <span className="text-gray-600">→</span>}
                  <span className="text-xs bg-nesma-primary/20 text-nesma-secondary px-2 py-1 rounded border border-nesma-primary/30">
                    L{step.level}: {getRoleLabel(step.approverRole)} ({step.slaHours}h)
                  </span>
                </React.Fragment>
              ))}
              {(chainPreview.data.data as { steps: Array<unknown> }).steps.length === 0 && (
                <span className="text-xs text-amber-400 flex items-center gap-1">
                  <AlertTriangle size={12} /> No matching workflow
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Workflow Table */}
      <div className="glass-card rounded-2xl overflow-hidden border border-white/10">
        <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <GitBranch size={18} className="text-nesma-secondary" />
            <div>
              <h3 className="text-sm font-bold text-white">{selectedLabel}</h3>
              <p className="text-xs text-gray-500">{filteredWorkflows.length} level(s) configured</p>
            </div>
          </div>
          <button
            onClick={() => setShowAddRow(true)}
            className="px-3 py-1.5 bg-nesma-primary/20 text-nesma-secondary rounded-lg text-xs hover:bg-nesma-primary/30 border border-nesma-primary/30 flex items-center gap-1 transition-colors"
          >
            <Plus size={12} /> Add Level
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left p-4 text-nesma-secondary font-medium text-xs uppercase tracking-wider">
                  Level
                </th>
                <th className="text-left p-4 text-nesma-secondary font-medium text-xs uppercase tracking-wider">
                  Min Amount
                </th>
                <th className="text-left p-4 text-nesma-secondary font-medium text-xs uppercase tracking-wider">
                  Max Amount
                </th>
                <th className="text-left p-4 text-nesma-secondary font-medium text-xs uppercase tracking-wider">
                  Approver Role
                </th>
                <th className="text-left p-4 text-nesma-secondary font-medium text-xs uppercase tracking-wider">
                  SLA (hours)
                </th>
                <th className="text-left p-4 text-nesma-secondary font-medium text-xs uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {isLoading && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    Loading...
                  </td>
                </tr>
              )}

              {filteredWorkflows.map((wf, idx) => (
                <tr key={wf.id} className="hover:bg-white/5 transition-colors">
                  {editingId === wf.id ? (
                    <>
                      <td className="p-4 text-gray-300 font-medium">{idx + 1}</td>
                      <td className="p-4">
                        <input
                          type="number"
                          value={editForm.minAmount ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, minAmount: Number(e.target.value) }))}
                          className="input-field w-28"
                        />
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          value={editForm.maxAmount ?? ''}
                          onChange={e =>
                            setEditForm(f => ({ ...f, maxAmount: e.target.value ? Number(e.target.value) : undefined }))
                          }
                          className="input-field w-28"
                          placeholder="No limit"
                        />
                      </td>
                      <td className="p-4">
                        <select
                          value={editForm.approverRole ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, approverRole: e.target.value }))}
                          className="input-field w-40"
                        >
                          {APPROVER_ROLES.map(r => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-4">
                        <input
                          type="number"
                          value={editForm.slaHours ?? ''}
                          onChange={e => setEditForm(f => ({ ...f, slaHours: Number(e.target.value) }))}
                          className="input-field w-20"
                        />
                      </td>
                      <td className="p-4">
                        <div className="flex gap-1">
                          <button
                            onClick={handleSaveEdit}
                            disabled={updateMutation.isPending}
                            className="p-1.5 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                          >
                            <Save size={14} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(null);
                              setEditForm({});
                            }}
                            className="p-1.5 rounded bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="p-4 text-gray-300 font-medium">{idx + 1}</td>
                      <td className="p-4 text-white">{formatAmount(wf.minAmount)}</td>
                      <td className="p-4 text-gray-300">{formatAmount(wf.maxAmount)}</td>
                      <td className="p-4">
                        <span className="text-xs bg-nesma-primary/20 text-nesma-secondary px-2 py-1 rounded border border-nesma-primary/30">
                          {getRoleLabel(wf.approverRole)}
                        </span>
                      </td>
                      <td className="p-4 text-gray-300">{wf.slaHours}h</td>
                      <td className="p-4">
                        <div className="flex gap-1">
                          <button
                            onClick={() => startEdit(wf)}
                            className="p-1.5 rounded bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                            aria-label="Edit level"
                          >
                            <Save size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(wf.id)}
                            disabled={deleteMutation.isPending}
                            className="p-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                            aria-label="Delete level"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}

              {/* Add new row */}
              {showAddRow && (
                <tr className="bg-emerald-500/5">
                  <td className="p-4 text-emerald-400 font-medium">New</td>
                  <td className="p-4">
                    <input
                      type="number"
                      value={newRow.minAmount}
                      onChange={e => setNewRow(r => ({ ...r, minAmount: e.target.value }))}
                      placeholder="0"
                      className="input-field w-28"
                    />
                  </td>
                  <td className="p-4">
                    <input
                      type="number"
                      value={newRow.maxAmount}
                      onChange={e => setNewRow(r => ({ ...r, maxAmount: e.target.value }))}
                      placeholder="No limit"
                      className="input-field w-28"
                    />
                  </td>
                  <td className="p-4">
                    <select
                      value={newRow.approverRole}
                      onChange={e => setNewRow(r => ({ ...r, approverRole: e.target.value }))}
                      className="input-field w-40"
                    >
                      {APPROVER_ROLES.map(r => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-4">
                    <input
                      type="number"
                      value={newRow.slaHours}
                      onChange={e => setNewRow(r => ({ ...r, slaHours: e.target.value }))}
                      className="input-field w-20"
                    />
                  </td>
                  <td className="p-4">
                    <div className="flex gap-1">
                      <button
                        onClick={handleAdd}
                        disabled={createMutation.isPending}
                        className="p-1.5 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                      >
                        <Save size={14} />
                      </button>
                      <button
                        onClick={() => setShowAddRow(false)}
                        className="p-1.5 rounded bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && filteredWorkflows.length === 0 && !showAddRow && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">
                    <GitBranch size={24} className="mx-auto mb-2 text-gray-600" />
                    <p>No approval levels configured for {selectedLabel}</p>
                    <button
                      onClick={() => setShowAddRow(true)}
                      className="text-nesma-secondary text-xs hover:underline mt-2"
                    >
                      Add the first level
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
