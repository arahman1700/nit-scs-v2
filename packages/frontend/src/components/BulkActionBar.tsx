import React, { useState, useCallback } from 'react';
import { CheckSquare, X, Download, AlertTriangle, Loader2 } from 'lucide-react';
import { useBulkActions, useExecuteBulkAction } from '@/api/hooks/useBulkActions';
import type { BulkActionResponse } from '@/api/hooks/useBulkActions';

interface BulkActionBarProps {
  selectedIds: Set<string>;
  entityType: string;
  rows: Record<string, unknown>[];
  onClearSelection: () => void;
}

const ACTION_LABELS: Record<string, string> = {
  submit: 'Submit',
  approve: 'Approve',
  reject: 'Reject',
  cancel: 'Cancel',
  delete: 'Delete',
  archive: 'Archive',
  complete: 'Complete',
  close: 'Close',
  reopen: 'Reopen',
};

const DESTRUCTIVE_ACTIONS = new Set(['cancel', 'reject', 'delete']);

export const BulkActionBar: React.FC<BulkActionBarProps> = ({ selectedIds, entityType, rows, onClearSelection }) => {
  const { data: actionsData } = useBulkActions(entityType);
  const executeBulk = useExecuteBulkAction();

  const [confirmAction, setConfirmAction] = useState<string | null>(null);
  const [result, setResult] = useState<BulkActionResponse | null>(null);

  const actions: string[] = (actionsData as unknown as { data?: { actions?: string[] } })?.data?.actions ?? [];
  const ids = Array.from(selectedIds);

  const handleExecute = useCallback(
    async (action: string) => {
      setConfirmAction(null);
      setResult(null);
      try {
        const res = await executeBulk.mutateAsync({
          documentType: entityType,
          action,
          ids,
        });
        const bulkResult =
          (res as unknown as { data?: BulkActionResponse })?.data ?? (res as unknown as BulkActionResponse);
        setResult(bulkResult);
        setTimeout(() => setResult(null), 4000);
      } catch {
        setResult({
          documentType: entityType,
          action,
          total: ids.length,
          succeeded: 0,
          failed: ids.length,
          results: [],
        });
        setTimeout(() => setResult(null), 4000);
      }
    },
    [entityType, ids, executeBulk],
  );

  const handleActionClick = useCallback(
    (action: string) => {
      if (DESTRUCTIVE_ACTIONS.has(action)) {
        setConfirmAction(action);
      } else {
        handleExecute(action);
      }
    },
    [handleExecute],
  );

  const exportCsv = useCallback(() => {
    const selected = rows.filter(r => selectedIds.has(r.id as string));
    if (selected.length === 0) return;

    const headers = Object.keys(selected[0]);
    const csvRows = [
      headers.join(','),
      ...selected.map(row =>
        headers
          .map(h => {
            const val = row[h];
            const str = val == null ? '' : String(val);
            return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str;
          })
          .join(','),
      ),
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entityType}-export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [rows, selectedIds, entityType]);

  if (selectedIds.size === 0) return null;

  return (
    <>
      {/* Confirmation overlay */}
      {confirmAction && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60">
          <div className="glass-panel rounded-2xl p-6 max-w-md w-full mx-4 border border-white/20 shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
              <h3 className="text-white font-semibold text-lg">
                Confirm {ACTION_LABELS[confirmAction] ?? confirmAction}
              </h3>
            </div>
            <p className="text-gray-300 text-sm mb-6">
              Are you sure you want to {(ACTION_LABELS[confirmAction] ?? confirmAction).toLowerCase()}{' '}
              {selectedIds.size} item{selectedIds.size > 1 ? 's' : ''}? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmAction(null)}
                className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-white/10 transition-all duration-300"
              >
                Cancel
              </button>
              <button
                onClick={() => handleExecute(confirmAction)}
                className="px-4 py-2 rounded-lg text-sm bg-red-500 hover:bg-red-600 text-white transition-all duration-300"
              >
                {ACTION_LABELS[confirmAction] ?? confirmAction} {selectedIds.size} Item{selectedIds.size > 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating bar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 glass-panel rounded-2xl px-6 py-3 border border-white/20 shadow-2xl shadow-black/40 animate-in slide-in-from-bottom-4 duration-300 flex items-center gap-4">
        <div className="flex items-center gap-2 text-white text-sm font-medium whitespace-nowrap">
          <CheckSquare className="w-4 h-4 text-nesma-secondary" />
          <span>
            {selectedIds.size} item{selectedIds.size > 1 ? 's' : ''} selected
          </span>
        </div>

        <div className="w-px h-6 bg-white/20" />

        {/* Action buttons */}
        {actions.map(action => (
          <button
            key={action}
            onClick={() => handleActionClick(action)}
            disabled={executeBulk.isPending}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 whitespace-nowrap ${
              DESTRUCTIVE_ACTIONS.has(action) ? 'text-red-400 hover:bg-red-500/20' : 'text-white hover:bg-white/10'
            } disabled:opacity-50`}
          >
            {ACTION_LABELS[action] ?? action}
          </button>
        ))}

        {/* Export CSV */}
        <button
          onClick={exportCsv}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:bg-white/10 transition-all duration-300 whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>

        <div className="w-px h-6 bg-white/20" />

        {/* Deselect */}
        <button
          onClick={onClearSelection}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-gray-400 hover:bg-white/10 transition-all duration-300 whitespace-nowrap"
        >
          <X className="w-3.5 h-3.5" />
          Deselect All
        </button>

        {/* Loading indicator */}
        {executeBulk.isPending && <Loader2 className="w-4 h-4 text-nesma-secondary animate-spin" />}

        {/* Result message */}
        {result && (
          <span className="text-xs whitespace-nowrap ml-2">
            {result.succeeded > 0 && <span className="text-emerald-400">{result.succeeded} succeeded</span>}
            {result.succeeded > 0 && result.failed > 0 && <span className="text-gray-500"> / </span>}
            {result.failed > 0 && <span className="text-red-400">{result.failed} failed</span>}
          </span>
        )}
      </div>
    </>
  );
};
