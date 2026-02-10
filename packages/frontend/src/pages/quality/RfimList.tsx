import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  FileCheck,
  X,
} from 'lucide-react';
import { useRfimList } from '@/api/hooks/useRfim';
import { DocumentActions } from '@/components/DocumentActions';
import { ExportButton } from '@/components/ExportButton';
import type { RFIM } from '@nit-scs-v2/shared/types';

// Custom Badge for Inspection Status
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  let colorClass = 'bg-gray-500/10 text-gray-400 border-gray-500/20';
  let Icon = Clock;

  switch (status) {
    case 'Pass':
      colorClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      Icon = CheckCircle;
      break;
    case 'Conditional':
      colorClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      Icon = AlertTriangle;
      break;
    case 'Fail':
      colorClass = 'bg-red-500/10 text-red-400 border-red-500/20';
      Icon = XCircle;
      break;
    case 'Pending':
      colorClass = 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      Icon = Clock;
      break;
  }

  return (
    <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${colorClass} w-fit`}>
      <Icon size={12} />
      {status}
    </span>
  );
};

// Custom Badge for Priority
const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
  let colorClass = 'text-gray-400';

  switch (priority) {
    case 'Critical':
      colorClass = 'text-red-400 font-bold';
      break;
    case 'Urgent':
      colorClass = 'text-amber-400 font-semibold';
      break;
    case 'Normal':
      colorClass = 'text-emerald-400';
      break;
  }

  return <span className={`text-xs ${colorClass}`}>{priority}</span>;
};

export const RfimList: React.FC = () => {
  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedItem, setSelectedItem] = useState<RFIM | null>(null);

  const rfimQuery = useRfimList({ pageSize: 200 });
  const rfimData = (rfimQuery.data?.data ?? []) as RFIM[];

  // Filter Logic
  const filteredData = useMemo(() => {
    return rfimData.filter(item => {
      const id = (item.id as string) || '';
      const mrrvId = (item.mrrvId as string) || '';
      const inspector = (item.inspector as string) || '';
      const status = (item.status as string) || '';
      const priority = (item.priority as string) || '';

      const matchesSearch =
        id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mrrvId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inspector.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = filterStatus ? status === filterStatus : true;
      const matchesPriority = filterPriority ? priority === filterPriority : true;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [rfimData, searchQuery, filterStatus, filterPriority]);

  if (rfimQuery.isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="animate-pulse bg-white/5 rounded h-12 w-full"></div>
        ))}
      </div>
    );
  }

  if (rfimQuery.isError) {
    return <div className="text-red-400 p-4">Failed to load inspection requests</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white glow-text">Inspection Requests (QCI)</h1>
          <p className="text-sm text-gray-400 mt-1 flex items-center gap-2">
            <span className="bg-nesma-primary/20 text-nesma-secondary px-2 py-0.5 rounded text-xs border border-nesma-primary/30">
              QC-QCI
            </span>
            Manage quality control inspections and results
          </p>
        </div>
        <div className="flex gap-3">
          <ExportButton
            data={filteredData as unknown as Record<string, unknown>[]}
            columns={[
              { key: 'formNumber', label: 'QCI #' },
              { key: 'mrrvId', label: 'GRN Ref' },
              { key: 'status', label: 'Status' },
              { key: 'priority', label: 'Priority' },
              { key: 'date', label: 'Date' },
            ]}
            filename="RFIM"
          />
          <button
            onClick={() => navigate('/admin/forms/qci')}
            className="flex items-center gap-2 px-4 py-2 bg-nesma-primary text-white rounded-lg hover:bg-nesma-accent text-sm shadow-lg shadow-nesma-primary/20 transition-all transform hover:-translate-y-0.5"
          >
            <Plus size={16} />
            <span>New Request</span>
          </button>
        </div>
      </div>

      {/* Glass Table Container */}
      <div className="glass-card rounded-2xl overflow-hidden">
        {/* Advanced Toolbar */}
        <div className="p-4 border-b border-white/10 flex flex-col lg:flex-row gap-4 justify-between items-center bg-white/5">
          {/* Search */}
          <div className="relative flex-1 w-full lg:max-w-xs">
            <Search size={18} className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search QCI ID, GRN, Inspector..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-nesma-secondary/50 focus:ring-1 focus:ring-nesma-secondary/50 transition-all"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 w-full lg:w-auto items-center">
            <div className="flex items-center gap-2 px-3 py-2 bg-black/20 border border-white/10 rounded-lg">
              <Filter size={14} className="text-nesma-secondary" />
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Filters:</span>
            </div>

            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-nesma-secondary/50 cursor-pointer hover:bg-white/5"
            >
              <option value="">All Statuses</option>
              <option value="Pass">Pass</option>
              <option value="Fail">Fail</option>
              <option value="Conditional">Conditional</option>
              <option value="Pending">Pending</option>
            </select>

            <select
              value={filterPriority}
              onChange={e => setFilterPriority(e.target.value)}
              className="bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-nesma-secondary/50 cursor-pointer hover:bg-white/5"
            >
              <option value="">All Priorities</option>
              <option value="Normal">Normal</option>
              <option value="Urgent">Urgent</option>
              <option value="Critical">Critical</option>
            </select>

            {(filterStatus || filterPriority) && (
              <button
                onClick={() => {
                  setFilterStatus('');
                  setFilterPriority('');
                }}
                className="text-xs text-red-400 hover:text-red-300 underline ml-2"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="nesma-table-head text-nesma-secondary text-xs uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-4 whitespace-nowrap">QCI ID</th>
                <th className="px-6 py-4 whitespace-nowrap">GRN Ref</th>
                <th className="px-6 py-4 whitespace-nowrap">Inspection Type</th>
                <th className="px-6 py-4 whitespace-nowrap">Priority</th>
                <th className="px-6 py-4 whitespace-nowrap">Status</th>
                <th className="px-6 py-4 whitespace-nowrap">Inspector</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm text-gray-300">
              {filteredData.length > 0 ? (
                filteredData.map((row, idx) => {
                  const rowId = (row.id as string) || '';
                  const rowMrrvId = (row.mrrvId as string) || '';
                  const rowInspectionType = (row.inspectionType as string) || '';
                  const rowPriority = (row.priority as string) || '';
                  const rowStatus = (row.status as string) || '';
                  const rowInspector = (row.inspector as string) || '';
                  return (
                    <tr key={idx} className="nesma-table-row group hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-white">{rowId}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-400 hover:text-nesma-secondary transition-colors cursor-pointer">
                        {rowMrrvId}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">{rowInspectionType}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <PriorityBadge priority={rowPriority} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={rowStatus} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-nesma-primary/50 flex items-center justify-center text-[10px] text-white font-bold border border-white/10">
                            {rowInspector ? rowInspector.charAt(0) : '?'}
                          </div>
                          <span className="text-gray-400">{rowInspector || 'Unassigned'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setSelectedItem(row)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-nesma-secondary hover:text-white transition-colors"
                            title="View Details"
                          >
                            <Eye size={16} />
                          </button>
                          <DocumentActions resource="rfim" row={row as unknown as Record<string, unknown>} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                        <FileCheck size={24} className="text-gray-600" />
                      </div>
                      <p>No inspection requests found matching your filters</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer/Pagination */}
        <div className="p-4 border-t border-white/10 flex justify-between items-center bg-white/5 text-xs text-gray-500">
          <span>Showing {filteredData.length} records</span>
          <span>QC Module v1.0</span>
        </div>
      </div>

      {/* RFIM Detail Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="glass-card w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#0E2841]"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-nesma-primary/20 rounded-lg text-nesma-secondary border border-nesma-primary/30">
                  <FileCheck size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Inspection Details</h3>
                  <p className="text-sm text-gray-400">{selectedItem.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-8 space-y-8">
              {/* Status Section */}
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                <div className="space-y-1">
                  <span className="text-xs text-gray-400 uppercase tracking-wider">Current Status</span>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={selectedItem.status} />
                    <span className="text-gray-500">•</span>
                    <PriorityBadge priority={selectedItem.priority} />
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-400 uppercase tracking-wider block mb-1">GRN Reference</span>
                  <span className="text-white font-mono font-medium">{selectedItem.mrrvId}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1 block">
                      Inspection Type
                    </label>
                    <p className="text-white text-lg">{selectedItem.inspectionType}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1 block">
                      Assigned Inspector
                    </label>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-nesma-primary to-nesma-dark flex items-center justify-center text-xs text-white font-bold border border-white/10 shadow-lg">
                        {selectedItem.inspector ? selectedItem.inspector.charAt(0) : '?'}
                      </div>
                      <span className="text-gray-200">{selectedItem.inspector || 'Unassigned'}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1 block">
                      Form Number
                    </label>
                    <p className="text-gray-300 font-mono">{selectedItem.formNumber || 'N/A'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider font-medium mb-1 block">
                      Inspector Notes
                    </label>
                    <p className="text-gray-300 text-sm leading-relaxed bg-black/20 p-3 rounded-lg border border-white/5 min-h-[80px]">
                      {selectedItem.notes || 'No additional notes provided.'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-white/10 bg-white/5 flex justify-end gap-3">
              <button
                onClick={() => setSelectedItem(null)}
                className="px-5 py-2.5 bg-transparent hover:bg-white/5 text-gray-300 rounded-xl text-sm font-medium transition-colors border border-white/10"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const id = selectedItem?.id;
                  setSelectedItem(null);
                  if (id) navigate(`/admin/forms/qci/${id}`);
                }}
                className="px-5 py-2.5 bg-nesma-primary hover:bg-nesma-accent text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-nesma-primary/20"
              >
                Edit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
