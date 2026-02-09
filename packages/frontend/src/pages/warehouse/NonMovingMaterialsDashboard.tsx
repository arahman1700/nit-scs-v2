import React, { useState, useMemo } from 'react';
import { Search, Filter, Download, AlertTriangle, Package, Building2, Clock, X, Eye, BarChart3 } from 'lucide-react';

// Real data from NON MOVING MATERIALS.xlsx
const NON_MOVING_DATA = [
  { sn: 1, warehouse: "Asfan", description: "HS Joint Kit", unit: "box", location: "inside store", qty: 4, project: "old stock", remarks: "Past 4 year haven't moved" },
  { sn: 2, warehouse: "Asfan", description: "Heavy Duty Safety Switch", unit: "box", location: "inside store", qty: 7, project: "old stock", remarks: "Past 4 year haven't moved" },
  { sn: 3, warehouse: "Asfan", description: "Fibre system", unit: "pcs", location: "inside store", qty: 2, project: "old stock", remarks: "Past 4 year haven't moved" },
  { sn: 4, warehouse: "Asfan", description: "Insulator with fixing systems", unit: "box", location: "inside store", qty: 1, project: "old stock", remarks: "Past 4 year haven't moved" },
  { sn: 5, warehouse: "Asfan", description: "HS outdoor termination", unit: "box", location: "inside store", qty: 2, project: "old stock", remarks: "Past 4 year haven't moved" },
  { sn: 6, warehouse: "Asfan", description: "Insulating parts including conductive screen", unit: "pcs", location: "inside store", qty: 2, project: "old stock", remarks: "Past 4 year haven't moved" },
  { sn: 7, warehouse: "Asfan", description: "Insulating plug w/cap k650 Bip", unit: "pcs", location: "inside store", qty: 2, project: "old stock", remarks: "Past 4 year haven't moved" },
  { sn: 8, warehouse: "Asfan", description: "SLC A6TH/5-400 VPE.SA", unit: "box", location: "inside store", qty: 1, project: "old stock", remarks: "Past 4 year haven't moved" },
  { sn: 9, warehouse: "Asfan", description: "Alarm System", unit: "pcs", location: "inside store", qty: 4, project: "old stock", remarks: "Past 4 year haven't moved" },
  { sn: 10, warehouse: "Asfan", description: "Conduit Fittings", unit: "pcs", location: "inside store", qty: 100, project: "old stock", remarks: "Past 4 year haven't moved" },
  { sn: 11, warehouse: "Asfan", description: "Spare parts set", unit: "pcs", location: "inside store", qty: 10, project: "old stock", remarks: "Past 4 year haven't moved" },
  { sn: 12, warehouse: "Asfan", description: "SENOID valve (0063)", unit: "pcs", location: "inside store", qty: 2, project: "old stock", remarks: "Past 4 year haven't moved" },
  { sn: 13, warehouse: "Asfan", description: "SJE 185-12", unit: "pcs", location: "inside store", qty: 84, project: "old stock", remarks: "Past 4 year haven't moved" },
  { sn: 14, warehouse: "Asfan", description: "SJE 300-M10", unit: "pcs", location: "inside store", qty: 18, project: "old stock", remarks: "Past 4 year haven't moved" },
  { sn: 15, warehouse: "Asfan", description: "KSE - D34 A300-M12", unit: "pcs", location: "inside store", qty: 85, project: "old stock", remarks: "Past 4 year haven't moved" },
  { sn: 16, warehouse: "Asfan", description: "Pilot Wire Differential Relay", unit: "pcs", location: "inside store", qty: 1, project: "old stock", remarks: "Past 4 year haven't moved" },
  { sn: 17, warehouse: "Asfan", description: "Alstom MMIG02", unit: "pcs", location: "inside store", qty: 5, project: "old stock", remarks: "Past 4 year haven't moved" },
  { sn: 18, warehouse: "Asfan", description: "ABB MCX913-1-6-1", unit: "pcs", location: "inside store", qty: 1, project: "old stock", remarks: "Past 4 year haven't moved" },
  { sn: 19, warehouse: "Asfan", description: "ABB RTXP24", unit: "pcs", location: "inside store", qty: 3, project: "old stock", remarks: "Past 4 year haven't moved" },
  { sn: 20, warehouse: "Asfan", description: "Protection Relay REG 670", unit: "pcs", location: "inside store", qty: 2, project: "old stock", remarks: "Past 4 year haven't moved" },
  { sn: 21, warehouse: "Jafurah", description: "Cable Tray 300mm Perforated", unit: "pcs", location: "yard", qty: 150, project: "Project Materials", remarks: "Excess from project" },
  { sn: 22, warehouse: "Jafurah", description: "Cable Tray Cover 300mm", unit: "pcs", location: "yard", qty: 120, project: "Project Materials", remarks: "Excess from project" },
  { sn: 23, warehouse: "Jafurah", description: "Unistrut Channel 41x41", unit: "meter", location: "yard", qty: 500, project: "Project Materials", remarks: "Excess from project" },
  { sn: 24, warehouse: "Jafurah", description: "Spring Nut M10", unit: "pcs", location: "inside store", qty: 2000, project: "Project Materials", remarks: "Excess from project" },
  { sn: 25, warehouse: "Jafurah", description: "Hex Bolt M10x40", unit: "pcs", location: "inside store", qty: 1500, project: "Project Materials", remarks: "Excess from project" },
  { sn: 26, warehouse: "Asfan", description: "Multi Function Meter", unit: "pcs", location: "inside store", qty: 8, project: "Optern materials", remarks: "Past 3 year haven't moved" },
  { sn: 27, warehouse: "Asfan", description: "Current Transformer 5A", unit: "pcs", location: "inside store", qty: 24, project: "Optern materials", remarks: "Past 3 year haven't moved" },
  { sn: 28, warehouse: "Asfan", description: "Voltage Transformer 110V", unit: "pcs", location: "inside store", qty: 12, project: "Optern materials", remarks: "Past 3 year haven't moved" },
  { sn: 29, warehouse: "Jafurah", description: "Safety Helmet White", unit: "pcs", location: "inside store", qty: 50, project: "Project Tools", remarks: "Unused safety equipment" },
  { sn: 30, warehouse: "Jafurah", description: "Safety Vest Orange", unit: "pcs", location: "inside store", qty: 40, project: "Project Tools", remarks: "Unused safety equipment" },
];

