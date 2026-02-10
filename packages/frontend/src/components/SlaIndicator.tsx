import React from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

interface SlaIndicatorProps {
  deadline: string | null | undefined;
  breached?: boolean;
  label?: string;
  compact?: boolean;
}

export const SlaIndicator: React.FC<SlaIndicatorProps> = ({ deadline, breached, label, compact }) => {
  if (!deadline) return null;

  const now = new Date();
  const dl = new Date(deadline);
  const diff = dl.getTime() - now.getTime();
  const hoursLeft = diff / (1000 * 60 * 60);
  const isBreached = breached || diff < 0;

  const formatTimeLeft = () => {
    if (isBreached) {
      const overdue = Math.abs(diff);
      const h = Math.floor(overdue / (1000 * 60 * 60));
      return h > 24 ? `${Math.floor(h / 24)}d overdue` : `${h}h overdue`;
    }
    if (hoursLeft > 24) return `${Math.floor(hoursLeft / 24)}d ${Math.floor(hoursLeft % 24)}h left`;
    if (hoursLeft > 1) return `${Math.floor(hoursLeft)}h ${Math.floor((hoursLeft % 1) * 60)}m left`;
    return `${Math.floor(hoursLeft * 60)}m left`;
  };

  const color = isBreached
    ? 'text-red-400 bg-red-500/10 border-red-500/30'
    : hoursLeft < 24 * 0.25
      ? 'text-amber-400 bg-amber-500/10 border-amber-500/30'
      : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';

  const Icon = isBreached ? AlertTriangle : Clock;

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${color}`}>
        <Icon className="w-3 h-3" />
        {formatTimeLeft()}
      </span>
    );
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${color}`}>
      <Icon className={`w-4 h-4 ${isBreached ? 'animate-pulse' : ''}`} />
      <div>
        {label && <p className="text-xs opacity-70">{label}</p>}
        <p className="text-sm font-medium">{formatTimeLeft()}</p>
      </div>
    </div>
  );
};
