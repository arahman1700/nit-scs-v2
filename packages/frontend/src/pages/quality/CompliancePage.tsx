import React, { useState } from 'react';
import {
  ClipboardCheck,
  Search,
  Eye,
  X,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Loader2,
  AlertTriangle,
  Calendar,
  User,
  FileText,
} from 'lucide-react';
import {
  useComplianceChecklistList,
  useComplianceAuditList,
  useComplianceAudit,
  useSubmitAuditResponses,
  useCompleteComplianceAudit,
} from '@/api/hooks';
import type {
  ComplianceChecklist,
  ComplianceAudit,
  ComplianceAuditResponse,
  ComplianceChecklistItem,
} from '@/api/hooks';

// ── Tabs ────────────────────────────────────────────────────────────────────

const TABS = [
  { key: 'checklists', label: 'Checklists' },
  { key: 'audits', label: 'Audits' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

// ── Status Badge ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  in_progress: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  action_required: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  overdue: 'bg-red-500/10 text-red-400 border-red-500/20',
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.draft;
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider border ${style}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ── Response Badge ──────────────────────────────────────────────────────────

const RESPONSE_STYLES: Record<string, { bg: string; icon: React.ReactNode; label: string }> = {
  compliant: {
    bg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    icon: <CheckCircle2 size={14} />,
    label: 'Compliant',
  },
  non_compliant: {
    bg: 'bg-red-500/10 border-red-500/20 text-red-400',
    icon: <XCircle size={14} />,
    label: 'Non-Compliant',
  },
  partial: {
    bg: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    icon: <AlertTriangle size={14} />,
    label: 'Partial',
  },
  not_applicable: {
    bg: 'bg-gray-500/10 border-gray-500/20 text-gray-400',
    icon: <MinusCircle size={14} />,
    label: 'N/A',
  },
};

// ── Audit Detail Modal ──────────────────────────────────────────────────────

interface AuditDetailModalProps {
  auditId: string;
  onClose: () => void;
}

const AuditDetailModal: React.FC<AuditDetailModalProps> = ({ auditId, onClose }) => {
  const { data: auditRes, isLoading } = useComplianceAudit(auditId);
  const submitMutation = useSubmitAuditResponses();
  const completeMutation = useCompleteComplianceAudit();

  const audit = auditRes?.data as ComplianceAudit | undefined;
  const checklistItems = audit?.checklist?.items ?? [];
  const existingResponses = audit?.responses ?? [];

  // Build local response state seeded from existing responses
  const [localResponses, setLocalResponses] = useState<
    Record<string, { response: ComplianceAuditResponse['response']; notes: string }>
  >({});

  // Merge existing + local for display
  function getResponseForItem(itemId: string) {
    if (localResponses[itemId]) return localResponses[itemId];
    const existing = existingResponses.find(r => r.checklistItemId === itemId);
    if (existing) return { response: existing.response, notes: existing.notes ?? '' };
    return null;
  }

  function setItemResponse(itemId: string, response: ComplianceAuditResponse['response']) {
    setLocalResponses(prev => ({
      ...prev,
      [itemId]: { response, notes: prev[itemId]?.notes ?? '' },
    }));
  }

  function setItemNotes(itemId: string, notes: string) {
    setLocalResponses(prev => ({
      ...prev,
      [itemId]: { response: prev[itemId]?.response ?? 'compliant', notes },
    }));
  }

  async function handleSubmitResponses() {
    if (!audit) return;
    const responses = Object.entries(localResponses).map(([checklistItemId, val]) => ({
      checklistItemId,
      response: val.response,
      notes: val.notes || undefined,
    }));
    if (responses.length === 0) return;
    await submitMutation.mutateAsync({ auditId: audit.id, responses });
  }

  async function handleCompleteAudit() {
    if (!audit) return;
    await completeMutation.mutateAsync(audit.id);
  }

  const isEditable = audit?.status === 'draft' || audit?.status === 'in_progress';
  const isSaving = submitMutation.isPending || completeMutation.isPending;
  const allItemsAnswered = checklistItems.every(item => getResponseForItem(item.id) !== null);

  // Score computation
  const answeredCount = checklistItems.filter(item => getResponseForItem(item.id) !== null).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-nesma-dark flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/5 flex-shrink-0">
          <div>
            <h3 className="text-xl font-bold text-white">{audit?.auditNumber ?? 'Audit Detail'}</h3>
            {audit && (
              <div className="flex items-center gap-3 mt-1">
                <StatusBadge status={audit.status} />
                {audit.checklist && <span className="text-xs text-gray-400">{audit.checklist.title}</span>}
                {audit.overallScore !== null && (
                  <span className="text-xs text-nesma-secondary font-medium">Score: {audit.overallScore}%</span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
            </div>
          ) : !audit ? (
            <p className="text-center text-gray-400 py-12">Audit not found.</p>
          ) : (
            <>
              {/* Audit Info Bar */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                    <User size={12} />
                    Auditor
                  </div>
                  <p className="text-sm text-white truncate">{audit.auditor?.fullName ?? '--'}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                    <Calendar size={12} />
                    Audit Date
                  </div>
                  <p className="text-sm text-white">{new Date(audit.auditDate).toLocaleDateString()}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                    <Calendar size={12} />
                    Due Date
                  </div>
                  <p className="text-sm text-white">
                    {audit.dueDate ? new Date(audit.dueDate).toLocaleDateString() : '--'}
                  </p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                    <FileText size={12} />
                    Progress
                  </div>
                  <p className="text-sm text-white">
                    {answeredCount} / {checklistItems.length} items
                  </p>
                </div>
              </div>

              {/* Checklist Items */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Checklist Items</h4>
                {checklistItems.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No checklist items found.</p>
                ) : (
                  checklistItems.map((item: ComplianceChecklistItem, idx: number) => {
                    const current = getResponseForItem(item.id);
                    return (
                      <div key={item.id} className="bg-white/5 rounded-xl border border-white/10 p-4">
                        <div className="flex items-start gap-3">
                          <span className="text-xs text-gray-400 font-mono w-6 text-right mt-0.5 flex-shrink-0">
                            {item.itemNumber ?? idx + 1}.
                          </span>
                          <div className="flex-1 space-y-3">
                            <div className="flex items-start justify-between gap-4">
                              <p className="text-sm text-white">{item.question}</p>
                              {item.weight > 1 && (
                                <span className="text-[10px] text-gray-400 flex-shrink-0">Weight: {item.weight}</span>
                              )}
                            </div>

                            {/* Response buttons */}
                            {isEditable ? (
                              <div className="flex flex-wrap gap-2">
                                {(['compliant', 'non_compliant', 'partial', 'not_applicable'] as const).map(val => {
                                  const s = RESPONSE_STYLES[val];
                                  const isSelected = current?.response === val;
                                  return (
                                    <button
                                      key={val}
                                      onClick={() => setItemResponse(item.id, val)}
                                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                        isSelected
                                          ? `${s.bg} ring-1 ring-current`
                                          : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                      }`}
                                    >
                                      {s.icon}
                                      {s.label}
                                    </button>
                                  );
                                })}
                              </div>
                            ) : current ? (
                              <div>
                                {(() => {
                                  const s = RESPONSE_STYLES[current.response];
                                  return (
                                    <span
                                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${s.bg}`}
                                    >
                                      {s.icon}
                                      {s.label}
                                    </span>
                                  );
                                })()}
                              </div>
                            ) : null}

                            {/* Notes */}
                            {isEditable ? (
                              <input
                                type="text"
                                value={current?.notes ?? ''}
                                onChange={e => setItemNotes(item.id, e.target.value)}
                                placeholder="Notes (optional)..."
                                className="input-field w-full text-xs"
                              />
                            ) : current?.notes ? (
                              <p className="text-xs text-gray-400 italic">{current.notes}</p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Findings & Corrective Actions */}
              {(audit.findings || audit.correctiveActions) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  {audit.findings && (
                    <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                      <h5 className="text-xs text-gray-400 uppercase tracking-wider mb-2">Findings</h5>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap">{audit.findings}</p>
                    </div>
                  )}
                  {audit.correctiveActions && (
                    <div className="bg-white/5 rounded-xl border border-white/10 p-4">
                      <h5 className="text-xs text-gray-400 uppercase tracking-wider mb-2">Corrective Actions</h5>
                      <p className="text-sm text-gray-300 whitespace-pre-wrap">{audit.correctiveActions}</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {audit && isEditable && (
          <div className="p-6 border-t border-white/10 bg-white/5 flex justify-end gap-3 flex-shrink-0">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-transparent hover:bg-white/5 text-gray-300 rounded-xl text-sm font-medium transition-colors border border-white/10"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitResponses}
              disabled={isSaving || Object.keys(localResponses).length === 0}
              className="px-5 py-2.5 bg-nesma-primary hover:bg-nesma-primary/80 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {submitMutation.isPending ? 'Saving...' : 'Save Responses'}
            </button>
            <button
              onClick={handleCompleteAudit}
              disabled={isSaving || !allItemsAnswered}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              title={!allItemsAnswered ? 'All items must be answered before completing' : ''}
            >
              {completeMutation.isPending ? 'Completing...' : 'Complete Audit'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Checklists Tab ──────────────────────────────────────────────────────────

const ChecklistsTab: React.FC = () => {
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');

  const { data: listRes, isLoading } = useComplianceChecklistList({
    ...(search && { search }),
    ...(filterCategory && { category: filterCategory }),
  });

  const checklists = (listRes?.data ?? []) as ComplianceChecklist[];

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative flex-1 w-full md:max-w-sm">
            <Search size={18} className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search checklists..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-nesma-secondary/50 focus:ring-1 focus:ring-nesma-secondary/50 transition-all"
            />
          </div>
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-nesma-secondary/50 cursor-pointer hover:bg-white/5"
          >
            <option value="">All Categories</option>
            <option value="quality">Quality</option>
            <option value="safety">Safety</option>
            <option value="environmental">Environmental</option>
            <option value="operational">Operational</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-white/5 rounded-xl h-16 w-full" />
          ))}
        </div>
      ) : checklists.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
            <ClipboardCheck size={28} className="text-gray-400" />
          </div>
          <p className="text-gray-400">No compliance checklists found</p>
          <p className="text-xs text-gray-400 mt-1">Checklists will appear here once created</p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider bg-white/5">
                  <th className="py-3 px-4 font-medium">Code</th>
                  <th className="py-3 px-4 font-medium">Title</th>
                  <th className="py-3 px-4 font-medium">Standard</th>
                  <th className="py-3 px-4 font-medium">Category</th>
                  <th className="py-3 px-4 font-medium text-center">Items</th>
                  <th className="py-3 px-4 font-medium text-center">Version</th>
                  <th className="py-3 px-4 font-medium text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {checklists.map(cl => (
                  <tr key={cl.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4">
                      <span className="text-sm text-nesma-secondary font-mono font-medium">{cl.checklistCode}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-white">{cl.title}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-sm text-gray-300">{cl.standard}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {cl.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-sm text-gray-300">{cl._count?.items ?? 0}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-xs text-gray-400">v{cl.version}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider border ${
                          cl.isActive
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                        }`}
                      >
                        {cl.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Audits Tab ──────────────────────────────────────────────────────────────

const AuditsTab: React.FC = () => {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);

  const { data: listRes, isLoading } = useComplianceAuditList({
    ...(search && { search }),
  });

  const audits = (listRes?.data ?? []) as ComplianceAudit[];
  const filtered = filterStatus ? audits.filter(a => a.status === filterStatus) : audits;

  // Check overdue
  function getDisplayStatus(audit: ComplianceAudit): string {
    if (audit.status !== 'completed' && audit.dueDate && new Date(audit.dueDate) < new Date()) {
      return 'overdue';
    }
    return audit.status;
  }

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative flex-1 w-full md:max-w-sm">
            <Search size={18} className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search audits..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-nesma-secondary/50 focus:ring-1 focus:ring-nesma-secondary/50 transition-all"
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-nesma-secondary/50 cursor-pointer hover:bg-white/5"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="action_required">Action Required</option>
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-white/5 rounded-xl h-16 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
            <ClipboardCheck size={28} className="text-gray-400" />
          </div>
          <p className="text-gray-400">No audits found</p>
          <p className="text-xs text-gray-400 mt-1">Compliance audits will appear here once scheduled</p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider bg-white/5">
                  <th className="py-3 px-4 font-medium">Audit #</th>
                  <th className="py-3 px-4 font-medium">Checklist</th>
                  <th className="py-3 px-4 font-medium">Auditor</th>
                  <th className="py-3 px-4 font-medium">Scheduled Date</th>
                  <th className="py-3 px-4 font-medium text-center">Status</th>
                  <th className="py-3 px-4 font-medium text-center">Score</th>
                  <th className="py-3 px-4 font-medium text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(audit => {
                  const displayStatus = getDisplayStatus(audit);
                  return (
                    <tr key={audit.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4">
                        <span className="text-sm text-nesma-secondary font-mono font-medium">{audit.auditNumber}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-white">{audit.checklist?.title ?? '--'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-300">{audit.auditor?.fullName ?? '--'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-300">{new Date(audit.auditDate).toLocaleDateString()}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge status={displayStatus} />
                      </td>
                      <td className="py-3 px-4 text-center">
                        {audit.overallScore !== null ? (
                          <span
                            className={`text-sm font-semibold ${
                              audit.overallScore >= 80
                                ? 'text-emerald-400'
                                : audit.overallScore >= 60
                                  ? 'text-amber-400'
                                  : 'text-red-400'
                            }`}
                          >
                            {audit.overallScore}%
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">--</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedAuditId(audit.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-nesma-secondary hover:bg-white/5 transition-colors"
                          title="View audit details"
                          aria-label="View audit details"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedAuditId && <AuditDetailModal auditId={selectedAuditId} onClose={() => setSelectedAuditId(null)} />}
    </div>
  );
};

// ── Main Page ───────────────────────────────────────────────────────────────

export const CompliancePage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('checklists');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-nesma-primary/20 flex items-center justify-center">
          <ClipboardCheck className="w-5 h-5 text-nesma-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Compliance & ISO 9001</h1>
          <p className="text-sm text-gray-400">Manage compliance checklists and audit records</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-xl p-1 w-fit">
        {TABS.map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-nesma-primary text-white shadow-lg shadow-nesma-primary/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'checklists' && <ChecklistsTab />}
      {activeTab === 'audits' && <AuditsTab />}
    </div>
  );
};
