import React, { useMemo, useState } from 'react';
import { useJobOrderList } from '@/api/hooks/useJobOrders';
import { useSuppliers, useEmployees } from '@/api/hooks/useMasterData';
import { JobStatus } from '@nit-scs-v2/shared/types';
import type { JobOrder, Employee } from '@nit-scs-v2/shared/types';
import {
  Calendar,
  Truck,
  User,
  MoreHorizontal,
  Plus,
  Users,
  Search,
  MapPin,
  Star,
  CheckCircle,
  Wrench,
  Package,
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { displayStr } from '@/utils/displayStr';

// ============ KANBAN COLUMN ============
const KanbanColumn: React.FC<{ status: string; jobs: JobOrder[]; color: string; borderColor: string }> = ({
  status,
  jobs,
  color,
  borderColor: _borderColor,
}) => (
  <div className="flex-1 min-w-[300px] glass-card rounded-2xl p-4 flex flex-col h-[calc(100vh-180px)] bg-black/20">
    <div className="flex items-center justify-between mb-4 pb-3 border-b border-white/10">
      <h3 className="font-bold text-gray-200 flex items-center gap-2">
        <span className={`w-3 h-3 rounded-full ${color}`}></span>
        {status}
      </h3>
      <span className="bg-white/10 text-gray-300 px-2.5 py-0.5 rounded-full text-xs font-bold">{jobs.length}</span>
    </div>

    <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1 pb-4">
      {jobs.map(job => (
        <div
          key={job.id}
          className="bg-white/5 p-4 rounded-xl border border-white/5 cursor-pointer hover:bg-white/10 transition-all group shadow-sm"
        >
          <div className="flex justify-between items-start mb-3">
            <span className="text-[10px] px-2 py-1 rounded bg-black/30 text-gray-400 font-mono tracking-wider border border-white/5">
              {job.id}
            </span>
            <div className="flex gap-2">
              <span
                className={`text-[10px] px-2 py-1 rounded-full font-medium border ${
                  job.priority === 'high' || job.priority === 'urgent'
                    ? 'bg-red-500/10 text-red-400 border-red-500/20'
                    : job.priority === 'normal'
                      ? 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}
              >
                {job.priority}
              </span>
              <button className="text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal size={16} />
              </button>
            </div>
          </div>
          <h4 className="font-bold text-gray-100 mb-3 text-sm leading-snug group-hover:text-nesma-secondary transition-colors">
            {job.description}
          </h4>

          <div className="space-y-2 border-t border-white/5 pt-3">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Truck size={14} className="text-gray-500" />
              <span>{(job.joType ?? '').replace('_', ' ')}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <User size={14} className="text-gray-500" />
              <span>{displayStr((job as unknown as Record<string, unknown>).requestedBy) || job.requester || '-'}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Calendar size={14} className="text-gray-500" />
              <span>{job.date}</span>
            </div>
            {job.project && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <MapPin size={14} className="text-gray-500" />
                <span>{displayStr(job.project)}</span>
              </div>
            )}
            {job.slaStatus && (
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium inline-block mt-1 ${
                  job.slaStatus === 'On Track'
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : job.slaStatus === 'At Risk'
                      ? 'bg-amber-500/10 text-amber-400'
                      : 'bg-red-500/10 text-red-400'
                }`}
              >
                {job.slaStatus}
              </span>
            )}
          </div>
        </div>
      ))}
      {jobs.length === 0 && (
        <div className="text-center py-12 flex flex-col items-center justify-center text-gray-600 border-2 border-dashed border-white/5 rounded-xl">
          <Truck size={32} className="mb-2 opacity-30" />
          <span className="text-sm opacity-50">No Jobs</span>
        </div>
      )}
    </div>
  </div>
);

