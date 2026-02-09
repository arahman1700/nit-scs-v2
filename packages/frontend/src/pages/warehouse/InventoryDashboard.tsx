import React, { useState, useMemo } from 'react';
import { Search, Filter, Download, Package, MapPin, Layers, BarChart3, X, Eye } from 'lucide-react';

// Real data from Inventory.ods (Dammam Warehouse - Wadi Dhahran & Qalah projects)
const INVENTORY_DATA = [
  { sn: 1, project: "WADI DHAHRAN", itemCode: "C210XA107NOSBBNDR", description: "CU/XLPE/CT/PVC-NFDR-BL CRS-FRO", size: "7x2.5", unit: "Mt", location: "Yard", subLocation: "Zone 1", balance: 299 },
  { sn: 2, project: "WADI DHAHRAN", itemCode: "NO STICKER # 18", description: "CU/XLPE/LPAD/PVC/ 0.06/1KV", size: "4X2.5", unit: "Mt", location: "Yard", subLocation: "Zone 1", balance: 512 },
  { sn: 3, project: "WADI DHAHRAN", itemCode: "C213XA107NOS83NDR", description: "CU/XLPE/CT/ PVC-NFR GREY CRS", size: "7X6", unit: "Mt", location: "Yard", subLocation: "Zone 1", balance: 23 },
  { sn: 4, project: "WADI DHAHRAN", itemCode: "C418XA104", description: "CU/XLPE/SWA/PVC/ 0.6/1KV", size: "4X50", unit: "Mt", location: "Yard", subLocation: "Zone 1", balance: 409 },
  { sn: 5, project: "WADI DHAHRAN", itemCode: "23015613", description: "CU/XLPE/LAT/PVC-FROR", size: "1X630/200 15KV", unit: "Mt", location: "Yard", subLocation: "Zone 1", balance: 30 },
  { sn: 6, project: "WADI DHAHRAN", itemCode: "23015613", description: "CU/XLPE/LAT/PVC-FROR", size: "1X630/200 15KV", unit: "Mt", location: "Yard", subLocation: "Zone 1", balance: 241 },
  { sn: 7, project: "WADI DHAHRAN", itemCode: "C345XA101", description: "XLPE/PVC-0.6 1KV", size: "1X95", unit: "Mt", location: "Yard", subLocation: "Zone 1", balance: 149 },
  { sn: 8, project: "WADI DHAHRAN", itemCode: "C349XA101", description: "CU/XLPE/PVC-0.6 1KV", size: "1X240", unit: "Mt", location: "Yard", subLocation: "Zone 1", balance: 804 },
  { sn: 9, project: "WADI DHAHRAN", itemCode: "C210XA107NOSBBNDR", description: "CU/XLPE/CT/PVC-NFDR-BL CRS-FRO", size: "7x2.5", unit: "Mt", location: "Yard", subLocation: "Zone 1", balance: 1035 },
  { sn: 10, project: "WADI DHAHRAN", itemCode: "C210XA107NOSBBNDR", description: "CU/XLPE/CT/PVC-NFDR-BL CRS-FRO", size: "7x2.5", unit: "Mt", location: "Yard", subLocation: "Zone 1", balance: 1042 },
  { sn: 11, project: "WADI DHAHRAN", itemCode: "C212XA1020WSB01NDR", description: "CU/XLPE/SWA/PVC/ 0.6/1KV-NDFR", size: "2X4", unit: "Mt", location: "Yard", subLocation: "Zone 1", balance: 281 },
  { sn: 12, project: "WADI DHAHRAN", itemCode: "C210XA107NOSB83NDR", description: "CU/XLPE/CT/PVC-NFDR-BK GY CORE", size: "7X2.5", unit: "Mt", location: "Yard", subLocation: "Zone 1", balance: 1035 },
  { sn: 13, project: "WADI DHAHRAN", itemCode: "C210XA107NOSB83NDR", description: "CU/XLPE/CT/PVC-NFDR-BK GY CORE", size: "7X2.5", unit: "Mt", location: "Yard", subLocation: "Zone 1", balance: 1020 },
  { sn: 14, project: "WADI DHAHRAN", itemCode: "C210XA107NOSB83NDR", description: "CU/XLPE/CT/PVC-NFDR-BK GY CORE", size: "7X2.5", unit: "Mt", location: "Yard", subLocation: "Zone 1", balance: 988 },
  { sn: 15, project: "WADI DHAHRAN", itemCode: "C212XA1020WSB01NDR", description: "CU/XLPE/SWA/PVC/ 0.6/1KV-NDFR", size: "2X4", unit: "Mt", location: "Yard", subLocation: "Zone 1", balance: 886 },
  { sn: 16, project: "WADI DHAHRAN", itemCode: "C314XA1020WSB01NDR", description: "CU/XLPE/SWA/PVC/ 0.6/1KV-NDFR", size: "2X10", unit: "Mt", location: "Yard", subLocation: "Zone 1", balance: 88 },
  { sn: 17, project: "WADI DHAHRAN", itemCode: "C314XA1020WSB01NDR", description: "CU/XLPE/SWA/PVC/ 0.6/1KV-NDFR", size: "2X10", unit: "Mt", location: "Yard", subLocation: "Zone 1", balance: 809 },
  { sn: 18, project: "WADI DHAHRAN", itemCode: "C213XA1010WSB08NDR", description: "CU/XLPE/SWA/PVC-0.6/1KV-NDFR", size: "4X6", unit: "Mt", location: "Yard", subLocation: "Zone 1", balance: 47 },
  { sn: 19, project: "WADI DHAHRAN", itemCode: "C351XA101OOSB", description: "CU/XLPE/PVC-FR-0.6/1KV", size: "1X400", unit: "Mt", location: "Yard", subLocation: "Zone 1", balance: 668 },
  { sn: 20, project: "WADI DHAHRAN", itemCode: "C349XA101", description: "CU/XLPE/PVC-0.6 1KV", size: "1X240", unit: "Mt", location: "Yard", subLocation: "Zone 1", balance: 811 },
  { sn: 21, project: "QALAH 115 KV SUB", itemCode: "C420XA104", description: "CU/XLPE/SWA/PVC-0.6/1KV", size: "4X95", unit: "Mt", location: "Yard", subLocation: "Zone 2", balance: 520 },
  { sn: 22, project: "QALAH 115 KV SUB", itemCode: "C418XA104", description: "CU/XLPE/SWA/PVC/ 0.6/1KV", size: "4X50", unit: "Mt", location: "Yard", subLocation: "Zone 2", balance: 345 },
  { sn: 23, project: "QALAH 115 KV SUB", itemCode: "C416XA104", description: "CU/XLPE/SWA/PVC/ 0.6/1KV", size: "4X35", unit: "Mt", location: "Yard", subLocation: "Zone 2", balance: 210 },
  { sn: 24, project: "QALAH 115 KV SUB", itemCode: "C212XA1020", description: "CU/XLPE/SWA/PVC/ 0.6/1KV", size: "2X4", unit: "Mt", location: "Yard", subLocation: "Zone 2", balance: 1250 },
  { sn: 25, project: "QALAH 115 KV SUB", itemCode: "C314XA1020", description: "CU/XLPE/SWA/PVC/ 0.6/1KV", size: "2X10", unit: "Mt", location: "Yard", subLocation: "Zone 2", balance: 980 },
];

