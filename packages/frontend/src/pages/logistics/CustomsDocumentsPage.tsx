import React, { useState } from 'react';
import {
  FileText,
  Search,
  Eye,
  X,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Calendar,
  ShieldCheck,
  Package,
} from 'lucide-react';
import {
  useCustomsDocumentList,
  useCustomsDocument,
  useVerifyCustomsDocument,
  useRejectCustomsDocument,
  useDocumentCompleteness,
} from '@/api/hooks';

// ── Status Badge ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  received: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  verified: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
  expired: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.pending;
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider border ${style}`}>
      {status}
    </span>
  );
}

// ── Completeness Card ───────────────────────────────────────────────────────

const CompletenessCard: React.FC<{ shipmentId: string }> = ({ shipmentId }) => {
  const { data: res, isLoading } = useDocumentCompleteness(shipmentId);
  const completeness = res?.data;

  if (isLoading) {
    return (
      <div className="glass-card rounded-2xl p-5 border border-white/10 animate-pulse">
        <div className="h-20 bg-white/5 rounded-xl" />
      </div>
    );
  }

  if (!completeness) return null;

  const pct = completeness.total > 0 ? Math.round((completeness.verified / completeness.total) * 100) : 0;

  return (
    <div className="glass-card rounded-2xl p-5 border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <ShieldCheck size={16} className="text-nesma-secondary" />
          Document Completeness
        </h3>
        <span
          className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
            completeness.isComplete
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          }`}
        >
          {completeness.isComplete ? 'Complete' : 'Incomplete'}
        </span>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-gray-400">
            {completeness.verified} of {completeness.total} verified
          </span>
          <span className="text-xs font-medium text-white">{pct}%</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              completeness.isComplete ? 'bg-emerald-500' : 'bg-nesma-secondary'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="text-center p-2 bg-white/5 rounded-lg border border-white/10">
          <div className="text-lg font-bold text-white">{completeness.total}</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider">Total</div>
        </div>
        <div className="text-center p-2 bg-emerald-500/5 rounded-lg border border-emerald-500/10">
          <div className="text-lg font-bold text-emerald-400">{completeness.verified}</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider">Verified</div>
        </div>
        <div className="text-center p-2 bg-white/5 rounded-lg border border-white/10">
          <div className="text-lg font-bold text-gray-300">{completeness.pending}</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider">Pending</div>
        </div>
        <div className="text-center p-2 bg-red-500/5 rounded-lg border border-red-500/10">
          <div className="text-lg font-bold text-red-400">{completeness.rejected}</div>
          <div className="text-[10px] text-gray-400 uppercase tracking-wider">Rejected</div>
        </div>
      </div>

      {/* Required documents checklist */}
      {completeness.requiredDocuments.length > 0 && (
        <div className="space-y-1.5">
          <h4 className="text-[10px] text-gray-400 uppercase tracking-wider font-semibold mb-2">Required Documents</h4>
          {completeness.requiredDocuments.map((doc, idx) => (
            <div key={idx} className="flex items-center justify-between px-3 py-2 bg-white/[0.03] rounded-lg">
              <div className="flex items-center gap-2">
                {doc.present ? (
                  <CheckCircle2 size={14} className="text-emerald-400" />
                ) : (
                  <AlertTriangle size={14} className="text-amber-400" />
                )}
                <span className="text-xs text-gray-300">{doc.label}</span>
              </div>
              {doc.status && <StatusBadge status={doc.status} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Document Detail Modal ───────────────────────────────────────────────────

interface DocumentDetailModalProps {
  documentId: string;
  onClose: () => void;
}

const DocumentDetailModal: React.FC<DocumentDetailModalProps> = ({ documentId, onClose }) => {
  const { data: docRes, isLoading } = useCustomsDocument(documentId);
  const verifyMutation = useVerifyCustomsDocument();
  const rejectMutation = useRejectCustomsDocument();
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  const doc = docRes?.data;
  const isActioning = verifyMutation.isPending || rejectMutation.isPending;

  async function handleVerify() {
    if (!doc) return;
    await verifyMutation.mutateAsync(doc.id);
    onClose();
  }

  async function handleReject() {
    if (!doc) return;
    await rejectMutation.mutateAsync({ id: doc.id, reason: rejectReason || undefined });
    onClose();
  }

  function getDisplayStatus(status: string, expiryDate: string | null): string {
    if (expiryDate && new Date(expiryDate) < new Date() && status !== 'rejected') {
      return 'expired';
    }
    return status;
  }

  const canVerifyOrReject = doc && (doc.status === 'pending' || doc.status === 'received');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-2xl max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-nesma-dark flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/5 flex-shrink-0">
          <div>
            <h3 className="text-xl font-bold text-white">Document Detail</h3>
            {doc && (
              <div className="flex items-center gap-3 mt-1">
                <StatusBadge status={getDisplayStatus(doc.status, doc.expiryDate)} />
                <span className="text-xs text-gray-400">{doc.documentType}</span>
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
          ) : !doc ? (
            <p className="text-center text-gray-400 py-12">Document not found.</p>
          ) : (
            <>
              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <div className="text-xs text-gray-400 mb-1">Document Type</div>
                  <p className="text-sm text-white font-medium">{doc.documentType}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <div className="text-xs text-gray-400 mb-1">Document Number</div>
                  <p className="text-sm text-white font-mono">{doc.documentNumber ?? '--'}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                    <Package size={12} />
                    Shipment
                  </div>
                  <p className="text-sm text-white">{doc.shipment?.shipmentNumber ?? '--'}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <div className="text-xs text-gray-400 mb-1">Status</div>
                  <StatusBadge status={getDisplayStatus(doc.status, doc.expiryDate)} />
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                    <Calendar size={12} />
                    Issue Date
                  </div>
                  <p className="text-sm text-white">
                    {doc.issueDate ? new Date(doc.issueDate).toLocaleDateString() : '--'}
                  </p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                    <Calendar size={12} />
                    Expiry Date
                  </div>
                  <p
                    className={`text-sm font-medium ${
                      doc.expiryDate && new Date(doc.expiryDate) < new Date() ? 'text-red-400' : 'text-white'
                    }`}
                  >
                    {doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString() : '--'}
                  </p>
                </div>
              </div>

              {/* Verified by info */}
              {doc.verifiedBy && (
                <div className="bg-emerald-500/5 rounded-xl p-3 border border-emerald-500/10">
                  <div className="flex items-center gap-2 text-xs text-emerald-400 mb-1">
                    <CheckCircle2 size={12} />
                    Verified By
                  </div>
                  <p className="text-sm text-white">{doc.verifiedBy.fullName}</p>
                  {doc.verifiedAt && (
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(doc.verifiedAt).toLocaleString()}</p>
                  )}
                </div>
              )}

              {/* Notes */}
              {doc.notes && (
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <div className="text-xs text-gray-400 mb-1">Notes</div>
                  <p className="text-sm text-gray-300 whitespace-pre-wrap">{doc.notes}</p>
                </div>
              )}

              {/* Reject reason input */}
              {showRejectInput && (
                <div className="bg-red-500/5 rounded-xl p-4 border border-red-500/20 space-y-3">
                  <label
                    htmlFor="rejectionReason"
                    className="block text-xs text-red-400 uppercase tracking-wider font-semibold"
                  >
                    Rejection Reason
                  </label>
                  <textarea
                    id="rejectionReason"
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    placeholder="Provide a reason for rejection..."
                    rows={3}
                    className="input-field w-full resize-none"
                  />
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => {
                        setShowRejectInput(false);
                        setRejectReason('');
                      }}
                      className="px-4 py-2 text-xs text-gray-300 hover:bg-white/5 rounded-lg transition-colors border border-white/10"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={isActioning}
                      className="px-4 py-2 text-xs bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                      {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Reject'}
                    </button>
                  </div>
                </div>
              )}

              {/* Completeness card for the shipment */}
              {doc.shipmentId && <CompletenessCard shipmentId={doc.shipmentId} />}
            </>
          )}
        </div>

        {/* Footer with actions */}
        {canVerifyOrReject && !showRejectInput && (
          <div className="p-6 border-t border-white/10 bg-white/5 flex justify-end gap-3 flex-shrink-0">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-transparent hover:bg-white/5 text-gray-300 rounded-xl text-sm font-medium transition-colors border border-white/10"
            >
              Close
            </button>
            <button
              onClick={() => setShowRejectInput(true)}
              disabled={isActioning}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <XCircle size={16} />
              Reject
            </button>
            <button
              onClick={handleVerify}
              disabled={isActioning}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {verifyMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Verify
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main Page ───────────────────────────────────────────────────────────────

export const CustomsDocumentsPage: React.FC = () => {
  const [shipmentFilter, setShipmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);

  // The hook requires shipmentId; use the filter or a placeholder
  const { data: listRes, isLoading } = useCustomsDocumentList({
    shipmentId: shipmentFilter,
    ...(statusFilter && { status: statusFilter }),
  });

  const documents = (listRes?.data ?? []) as Array<{
    id: string;
    shipmentId: string;
    documentType: string;
    documentNumber: string | null;
    issueDate: string | null;
    expiryDate: string | null;
    status: string;
    filePath: string | null;
    notes: string | null;
    createdAt: string;
    shipment?: { id: string; shipmentNumber: string; status: string };
  }>;

  // Client-side search filter
  const filtered = search
    ? documents.filter(
        d =>
          d.documentType.toLowerCase().includes(search.toLowerCase()) ||
          d.documentNumber?.toLowerCase().includes(search.toLowerCase()) ||
          d.shipment?.shipmentNumber?.toLowerCase().includes(search.toLowerCase()),
      )
    : documents;

  function getDisplayStatus(status: string, expiryDate: string | null): string {
    if (expiryDate && new Date(expiryDate) < new Date() && status !== 'rejected') {
      return 'expired';
    }
    return status;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-nesma-primary/20 flex items-center justify-center">
          <FileText className="w-5 h-5 text-nesma-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Customs Documents</h1>
          <p className="text-sm text-gray-400">Track and verify customs documentation for shipments</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <div className="relative flex-1 w-full md:max-w-sm">
            <Search size={18} className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search documents..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-nesma-secondary/50 focus:ring-1 focus:ring-nesma-secondary/50 transition-all"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Shipment ID..."
              value={shipmentFilter}
              onChange={e => setShipmentFilter(e.target.value)}
              className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-nesma-secondary/50 w-44"
            />
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-nesma-secondary/50 cursor-pointer hover:bg-white/5"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="received">Received</option>
              <option value="verified">Verified</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Completeness card - shown when a shipment is selected */}
      {shipmentFilter && <CompletenessCard shipmentId={shipmentFilter} />}

      {/* Table */}
      {!shipmentFilter ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
            <FileText size={28} className="text-gray-400" />
          </div>
          <p className="text-gray-400">Enter a Shipment ID to view documents</p>
          <p className="text-xs text-gray-400 mt-1">Filter by shipment to see associated customs documents</p>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-white/5 rounded-xl h-16 w-full" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
            <FileText size={28} className="text-gray-400" />
          </div>
          <p className="text-gray-400">No customs documents found</p>
          <p className="text-xs text-gray-400 mt-1">No documents match the current filters</p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider bg-white/5">
                  <th className="py-3 px-4 font-medium">Document Type</th>
                  <th className="py-3 px-4 font-medium">Document #</th>
                  <th className="py-3 px-4 font-medium">Shipment</th>
                  <th className="py-3 px-4 font-medium text-center">Status</th>
                  <th className="py-3 px-4 font-medium">Issued</th>
                  <th className="py-3 px-4 font-medium">Expires</th>
                  <th className="py-3 px-4 font-medium text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(doc => {
                  const displayStatus = getDisplayStatus(doc.status, doc.expiryDate);
                  const isExpired = displayStatus === 'expired';
                  return (
                    <tr
                      key={doc.id}
                      className={`hover:bg-white/5 transition-colors ${isExpired ? 'bg-amber-500/[0.03]' : ''}`}
                    >
                      <td className="py-3 px-4">
                        <span className="text-sm text-white font-medium">{doc.documentType}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-nesma-secondary font-mono">{doc.documentNumber ?? '--'}</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-300">{doc.shipment?.shipmentNumber ?? '--'}</span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge status={displayStatus} />
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-sm text-gray-300">
                          {doc.issueDate ? new Date(doc.issueDate).toLocaleDateString() : '--'}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-sm ${isExpired ? 'text-red-400 font-medium' : 'text-gray-300'}`}>
                          {doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString() : '--'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setSelectedDocId(doc.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-nesma-secondary hover:bg-white/5 transition-colors"
                          title="View document details"
                          aria-label="View document details"
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
      {selectedDocId && <DocumentDetailModal documentId={selectedDocId} onClose={() => setSelectedDocId(null)} />}
    </div>
  );
};
