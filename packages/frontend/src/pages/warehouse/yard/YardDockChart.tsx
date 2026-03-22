import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import type { DockDoor, DockUtilization, YardAppointment } from '@/domains/warehouse-ops/hooks/useYard';
import { BarChart3 } from 'lucide-react';

interface YardDockChartProps {
  utilization: DockUtilization | undefined;
  dockDoors: DockDoor[];
  todayAppointments: YardAppointment[];
}

export const YardDockChart: React.FC<YardDockChartProps> = ({ utilization, dockDoors, todayAppointments }) => {
  const chartData = utilization
    ? utilization.dockMetrics.map(d => ({
        name: `Door #${d.doorNumber}`,
        appointments: d.appointmentCount,
        visits: d.visitCount,
        completed: d.completedCount,
        avgDwell: d.avgDwellMinutes,
      }))
    : dockDoors.map(d => {
        const doorAppts = todayAppointments.filter(a => a.dockDoorId === d.id);
        const completedAppts = doorAppts.filter(a => a.status === 'completed').length;
        return {
          name: `Door #${d.doorNumber}`,
          appointments: doorAppts.length,
          visits: d.truckVisits?.length ?? 0,
          completed: completedAppts,
          avgDwell: 0,
        };
      });

  return (
    <div className="glass-card rounded-2xl p-6 border border-white/5">
      <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-nesma-primary" />
        Dock Utilization
      </h2>
      {chartData.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">No dock door data available.</p>
      ) : (
        <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 48)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
            <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 12 }} />
            <YAxis dataKey="name" type="category" tick={{ fill: '#9ca3af', fontSize: 12 }} width={100} />
            <Tooltip
              contentStyle={{
                backgroundColor: 'rgba(10, 22, 40, 0.95)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px',
                color: '#fff',
              }}
            />
            <Bar dataKey="appointments" fill="#3b82f6" name="Appointments" radius={[0, 4, 4, 0]} />
            <Bar dataKey="visits" fill="#10b981" name="Truck Visits" radius={[0, 4, 4, 0]} />
            <Bar dataKey="completed" fill="#8b5cf6" name="Completed" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
};

// ── Utilization Summary Card ─────────────────────────────────────────

interface UtilizationSummaryProps {
  summary: {
    utilizationRate: number;
    completedAppointments: number;
    cancelledAppointments: number;
    noShowAppointments: number;
  };
}

export const UtilizationSummaryCard: React.FC<UtilizationSummaryProps> = ({ summary }) => (
  <div className="glass-card rounded-2xl p-6 border border-white/5">
    <h2 className="text-lg font-semibold text-white mb-4">Utilization Summary</h2>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="text-center">
        <p className="text-2xl font-bold text-white">{Math.round(summary.utilizationRate)}%</p>
        <p className="text-xs text-gray-400 mt-1">Utilization Rate</p>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold text-white">{summary.completedAppointments}</p>
        <p className="text-xs text-gray-400 mt-1">Completed</p>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold text-amber-400">{summary.cancelledAppointments}</p>
        <p className="text-xs text-gray-400 mt-1">Cancelled</p>
      </div>
      <div className="text-center">
        <p className="text-2xl font-bold text-red-400">{summary.noShowAppointments}</p>
        <p className="text-xs text-gray-400 mt-1">No Shows</p>
      </div>
    </div>
  </div>
);
