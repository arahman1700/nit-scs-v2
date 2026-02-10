import React, { useState } from 'react';
import { CheckCircle, XCircle, Clock, Users, FileText, Send, ChevronDown, ChevronUp } from 'lucide-react';
import { usePendingApprovals, useRespondToApproval } from '@/api/hooks';
import type { ParallelApprovalGroup, ParallelApprovalResponse } from '@/api/hooks';

// ── Helpers ────────────────────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  mi: 'Material Issue',
  mr: 'Material Request',
  jo: 'Job Order',
  grn: 'Goods Receipt Note',
  wt: 'Warehouse Transfer',
  mirv: 'Material Issue (V1)',
  mrf: 'Material Requisition (V1)',
  mrrv: 'Material Receiving (V1)',
};

function docTypeLabel(type: string): string {
  return DOC_TYPE_LABELS[type] || type.toUpperCase();
}

// ── Sub-components ─────────────────────────────────────────────────────────

const ApproverChip: React.FC<{ response: ParallelApprovalResponse }> = ({ response }) => {
  const colorMap: Record<string, string> = {
    approved: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    rejected: 'bg-red-500/10 border-red-500/30 text-red-400',
  };

  const iconMap: Record<string, React.ReactNode> = {
    approved: <CheckCircle size={12} className="text-emerald-400" />,
    rejected: <XCircle size={12} className="text-red-400" />,
  };

  return (
    <div
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${colorMap[response.decision] || 'bg-white/5 border-white/10 text-gray-400'}`}
      title={response.comments || undefined}
    >
      {iconMap[response.decision] || <Clock size={12} />}
      <span className="truncate max-w-[120px]">{response.approver.fullName}</span>
    </div>
  );
};

const ApprovalCard: React.FC<{
  group: ParallelApprovalGroup;
}> = ({ group }) => {
  const [comments, setComments] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const respond = useRespondToApproval();

  const handleDecision = (decision: 'approved' | 'rejected') => {
    respond.mutate(
      { groupId: group.id, decision, comments: comments.trim() || undefined },
      {
        onSuccess: () => {
          setComments('');
          setShowActions(false);
        },
      },
    );
  };

  return (
    <div className="glass-card rounded-2xl p-6 border border-white/10 hover:border-white/20 transition-all">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-nesma-primary/20 border border-nesma-primary/30 flex items-center justify-center shrink-0">
            <FileText size={18} className="text-nesma-primary" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">{docTypeLabel(group.documentType)}</div>
            <div className="text-xs text-gray-500 font-mono truncate">{group.documentId.slice(0, 8)}...</div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
              group.mode === 'all'
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
                : 'bg-purple-500/10 border-purple-500/30 text-purple-400'
            }`}
          >
            <Users size={10} />
            {group.mode === 'all' ? 'All' : 'Any'}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-amber-500/10 border-amber-500/30 text-amber-400">
            Level {group.approvalLevel}
          </span>
        </div>
      </div>

      {/* Other approvers' status */}
      {group.responses.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-300 transition-colors"
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {group.responses.length} response{group.responses.length !== 1 ? 's' : ''} so far
          </button>
          {isExpanded && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {group.responses.map(r => (
                <ApproverChip key={r.id} response={r} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Created timestamp */}
      <div className="mt-3 text-[10px] text-gray-600">
        Created{' '}
        {new Date(group.createdAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>

      {/* Action area */}
      {!showActions ? (
        <div className="mt-4 pt-4 border-t border-white/5 flex gap-2">
          <button
            onClick={() => handleDecision('approved')}
            disabled={respond.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-xl text-sm text-emerald-400 font-medium transition-all disabled:opacity-50"
          >
            <CheckCircle size={16} />
            Quick Approve
          </button>
          <button
            onClick={() => handleDecision('rejected')}
            disabled={respond.isPending}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-sm text-red-400 font-medium transition-all disabled:opacity-50"
          >
            <XCircle size={16} />
            Quick Reject
          </button>
          <button
            onClick={() => setShowActions(true)}
            className="px-3 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-gray-400 transition-all"
            title="Add comments"
          >
            <Send size={16} />
          </button>
        </div>
      ) : (
        <div className="mt-4 pt-4 border-t border-white/5 space-y-3">
          <textarea
            value={comments}
            onChange={e => setComments(e.target.value)}
            placeholder="Add your comments..."
            className="input-field w-full text-sm resize-none"
            rows={3}
            autoFocus
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleDecision('approved')}
              disabled={respond.isPending}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 rounded-xl text-sm text-emerald-400 font-medium transition-all disabled:opacity-50"
            >
              <CheckCircle size={14} />
              Approve
            </button>
            <button
              onClick={() => handleDecision('rejected')}
              disabled={respond.isPending}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-xl text-sm text-red-400 font-medium transition-all disabled:opacity-50"
            >
              <XCircle size={14} />
              Reject
            </button>
            <button
              onClick={() => {
                setShowActions(false);
                setComments('');
              }}
              className="px-3 py-2 text-gray-500 hover:text-gray-300 text-sm transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main Page Component ────────────────────────────────────────────────────

export const PendingApprovalsPage: React.FC = () => {
  const { data, isLoading, error } = usePendingApprovals();
  const groups: ParallelApprovalGroup[] = (data as unknown as { data?: ParallelApprovalGroup[] })?.data ?? [];

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Pending Approvals</h1>
          <p className="text-sm text-gray-400 mt-1">Parallel approval requests awaiting your decision</p>
        </div>
        {groups.length > 0 && (
          <span className="text-sm font-semibold text-white bg-nesma-primary/20 border border-nesma-primary/30 px-3 py-1.5 rounded-full">
            {groups.length} pending
          </span>
        )}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="glass-card rounded-2xl p-10 flex items-center justify-center border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-nesma-secondary border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-400">Loading pending approvals...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="glass-card rounded-2xl p-6 border border-red-500/20">
          <span className="text-sm text-red-400">Failed to load pending approvals. Please try again.</span>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !error && groups.length === 0 && (
        <div className="glass-card rounded-2xl p-10 text-center border border-white/10">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={28} className="text-emerald-400" />
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">All caught up!</h2>
          <p className="text-sm text-gray-400">You have no pending parallel approvals at this time.</p>
        </div>
      )}

      {/* Approval cards */}
      {!isLoading && groups.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {groups.map(group => (
            <ApprovalCard key={group.id} group={group} />
          ))}
        </div>
      )}
    </div>
  );
};
