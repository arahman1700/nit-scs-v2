import React, { useState } from 'react';
import { ChevronDown, Check, AlertCircle } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────

export interface FormSectionProps {
  title: string;
  icon?: React.FC<{ size?: number; className?: string }>;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  validationStatus?: 'valid' | 'error' | 'pending';
}

// ── Component ────────────────────────────────────────────────────────────

export const FormSection: React.FC<FormSectionProps> = ({
  title,
  icon: SectionIcon,
  description,
  defaultOpen = true,
  children,
  validationStatus = 'pending',
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="glass-card rounded-2xl overflow-hidden transition-all duration-300">
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-all duration-300 group"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          {/* Validation Indicator */}
          {validationStatus === 'valid' && (
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
              <Check size={14} className="text-emerald-400" />
            </div>
          )}
          {validationStatus === 'error' && (
            <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
              <AlertCircle size={14} className="text-red-400" />
            </div>
          )}
          {validationStatus === 'pending' && SectionIcon && (
            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0">
              <SectionIcon size={14} className="text-gray-400" />
            </div>
          )}
          {validationStatus === 'pending' && !SectionIcon && (
            <span className="w-1 h-6 bg-nesma-secondary rounded-full shadow-[0_0_8px_rgba(128,209,233,0.6)] shrink-0" />
          )}

          <div className="text-left">
            <h3 className="text-lg font-bold text-white group-hover:text-nesma-secondary transition-colors">{title}</h3>
            {description && <p className="text-sm text-gray-400 mt-0.5">{description}</p>}
          </div>
        </div>

        <ChevronDown
          size={20}
          className={`text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Collapsible Content */}
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isOpen ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="p-6 pt-0 border-t border-white/5">{children}</div>
      </div>
    </div>
  );
};
