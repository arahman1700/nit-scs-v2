import React from 'react';
import { Printer } from 'lucide-react';
import { getStatusBgColor } from '@nit-scs-v2/shared/formatters';

interface DocumentHeaderProps {
  documentNumber: string;
  status: string;
  code: string;
  createdBy?: string;
  createdAt?: string;
  onPrint?: () => void;
}

export const DocumentHeader: React.FC<DocumentHeaderProps> = ({
  documentNumber,
  status,
  code,
  createdBy,
  createdAt,
  onPrint,
}) => {
  const formattedDate = createdAt
    ? new Date(createdAt).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Left: Document number + code tag */}
        <div className="flex items-center gap-4">
          {/* Form code tag */}
          <div className="flex-shrink-0 px-3 py-2 bg-nesma-primary/20 border border-nesma-primary/30 rounded-xl">
            <span className="text-xs font-bold text-nesma-secondary tracking-wider uppercase">{code}</span>
          </div>

          <div>
            {/* Document number (large) */}
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide font-mono">{documentNumber}</h2>

            {/* Created by / date */}
            {(createdBy || formattedDate) && (
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                {createdBy && (
                  <>
                    <span>Created by</span>
                    <span className="text-gray-200 font-medium">{createdBy}</span>
                  </>
                )}
                {createdBy && formattedDate && <span className="text-gray-600">|</span>}
                {formattedDate && <span>{formattedDate}</span>}
              </div>
            )}
          </div>
        </div>

        {/* Right: Status badge + print button */}
        <div className="flex items-center gap-3">
          {/* Status badge */}
          <span
            className={`inline-flex items-center px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${getStatusBgColor(status)}`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full mr-2 ${
                status === 'Approved' || status === 'Completed'
                  ? 'bg-emerald-400'
                  : status === 'Rejected' || status === 'Cancelled'
                    ? 'bg-red-400'
                    : status === 'Draft' || status === 'New'
                      ? 'bg-gray-400'
                      : status === 'Issued' || status === 'Inspected'
                        ? 'bg-blue-400'
                        : 'bg-amber-400'
              }`}
            />
            <span
              className={
                status === 'Approved' || status === 'Completed'
                  ? 'text-emerald-400'
                  : status === 'Rejected' || status === 'Cancelled'
                    ? 'text-red-400'
                    : status === 'Draft' || status === 'New'
                      ? 'text-gray-400'
                      : status === 'Issued' || status === 'Inspected'
                        ? 'text-blue-400'
                        : 'text-amber-400'
              }
            >
              {status}
            </span>
          </span>

          {/* Print button */}
          {onPrint && (
            <button
              onClick={onPrint}
              className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all active:scale-95 transform"
              title="Print document"
            >
              <Printer size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
