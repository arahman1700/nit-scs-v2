
import React, { useMemo, useState } from 'react';
import { PlusCircle, Clock, CheckCircle, XCircle, ArrowRight, FileText, Truck, Search, Package, MapPin, BarChart3, AlertTriangle, Eye, Filter } from 'lucide-react';
import { useProjects, useInventory } from '@/api/hooks/useMasterData';
import { useMirvList } from '@/api/hooks/useMirv';
import { useJobOrderList } from '@/api/hooks/useJobOrders';
import { JobStatus } from '@nit-scs/shared/types';
import type { MIRV, JobOrder, InventoryItem, Project } from '@nit-scs/shared/types';
import { useParams, useNavigate } from 'react-router-dom';

// The logged-in engineer (simulated)
const CURRENT_ENGINEER = {
  name: 'Eng. Mohammed Alamri',
  shortName: 'Eng. Mohammed',
  projectId: 'P-8241',
};

export const EngineerDashboard: React.FC = () => {
  const { '*': subRoute } = useParams();
  const navigate = useNavigate();

  // API hooks
  const mirvQuery = useMirvList({ pageSize: 100 });
  const jobsQuery = useJobOrderList({ pageSize: 100 });
  const projectsQuery = useProjects({ pageSize: 200 });
  const inventoryQuery = useInventory({ pageSize: 500 });

  const allMirvs = (mirvQuery.data?.data ?? []) as MIRV[];
  const allJobs = (jobsQuery.data?.data ?? []) as JobOrder[];
  const allProjects = (projectsQuery.data?.data ?? []) as Project[];
  const inventoryItems = (inventoryQuery.data?.data ?? []) as InventoryItem[];

  const project = useMemo(() =>
    allProjects.find(p => p.id === CURRENT_ENGINEER.projectId),
    [allProjects]
  );

  // Engineer's material requests (MIRVs)
  const myMirvs = useMemo(() =>
    allMirvs.filter(m => m.requester === CURRENT_ENGINEER.shortName),
    [allMirvs]
  );

  // Engineer's job orders
  const myJobs = useMemo(() =>
    allJobs.filter(j =>
      j.requester === CURRENT_ENGINEER.shortName ||
      j.project === project?.name?.split(' ')[0]
    ),
    [allJobs, project]
  );

  // Combined requests for "My Requests" view
  const allRequests = useMemo(() => {
    const mirvRequests = myMirvs.map(m => ({
      id: m.id as string,
      type: 'MIRV' as const,
      title: `Material Issue - ${m.project as string}`,
      date: m.date as string,
      status: m.status as string,
      value: Number(m.value || 0),
      warehouse: (m.warehouse as string) || '',
    }));
    const joRequests = myJobs.map(j => ({
      id: j.id as string,
      type: 'JO' as const,
      title: j.title as string,
      date: j.date as string,
      status: j.status as string,
      value: Number(j.materialPriceSar || 0),
      warehouse: '',
    }));
    return [...mirvRequests, ...joRequests].sort((a, b) => b.date.localeCompare(a.date));
  }, [myMirvs, myJobs]);

  // Stats
  const stats = useMemo(() => {
    const completed = allRequests.filter(r => {
      const s = r.status as string;
      return s === 'Completed' || s === 'Issued' || s === JobStatus.COMPLETED;
    }).length;
    const pending = allRequests.filter(r => {
      const s = r.status as string;
      return s === 'Draft' || s === 'Pending Approval' || s === JobStatus.NEW;
    }).length;
    const inProgress = allRequests.filter(r => {
      const s = r.status as string;
      return s === 'Approved' || s === 'In Progress' || s === JobStatus.IN_PROGRESS || s === JobStatus.ASSIGNING;
    }).length;
    const totalValue = allRequests.reduce((sum, r) => sum + (r.value || 0), 0);
    return { completed, pending, inProgress, totalValue };
  }, [allRequests]);

  // Project inventory (items in engineer's project warehouse)
  const projectInventory = useMemo(() => {
    if (!project) return [];
    const region = (project.region ?? '').toLowerCase();
    return inventoryItems.filter(i =>
      (i.warehouse ?? '').toLowerCase().includes(region)
    );
  }, [project, inventoryItems]);

  const proj = project;

  // ============ MY REQUESTS VIEW ============
  if (subRoute === 'my-requests') {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">My Requests</h1>
            <p className="text-sm text-gray-400 mt-1">{allRequests.length} requests</p>
          </div>
          <button
            onClick={() => navigate('/engineer/new')}
            className="bg-nesma-primary text-white px-5 py-2.5 rounded-xl hover:bg-nesma-accent flex items-center gap-2 shadow-lg shadow-nesma-primary/20 transition-all border border-white/10"
          >
            <PlusCircle size={18} />
            New Request
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {['All', 'MIRV', 'JO'].map(f => (
            <button key={f} className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              f === 'All' ? 'bg-nesma-primary/20 text-nesma-secondary border border-nesma-primary/30' : 'bg-white/5 text-gray-400 border border-white/10 hover:bg-white/10'
            }`}>
              {f === 'All' ? 'All' : f === 'MIRV' ? 'Material' : 'Job Orders'}
            </button>
          ))}
        </div>

        {/* Requests Table */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/10 text-gray-400 text-xs uppercase tracking-wider bg-white/5">
                  <th className="py-3 px-4 font-medium">ID</th>
                  <th className="py-3 px-4 font-medium">Type</th>
                  <th className="py-3 px-4 font-medium">Description</th>
                  <th className="py-3 px-4 font-medium">Date</th>
                  <th className="py-3 px-4 font-medium text-center">Value</th>
                  <th className="py-3 px-4 font-medium text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {allRequests.map(req => (
                  <tr key={req.id} className="hover:bg-white/5 transition-colors cursor-pointer group">
                    <td className="py-3 px-4">
                      <span className="font-mono text-xs bg-white/10 px-2 py-1 rounded text-gray-300">{req.id}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
                        req.type === 'MIRV' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                      }`}>{req.type}</span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-200 group-hover:text-white">{req.title}</td>
                    <td className="py-3 px-4 text-sm text-gray-400">{req.date}</td>
                    <td className="py-3 px-4 text-center text-sm text-nesma-secondary font-medium">
                      {req.value ? `${req.value.toLocaleString()} SAR` : '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <StatusBadge status={req.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ============ MY PROJECT VIEW ============
  if (subRoute === 'project') {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Project Header */}
        <div className="bg-gradient-to-r from-nesma-primary to-nesma-dark rounded-2xl p-8 shadow-[0_0_40px_rgba(46,49,146,0.3)] relative overflow-hidden border border-white/10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-nesma-secondary/10 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-mono bg-white/10 px-2 py-1 rounded text-gray-300">{proj?.id}</span>
              <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Active</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">{proj?.name}</h1>
            <div className="flex flex-wrap gap-4 text-sm text-gray-300 mt-4">
              <span className="flex items-center gap-1"><MapPin size={14} className="text-nesma-secondary" /> {proj?.region}</span>
              <span>Client: <strong className="text-white">{proj?.client}</strong></span>
              <span>PM: <strong className="text-white">{proj?.manager}</strong></span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="glass-card p-5 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-blue-500/20 rounded-lg"><Package size={18} className="text-blue-400" /></div>
              <span className="text-sm text-gray-400">MIRVs</span>
            </div>
            <p className="text-2xl font-bold text-white">{myMirvs.length}</p>
          </div>
          <div className="glass-card p-5 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-orange-500/20 rounded-lg"><Truck size={18} className="text-orange-400" /></div>
              <span className="text-sm text-gray-400">Job Orders</span>
            </div>
            <p className="text-2xl font-bold text-white">{myJobs.length}</p>
          </div>
          <div className="glass-card p-5 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-500/20 rounded-lg"><CheckCircle size={18} className="text-emerald-400" /></div>
              <span className="text-sm text-gray-400">Completed</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.completed}</p>
          </div>
          <div className="glass-card p-5 rounded-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-nesma-secondary/20 rounded-lg"><BarChart3 size={18} className="text-nesma-secondary" /></div>
              <span className="text-sm text-gray-400">Total Value</span>
            </div>
            <p className="text-2xl font-bold text-white">{stats.totalValue.toLocaleString()} <span className="text-sm text-gray-400">SAR</span></p>
          </div>
        </div>

        {/* Project Inventory */}
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-white/10 bg-white/5 flex items-center justify-between">
            <h3 className="font-bold text-lg text-white flex items-center gap-3">
              <span className="w-1 h-6 bg-nesma-secondary rounded-full"></span>
              Project Inventory
            </h3>
            <span className="text-sm text-gray-400">{projectInventory.length} items</span>
          </div>
          <div className="divide-y divide-white/5">
            {projectInventory.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-4">
                  <span className="font-mono text-xs bg-white/10 px-2 py-1 rounded text-gray-400">{item.code}</span>
                  <div>
                    <span className="text-sm text-gray-200">{item.name}</span>
                    <span className="text-xs text-gray-500 block">{item.warehouse} • {item.location}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-sm font-medium text-white">{item.quantity?.toLocaleString()}</span>
                    <span className="text-xs text-gray-500 block">{item.category}</span>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full border ${
                    item.stockStatus === 'In Stock' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    item.stockStatus === 'Low Stock' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                    'bg-red-500/10 text-red-400 border-red-500/20'
                  }`}>{item.stockStatus}</span>
                </div>
              </div>
            ))}
            {projectInventory.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm">No items in this region</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============ NEW REQUEST VIEW ============
  if (subRoute === 'new') {
    return (
      <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-white">New Request</h1>
          <p className="text-sm text-gray-400 mt-1">Choose request type</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Material Request Card */}
          <button
            onClick={() => navigate('/admin/forms/mirv')}
            className="glass-card p-6 rounded-2xl text-left hover:bg-white/10 transition-all group border border-white/5 hover:border-nesma-secondary/30"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-blue-500/20 rounded-xl text-blue-400 group-hover:bg-blue-500/30 transition-colors">
                <Package size={28} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white group-hover:text-nesma-secondary transition-colors">Material Issue Request</h3>
                <p className="text-sm text-gray-400">MIRV</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Request materials from warehouse for your project. Requires approval based on value.
            </p>
          </button>

          {/* Transport Request Card */}
          <button
            onClick={() => navigate('/admin/forms/jo')}
            className="glass-card p-6 rounded-2xl text-left hover:bg-white/10 transition-all group border border-white/5 hover:border-nesma-secondary/30"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-orange-500/20 rounded-xl text-orange-400 group-hover:bg-orange-500/30 transition-colors">
                <Truck size={28} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white group-hover:text-nesma-secondary transition-colors">Job Order / Transport</h3>
                <p className="text-sm text-gray-400">JO</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Request transport, equipment, generators, or other logistics services.
            </p>
          </button>

          {/* Return Material Card */}
          <button
            onClick={() => navigate('/admin/forms/mrv')}
            className="glass-card p-6 rounded-2xl text-left hover:bg-white/10 transition-all group border border-white/5 hover:border-nesma-secondary/30"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-purple-500/20 rounded-xl text-purple-400 group-hover:bg-purple-500/30 transition-colors">
                <FileText size={28} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white group-hover:text-nesma-secondary transition-colors">Material Return</h3>
                <p className="text-sm text-gray-400">MRV</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Return surplus or damaged materials back to warehouse.
            </p>
          </button>

          {/* OSD Report Card */}
          <button
            onClick={() => navigate('/admin/forms/osd')}
            className="glass-card p-6 rounded-2xl text-left hover:bg-white/10 transition-all group border border-white/5 hover:border-nesma-secondary/30"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-red-500/20 rounded-xl text-red-400 group-hover:bg-red-500/30 transition-colors">
                <AlertTriangle size={28} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white group-hover:text-nesma-secondary transition-colors">OSD Report</h3>
                <p className="text-sm text-gray-400">Over/Short/Damage</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Report shortage, overage, or damage in received materials.
            </p>
          </button>
        </div>
      </div>
    );
  }

  // ============ DEFAULT: DASHBOARD ============
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Hero */}
      <div className="bg-gradient-to-r from-nesma-primary to-nesma-dark rounded-2xl p-8 shadow-[0_0_40px_rgba(46,49,146,0.3)] relative overflow-hidden border border-white/10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-nesma-secondary/10 rounded-full -mr-20 -mt-20 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-nesma-primary/30 rounded-full -ml-16 -mb-16 blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-white glow-text">Welcome, {CURRENT_ENGINEER.name}</h1>
            <p className="text-nesma-secondary text-lg font-medium flex items-center gap-2">
              <MapPin size={16} />
              {proj?.name || 'No Project'} ({proj?.id})
            </p>
            <p className="text-gray-300 text-sm mt-1">
              Client: {proj?.client} • Region: {proj?.region}
            </p>
          </div>

          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => navigate('/engineer/new')}
              className="bg-white text-nesma-dark px-6 py-3 rounded-xl font-bold hover:bg-nesma-secondary transition-all flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              <PlusCircle size={20} className="text-nesma-primary" />
              <span>Material Request</span>
            </button>
            <button
              onClick={() => navigate('/engineer/new')}
              className="bg-white/10 backdrop-blur-md text-white px-6 py-3 rounded-xl font-bold hover:bg-white/20 transition-all border border-white/20 flex items-center gap-2"
            >
              <Truck size={20} className="text-nesma-secondary" />
              <span>Transport</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<CheckCircle size={18} />} label="Completed" value={stats.completed} color="emerald" />
        <StatCard icon={<Clock size={18} />} label="In Progress" value={stats.inProgress} color="blue" />
        <StatCard icon={<AlertTriangle size={18} />} label="Pending" value={stats.pending} color="amber" />
        <StatCard icon={<BarChart3 size={18} />} label="Total Value" value={`${stats.totalValue.toLocaleString()} SAR`} color="nesma" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Requests List */}
        <div className="lg:col-span-2 glass-card rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
            <h3 className="font-bold text-lg text-white flex items-center gap-3">
              <span className="w-1 h-6 bg-nesma-secondary rounded-full"></span>
              Recent Requests
            </h3>
            <button
              onClick={() => navigate('/engineer/my-requests')}
              className="text-sm text-nesma-secondary hover:text-white font-medium flex items-center gap-1 transition-colors"
            >
              View All <ArrowRight size={14} />
            </button>
          </div>
          <div className="divide-y divide-white/5">
            {allRequests.slice(0, 5).map(req => (
              <div key={req.id} className="flex items-center justify-between p-5 hover:bg-white/5 transition-colors group cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${req.type === 'JO' ? 'bg-orange-500/20 text-orange-400' : 'bg-blue-500/20 text-blue-400'}`}>
                    {req.type === 'JO' ? <Truck size={20} /> : <Package size={20} />}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-200 group-hover:text-white transition-colors text-sm">{req.title}</h4>
                    <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                      <span className="font-mono bg-white/10 px-1.5 py-0.5 rounded text-gray-400 font-medium">{req.id}</span>
                      <span className="text-gray-600">•</span>
                      <span>{req.date}</span>
                      {req.value > 0 && (
                        <>
                          <span className="text-gray-600">•</span>
                          <span className="text-nesma-secondary">{req.value.toLocaleString()} SAR</span>
                        </>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <StatusBadge status={req.status} />
                  <ArrowRight size={16} className="text-gray-600 group-hover:text-nesma-secondary transition-colors" />
                </div>
              </div>
            ))}
            {allRequests.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm">No requests yet</div>
            )}
          </div>
        </div>

        {/* Project Summary */}
        <div className="space-y-6">
          <div className="glass-card p-6 rounded-2xl">
            <h3 className="font-bold text-lg text-white mb-6 flex items-center gap-3">
              <span className="w-1 h-6 bg-nesma-secondary rounded-full"></span>
              Project Summary
            </h3>

            <div className="space-y-4">
              <div className="p-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-500/20 p-2 rounded-lg text-emerald-400"><CheckCircle size={18} /></div>
                  <span className="font-medium text-gray-300">Completed</span>
                </div>
                <span className="text-2xl font-bold text-white">{stats.completed}</span>
              </div>

              <div className="p-4 bg-blue-500/10 rounded-xl border border-blue-500/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-500/20 p-2 rounded-lg text-blue-400"><Clock size={18} /></div>
                  <span className="font-medium text-gray-300">In Progress</span>
                </div>
                <span className="text-2xl font-bold text-white">{stats.inProgress}</span>
              </div>

              <div className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-amber-500/20 p-2 rounded-lg text-amber-400"><AlertTriangle size={18} /></div>
                  <span className="font-medium text-gray-300">Pending</span>
                </div>
                <span className="text-2xl font-bold text-white">{stats.pending}</span>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm text-gray-400 font-medium">Material Budget</p>
                <p className="text-xs text-nesma-secondary font-bold">{Math.min(Math.round((stats.totalValue / 200000) * 100), 100)}%</p>
              </div>
              <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-nesma-primary to-nesma-secondary h-2 rounded-full shadow-[0_0_10px_rgba(128,209,233,0.5)]"
                  style={{ width: `${Math.min((stats.totalValue / 200000) * 100, 100)}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-2">{stats.totalValue.toLocaleString()} / 200,000 SAR</p>
            </div>
          </div>

          {/* Low Stock Alerts */}
          {projectInventory.filter(i => i.stockStatus !== 'In Stock').length > 0 && (
            <div className="glass-card p-6 rounded-2xl">
              <h3 className="font-bold text-sm text-amber-400 mb-4 flex items-center gap-2">
                <AlertTriangle size={16} />
                Stock Alerts
              </h3>
              <div className="space-y-3">
                {projectInventory.filter(i => i.stockStatus !== 'In Stock').map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-amber-500/5 rounded-lg border border-amber-500/10">
                    <div>
                      <span className="text-sm text-gray-200">{item.name}</span>
                      <span className="text-xs text-gray-500 block">{item.code}</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      item.stockStatus === 'Out of Stock' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
                    }`}>{item.stockStatus === 'Out of Stock' ? 'Out of Stock' : 'Low Stock'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============ Helper Components ============

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; color: string }> = ({ icon, label, value, color }) => (
  <div className="glass-card p-5 rounded-xl">
    <div className="flex items-center gap-3 mb-3">
      <div className={`p-2 rounded-lg ${
        color === 'emerald' ? 'bg-emerald-500/20 text-emerald-400' :
        color === 'blue' ? 'bg-blue-500/20 text-blue-400' :
        color === 'amber' ? 'bg-amber-500/20 text-amber-400' :
        'bg-nesma-secondary/20 text-nesma-secondary'
      }`}>{icon}</div>
      <span className="text-xs text-gray-400">{label}</span>
    </div>
    <p className="text-2xl font-bold text-white">{value}</p>
  </div>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const styles: Record<string, string> = {
    'Completed': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'Issued': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'Approved': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'In Progress': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'Assigning': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'Pending Approval': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'Draft': 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    'New': 'bg-gray-500/10 text-gray-400 border-gray-500/20',
    'Pending': 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    'Rejected': 'bg-red-500/10 text-red-400 border-red-500/20',
    'Cancelled': 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return (
    <span className={`px-3 py-1 text-xs rounded-full font-medium border ${styles[status] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
      {status}
    </span>
  );
};
