
import React from 'react';
import type { StatusHistoryEntry } from '@nit-scs/shared/types';
import { formatRelativeTime, formatDate } from '@nit-scs/shared/formatters';

interface StatusTimelineProps {
  history: StatusHistoryEntry[];
}

function getStatusDotColor(status: string): string {
  if (['Approved', 'Completed', 'Active', 'Pass', 'Resolved', 'Cleared', 'Released', 'Received'].includes(status)) {
    return 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
  }
  if (['Rejected', 'Cancelled', 'Fail', 'Overdue'].includes(status)) {
    return 'bg-red-400 shadow-[0_0_8px_rgba(239,68,68,0.5)]';
  }
  if (['Issued', 'Inspected', 'In Clearance', 'Booked'].includes(status)) {
    return 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]';
  }
  if (['Pending', 'Pending Approval', 'In Progress', 'In Transit', 'At Risk', 'Under Review', 'Pending QC', 'Open'].includes(status)) {
    return 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]';
  }
  return 'bg-gray-400 shadow-[0_0_8px_rgba(156,163,175,0.3)]';
}

function getStatusBadgeClasses(status: string): string {
  if (['Approved', 'Completed', 'Active', 'Pass', 'Resolved', 'Cleared', 'Released', 'Received'].includes(status)) {
    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  }
  if (['Rejected', 'Cancelled', 'Fail', 'Overdue'].includes(status)) {
    return 'bg-red-500/10 text-red-400 border-red-500/20';
  }
  if (['Issued', 'Inspected', 'In Clearance', 'Booked'].includes(status)) {
    return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
  }
  if (['Pending', 'Pending Approval', 'In Progress', 'In Transit', 'At Risk', 'Under Review', 'Pending QC', 'Open'].includes(status)) {
    return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  }
  return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
}

export const StatusTimeline: React.FC<StatusTimelineProps> = ({ history }) => {
  const sorted = [...history].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  if (sorted.length === 0) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white flex items-center gap-3 mb-4">
          <span className="w-1 h-6 bg-nesma-secondary rounded-full shadow-[0_0_8px_rgba(128,209,233,0.6)]" />
          Status History
        </h3>
        <div className="text-center py-8 text-gray-500 text-sm">
          No status history available
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <h3 className="text-lg font-bold text-white flex items-center gap-3 mb-6">
        <span className="w-1 h-6 bg-nesma-secondary rounded-full shadow-[0_0_8px_rgba(128,209,233,0.6)]" />
        Status History
        <span className="text-sm font-normal text-gray-400">({sorted.length} entries)</span>
      </h3>

      <div className="relative">
        {sorted.map((entry, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === sorted.length - 1;

          return (
            <div key={entry.id} className="relative flex gap-4 group">
              {/* Vertical line */}
              <div className="flex flex-col items-center">
                <div
                  className={`relative z-10 w-3 h-3 rounded-full flex-shrink-0 mt-1.5 ${getStatusDotColor(entry.status)} ${
                    isFirst ? 'ring-4 ring-white/5' : ''
                  }`}
                />
                {!isLast && (
                  <div className="w-px flex-1 bg-white/10 my-1" />
                )}
              </div>

              {/* Content */}
              <div className={`pb-6 flex-1 ${isFirst ? '' : 'opacity-75 group-hover:opacity-100 transition-opacity'}`}>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <span
                    className={`inline-flex items-center self-start px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusBadgeClasses(entry.status)}`}
                  >
                    {entry.status}
                  </span>

                  {entry.action && (
                    <span className="text-xs text-gray-500 font-medium">
                      {entry.action}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-sm text-gray-200 font-medium">{entry.userName}</span>
                  <span className="text-gray-600">-</span>
                  <span className="text-xs text-gray-500" title={formatDate(entry.timestamp)}>
                    {formatRelativeTime(entry.timestamp)}
                  </span>
                </div>

                {entry.notes && (
                  <div className="mt-2 text-xs text-gray-400 bg-white/5 border border-white/5 rounded-lg px-3 py-2 leading-relaxed">
                    {entry.notes}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
