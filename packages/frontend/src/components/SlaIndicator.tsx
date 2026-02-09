import React, { useMemo } from 'react';
import { Clock, AlertTriangle, CheckCircle } from 'lucide-react';

interface SlaIndicatorProps {
  deadline: string | Date; // ISO date string or Date
  completedAt?: string | Date | null; // if already completed
}

export const SlaIndicator: React.FC<SlaIndicatorProps> = ({ deadline, completedAt }) => {
  const { label, color, Icon } = useMemo(() => {
    if (completedAt) {
      const completed = new Date(completedAt);
      const due = new Date(deadline);
      if (completed <= due) {
        return { label: 'On Time', color: 'text-emerald-400', Icon: CheckCircle };
      }
      return { label: 'Late', color: 'text-red-400', Icon: AlertTriangle };
    }

    const now = new Date();
    const due = new Date(deadline);
    const diffMs = due.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffMs < 0) {
      const overHours = Math.abs(diffHours);
      return {
        label: `${overHours}h overdue`,
        color: 'text-red-400',
        Icon: AlertTriangle,
      };
    }

    if (diffHours < 2) {
      return {
        label: diffHours > 0 ? `${diffHours}h ${diffMins}m left` : `${diffMins}m left`,
        color: 'text-amber-400',
        Icon: Clock,
      };
    }

    if (diffHours < 24) {
      return { label: `${diffHours}h left`, color: 'text-amber-400', Icon: Clock };
    }

    const diffDays = Math.floor(diffHours / 24);
    return { label: `${diffDays}d left`, color: 'text-gray-400', Icon: Clock };
  }, [deadline, completedAt]);

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
};
