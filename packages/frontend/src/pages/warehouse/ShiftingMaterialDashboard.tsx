import React, { useState, useMemo } from 'react';
import { Search, Filter, Download, ArrowRightLeft, Calendar, Package, Users, Building2, X, BarChart3 } from 'lucide-react';

// Real data from Shifting Material Report.ods
const SHIFTING_MATERIALS_DATA = [
  { material: "LV CABLE 1Cx400 Sq. mm 0.6/1 kv , CU/XLPE / PVC", qty: "732", date: "2025-09-12", sendProject: "QATIF SHATI", requestProject: "Farasan Island", requestedBy: "Ahmed Salah", issuedBy: "Dammam WH" },
  { material: "LV CABLE 1Cx400 Sq. mm 0.6/1 kv , CU/XLPE / PVC", qty: "721", date: "2025-09-12", sendProject: "URUBA", requestProject: "Farasan Island", requestedBy: "Ahmed Salah", issuedBy: "Dammam WH" },
  { material: "LV CABLE 1Cx400 Sq. mm 0.6/1 kv , CU/XLPE / PVC", qty: "724", date: "2025-09-12", sendProject: "QALAH", requestProject: "Farasan Island", requestedBy: "Ahmed Salah", issuedBy: "Dammam WH" },
  { material: "LV CABLE 4Cx95 Sq. mm 0.6/1 kv , CU/XLPE /SWA/ PVC", qty: "254", date: "2025-09-12", sendProject: "QALAH", requestProject: "Farasan Island", requestedBy: "Ahmed Salah", issuedBy: "Dammam WH" },
  { material: "LV CABLE 4Cx95 Sq. mm 0.6/1 kv , CU/XLPE /SWA/ PVC", qty: "243", date: "2025-09-12", sendProject: "BAYOUNIYAH", requestProject: "Farasan Island", requestedBy: "Ahmed Salah", issuedBy: "Dammam WH" },
  { material: "LV CABLE 4Cx25 Sq. mm 0.6/1 kv , CU/XLPE /SWA /PVC", qty: "973", date: "2025-09-12", sendProject: "BAYOUNIYA", requestProject: "Farasan Island", requestedBy: "Ahmed Salah", issuedBy: "Dammam WH" },
  { material: "2FMM DUPLEX ZIP CORDE FIBER OPTIC CABLE", qty: "1010", date: "2025-11-02", sendProject: "Surplus NIC", requestProject: "Farasan Island", requestedBy: "Ahmed Salah", issuedBy: "Tabuk WH" },
  { material: "Cable 1x300", qty: "157", date: "2026-10-04", sendProject: "Surplus", requestProject: "Farasan Island", requestedBy: "Ousama", issuedBy: "Asfan WH" },
  { material: "RGS Pipes 1\"", qty: "3000", date: "2025-11-02", sendProject: "Surplus", requestProject: "Farasan Island", requestedBy: "Ousama", issuedBy: "Asfan WH" },
  { material: "VT cables 7X6mm2 CU/XLPE/CTS/PVC 0.6/1KV", qty: "995", date: "2026-11-25", sendProject: "Qalaa", requestProject: "Aljazira", requestedBy: "Ahmed Shaban", issuedBy: "Dammam WH" },
  { material: "Control cable 12Cx2.5mm2 CU/XLPE/CTS/PVC 0.6/1KV", qty: "1018", date: "2026-11-25", sendProject: "Qalaa", requestProject: "Aljazira", requestedBy: "Ahmed Shaban", issuedBy: "Dammam WH" },
  { material: "CT Cables 4x4 CU/XLPE/PVC", qty: "870", date: "2026-11-25", sendProject: "NIC North", requestProject: "Aljazira", requestedBy: "Ahmed Shaban", issuedBy: "Tabuk WH" },
  { material: "Cable 1x50", qty: "750", date: "2025-11-30", sendProject: "SurplusSharafia", requestProject: "Diraia", requestedBy: "Ahmed Sallam", issuedBy: "Twiq WH" },
  { material: "Bare copper Conducter 150mm2", qty: "365", date: "2025-12-31", sendProject: "Surplus HARAM 3", requestProject: "WHD-3", requestedBy: "Naif Alghamdi", issuedBy: "HARAM 3" },
  { material: "4C × 6 mm2 CU/XLPE/CUT/PVC RED, YELLOW, BLUE and BLACK", qty: "386", date: "2025-12-31", sendProject: "Surplus HARAM 3", requestProject: "Tiba Univesity", requestedBy: "Fahad Almehmadi", issuedBy: "HARAM 3" },
  { material: "Security porta cabin", qty: "2", date: "2026-01-06", sendProject: "Asfan", requestProject: "Rumah", requestedBy: "Gaser", issuedBy: "Asfan" },
  { material: "1x70mm hitachi cable 6kv", qty: "140", date: "2026-01-06", sendProject: "NIC EV2 S/S", requestProject: "Aljazira", requestedBy: "Saper", issuedBy: "Tabuk WH" },
  { material: "Control Cable 4X2.5", qty: "1030", date: "2026-01-08", sendProject: "Qatif Fhati", requestProject: "Hafar Albatin", requestedBy: "Mohamed Alshamani", issuedBy: "Dammam WH" },
  { material: "Lighting fixture", qty: "19", date: "2026-01-10", sendProject: "Khobar Corniche SS", requestProject: "Wadi Aldhran", requestedBy: "Mahmoud", issuedBy: "Dammam WH" },
  { material: "1X400mm CU/XLPE/PVC-FR0.6/1KV", qty: "72", date: "2026-01-14", sendProject: "Alryadia", requestProject: "Dana 2", requestedBy: "Essam", issuedBy: "Dammam WH" },
  { material: "Cable - 4Cx 4 MM", qty: "1054", date: "2026-01-15", sendProject: "KSP8388", requestProject: "Jazira", requestedBy: "Samy", issuedBy: "Twiq WH" },
  { material: "Metal Spring for MV Cable Clamps", qty: "250", date: "2026-01-19", sendProject: "HDM", requestProject: "Buhairat", requestedBy: "Zeeshan", issuedBy: "Asfan" },
  { material: "03 Rooms Porta cabin", qty: "1", date: "2026-01-20", sendProject: "Tabuk WH", requestProject: "Modon Asir", requestedBy: "Hayman", issuedBy: "Tabuk WH" },
  { material: "HDG SFT-225 corner angel including screw accessories", qty: "1215", date: "2026-01-25", sendProject: "Surplus Defaa", requestProject: "Uruba", requestedBy: "Ahmed Nawarah", issuedBy: "Defaa" },
  { material: "1X240 Yellow/Green grounding cable", qty: "250", date: "2026-06-22", sendProject: "Qalaa", requestProject: "8388 King Salman Park", requestedBy: "Fahad Althawri", issuedBy: "Dammam WH" },
];

