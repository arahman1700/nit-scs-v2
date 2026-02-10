import React, { memo } from 'react';

const STATUS_COLORS: Record<string, string> = {
  // Green — success/complete
  approved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  delivered: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  cleared: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  in_stock: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  pass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  resolved: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  on_track: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  stored: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  received: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  closed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  // Amber — pending/in-progress
  pending: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  pending_approval: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  pending_qc: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  in_progress: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  in_transit: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  assigning: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low_stock: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  conditional: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  open: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  at_risk: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  under_review: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  partially_issued: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  // Red — rejected/cancelled
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
  out_of_stock: 'bg-red-500/20 text-red-400 border-red-500/30',
  overdue: 'bg-red-500/20 text-red-400 border-red-500/30',
  fail: 'bg-red-500/20 text-red-400 border-red-500/30',
  // Blue — informational
  issued: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  customs_clearance: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  inspected: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  shipped: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  qc_approved: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  // Gray — draft/new
  draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  new: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

function formatLabel(status: string): string {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export const StatusBadge: React.FC<{ status: string }> = memo(({ status }) => {
  const key = status.toLowerCase().replace(/\s+/g, '_');
  const colorClass = STATUS_COLORS[key] ?? 'bg-gray-500/20 text-gray-300 border-gray-500/50';
  const label = formatLabel(status);

  return (
    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${colorClass} backdrop-blur-sm`}>{label}</span>
  );
});
