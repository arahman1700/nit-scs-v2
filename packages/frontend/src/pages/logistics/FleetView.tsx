import React, { useMemo } from 'react';
import { useJobOrderList } from '@/api/hooks/useJobOrders';
import { useEmployees } from '@/api/hooks/useMasterData';
import { JobStatus } from '@nit-scs-v2/shared/types';
import type { JobOrder, Employee } from '@nit-scs-v2/shared/types';
import { Truck, CheckCircle, Package, Wrench, MapPin } from 'lucide-react';

interface FleetItem {
  id: string;
  name: string;
  type: string;
  project: string;
  status: string;
  lastUsed: string;
  driver?: string;
}

export const FleetView: React.FC = () => {
  const jobsQuery = useJobOrderList({ pageSize: 200 });
  const employeeQuery = useEmployees({ pageSize: 200 });
  const JOBS = (jobsQuery.data?.data ?? []) as JobOrder[];
  const employees = (employeeQuery.data?.data ?? []) as Employee[];

  const jobStats = useMemo(() => {
    const byType: Record<string, number> = {};
    JOBS.forEach(j => {
      byType[j.type] = (byType[j.type] || 0) + 1;
    });
    return { byType, total: JOBS.length };
  }, [JOBS]);

  const fleetItems: FleetItem[] = useMemo(() => {
    const vehicles: FleetItem[] = [];
    const equipmentJobs = JOBS.filter(
      j => j.type === 'Equipment' || j.type === 'Transport' || j.type === 'Generator_Maintenance',
    );
    equipmentJobs.forEach(job => {
      vehicles.push({
        id: `FL-${job.id.split('-').pop()}`,
        name: job.title.split(' - ')[0] || job.title,
        type: job.type === 'Transport' ? 'Truck' : job.type === 'Generator_Maintenance' ? 'Generator' : 'Equipment',
        project: job.project || '-',
        status:
          job.status === JobStatus.IN_PROGRESS
            ? 'Active'
            : job.status === JobStatus.COMPLETED
              ? 'Available'
              : job.status === JobStatus.DRAFT
                ? 'Requested'
                : 'Standby',
        lastUsed: job.date,
        driver: job.driver,
      });
    });
    return vehicles;
  }, [JOBS]);

  const fleetStats = useMemo(
    () => ({
      total: fleetItems.length,
      active: fleetItems.filter(f => f.status === 'Active').length,
      available: fleetItems.filter(f => f.status === 'Available').length,
      maintenance: fleetItems.filter(f => f.type === 'Generator').length,
    }),
    [fleetItems],
  );

  if (jobsQuery.isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-10 bg-white/5 rounded w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Fleet Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: fleetStats.total, icon: Truck, cls: 'bg-blue-500/20 text-blue-400' },
          { label: 'Active', value: fleetStats.active, icon: CheckCircle, cls: 'bg-emerald-500/20 text-emerald-400' },
          {
            label: 'Available',
            value: fleetStats.available,
            icon: Package,
            cls: 'bg-nesma-secondary/20 text-nesma-secondary',
          },
          { label: 'Maintenance', value: fleetStats.maintenance, icon: Wrench, cls: 'bg-amber-500/20 text-amber-400' },
        ].map(s => (
          <div key={s.label} className="glass-card p-5 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-2 rounded-lg ${s.cls}`}>
                <s.icon size={18} />
              </div>
              <span className="text-xs text-gray-400">{s.label}</span>
            </div>
            <p className="text-2xl font-bold text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Fleet Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-white/10 bg-white/5 flex items-center justify-between">
          <h3 className="font-bold text-lg text-white flex items-center gap-3">
            <span className="w-1 h-6 bg-nesma-secondary rounded-full" />
            Vehicles & Equipment
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider bg-white/5">
                <th className="py-3 px-4 font-medium">ID</th>
                <th className="py-3 px-4 font-medium">Vehicle</th>
                <th className="py-3 px-4 font-medium">Type</th>
                <th className="py-3 px-4 font-medium">Project</th>
                <th className="py-3 px-4 font-medium">Last Used</th>
                <th className="py-3 px-4 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {fleetItems.map(item => (
                <tr key={item.id} className="hover:bg-white/5 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-mono text-xs bg-white/10 px-2 py-1 rounded text-gray-400">{item.id}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div>
                      <span className="text-sm text-gray-200 font-medium">{item.name}</span>
                      {item.driver && <span className="text-xs text-gray-500 block mt-0.5">Driver: {item.driver}</span>}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
                        item.type === 'Truck'
                          ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          : item.type === 'Generator'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                      }`}
                    >
                      {item.type}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-300">{item.project}</td>
                  <td className="py-3 px-4 text-sm text-gray-400">{item.lastUsed}</td>
                  <td className="py-3 px-4 text-center">
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-medium border ${
                        item.status === 'Active'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : item.status === 'Available'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : item.status === 'Requested'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                      }`}
                    >
                      {item.status}
                    </span>
                  </td>
                </tr>
              ))}
              {fleetItems.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-gray-500">
                    No fleet records
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bottom Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card p-6 rounded-2xl">
          <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-3">
            <span className="w-1 h-5 bg-nesma-secondary rounded-full" />
            By JO Type
          </h3>
          <div className="space-y-3">
            {Object.entries(jobStats.byType).map(([type, count]) => (
              <div key={type} className="flex items-center gap-3">
                <span className="text-sm text-gray-400 w-40 truncate">{type.replace('_', ' ')}</span>
                <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-nesma-primary to-nesma-secondary h-2 rounded-full"
                    style={{ width: `${jobStats.total > 0 ? (count / jobStats.total) * 100 : 0}%` }}
                  />
                </div>
                <span className="text-sm text-white font-medium w-8 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card p-6 rounded-2xl">
          <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-3">
            <span className="w-1 h-5 bg-nesma-secondary rounded-full" />
            Drivers & Technicians
          </h3>
          <div className="space-y-3">
            {employees
              .filter(
                e =>
                  (e.department as string) === 'Transport' ||
                  ((e.title as string) || '').includes('Driver') ||
                  ((e.title as string) || '').includes('Mechanic'),
              )
              .map(emp => (
                <div key={emp.id as string} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-nesma-primary/30 flex items-center justify-center text-xs text-nesma-secondary font-bold">
                      {(emp.name as string)
                        .split(' ')
                        .map(n => n[0])
                        .join('')
                        .slice(0, 2)}
                    </div>
                    <div>
                      <span className="text-sm text-gray-200">{emp.name as string}</span>
                      <span className="text-xs text-gray-500 block">{emp.title as string}</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <MapPin size={12} /> {emp.site as string}
                  </span>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
};