export const ShiftingMaterialDashboard: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSendProject, setFilterSendProject] = useState('');
  const [filterRequestProject, setFilterRequestProject] = useState('');
  const [filterIssuedBy, setFilterIssuedBy] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Get unique values for filters
  const sendProjects = useMemo(() => [...new Set(SHIFTING_MATERIALS_DATA.map(d => d.sendProject))].sort(), []);
  const requestProjects = useMemo(() => [...new Set(SHIFTING_MATERIALS_DATA.map(d => d.requestProject))].sort(), []);
  const issuedByList = useMemo(() => [...new Set(SHIFTING_MATERIALS_DATA.map(d => d.issuedBy))].sort(), []);

  // Filter data
  const filteredData = useMemo(() => {
    return SHIFTING_MATERIALS_DATA.filter(item => {
      const matchesSearch = item.material.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.requestedBy.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSend = !filterSendProject || item.sendProject === filterSendProject;
      const matchesRequest = !filterRequestProject || item.requestProject === filterRequestProject;
      const matchesIssued = !filterIssuedBy || item.issuedBy === filterIssuedBy;
      return matchesSearch && matchesSend && matchesRequest && matchesIssued;
    });
  }, [searchQuery, filterSendProject, filterRequestProject, filterIssuedBy]);

  // Stats
  const stats = useMemo(() => ({
    totalTransfers: filteredData.length,
    uniqueMaterials: new Set(filteredData.map(d => d.material)).size,
    uniqueProjects: new Set([...filteredData.map(d => d.sendProject), ...filteredData.map(d => d.requestProject)]).size,
    uniqueWarehouses: new Set(filteredData.map(d => d.issuedBy)).size,
  }), [filteredData]);

  const clearFilters = () => {
    setSearchQuery('');
    setFilterSendProject('');
    setFilterRequestProject('');
    setFilterIssuedBy('');
  };

  const hasActiveFilters = searchQuery || filterSendProject || filterRequestProject || filterIssuedBy;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white glow-text flex items-center gap-3">
            <ArrowRightLeft className="text-nesma-secondary" />
            Shifting Materials
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Track material transfers between projects and warehouses
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
        <div className="glass-card p-4 rounded-xl border border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-nesma-primary/20 rounded-lg">
              <ArrowRightLeft size={20} className="text-nesma-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.totalTransfers}</p>
              <p className="text-xs text-gray-400">Total Transfers</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl border border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <Package size={20} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.uniqueMaterials}</p>
              <p className="text-xs text-gray-400">Unique Items</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl border border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <Building2 size={20} className="text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.uniqueProjects}</p>
              <p className="text-xs text-gray-400">Projects</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl border border-white/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Users size={20} className="text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{stats.uniqueWarehouses}</p>
              <p className="text-xs text-gray-400">Warehouses</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-white/10 bg-white/5">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search size={18} className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search material or requester..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-nesma-secondary/50"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap gap-3">
              <select
                value={filterSendProject}
                onChange={(e) => setFilterSendProject(e.target.value)}
                className="bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-nesma-secondary/50"
              >
                <option value="">From Project</option>
                {sendProjects.map(p => <option key={p} value={p}>{p}</option>)}
              </select>

              <select
                value={filterRequestProject}
                onChange={(e) => setFilterRequestProject(e.target.value)}
                className="bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-nesma-secondary/50"
              >
                <option value="">To Project</option>
                {requestProjects.map(p => <option key={p} value={p}>{p}</option>)}
              </select>

              <select
                value={filterIssuedBy}
                onChange={(e) => setFilterIssuedBy(e.target.value)}
                className="bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-nesma-secondary/50"
              >
                <option value="">Warehouse</option>
                {issuedByList.map(w => <option key={w} value={w}>{w}</option>)}
              </select>

              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 px-3 py-2 text-red-400 hover:text-red-300 text-sm"
                >
                  <X size={14} />
                  Clear Filters
                </button>
              )}

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
                  <th className="px-6 py-4">Material</th>
                  <th className="px-6 py-4">Qty</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">From</th>
                  <th className="px-6 py-4">To</th>
                  <th className="px-6 py-4">Requester</th>
                  <th className="px-6 py-4">Warehouse</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm text-gray-300">
                {filteredData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 max-w-xs truncate" title={row.material}>{row.material}</td>
                    <td className="px-6 py-4 font-mono text-white">{row.qty}</td>
                    <td className="px-6 py-4 text-gray-400">{row.date}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-red-500/10 text-red-400 rounded text-xs">{row.sendProject}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded text-xs">{row.requestProject}</span>
                    </td>
                    <td className="px-6 py-4">{row.requestedBy}</td>
                    <td className="px-6 py-4 text-nesma-secondary">{row.issuedBy}</td>
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
              <div key={idx} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-white font-medium text-sm line-clamp-2">{row.material}</h3>
                  <span className="text-lg font-bold text-nesma-secondary ml-2">{row.qty}</span>
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <span className="px-2 py-1 bg-red-500/10 text-red-400 rounded text-xs">{row.sendProject}</span>
                  <ArrowRightLeft size={14} className="text-gray-500" />
                  <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 rounded text-xs">{row.requestProject}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>{row.requestedBy}</span>
                  <span>{row.issuedBy}</span>
                </div>
                <div className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                  <Calendar size={12} />
                  {row.date}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-white/5 flex justify-between items-center text-xs text-gray-400">
          <span>Showing {filteredData.length} of {SHIFTING_MATERIALS_DATA.length} records</span>
          <span>Shifting Materials Report</span>
        </div>
      </div>
    </div>
  );
};