const getStockStatus = (balance: number): { label: string; color: string } => {
  if (balance === 0) return { label: 'Out of Stock', color: 'bg-red-500/20 text-red-400 border-red-500/30' };
  if (balance < 100) return { label: 'Low Stock', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
  if (balance < 500) return { label: 'Medium', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
  return { label: 'In Stock', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
};

export const InventoryDashboard: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterProject, setFilterProject] = useState('');
  const [filterLocation, setFilterLocation] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [selectedItem, setSelectedItem] = useState<typeof INVENTORY_DATA[0] | null>(null);

  // Get unique values
  const projects = useMemo(() => [...new Set(INVENTORY_DATA.map(d => d.project))], []);
  const locations = useMemo(() => [...new Set(INVENTORY_DATA.map(d => d.subLocation))], []);

  // Filter data
  const filteredData = useMemo(() => {
    return INVENTORY_DATA.filter(item => {
      const matchesSearch = item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.itemCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.size.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesProject = !filterProject || item.project === filterProject;
      const matchesLocation = !filterLocation || item.subLocation === filterLocation;
      return matchesSearch && matchesProject && matchesLocation;
    });
  }, [searchQuery, filterProject, filterLocation]);

  // Stats
  const stats = useMemo(() => {
    const totalBalance = filteredData.reduce((acc, item) => acc + item.balance, 0);
    const lowStock = filteredData.filter(item => item.balance < 100 && item.balance > 0).length;
    const outOfStock = filteredData.filter(item => item.balance === 0).length;
    return {
      totalItems: filteredData.length,
      totalBalance,
      lowStock,
      outOfStock,
      inStock: filteredData.length - lowStock - outOfStock,
    };
  }, [filteredData]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white glow-text flex items-center gap-3">
            <Package className="text-nesma-secondary" />
            Inventory Levels
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Real-time inventory levels - Dammam Warehouse
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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="glass-card p-4 rounded-xl border border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-nesma-primary/20 rounded-lg">
              <Package size={20} className="text-nesma-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.totalItems}</p>
              <p className="text-xs text-gray-400">Total Items</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl border border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Layers size={20} className="text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.totalBalance.toLocaleString()}</p>
              <p className="text-xs text-gray-400">Total Balance (Mt)</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl border border-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <BarChart3 size={20} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-400">{stats.inStock}</p>
              <p className="text-xs text-gray-400">In Stock</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl border border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <BarChart3 size={20} className="text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-400">{stats.lowStock}</p>
              <p className="text-xs text-gray-400">Low Stock</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl border border-red-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <BarChart3 size={20} className="text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-400">{stats.outOfStock}</p>
              <p className="text-xs text-gray-400">Out of Stock</p>
            </div>
          </div>
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
                placeholder="Search code, description, size..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-nesma-secondary/50"
              />
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3">
              <select
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-nesma-secondary/50"
              >
                <option value="">All Projects</option>
                {projects.map(p => <option key={p} value={p}>{p}</option>)}
              </select>

              <select
                value={filterLocation}
                onChange={(e) => setFilterLocation(e.target.value)}
                className="bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-nesma-secondary/50"
              >
                <option value="">All Locations</option>
                {locations.map(l => <option key={l} value={l}>{l}</option>)}
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
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-2 text-sm ${viewMode === 'grid' ? 'bg-nesma-primary text-white' : 'text-gray-400 hover:bg-white/5'}`}
                >
                  Grid
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
                  <th className="px-4 py-4">Project</th>
                  <th className="px-4 py-4">Code</th>
                  <th className="px-4 py-4">Description</th>
                  <th className="px-4 py-4">Size</th>
                  <th className="px-4 py-4">Location</th>
                  <th className="px-4 py-4">Balance</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm text-gray-300">
                {filteredData.map((row, idx) => {
                  const status = getStockStatus(row.balance);
                  return (
                    <tr key={idx} className="hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 text-gray-500">{row.sn}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-nesma-primary/20 text-nesma-secondary rounded text-xs">{row.project}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-white text-xs">{row.itemCode}</td>
                      <td className="px-4 py-3 max-w-xs truncate" title={row.description}>{row.description}</td>
                      <td className="px-4 py-3 text-gray-400">{row.size}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <MapPin size={12} />
                          {row.location} - {row.subLocation}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-lg text-white">{row.balance.toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs border ${status.color}`}>{status.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedItem(row)}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-nesma-secondary hover:text-white transition-colors"
                        >
                          <Eye size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Grid View */}
        {viewMode === 'grid' && (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredData.map((row, idx) => {
              const status = getStockStatus(row.balance);
              return (
                <div
                  key={idx}
                  className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all cursor-pointer"
                  onClick={() => setSelectedItem(row)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className="px-2 py-1 bg-nesma-primary/20 text-nesma-secondary rounded text-xs">{row.project}</span>
                    <span className={`px-2 py-1 rounded text-xs border ${status.color}`}>{status.label}</span>
                  </div>
                  <p className="text-white font-medium text-sm mb-1 line-clamp-2">{row.description}</p>
                  <p className="text-gray-400 text-xs mb-3 font-mono">{row.itemCode}</p>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-xs text-gray-500">Size: {row.size}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <MapPin size={10} />
                        {row.subLocation}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-white">{row.balance.toLocaleString()}</p>
                      <p className="text-xs text-gray-400">{row.unit}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-white/5 flex justify-between items-center text-xs text-gray-400">
          <span>Showing {filteredData.length} of {INVENTORY_DATA.length} items</span>
          <span>Dammam Warehouse Inventory</span>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedItem(null)}>
          <div className="glass-card w-full max-w-lg rounded-2xl overflow-hidden border border-white/10 bg-[#0E2841]" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-white/10 bg-white/5 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Item Details</h3>
              <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-white/10 rounded-lg">
                <X size={20} className="text-gray-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Item Code</p>
                  <p className="text-white font-mono">{selectedItem.itemCode}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Project</p>
                  <p className="text-nesma-secondary">{selectedItem.project}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Description</p>
                <p className="text-white">{selectedItem.description}</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Size</p>
                  <p className="text-white">{selectedItem.size}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Unit</p>
                  <p className="text-white">{selectedItem.unit}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Location</p>
                  <p className="text-white">{selectedItem.location} - {selectedItem.subLocation}</p>
                </div>
              </div>
              <div className="bg-white/5 rounded-xl p-4 text-center">
                <p className="text-xs text-gray-400 mb-1">Current Balance</p>
                <p className="text-4xl font-bold text-nesma-secondary">{selectedItem.balance.toLocaleString()}</p>
                <p className="text-sm text-gray-400">{selectedItem.unit}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
