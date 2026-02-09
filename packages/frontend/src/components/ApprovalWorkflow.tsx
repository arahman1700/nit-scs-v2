import React from 'react';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import type { ApprovalChain, ApprovalStep } from '@nit-scs-v2/shared/types';
import { formatRelativeTime } from '@nit-scs-v2/shared/formatters';

interface ApprovalWorkflowProps {
  chain: ApprovalChain;
  compact?: boolean;
}

const SLAIndicator: React.FC<{ step: ApprovalStep }> = ({ step }) => {
  if (!step.slaDeadline) return null;

  const now = Date.now();
  const deadline = new Date(step.slaDeadline).getTime();
  const remaining = deadline - now;
  const hoursRemaining = Math.max(0, Math.floor(remaining / 3600000));
  const minsRemaining = Math.max(0, Math.floor((remaining % 3600000) / 60000));

  const slaColor =
    step.slaStatus === 'overdue'
      ? 'text-red-400'
      : step.slaStatus === 'at_risk'
        ? 'text-amber-400'
        : 'text-emerald-400';

  const slaBg =
    step.slaStatus === 'overdue'
      ? 'bg-red-500/10'
      : step.slaStatus === 'at_risk'
        ? 'bg-amber-500/10'
        : 'bg-emerald-500/10';

  return (
    <div
      className={`flex items-center gap-1 text-[10px] font-medium ${slaColor} ${slaBg} px-1.5 py-0.5 rounded-full mt-1`}
    >
      {step.slaStatus === 'overdue' ? <AlertTriangle size={10} /> : <Clock size={10} />}
      <span>{step.slaStatus === 'overdue' ? 'Overdue' : `${hoursRemaining}h ${minsRemaining}m`}</span>
    </div>
  );
};

const StepDot: React.FC<{ step: ApprovalStep; compact: boolean }> = ({ step, compact }) => {
  const dotSize = compact ? 'w-8 h-8' : 'w-10 h-10';
  const iconSize = compact ? 14 : 18;

  if (step.status === 'approved') {
    return (
      <div
        className={`${dotSize} rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center shadow-[0_0_12px_rgba(16,185,129,0.3)]`}
      >
        <CheckCircle size={iconSize} className="text-emerald-400" />
      </div>
    );
  }

  if (step.status === 'rejected') {
    return (
      <div
        className={`${dotSize} rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center shadow-[0_0_12px_rgba(239,68,68,0.3)]`}
      >
        <XCircle size={iconSize} className="text-red-400" />
      </div>
    );
  }

  if (step.status === 'current') {
    return (
      <div
        className={`${dotSize} rounded-full bg-nesma-secondary/20 border-2 border-nesma-secondary flex items-center justify-center shadow-[0_0_16px_rgba(128,209,233,0.4)] animate-pulse`}
      >
        <Clock size={iconSize} className="text-nesma-secondary" />
      </div>
    );
  }

  if (step.status === 'skipped') {
    return (
      <div className={`${dotSize} rounded-full bg-white/5 border-2 border-white/20 flex items-center justify-center`}>
        <span className="text-gray-500 text-xs font-bold">--</span>
      </div>
    );
  }

  // pending
  return (
    <div className={`${dotSize} rounded-full bg-white/5 border-2 border-white/10 flex items-center justify-center`}>
      <div className="w-2 h-2 rounded-full bg-gray-500" />
    </div>
  );
};

const ConnectorLine: React.FC<{ prevStatus: ApprovalStep['status']; nextStatus: ApprovalStep['status'] }> = ({
  prevStatus,
}) => {
  const lineColor =
    prevStatus === 'approved' ? 'bg-emerald-500/50' : prevStatus === 'rejected' ? 'bg-red-500/50' : 'bg-white/10';

  return <div className={`flex-1 h-0.5 min-w-[24px] ${lineColor} mx-1`} />;
};

export const ApprovalWorkflow: React.FC<ApprovalWorkflowProps> = ({ chain, compact = false }) => {
  const { steps } = chain;

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {steps.map((step, idx) => (
          <React.Fragment key={step.id}>
            <div
              className="flex flex-col items-center"
              title={`${step.label}: ${step.status}${step.approverName ? ` (${step.approverName})` : ''}`}
            >
              <StepDot step={step} compact />
            </div>
            {idx < steps.length - 1 && <ConnectorLine prevStatus={step.status} nextStatus={steps[idx + 1].status} />}
          </React.Fragment>
        ))}
        {/* Overall status badge */}
        <div
          className={`ml-2 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
            chain.status === 'approved'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : chain.status === 'rejected'
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          }`}
        >
          {chain.status}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-white flex items-center gap-3">
          <span className="w-1 h-6 bg-nesma-secondary rounded-full shadow-[0_0_8px_rgba(128,209,233,0.6)]" />
          Approval Chain
          <span className="text-sm font-normal text-gray-400">
            Level {chain.currentLevel} of {chain.totalLevels}
          </span>
        </h3>
        <div
          className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full border ${
            chain.status === 'approved'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : chain.status === 'rejected'
                ? 'bg-red-500/10 border-red-500/30 text-red-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          }`}
        >
          {chain.status}
        </div>
      </div>

      {/* Steps row */}
      <div className="flex items-start">
        {steps.map((step, idx) => (
          <React.Fragment key={step.id}>
            <div className="flex flex-col items-center min-w-[100px] max-w-[140px]">
              <StepDot step={step} compact={false} />

              {/* Label */}
              <span
                className={`mt-2 text-xs font-semibold text-center leading-tight ${
                  step.status === 'current'
                    ? 'text-nesma-secondary'
                    : step.status === 'approved'
                      ? 'text-emerald-400'
                      : step.status === 'rejected'
                        ? 'text-red-400'
                        : 'text-gray-500'
                }`}
              >
                {step.label}
              </span>

              {/* Approver name */}
              {step.approverName && (
                <span className="text-[10px] text-gray-400 mt-0.5 text-center truncate max-w-full">
                  {step.approverName}
                </span>
              )}

              {/* Timestamp */}
              {step.timestamp && (
                <span className="text-[10px] text-gray-600 mt-0.5">{formatRelativeTime(step.timestamp)}</span>
              )}

              {/* SLA timer (only for current step) */}
              {step.status === 'current' && <SLAIndicator step={step} />}

              {/* Comments */}
              {step.comments && (
                <div className="mt-1.5 text-[10px] text-gray-500 italic text-center line-clamp-2 max-w-[120px]">
                  "{step.comments}"
                </div>
              )}
            </div>

            {idx < steps.length - 1 && (
              <div className="flex items-center pt-5 flex-1">
                <ConnectorLine prevStatus={step.status} nextStatus={steps[idx + 1].status} />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
