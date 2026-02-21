import React, { useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, Trash2, Loader2 } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'warning';
  loading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  variant = 'danger',
  loading = false,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  // Focus trap + Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        onClose();
        return;
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [loading, onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Auto-focus the cancel button when dialog opens
      requestAnimationFrame(() => {
        const cancel = dialogRef.current?.querySelector<HTMLElement>('button');
        cancel?.focus();
      });
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const isDanger = variant === 'danger';
  const Icon = isDanger ? Trash2 : AlertTriangle;

  const iconColor = isDanger
    ? 'text-red-400 bg-red-500/10 border-red-500/20'
    : 'text-amber-400 bg-amber-500/10 border-amber-500/20';

  const confirmBtnClass = isDanger
    ? 'bg-red-600 hover:bg-red-500 border-red-500/30 hover:shadow-[0_0_20px_rgba(239,68,68,0.2)]'
    : 'bg-amber-600 hover:bg-amber-500 border-amber-500/30 hover:shadow-[0_0_20px_rgba(245,158,11,0.2)]';

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 transition-opacity"
        onClick={() => {
          if (!loading) onClose();
        }}
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
          aria-describedby="confirm-dialog-message"
          className="w-full max-w-md bg-nesma-dark/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl shadow-black/40 animate-fade-in"
          onClick={e => e.stopPropagation()}
        >
          {/* Body */}
          <div className="p-6 text-center">
            {/* Icon */}
            <div className="flex justify-center mb-5">
              <div className={`p-4 rounded-2xl border ${iconColor}`}>
                <Icon size={28} />
              </div>
            </div>

            {/* Title */}
            <h3 id="confirm-dialog-title" className="text-lg font-bold text-white mb-2">
              {title}
            </h3>

            {/* Message */}
            <p id="confirm-dialog-message" className="text-sm text-gray-400 leading-relaxed max-w-sm mx-auto">
              {message}
            </p>
          </div>

          {/* Footer */}
          <div className="flex items-center gap-3 px-6 pb-6">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-5 py-3 text-sm font-medium text-gray-300 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 px-5 py-3 text-sm font-bold text-white border rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${confirmBtnClass}`}
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
