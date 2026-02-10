import React, { useState } from 'react';
import { CheckCircle, XCircle, Clock, Users, Send } from 'lucide-react';
import { useDocumentApprovalGroups, useRespondToApproval } from '@/api/hooks';
import type { ParallelApprovalGroup, ParallelApprovalResponse } from '@/api/hooks';

// ── Types ──────────────────────────────────────────────────────────────────

interface ParallelApprovalStatusProps {
  documentType: string;
  documentId: string;
  /** Current user ID — used to show action buttons for pending approvals */
  currentUserId?: string;
}

// ── Sub-components ─────────────────────────────────────────────────────────

const ModeBadge: React.FC<{ mode: 'all' | 'any' }> = ({ mode }) => (
  <span
    className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
      mode === 'all'
        ? 'bg-blue-500/10 border-blue-500/30 text-blue-400'
        : 'bg-purple-500/10 border-purple-500/30 text-purple-400'
    }`}
  >
    <Users size={10} />
    {mode === 'all' ? 'All Must Approve' : 'Any Can Approve'}
  </span>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const colorMap: Record<string, string> = {
    approved: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
    rejected: 'bg-red-500/10 border-red-500/30 text-red-400',
    pending: 'bg-amber-500/10 border-amber-500/30 text-amber-400',
  };

  return (
    <span
      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${colorMap[status] || colorMap.pending}`}
    >
      {status}
    </span>
  );
};

const DecisionIcon: React.FC<{ decision?: string }> = ({ decision }) => {
  if (decision === 'approved') {
    return (
      <div className="w-8 h-8 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.3)]">
        <CheckCircle size={14} className="text-emerald-400" />
      </div>
    );
  }
  if (decision === 'rejected') {
    return (
      <div className="w-8 h-8 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center shadow-[0_0_12px_rgba(239,68,68,0.3)]">
        <XCircle size={14} className="text-red-400" />
      </div>
    );
  }
  // pending
  return (
    <div className="w-8 h-8 rounded-full bg-white/5 border-2 border-white/20 flex items-center justify-center">
      <Clock size={14} className="text-gray-400" />
    </div>
  );
};

const ApproverRow: React.FC<{
  response: ParallelApprovalResponse;
}> = ({ response }) => (
  <div className="flex items-center gap-3 py-2">
    <DecisionIcon decision={response.decision} />
    <div className="flex-1 min-w-0">
      <div className="text-sm font-medium text-white truncate">{response.approver.fullName}</div>
      <div className="text-xs text-gray-500">{response.approver.email}</div>
      {response.comments && (
        <div className="text-xs text-gray-400 italic mt-0.5 line-clamp-2">"{response.comments}"</div>
      )}
    </div>
    <div className="text-right shrink-0">
      <StatusBadge status={response.decision} />
      <div className="text-[10px] text-gray-600 mt-0.5">
        {new Date(response.decidedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </div>
    </div>
  </div>
);

const PendingApproverAction: React.FC<{
  groupId: string;
  onResponded?: () => void;
}> = ({ groupId, onResponded }) => {
  const [comments, setComments] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const respond = useRespondToApproval();

  const handleDecision = (decision: 'approved' | 'rejected') => {
    respond.mutate(
      { groupId, decision, comments: comments.trim() || undefined },
      {
        onSuccess: () => {
          setComments('');
          setIsExpanded(false);
          onResponded?.();
        },
      },
    );
  };

  if (!isExpanded) {
    return (
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/5">
        <button
          onClick={() => {
            setIsExpanded(true);
          }}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-sm text-gray-300 transition-all"
        >
          <Send size={14} />
          Respond to this approval
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-white/5 space-y-3">
      <textarea
        value={comments}
        onChange={e => setComments(e.target.value)}
        placeholder="Add comments (optional)..."
        className="input-field w-full text-sm resize-none"
        rows={2}
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
            setIsExpanded(false);
            setComments('');
          }}
          className="px-3 py-2 text-gray-500 hover:text-gray-300 text-sm transition-all"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

const GroupCard: React.FC<{
  group: ParallelApprovalGroup;
  currentUserId?: string;
}> = ({ group, currentUserId }) => {
  const hasResponded = group.responses.some(r => r.approverId === currentUserId);
  const canAct = group.status === 'pending' && currentUserId && !hasResponded;

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-white">Level {group.approvalLevel}</span>
          <ModeBadge mode={group.mode} />
        </div>
        <StatusBadge status={group.status} />
      </div>

      {/* Responses */}
      <div className="divide-y divide-white/5">
        {group.responses.map(response => (
          <ApproverRow key={response.id} response={response} />
        ))}
      </div>

      {/* No responses yet */}
      {group.responses.length === 0 && <div className="text-center py-4 text-gray-500 text-sm">No responses yet</div>}

      {/* Action buttons for pending */}
      {canAct && <PendingApproverAction groupId={group.id} />}

      {/* Completion timestamp */}
      {group.completedAt && (
        <div className="mt-3 pt-2 border-t border-white/5 text-[10px] text-gray-600 text-right">
          Completed{' '}
          {new Date(group.completedAt).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </div>
      )}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────

export const ParallelApprovalStatus: React.FC<ParallelApprovalStatusProps> = ({
  documentType,
  documentId,
  currentUserId,
}) => {
  const { data, isLoading, error } = useDocumentApprovalGroups(documentType, documentId);
  const groups: ParallelApprovalGroup[] = (data as unknown as { data?: ParallelApprovalGroup[] })?.data ?? [];

  if (isLoading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 border-2 border-nesma-secondary border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-400">Loading parallel approvals...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6">
        <span className="text-sm text-red-400">Failed to load parallel approvals</span>
      </div>
    );
  }

  if (groups.length === 0) {
    return null; // No parallel approval groups for this document
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold text-white flex items-center gap-3">
        <span className="w-1 h-6 bg-nesma-secondary rounded-full shadow-[0_0_8px_rgba(128,209,233,0.6)]" />
        Parallel Approvals
        <span className="text-sm font-normal text-gray-400">
          {groups.length} group{groups.length !== 1 ? 's' : ''}
        </span>
      </h3>

      {groups.map(group => (
        <GroupCard key={group.id} group={group} currentUserId={currentUserId} />
      ))}
    </div>
  );
};
