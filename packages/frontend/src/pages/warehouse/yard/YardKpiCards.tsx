import React from 'react';
import type { YardAppointment } from '@/domains/warehouse-ops/hooks/useYard';
import {
  DoorOpen,
  CheckCircle2,
  Truck,
  CalendarClock,
  Clock,
  AlertTriangle,
} from 'lucide-react';

// ── Status colors ─────────────────────────────────────────────────────

export const DOCK_STATUS_COLOR: Record<string, { bg: string; border: string; text: string; label: string }> = {
  available: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/50', text: 'text-emerald-400', label: 'Available' },
  occupied: { bg: 'bg-red-500/20', border: 'border-red-500/50', text: 'text-red-400', label: 'Occupied' },
  maintenance: { bg: 'bg-gray-500/20', border: 'border-gray-500/50', text: 'text-gray-400', label: 'Maintenance' },
};

export const APPT_STATUS_COLOR: Record<string, { bg: string; text: string; label: string }> = {
  scheduled: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'Scheduled' },
  checked_in: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'Checked In' },
  loading: { bg: 'bg-purple-500/20', text: 'text-purple-400', label: 'Loading' },
  completed: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', label: 'Completed' },
  cancelled: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Cancelled' },
  no_show: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'No Show' },
};

export const TRUCK_STATUS_COLOR: Record<string, { bg: string; text: string; label: string }> = {
  in_yard: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: 'In Yard' },
  at_dock: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'At Dock' },
  departed: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Departed' },
};

// ── Helpers ──────────────────────────────────────────────────────────

export function formatTime(d: string | Date) {
  return new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(d: string | Date) {
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getDuration(checkIn: string): string {
  const ms = Date.now() - new Date(checkIn).getTime();
  const hours = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

// ── KPI Card ─────────────────────────────────────────────────────────

export const KpiCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
}> = ({ icon, label, value, color }) => (
  <div className="glass-card rounded-2xl p-5 border border-white/5">
    <div className="flex items-center gap-3">
      <div className={`p-2.5 rounded-xl ${color}`}>{icon}</div>
      <div>
        <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-white mt-0.5">{value}</p>
      </div>
    </div>
  </div>
);

// ── Summary KPI Cards ────────────────────────────────────────────────

interface YardSummary {
  totalDocks: number;
  availableDocks: number;
  trucksInYard: number;
  appointmentsToday: number;
}

export const YardSummaryKpis: React.FC<{ summary: YardSummary }> = ({ summary }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    <KpiCard
      icon={<DoorOpen className="w-5 h-5 text-blue-400" />}
      label="Total Docks"
      value={summary.totalDocks}
      color="bg-blue-500/15"
    />
    <KpiCard
      icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />}
      label="Available"
      value={summary.availableDocks}
      color="bg-emerald-500/15"
    />
    <KpiCard
      icon={<Truck className="w-5 h-5 text-amber-400" />}
      label="Trucks in Yard"
      value={summary.trucksInYard}
      color="bg-amber-500/15"
    />
    <KpiCard
      icon={<CalendarClock className="w-5 h-5 text-purple-400" />}
      label="Today's Appointments"
      value={summary.appointmentsToday}
      color="bg-purple-500/15"
    />
  </div>
);

// ── Analytics SLA KPIs ───────────────────────────────────────────────

export const AnalyticsSlaKpis: React.FC<{ todayAppointments: YardAppointment[] }> = ({ todayAppointments }) => {
  const SLA_GRACE_MINUTES = 15;
  const allAppts = todayAppointments;
  const totalAppts = allAppts.length;
  const noShows = allAppts.filter(a => a.status === 'no_show').length;

  const lateArrivals = allAppts.filter(a => {
    if (a.status === 'scheduled' || a.status === 'cancelled' || a.status === 'no_show') return false;
    const graceEnd = new Date(new Date(a.scheduledStart).getTime() + SLA_GRACE_MINUTES * 60_000);
    return new Date() > graceEnd && ['checked_in', 'loading'].includes(a.status);
  }).length;

  const completed = allAppts.filter(a => a.status === 'completed').length;
  const applicable = completed + lateArrivals + noShows;
  const onTimeRate = applicable > 0 ? Math.round(((completed - lateArrivals) / applicable) * 100) : 100;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiCard
        icon={<CheckCircle2 className="w-5 h-5 text-emerald-400" />}
        label="On-Time Rate"
        value={`${Math.max(0, onTimeRate)}%`}
        color="bg-emerald-500/15"
      />
      <KpiCard
        icon={<Clock className="w-5 h-5 text-amber-400" />}
        label="Late Arrivals"
        value={lateArrivals}
        color="bg-amber-500/15"
      />
      <KpiCard
        icon={<AlertTriangle className="w-5 h-5 text-red-400" />}
        label="No Shows"
        value={noShows}
        color="bg-red-500/15"
      />
      <KpiCard
        icon={<CalendarClock className="w-5 h-5 text-blue-400" />}
        label="Total Appointments"
        value={totalAppts}
        color="bg-blue-500/15"
      />
    </div>
  );
};