export const NonMovingMaterialsDashboard: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [selectedItem, setSelectedItem] = useState<typeof NON_MOVING_DATA[0] | null>(null);

  // Get unique values
  const warehouses = useMemo(() => [...new Set(NON_MOVING_DATA.map(d => d.warehouse))], []);
  const projects = useMemo(() => [...new Set(NON_MOVING_DATA.map(d => d.project))], []);

  // Filter data
  const filteredData = useMemo(() => {
    return NON_MOVING_DATA.filter(item => {
      const matchesSearch = item.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesWarehouse = !filterWarehouse || item.warehouse === filterWarehouse;
      const matchesProject = !filterProject || item.project === filterProject;
      return matchesSearch && matchesWarehouse && matchesProject;
    });
  }, [searchQuery, filterWarehouse, filterProject]);

  // Stats
  const stats = useMemo(() => {
    const totalQty = filteredData.reduce((acc, item) => acc + item.qty, 0);
    const byWarehouse: Record<string, number> = {};
    const byProject: Record<string, number> = {};

    filteredData.forEach(item => {
      byWarehouse[item.warehouse] = (byWarehouse[item.warehouse] || 0) + item.qty;
      byProject[item.project] = (byProject[item.project] || 0) + item.qty;
    });

    return {
      totalItems: filteredData.length,
      totalQty,
      byWarehouse,
      byProject,
    };
  }, [filteredData]);

  const getProjectColor = (project: string) => {
    switch (project) {
      case 'old stock': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'Optern materials': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'Project Materials': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Project Tools': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white glow-text flex items-center gap-3">
            <AlertTriangle className="text-amber-400" />
            Non-Moving Materials
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Materials that haven't moved for an extended period and need review
          </p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2 border border-white/20 rounded-lg text-gray-300 hover:bg-white/10 text-sm transition-all">
            <Download size={16} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-xl border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <AlertTriangle size={20} className="text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-400">{stats.totalItems}</p>
              <p className="text-xs text-gray-400">Total Non-Moving Items</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl border border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-nesma-primary/20 rounded-lg">
              <Package size={20} className="text-nesma-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.totalQty.toLocaleString()}</p>
              <p className="text-xs text-gray-400">Total Quantity</p>
            </div>
          </div>
        </div>
        {Object.entries(stats.byWarehouse).map(([wh, qty]) => (
          <div key={wh} className="glass-card p-4 rounded-xl border border-white/10">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Building2 size={20} className="text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{qty.toLocaleString()}</p>
                <p className="text-xs text-gray-400">{wh}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Category Breakdown */}
      <div className="glass-card rounded-xl p-4 border border-white/10">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <BarChart3 size={16} className="text-nesma-secondary" />
          Category Breakdown
        </h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(stats.byProject).map(([project, qty]) => (
            <div key={project} className={`px-4 py-2 rounded-lg border ${getProjectColor(project)}`}>
              <p className="text-sm font-medium">{project}</p>
              <p className="text-lg font-bold">{qty} items</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filters & Table */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/10 bg-white/5">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search size={18} className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-nesma-secondary/50"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <select
                value={filterWarehouse}
                onChange={(e) => setFilterWarehouse(e.target.value)}
                className="bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-nesma-secondary/50"
              >
                <option value="">All Warehouses</option>
                {warehouses.map(w => <option key={w} value={w}>{w}</option>)}
              </select>

              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-nesma-secondary/50"
              >
                <option value="">All Categories</option>
                {projects.map(p => <option key={p} value={p}>{p}</option>)}
              </select>

              {/* View Toggle */}
              <div className="flex border border-white/10 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-2 text-sm ${viewMode === 'table' ? 'bg-nesma-primary text-white' : 'text-gray-400 hover:bg-white/5'}`}
                >
                  Table
                </button>
                <button
                  onClick={() => setViewMode('cards')}
                  className={`px-3 py-2 text-sm ${viewMode === 'cards' ? 'bg-nesma-primary text-white' : 'text-gray-400 hover:bg-white/5'}`}
                >
                  Cards
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Table View */}
        {viewMode === 'table' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="nesma-table-head text-nesma-secondary text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-4">#</th>
                  <th className="px-4 py-4">Warehouse</th>
                  <th className="px-4 py-4">Description</th>
                  <th className="px-4 py-4">Unit</th>
                  <th className="px-4 py-4">Location</th>
                  <th className="px-4 py-4">Qty</th>
                  <th className="px-4 py-4">Category</th>
                  <th className="px-4 py-4">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm text-gray-300">
                {filteredData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 text-gray-500">{row.sn}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-xs">{row.warehouse}</span>
                    </td>
                    <td className="px-4 py-3 text-white">{row.description}</td>
                    <td className="px-4 py-3 text-gray-400">{row.unit}</td>
                    <td className="px-4 py-3 text-gray-400">{row.location}</td>
                    <td className="px-4 py-3 font-mono text-lg text-white">{row.qty}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs border ${getProjectColor(row.project)}`}>{row.project}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate" title={row.remarks}>{row.remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Cards View */}
        {viewMode === 'cards' && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredData.map((row, idx) => (
              <div
                key={idx}
                className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all"
              >
                <div className="flex justify-between items-start mb-3">
                  <span className="px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-xs">{row.warehouse}</span>
                  <span className={`px-2 py-1 rounded text-xs border ${getProjectColor(row.project)}`}>{row.project}</span>
                </div>
                <h3 className="text-white font-medium mb-2">{row.description}</h3>
                <div className="flex justify-between items-end">
                  <div className="text-xs text-gray-400">
                    <p>{row.location}</p>
                    <p>{row.unit}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-amber-400">{row.qty}</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-white/10">
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock size={12} />
                    {row.remarks}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-white/5 flex justify-between items-center text-xs text-gray-400">
          <span>Showing {filteredData.length} of {NON_MOVING_DATA.length} non-moving items</span>
          <span>Non-Moving Materials Report</span>
        </div>
      </div>
    </div>
  );
};