// ============ MAIN COMPONENT ============
export const TransportDashboard: React.FC = () => {
  const { view } = useParams<{ view: string }>();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

  // API hooks
  const jobsQuery = useJobOrderList({ pageSize: 200 });
  const supplierQuery = useSuppliers({ pageSize: 200 });
  const employeeQuery = useEmployees({ pageSize: 200 });
  const JOBS = (jobsQuery.data?.data ?? []) as JobOrder[];
  const suppliers = (supplierQuery.data?.data ?? []) as unknown as Record<string, unknown>[];
  const employees = (employeeQuery.data?.data ?? []) as Employee[];
  const isLoading = jobsQuery.isLoading;
  const isError = jobsQuery.isError;

  // Job stats
  const jobStats = useMemo(() => {
    const byType: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    JOBS.forEach(j => {
      const jt = j.joType ?? '';
      byType[jt] = (byType[jt] || 0) + 1;
      byStatus[j.status] = (byStatus[j.status] || 0) + 1;
    });
    return { byType, byStatus, total: JOBS.length };
  }, [JOBS]);

  const newJobs = JOBS.filter(j => j.status === JobStatus.DRAFT);
  const assigningJobs = JOBS.filter(j => j.status === JobStatus.ASSIGNED);
  const progressJobs = JOBS.filter(j => j.status === JobStatus.IN_PROGRESS);
  const completedJobs = JOBS.filter(j => j.status === JobStatus.COMPLETED);

  // Fleet data (used in fleet view)
  const fleetItems = useMemo(() => {
    const vehicles: Array<{
      id: string;
      name: string;
      type: string;
      project: string;
      status: string;
      lastUsed: string;
      driver?: string;
    }> = [];

    const equipmentJobs = JOBS.filter(
      j => j.joType === 'equipment' || j.joType === 'transport' || j.joType === 'generator_maintenance',
    );

    equipmentJobs.forEach(job => {
      vehicles.push({
        id: `FL-${job.id.split('-').pop()}`,
        name: job.description.split(' - ')[0] || job.description,
        type: job.joType === 'transport' ? 'Truck' : job.joType === 'generator_maintenance' ? 'Generator' : 'Equipment',
        project: displayStr(job.project) || '-',
        status:
          job.status === JobStatus.IN_PROGRESS
            ? 'Active'
            : job.status === JobStatus.COMPLETED
              ? 'Available'
              : job.status === JobStatus.DRAFT
                ? 'Requested'
                : 'Standby',
        lastUsed: job.requestDate,
        driver: job.driverName,
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

  // Supplier data (used in suppliers view)
  const filteredSuppliers = useMemo(
    () =>
      suppliers.filter(
        s =>
          searchTerm === '' ||
          displayStr(s).toLowerCase().includes(searchTerm.toLowerCase()) ||
          displayStr(s.city).toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [searchTerm, suppliers],
  );

  const suppliersByCity = useMemo(() => {
    const byCityMap: Record<string, number> = {};
    suppliers.forEach(s => {
      const city = displayStr(s.city) || 'Unknown';
      byCityMap[city] = (byCityMap[city] || 0) + 1;
    });
    return byCityMap;
  }, [suppliers]);

  // ============ FLEET VIEW ============
  if (view === 'fleet') {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Fleet Management</h1>
            <p className="text-sm text-gray-400 mt-1">{fleetItems.length} vehicles & equipment</p>
          </div>
        </div>

        {/* Fleet Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card p-5 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Truck size={18} className="text-blue-400" />
              </div>
              <span className="text-xs text-gray-400">Total</span>
            </div>
            <p className="text-2xl font-bold text-white">{fleetStats.total}</p>
          </div>
          <div className="glass-card p-5 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <CheckCircle size={18} className="text-emerald-400" />
              </div>
              <span className="text-xs text-gray-400">Active</span>
            </div>
            <p className="text-2xl font-bold text-white">{fleetStats.active}</p>
          </div>
          <div className="glass-card p-5 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-nesma-secondary/20 rounded-lg">
                <Package size={18} className="text-nesma-secondary" />
              </div>
              <span className="text-xs text-gray-400">Available</span>
            </div>
            <p className="text-2xl font-bold text-white">{fleetStats.available}</p>
          </div>
          <div className="glass-card p-5 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Wrench size={18} className="text-amber-400" />
              </div>
              <span className="text-xs text-gray-400">Maintenance</span>
            </div>
            <p className="text-2xl font-bold text-white">{fleetStats.maintenance}</p>
          </div>
        </div>

        {/* Fleet Table */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-white/10 bg-white/5 flex items-center justify-between">
            <h3 className="font-bold text-lg text-white flex items-center gap-3">
              <span className="w-1 h-6 bg-nesma-secondary rounded-full"></span>
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
                        {item.driver && (
                          <span className="text-xs text-gray-500 block mt-0.5">Driver: {item.driver}</span>
                        )}
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
              </tbody>
            </table>
          </div>
        </div>

        {/* Fleet by Type Chart (simple visual) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-card p-6 rounded-2xl">
            <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-3">
              <span className="w-1 h-5 bg-nesma-secondary rounded-full"></span>
              By JO Type
            </h3>
            <div className="space-y-3">
              {Object.entries(jobStats.byType).map(([type, count]) => (
                <div key={type} className="flex items-center gap-3">
                  <span className="text-sm text-gray-400 w-40 truncate">{type.replace('_', ' ')}</span>
                  <div className="flex-1 bg-white/5 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-nesma-primary to-nesma-secondary h-2 rounded-full"
                      style={{ width: `${(count / jobStats.total) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-white font-medium w-8 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-6 rounded-2xl">
            <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-3">
              <span className="w-1 h-5 bg-nesma-secondary rounded-full"></span>
              Drivers & Technicians
            </h3>
            <div className="space-y-3">
              {employees
                .filter(
                  e =>
                    (e.department as string) === 'transport' ||
                    ((e.role as string) || '').includes('driver') ||
                    ((e.role as string) || '').includes('mechanic'),
                )
                .map(emp => (
                  <div key={emp.id as string} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-nesma-primary/30 flex items-center justify-center text-xs text-nesma-secondary font-bold">
                        {emp.fullName
                          .split(' ')
                          .map(n => n[0])
                          .join('')
                          .slice(0, 2)}
                      </div>
                      <div>
                        <span className="text-sm text-gray-200">{emp.fullName}</span>
                        <span className="text-xs text-gray-500 block">{emp.role}</span>
                      </div>
                    </div>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <MapPin size={12} /> {emp.department}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============ SUPPLIERS VIEW ============
  if (view === 'suppliers') {
    return (
      <div className="animate-fade-in space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Transporter Suppliers</h1>
            <p className="text-sm text-gray-400 mt-1">{suppliers.length} suppliers</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="glass-card p-5 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Users size={18} className="text-blue-400" />
              </div>
              <span className="text-xs text-gray-400">Total</span>
            </div>
            <p className="text-2xl font-bold text-white">{suppliers.length}</p>
          </div>
          <div className="glass-card p-5 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-500/20 rounded-lg">
                <CheckCircle size={18} className="text-emerald-400" />
              </div>
              <span className="text-xs text-gray-400">Active</span>
            </div>
            <p className="text-2xl font-bold text-white">{suppliers.filter(s => s.status === 'Active').length}</p>
          </div>
          <div className="glass-card p-5 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-nesma-secondary/20 rounded-lg">
                <MapPin size={18} className="text-nesma-secondary" />
              </div>
              <span className="text-xs text-gray-400">Cities</span>
            </div>
            <p className="text-2xl font-bold text-white">{Object.keys(suppliersByCity).length}</p>
          </div>
          <div className="glass-card p-5 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-amber-500/20 rounded-lg">
                <Star size={18} className="text-amber-400" />
              </div>
              <span className="text-xs text-gray-400">Local</span>
            </div>
            <p className="text-2xl font-bold text-white">{suppliers.filter(s => s.type === 'LOCAL SUPPLIER').length}</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search suppliers..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-black/30 border border-white/10 rounded-lg text-white text-sm focus:border-nesma-secondary outline-none"
          />
        </div>

        {/* Suppliers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSuppliers.map(supplier => (
            <div
              key={supplier.id as string}
              className="glass-card p-5 rounded-xl hover:bg-white/10 transition-all group border border-white/5 hover:border-nesma-secondary/20"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-nesma-primary/30 flex items-center justify-center text-sm text-nesma-secondary font-bold border border-nesma-primary/20">
                    {displayStr(supplier)
                      .split(' ')
                      .map(n => n[0])
                      .join('')
                      .slice(0, 2)}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors leading-tight">
                      {displayStr(supplier) || '-'}
                    </h4>
                    <span className="text-xs text-gray-500 font-mono">{String(supplier.id)}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-white/5">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <MapPin size={14} className="text-gray-500" />
                  <span>{displayStr(supplier.city) || '-'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
                      supplier.status === 'Active'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-gray-500/10 text-gray-400 border-gray-500/20'
                    }`}
                  >
                    {supplier.status === 'Active' ? 'Active' : String(supplier.status || '-')}
                  </span>
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                    {Array.isArray(supplier.types)
                      ? (supplier.types as string[]).join(', ')
                      : String(supplier.type || '-').replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredSuppliers.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Users size={48} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No suppliers found</p>
          </div>
        )}

        {/* Distribution by City */}
        <div className="glass-card p-6 rounded-2xl">
          <h3 className="font-bold text-sm text-white mb-4 flex items-center gap-3">
            <span className="w-1 h-5 bg-nesma-secondary rounded-full"></span>
            By City
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(suppliersByCity)
              .sort((a, b) => b[1] - a[1])
              .map(([city, count]) => (
                <div key={city} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <span className="text-sm text-gray-300 flex items-center gap-2">
                    <MapPin size={12} className="text-nesma-secondary" /> {city}
                  </span>
                  <span className="text-sm text-white font-bold">{count}</span>
                </div>
              ))}
          </div>
        </div>
      </div>
    );
  }

  // ============ DEFAULT: KANBAN VIEW ============
  if (isLoading)
    return (
      <div className="space-y-4 animate-fade-in">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="animate-pulse bg-white/5 rounded h-8 w-full"></div>
        ))}
      </div>
    );
  if (isError) return <div className="text-red-400 p-4">Failed to load data</div>;

  return (
    <div className="h-full flex flex-col animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Job Orders</h1>
          <p className="text-sm text-gray-400 mt-1">{JOBS.length} total job orders</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <div className="hidden md:flex bg-white/5 border border-white/10 rounded-lg p-1">
            <button className="px-4 py-1.5 text-sm bg-white/10 rounded-md font-medium text-white shadow-sm border border-white/10">
              Kanban
            </button>
            <button className="px-4 py-1.5 text-sm text-gray-400 hover:text-white transition-colors">List</button>
          </div>
          <button
            onClick={() => navigate('/admin/forms/jo')}
            className="bg-nesma-primary text-white px-5 py-2.5 rounded-xl hover:bg-nesma-accent flex items-center justify-center gap-2 shadow-lg shadow-nesma-primary/20 transition-all hover:scale-105 transform border border-white/10 w-full md:w-auto"
          >
            <Plus size={18} />
            <span>New Job Order</span>
          </button>
        </div>
      </div>

      {/* Quick Stats Bar */}
      <div className="flex gap-3 mb-6 overflow-x-auto pb-1">
        <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg border border-white/10 whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-gray-400"></span>
          <span className="text-xs text-gray-400">New</span>
          <span className="text-sm font-bold text-white">{newJobs.length}</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg border border-white/10 whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-amber-400"></span>
          <span className="text-xs text-gray-400">Assigning</span>
          <span className="text-sm font-bold text-white">{assigningJobs.length}</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg border border-white/10 whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-nesma-secondary"></span>
          <span className="text-xs text-gray-400">In Progress</span>
          <span className="text-sm font-bold text-white">{progressJobs.length}</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-lg border border-white/10 whitespace-nowrap">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span className="text-xs text-gray-400">Completed</span>
          <span className="text-sm font-bold text-white">{completedJobs.length}</span>
        </div>
      </div>

      <div className="flex gap-4 md:gap-6 overflow-x-auto pb-4 flex-1 items-start snap-x snap-mandatory">
        <div className="snap-center">
          <KanbanColumn status="New" jobs={newJobs} color="bg-gray-400" borderColor="gray-400" />
        </div>
        <div className="snap-center">
          <KanbanColumn status="Assigning" jobs={assigningJobs} color="bg-amber-400" borderColor="amber-400" />
        </div>
        <div className="snap-center">
          <KanbanColumn
            status="In Progress"
            jobs={progressJobs}
            color="bg-nesma-secondary"
            borderColor="nesma-secondary"
          />
        </div>
        <div className="snap-center">
          <KanbanColumn status="Completed" jobs={completedJobs} color="bg-emerald-400" borderColor="emerald-400" />
        </div>
      </div>
    </div>
  );
};
