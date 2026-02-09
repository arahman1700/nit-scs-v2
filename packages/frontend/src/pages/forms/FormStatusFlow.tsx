import React from 'react';
import { Shield } from 'lucide-react';

// ── Status Flow Indicator ──────────────────────────────────────────────────

export interface StatusFlowIndicatorProps {
  statusFlow: string[];
  isEditMode: boolean;
  docStatus: string;
}

export const StatusFlowIndicator: React.FC<StatusFlowIndicatorProps> = ({ statusFlow, isEditMode, docStatus }) => {
  if (statusFlow.length === 0) return null;

  return (
    <div className="glass-card rounded-xl p-4 border border-white/10 bg-gradient-to-r from-white/5 to-transparent">
      <p className="text-xs text-gray-500 mb-2">Document Workflow</p>
      <div className="flex items-center gap-2 text-xs flex-wrap">
        {statusFlow.map((s, i, arr) => {
          const isCurrent = isEditMode && s === docStatus;
          return (
            <React.Fragment key={s}>
              <span
                className={`px-2 py-1 rounded ${isCurrent ? 'bg-nesma-secondary/20 text-nesma-secondary border border-nesma-secondary/30 ring-1 ring-nesma-secondary/40' : i === 0 && !isEditMode ? 'bg-nesma-secondary/20 text-nesma-secondary border border-nesma-secondary/30' : 'bg-white/5 text-gray-500 border border-white/10'}`}
              >
                {s}
              </span>
              {i < arr.length - 1 && <span className="text-gray-600">{'\u2192'}</span>}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

// ── Approval Level Indicator ───────────────────────────────────────────────

export interface ApprovalLevelIndicatorProps {
  approvalInfo: { level: string; color: string };
  totalValue: number;
}

export const ApprovalLevelIndicator: React.FC<ApprovalLevelIndicatorProps> = ({ approvalInfo, totalValue }) => {
  return (
    <div className="glass-card rounded-xl p-4 border border-white/10 bg-gradient-to-r from-white/5 to-transparent">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center border border-white/10">
            <Shield size={18} className="text-nesma-secondary" />
          </div>
          <div>
            <span className="text-sm text-gray-400 block">Required Approval Level</span>
            <span className={`text-sm font-medium ${approvalInfo.color}`}>{approvalInfo.level}</span>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xs text-gray-500 block">Total Value</span>
          <span className="text-nesma-secondary font-bold text-lg">{totalValue.toLocaleString()} SAR</span>
        </div>
      </div>
    </div>
  );
};
