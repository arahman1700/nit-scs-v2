import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Mail, X, Plus, Trash2, Loader2 } from 'lucide-react';
import type { SavedReport, ScheduleFrequency } from '@/domains/reporting/hooks/useSavedReports';
import { useScheduleReport } from '@/domains/reporting/hooks/useSavedReports';

// ── Types ────────────────────────────────────────────────────────────────────

interface ReportScheduleModalProps {
  report: SavedReport;
  onClose: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const FREQUENCY_OPTIONS: { value: ScheduleFrequency | ''; label: string; description: string }[] = [
  { value: '', label: 'No Schedule', description: 'Run manually only' },
  { value: 'daily', label: 'Daily', description: 'Runs every 24 hours' },
  { value: 'weekly', label: 'Weekly', description: 'Runs every 7 days' },
  { value: 'monthly', label: 'Monthly', description: 'Runs on the same day each month' },
  { value: 'quarterly', label: 'Quarterly', description: 'Runs every 3 months' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcNextRunAt(frequency: ScheduleFrequency | ''): Date | null {
  if (!frequency) return null;
  const now = new Date();
  switch (frequency) {
    case 'daily':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case 'weekly':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case 'monthly': {
      const d = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
      return d;
    }
    case 'quarterly': {
      const d = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
      return d;
    }
    default:
      return null;
  }
}

function formatNextRun(date: Date | null): string {
  if (!date) return '—';
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// ── Component ─────────────────────────────────────────────────────────────────

export const ReportScheduleModal: React.FC<ReportScheduleModalProps> = ({ report, onClose }) => {
  const [frequency, setFrequency] = useState<ScheduleFrequency | ''>(report.scheduleFrequency ?? '');
  const [recipients, setRecipients] = useState<string[]>(report.scheduleRecipients ?? []);
  const [emailInput, setEmailInput] = useState('');
  const [emailError, setEmailError] = useState('');

  const scheduleReport = useScheduleReport();
  const nextRun = calcNextRunAt(frequency);

  // Reset email error on input change
  useEffect(() => {
    setEmailError('');
  }, [emailInput]);

  const handleAddEmail = () => {
    const trimmed = emailInput.trim();
    if (!trimmed) return;
    if (!isValidEmail(trimmed)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    if (recipients.includes(trimmed)) {
      setEmailError('This email is already added');
      return;
    }
    setRecipients(prev => [...prev, trimmed]);
    setEmailInput('');
  };

  const handleRemoveEmail = (email: string) => {
    setRecipients(prev => prev.filter(r => r !== email));
  };

  const handleEmailKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddEmail();
    }
  };

  const handleSave = async () => {
    await scheduleReport.mutateAsync({
      id: report.id,
      scheduleFrequency: frequency || null,
      scheduleRecipients: recipients,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="bg-white/5 backdrop-blur-[24px] border border-white/10 rounded-2xl shadow-2xl
          w-full max-w-lg mx-4 overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-nesma-primary/20">
              <Calendar size={18} className="text-nesma-secondary" />
            </div>
            <div>
              <h2 id="schedule-modal-title" className="text-sm font-semibold text-white">
                Schedule Report
              </h2>
              <p className="text-xs text-gray-400 truncate max-w-[260px]">{report.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
            aria-label="Close schedule modal"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-6">
          {/* Frequency selector */}
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">Frequency</label>
            <div className="space-y-2">
              {FREQUENCY_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFrequency(opt.value)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border
                    transition-all duration-200 text-left ${
                      frequency === opt.value
                        ? 'bg-nesma-primary/20 border-nesma-primary/50 text-white'
                        : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/20'
                    }`}
                >
                  <div>
                    <span className="text-sm font-medium">{opt.label}</span>
                    <p className="text-xs text-gray-400 mt-0.5">{opt.description}</p>
                  </div>
                  {frequency === opt.value && <div className="w-2 h-2 rounded-full bg-nesma-secondary flex-shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          {/* Next run preview */}
          {frequency && (
            <div className="flex items-center gap-3 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
              <Clock size={16} className="text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-emerald-400 font-medium">Next scheduled run</p>
                <p className="text-sm text-white">{formatNextRun(nextRun)}</p>
              </div>
            </div>
          )}

          {/* Recipients */}
          <div>
            <label className="block text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">
              <span className="flex items-center gap-1.5">
                <Mail size={12} />
                Email Recipients
              </span>
            </label>

            {/* Email input */}
            <div className="flex gap-2 mb-3">
              <input
                type="email"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                onKeyDown={handleEmailKeyDown}
                placeholder="user@example.com"
                className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white
                  placeholder:text-gray-500 focus:outline-none focus:border-nesma-secondary/50 transition-colors"
              />
              <button
                onClick={handleAddEmail}
                disabled={!emailInput.trim()}
                className="flex items-center gap-1.5 px-3 py-2 bg-nesma-primary/20 border border-nesma-primary/30
                  text-nesma-secondary text-sm rounded-lg hover:bg-nesma-primary/40 transition-colors
                  disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Add recipient email"
              >
                <Plus size={14} />
                Add
              </button>
            </div>

            {emailError && <p className="text-xs text-red-400 mb-2">{emailError}</p>}

            {/* Recipient list */}
            {recipients.length > 0 ? (
              <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                {recipients.map(email => (
                  <li
                    key={email}
                    className="flex items-center justify-between px-3 py-2 bg-white/5 border border-white/10
                      rounded-lg group"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Mail size={12} className="text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-300 truncate">{email}</span>
                    </div>
                    <button
                      onClick={() => handleRemoveEmail(email)}
                      className="p-1 rounded-md text-gray-500 hover:text-red-400 hover:bg-red-500/10
                        opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 ml-2"
                      aria-label={`Remove ${email}`}
                    >
                      <Trash2 size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-500 px-1">
                No recipients added. Report will run silently without notifications.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={scheduleReport.isPending}
            className="flex items-center gap-2 px-5 py-2 bg-nesma-primary hover:bg-nesma-primary/80
              text-white text-sm font-medium rounded-lg transition-all duration-300
              shadow-lg shadow-nesma-primary/20 disabled:opacity-50"
          >
            {scheduleReport.isPending ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Calendar size={14} />
                Save Schedule
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
