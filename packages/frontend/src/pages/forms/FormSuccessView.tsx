import React from 'react';
import { CheckCircle } from 'lucide-react';

export interface FormSuccessViewProps {
  isEditMode: boolean;
  id?: string;
  documentNumber?: string | null;
  formCode: string;
  hasLineItems: boolean;
  totalValue: number;
  approvalInfo: { level: string; color: string };
  onReset: () => void;
  onNavigateBack: () => void;
}

export const FormSuccessView: React.FC<FormSuccessViewProps> = ({
  isEditMode,
  id,
  documentNumber,
  formCode: _formCode,
  hasLineItems,
  totalValue,
  approvalInfo,
  onReset,
  onNavigateBack,
}) => {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] glass-card rounded-2xl p-8 text-center animate-fade-in mx-auto max-w-2xl mt-10 border border-green-500/30 bg-gradient-to-b from-green-900/10 to-transparent">
      <div className="w-20 h-20 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mb-6 border border-green-500/50 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
        <CheckCircle size={40} />
      </div>
      <h2 className="text-3xl font-bold text-white mb-2">
        {isEditMode ? 'Document Updated Successfully' : 'Request Submitted Successfully'}
      </h2>
      <p className="text-gray-400 mb-4 max-w-md">
        Document <span className="text-nesma-secondary font-medium font-mono">{isEditMode ? id : documentNumber}</span>{' '}
        has been {isEditMode ? 'updated' : 'created'}.
      </p>
      {hasLineItems && totalValue > 0 && (
        <div className="glass-card px-6 py-3 rounded-xl mb-6">
          <span className="text-gray-400 text-sm">Total Value: </span>
          <span className="text-nesma-secondary font-bold text-xl">{totalValue.toLocaleString()} SAR</span>
          <span className="text-gray-500 text-xs block mt-1">{approvalInfo.level}</span>
        </div>
      )}
      <div className="flex gap-4">
        {!isEditMode && (
          <button
            onClick={onReset}
            className="px-6 py-3 border border-white/20 rounded-xl text-gray-300 hover:bg-white/10 hover:text-white transition-all"
          >
            Submit Another
          </button>
        )}
        <button
          onClick={onNavigateBack}
          className="px-6 py-3 bg-gradient-to-r from-nesma-primary to-nesma-dark border border-nesma-primary/50 text-white rounded-xl hover:shadow-[0_0_20px_rgba(46,49,146,0.4)] transition-all"
        >
          {isEditMode ? 'Back to List' : 'Back to Dashboard'}
        </button>
      </div>
    </div>
  );
};
