import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

// ── Toast types ─────────────────────────────────────────────────────────────

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

// ── Global toast store (simple event emitter) ───────────────────────────────

type Listener = (toast: Toast) => void;
const listeners = new Set<Listener>();

function emit(toast: Toast) {
  listeners.forEach(fn => fn(toast));
}

/** Show a toast notification from anywhere in the app */
export const toast = {
  success: (title: string, message?: string) =>
    emit({ id: `t-${Date.now()}`, type: 'success', title, message, duration: 4000 }),
  error: (title: string, message?: string) =>
    emit({ id: `t-${Date.now()}`, type: 'error', title, message, duration: 6000 }),
  warning: (title: string, message?: string) =>
    emit({ id: `t-${Date.now()}`, type: 'warning', title, message, duration: 5000 }),
  info: (title: string, message?: string) =>
    emit({ id: `t-${Date.now()}`, type: 'info', title, message, duration: 4000 }),
};

// ── Toast Item ──────────────────────────────────────────────────────────────

const iconMap: Record<ToastType, React.FC<{ size?: number; className?: string }>> = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colorMap: Record<ToastType, string> = {
  success: 'border-emerald-500/40 bg-emerald-500/10',
  error: 'border-red-500/40 bg-red-500/10',
  warning: 'border-amber-500/40 bg-amber-500/10',
  info: 'border-blue-500/40 bg-blue-500/10',
};

const iconColorMap: Record<ToastType, string> = {
  success: 'text-emerald-400',
  error: 'text-red-400',
  warning: 'text-amber-400',
  info: 'text-blue-400',
};

const ToastItem: React.FC<{ toast: Toast; onDismiss: (id: string) => void }> = ({ toast: t, onDismiss }) => {
  const Icon = iconMap[t.type];

  useEffect(() => {
    const timer = setTimeout(() => onDismiss(t.id), t.duration ?? 4000);
    return () => clearTimeout(timer);
  }, [t.id, t.duration, onDismiss]);

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-xl animate-slide-in-right ${colorMap[t.type]}`}
    >
      <Icon size={18} className={`mt-0.5 shrink-0 ${iconColorMap[t.type]}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white">{t.title}</p>
        {t.message && <p className="text-xs text-gray-400 mt-0.5">{t.message}</p>}
      </div>
      <button
        onClick={() => onDismiss(t.id)}
        className="text-gray-500 hover:text-white transition-colors shrink-0"
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  );
};

// ── Toaster Container ───────────────────────────────────────────────────────

export const Toaster: React.FC = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handler: Listener = t => setToasts(prev => [...prev.slice(-4), t]);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-80" aria-live="polite" role="status">
      {toasts.map(t => (
        <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
      ))}
    </div>
  );
};
