import React from 'react';
import { CheckCircle, AlertTriangle, Clock, XCircle } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────

export type CustomsEventStatus = 'verified' | 'hold' | 'pending' | 'rejected' | 'expiring';

export interface CustomsTimelineEvent {
  id: string;
  timestamp: string;
  status: CustomsEventStatus;
  description: string;
  documentType?: string;
  documentNumber?: string;
}

export interface CustomsTimelineProps {
  events: CustomsTimelineEvent[];
  className?: string;
}

// ── Status Config ─────────────────────────────────────────────────────────

interface StatusConfig {
  Icon: React.ComponentType<{ size?: number; className?: string }>;
  iconClass: string;
  lineClass: string;
  label: string;
}

const STATUS_CONFIG: Record<CustomsEventStatus, StatusConfig> = {
  verified: {
    Icon: CheckCircle,
    iconClass: 'text-emerald-400',
    lineClass: 'bg-emerald-500/30',
    label: 'Verified',
  },
  hold: {
    Icon: AlertTriangle,
    iconClass: 'text-amber-400',
    lineClass: 'bg-amber-500/30',
    label: 'Hold Placed',
  },
  expiring: {
    Icon: AlertTriangle,
    iconClass: 'text-amber-400',
    lineClass: 'bg-amber-500/30',
    label: 'Expiring Soon',
  },
  pending: {
    Icon: Clock,
    iconClass: 'text-nesma-secondary',
    lineClass: 'bg-nesma-secondary/20',
    label: 'Pending',
  },
  rejected: {
    Icon: XCircle,
    iconClass: 'text-red-400',
    lineClass: 'bg-red-500/30',
    label: 'Rejected',
  },
};

// ── Helpers ──────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ── Component ────────────────────────────────────────────────────────────

export function CustomsTimeline({ events, className = '' }: CustomsTimelineProps) {
  if (events.length === 0) {
    return (
      <div className={`glass-card rounded-2xl p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-white mb-4">Customs Timeline</h3>
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <Clock size={32} className="text-gray-500" />
          <p className="text-sm text-gray-400">No customs events recorded yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`glass-card rounded-2xl p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-white mb-6">Customs Timeline</h3>

      <div className="relative">
        {events.map((event, index) => {
          const config = STATUS_CONFIG[event.status] ?? STATUS_CONFIG.pending;
          const { Icon, iconClass, lineClass } = config;
          const isLast = index === events.length - 1;

          return (
            <div key={event.id} className="relative flex gap-4">
              {/* Vertical connector line */}
              {!isLast && (
                <div className={`absolute left-[15px] top-8 bottom-0 w-0.5 ${lineClass}`} aria-hidden="true" />
              )}

              {/* Icon dot */}
              <div className="relative z-10 flex-shrink-0 flex items-start justify-center w-8 pt-0.5">
                <div className="glass-card rounded-full p-1.5 border border-white/10">
                  <Icon size={16} className={iconClass} />
                </div>
              </div>

              {/* Content */}
              <div className={`flex-1 pb-6 ${isLast ? '' : ''}`}>
                <div className="glass-card rounded-xl p-4 hover:bg-white/10 transition-all duration-300">
                  {/* Header row */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${iconClass}`}>{config.label}</span>
                      {event.documentType && (
                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-full">
                          {event.documentType.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                    <time dateTime={event.timestamp} className="text-xs text-gray-400 flex-shrink-0">
                      {formatTimestamp(event.timestamp)}
                    </time>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-300">{event.description}</p>

                  {/* Document number */}
                  {event.documentNumber && (
                    <p className="text-xs text-gray-500 mt-1">
                      Ref: <span className="text-nesma-secondary font-medium">{event.documentNumber}</span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
