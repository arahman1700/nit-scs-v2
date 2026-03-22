import React from 'react';
import { APPT_STATUS_COLOR, formatTime } from './YardKpiCards';
import type { YardAppointment } from '@/domains/warehouse-ops/hooks/useYard';
import { CalendarClock, LogIn, CheckCircle2, X } from 'lucide-react';

// ── Overview: Upcoming Appointments Card ─────────────────────────────

interface UpcomingAppointmentsProps {
  upcomingAppts: YardAppointment[];
  onCheckIn: (id: string) => void;
  onComplete: (id: string) => void;
  onCancel: (id: string) => void;
}

export const UpcomingAppointmentsCard: React.FC<UpcomingAppointmentsProps> = ({
  upcomingAppts,
  onCheckIn,
  onComplete,
  onCancel,
}) => (
  <div className="glass-card rounded-2xl p-6 border border-white/5">
    <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
      <CalendarClock className="w-5 h-5 text-nesma-primary" />
      Upcoming Appointments
      {upcomingAppts.length > 0 && (
        <span className="text-xs bg-nesma-primary/20 text-nesma-primary px-2 py-0.5 rounded-full">
          {upcomingAppts.length}
        </span>
      )}
    </h2>
    {upcomingAppts.length === 0 ? (
      <p className="text-sm text-gray-400 py-4">No upcoming appointments today.</p>
    ) : (
      <div className="space-y-3 max-h-80 overflow-y-auto">
        {upcomingAppts.map(appt => {
          const statusStyle = APPT_STATUS_COLOR[appt.status] ?? APPT_STATUS_COLOR.scheduled;
          return (
            <div
              key={appt.id}
              className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white font-medium">
                    {formatTime(appt.scheduledStart)} - {formatTime(appt.scheduledEnd)}
                  </span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}
                  >
                    {statusStyle.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-400 capitalize">{appt.appointmentType}</span>
                  {appt.carrierName && <span className="text-xs text-gray-400">| {appt.carrierName}</span>}
                  {appt.vehiclePlate && <span className="text-xs text-gray-400">| {appt.vehiclePlate}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 ml-2">
                {appt.status === 'scheduled' && (
                  <button
                    onClick={() => onCheckIn(appt.id)}
                    className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
                    title="Check In"
                    aria-label="Check in"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                  </button>
                )}
                {['checked_in', 'loading'].includes(appt.status) && (
                  <button
                    onClick={() => onComplete(appt.id)}
                    className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                    title="Complete"
                    aria-label="Complete"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {appt.status !== 'completed' && appt.status !== 'cancelled' && (
                  <button
                    onClick={() => onCancel(appt.id)}
                    className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                    title="Cancel"
                    aria-label="Cancel"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    )}
  </div>
);

// ── Full Appointments Table (Appointments tab) ──────────────────────

interface AppointmentsTableProps {
  todayAppointments: YardAppointment[];
  onCheckIn: (id: string) => void;
  onComplete: (id: string) => void;
}

export const AppointmentsTable: React.FC<AppointmentsTableProps> = ({
  todayAppointments,
  onCheckIn,
  onComplete,
}) => (
  <div className="glass-card rounded-2xl p-6 border border-white/5">
    <h2 className="text-lg font-semibold text-white mb-4">Today's Appointments</h2>
    {todayAppointments.length === 0 ? (
      <p className="text-sm text-gray-400 py-8 text-center">No appointments scheduled for today.</p>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-xs text-gray-400 font-medium pb-3 uppercase tracking-wider">Time</th>
              <th className="text-left text-xs text-gray-400 font-medium pb-3 uppercase tracking-wider">Type</th>
              <th className="text-left text-xs text-gray-400 font-medium pb-3 uppercase tracking-wider">
                Carrier
              </th>
              <th className="text-left text-xs text-gray-400 font-medium pb-3 uppercase tracking-wider">
                Vehicle
              </th>
              <th className="text-left text-xs text-gray-400 font-medium pb-3 uppercase tracking-wider">Dock</th>
              <th className="text-left text-xs text-gray-400 font-medium pb-3 uppercase tracking-wider">
                Status
              </th>
              <th className="text-right text-xs text-gray-400 font-medium pb-3 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {todayAppointments.map(appt => {
              const statusStyle = APPT_STATUS_COLOR[appt.status] ?? APPT_STATUS_COLOR.scheduled;
              return (
                <tr key={appt.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-3 text-white">
                    {formatTime(appt.scheduledStart)} - {formatTime(appt.scheduledEnd)}
                  </td>
                  <td className="py-3 text-gray-300 capitalize">{appt.appointmentType}</td>
                  <td className="py-3 text-gray-300">{appt.carrierName || '-'}</td>
                  <td className="py-3 text-gray-300">{appt.vehiclePlate || '-'}</td>
                  <td className="py-3 text-gray-300">{appt.dockDoor ? `#${appt.dockDoor.doorNumber}` : '-'}</td>
                  <td className="py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                      {statusStyle.label}
                    </span>
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {appt.status === 'scheduled' && (
                        <button
                          onClick={() => onCheckIn(appt.id)}
                          className="text-xs text-amber-400 hover:text-amber-300"
                        >
                          Check In
                        </button>
                      )}
                      {['checked_in', 'loading'].includes(appt.status) && (
                        <button
                          onClick={() => onComplete(appt.id)}
                          className="text-xs text-emerald-400 hover:text-emerald-300"
                        >
                          Complete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </div>
);
