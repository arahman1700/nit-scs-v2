import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, AlertCircle, AlertTriangle } from 'lucide-react';

interface DocumentFormLayoutProps {
  title: string;
  titleEn: string;
  code: string;
  subtitle: string;
  icon: React.FC<{ className?: string; size?: number }>;
  documentNumber: string;
  isEditMode: boolean;
  isEditable: boolean;
  docStatus?: string;
  editableStatuses?: string[];
  submitting: boolean;
  children: React.ReactNode;
  onSubmit: (e: React.FormEvent) => void;
}

export const DocumentFormLayout: React.FC<DocumentFormLayoutProps> = ({
  title,
  titleEn,
  code,
  subtitle,
  icon: FormIcon,
  documentNumber,
  isEditMode,
  isEditable,
  docStatus,
  editableStatuses = [],
  submitting,
  children,
  onSubmit,
}) => {
  const navigate = useNavigate();

  return (
    <div className="max-w-5xl mx-auto pb-10 animate-fade-in">
      {/* Non-editable warning */}
      {isEditMode && !isEditable && (
        <div className="flex items-center gap-3 px-5 py-4 mb-6 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
          <AlertTriangle size={20} className="shrink-0" />
          <div>
            <p className="font-medium">This document cannot be edited</p>
            <p className="text-sm text-amber-400/70">
              Documents with status &quot;{docStatus}&quot; are read-only. Only documents in{' '}
              {editableStatuses.join(' / ')} status can be modified.
            </p>
          </div>
        </div>
      )}

      <div className="glass-card rounded-2xl overflow-hidden shadow-2xl border border-white/10">
        {/* Header */}
        <div className="border-b border-white/10 p-8 bg-gradient-to-r from-nesma-primary/20 to-transparent">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-white mb-1">{title}</h1>
              <p className="text-lg text-gray-400 mb-3">{titleEn}</p>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-mono bg-nesma-secondary/10 text-nesma-secondary border border-nesma-secondary/30 px-2 py-1 rounded">
                  {documentNumber}
                </span>
                <span className="text-[10px] text-gray-500">{subtitle}</span>
                {isEditMode && docStatus && (
                  <span
                    className={`text-xs px-2 py-1 rounded border ${isEditable ? 'bg-green-500/10 text-green-400 border-green-500/30' : 'bg-amber-500/10 text-amber-400 border-amber-500/30'}`}
                  >
                    {docStatus}
                  </span>
                )}
                {!isEditMode && (
                  <span className="text-sm text-gray-400 flex items-center gap-1">
                    <AlertCircle size={14} /> Required fields
                  </span>
                )}
              </div>
            </div>
            <div className="h-14 w-14 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
              <FormIcon className="text-nesma-secondary" size={28} />
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="p-8 space-y-10">
          {children}

          {/* Submit */}
          <div className="pt-8 border-t border-white/10 flex justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-3 border border-white/20 rounded-xl text-gray-300 hover:bg-white/10 hover:text-white font-medium transition-all"
            >
              Cancel
            </button>
            {(!isEditMode || isEditable) && (
              <button
                type="submit"
                disabled={submitting}
                className="px-8 py-3 bg-nesma-primary hover:bg-nesma-accent text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-nesma-primary/30 hover:shadow-nesma-primary/50 transition-all transform hover:-translate-y-1 disabled:opacity-50 disabled:transform-none"
              >
                <Save size={18} />
                {submitting ? 'Saving...' : isEditMode ? `Update ${code}` : 'Save & Submit'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
