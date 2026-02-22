import React, { useState, useMemo, useCallback } from 'react';
import { Search, Package, MapPin, Layers, BarChart3, X, Eye, AlertCircle, RefreshCw } from 'lucide-react';
import { ExportButton } from '@/components/ExportButton';
import { generateInventoryReportPdf } from '@/utils/pdfExport';
import { exportToExcel } from '@/lib/excelExport';
import { useInventory, useWarehouses } from '@/api/hooks/useMasterData';
import { useInventorySummary } from '@/api/hooks/useDashboard';
import { displayStr } from '@/utils/displayStr';

// ── Types for the API response shape ──────────────────────────────────────

interface InventoryRow {
  id: string;
  itemCode: string;
  description: string;
  category: string;
  warehouseName: string;
  warehouseCode: string;
  warehouseId: string;
  unit: string;
  qtyOnHand: number;
  qtyReserved: number;
  available: number;
  minLevel: number;
  reorderPoint: number;
  lastMovementDate: string | null;
}

/** Parse a single InventoryLevel API record into a flat display row */
function parseInventoryRow(raw: Record<string, unknown>): InventoryRow {
  const item = (raw.item as Record<string, unknown>) ?? {};
  const wh = (raw.warehouse as Record<string, unknown>) ?? {};
  const uom = (item.uom as Record<string, unknown>) ?? {};
  const qtyOnHand = Number(raw.qtyOnHand ?? 0);
  const qtyReserved = Number(raw.qtyReserved ?? 0);

  return {
    id: String(raw.id ?? ''),
    itemCode: String(item.itemCode ?? item.code ?? '-'),
    description: String(item.itemDescription ?? item.name ?? displayStr(item) ?? '-'),
    category: String(item.category ?? item.mainCategory ?? '-'),
    warehouseName: String(wh.warehouseName ?? displayStr(wh) ?? '-'),
    warehouseCode: String(wh.warehouseCode ?? '-'),
    warehouseId: String(raw.warehouseId ?? wh.id ?? ''),
    unit: String(uom.uomCode ?? uom.uomName ?? 'EA'),
    qtyOnHand,
    qtyReserved,
    available: qtyOnHand - qtyReserved,
    minLevel: Number(raw.minLevel ?? item.minStock ?? 0),
    reorderPoint: Number(raw.reorderPoint ?? item.reorderPoint ?? 0),
    lastMovementDate: raw.lastMovementDate ? String(raw.lastMovementDate) : null,
  };
}

const getStockStatus = (available: number, minLevel: number): { label: string; color: string } => {
  if (available <= 0) return { label: 'Out of Stock', color: 'bg-red-500/20 text-red-400 border-red-500/30' };
  if (minLevel > 0 && available <= minLevel)
    return { label: 'Low Stock', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' };
  if (minLevel > 0 && available <= minLevel * 2)
    return { label: 'Medium', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
  return { label: 'In Stock', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' };
};

export const InventoryDashboard: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterWarehouse, setFilterWarehouse] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [selectedItem, setSelectedItem] = useState<InventoryRow | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 50;

  // ── API hooks ─────────────────────────────────────────────────────────

  const inventoryQuery = useInventory({ page, pageSize, sortBy: 'updatedAt', sortDir: 'desc' } as Record<
    string,
    unknown
  >);
  const summaryQuery = useInventorySummary();
  const warehousesQuery = useWarehouses({ pageSize: 100 });

  const isLoading = inventoryQuery.isLoading;
  const isError = inventoryQuery.isError;

  // Parse raw API data into display rows
  const allRows: InventoryRow[] = useMemo(() => {
    const raw = (inventoryQuery.data?.data ?? []) as unknown as Record<string, unknown>[];
    return raw.map(parseInventoryRow);
  }, [inventoryQuery.data]);

  const meta = (inventoryQuery.data as Record<string, unknown> | undefined)?.meta as
    | { page: number; pageSize: number; total: number; totalPages: number }
    | undefined;

  // Warehouse list for the filter dropdown
  const warehouses = useMemo(() => {
    const raw = (warehousesQuery.data?.data ?? []) as unknown as Record<string, unknown>[];
    return raw.map(w => ({
      id: String(w.id),
      name: String(w.warehouseName ?? displayStr(w) ?? '-'),
    }));
  }, [warehousesQuery.data]);

  // Unique categories from current page
  const categories = useMemo(() => [...new Set(allRows.map(r => r.category).filter(c => c !== '-'))], [allRows]);

  // Client-side filtering (API doesn't support filter params for inventory)
  const filteredData = useMemo(() => {
    return allRows.filter(row => {
      const matchesSearch =
        !searchQuery ||
        row.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.itemCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesWarehouse = !filterWarehouse || row.warehouseId === filterWarehouse;
      const matchesCategory = !filterCategory || row.category === filterCategory;
      return matchesSearch && matchesWarehouse && matchesCategory;
    });
  }, [allRows, searchQuery, filterWarehouse, filterCategory]);

  // KPI data from the summary endpoint (or compute from current page as fallback)
  const summary = (summaryQuery.data?.data ?? null) as {
    totalItems: number;
    totalQty: number;
    lowStock: number;
    outOfStock: number;
    totalValue: number;
  } | null;

  const stats = useMemo(() => {
    if (summary) {
      return {
        totalItems: summary.totalItems,
        totalBalance: summary.totalQty,
        lowStock: summary.lowStock,
        outOfStock: summary.outOfStock,
        inStock: summary.totalItems - summary.lowStock - summary.outOfStock,
        totalValue: summary.totalValue,
      };
    }
    // Fallback: compute from the current visible page
    const lowStock = filteredData.filter(r => r.available > 0 && r.minLevel > 0 && r.available <= r.minLevel).length;
    const outOfStock = filteredData.filter(r => r.available <= 0).length;
    return {
      totalItems: meta?.total ?? filteredData.length,
      totalBalance: filteredData.reduce((acc, r) => acc + r.qtyOnHand, 0),
      lowStock,
      outOfStock,
      inStock: filteredData.length - lowStock - outOfStock,
      totalValue: 0,
    };
  }, [summary, filteredData, meta]);

  // ── Export handlers ───────────────────────────────────────────────────

  const handleExportPdf = useCallback(() => {
    const exportData = filteredData.map((r, i) => ({
      sn: i + 1,
      project: '-',
      itemCode: r.itemCode,
      description: r.description,
      size: '-',
      unit: r.unit,
      location: r.warehouseName,
      subLocation: '-',
      balance: r.qtyOnHand,
    }));
    generateInventoryReportPdf(exportData, 'Inventory Levels');
  }, [filteredData]);

  const handleExportExcel = useCallback(() => {
    const exportData = filteredData.map((r, i) => ({
      sn: i + 1,
      itemCode: r.itemCode,
      description: r.description,
      category: r.category,
      warehouse: r.warehouseName,
      unit: r.unit,
      onHand: r.qtyOnHand,
      reserved: r.qtyReserved,
      available: r.available,
      minLevel: r.minLevel,
    }));
    exportToExcel(
      exportData as unknown as Record<string, unknown>[],
      [
        { header: '#', key: 'sn' },
        { header: 'Item Code', key: 'itemCode' },
        { header: 'Description', key: 'description' },
        { header: 'Category', key: 'category' },
        { header: 'Warehouse', key: 'warehouse' },
        { header: 'Unit', key: 'unit' },
        { header: 'On Hand', key: 'onHand' },
        { header: 'Reserved', key: 'reserved' },
        { header: 'Available', key: 'available' },
        { header: 'Min Level', key: 'minLevel' },
      ],
      'Inventory_Levels',
    );
  }, [filteredData]);

  // ── Pagination helpers ────────────────────────────────────────────────

  const totalPages = meta?.totalPages ?? 1;
  const canPrev = page > 1;
  const canNext = page < totalPages;

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
            Real-time inventory levels across all warehouses
            {meta?.total != null && (
              <span className="text-gray-500 ml-2">({meta.total.toLocaleString()} total items)</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => inventoryQuery.refetch()}
            disabled={inventoryQuery.isFetching}
            className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
            title="Refresh data"
          >
            <RefreshCw size={16} className={inventoryQuery.isFetching ? 'animate-spin' : ''} />
          </button>
          <ExportButton onExportPdf={handleExportPdf} onExportExcel={handleExportExcel} />
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
              <p className="text-2xl font-bold text-white">
                {isLoading ? (
                  <span className="animate-pulse bg-white/10 rounded w-12 h-7 inline-block" />
                ) : (
                  stats.totalItems.toLocaleString()
                )}
              </p>
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
              <p className="text-2xl font-bold text-white">
                {isLoading ? (
                  <span className="animate-pulse bg-white/10 rounded w-16 h-7 inline-block" />
                ) : (
                  stats.totalBalance.toLocaleString()
                )}
              </p>
              <p className="text-xs text-gray-400">Total Qty on Hand</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl border border-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/20 rounded-lg">
              <BarChart3 size={20} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-400">
                {isLoading ? (
                  <span className="animate-pulse bg-white/10 rounded w-10 h-7 inline-block" />
                ) : (
                  stats.inStock
                )}
              </p>
              <p className="text-xs text-gray-400">In Stock</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl border border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <AlertCircle size={20} className="text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-400">
                {isLoading ? (
                  <span className="animate-pulse bg-white/10 rounded w-8 h-7 inline-block" />
                ) : (
                  stats.lowStock
                )}
              </p>
              <p className="text-xs text-gray-400">Low Stock</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-4 rounded-xl border border-red-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/20 rounded-lg">
              <AlertCircle size={20} className="text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-red-400">
                {isLoading ? (
                  <span className="animate-pulse bg-white/10 rounded w-8 h-7 inline-block" />
                ) : (
                  stats.outOfStock
                )}
              </p>
              <p className="text-xs text-gray-400">Out of Stock</p>
            </div>
          </div>
        </div>
      </div>

      {/* Error state */}
      {isError && (
        <div className="glass-card rounded-2xl p-6 border border-red-500/20 text-center">
          <AlertCircle size={32} className="text-red-400 mx-auto mb-3" />
          <p className="text-red-400 font-medium">Failed to load inventory data</p>
          <p className="text-gray-500 text-sm mt-1">Check your connection and try again</p>
          <button
            onClick={() => inventoryQuery.refetch()}
            className="mt-4 px-4 py-2 bg-nesma-primary text-white rounded-lg text-sm hover:bg-nesma-primary/80 transition-all"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filters & Table */}
      {!isError && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/10 bg-white/5">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search size={18} className="absolute top-1/2 -translate-y-1/2 left-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search code, description, category..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-nesma-secondary/50"
                />
              </div>

              {/* Filters */}
              <div className="flex flex-wrap gap-3">
                <select
                  value={filterWarehouse}
                  onChange={e => setFilterWarehouse(e.target.value)}
                  className="bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-nesma-secondary/50"
                >
                  <option value="">All Warehouses</option>
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>

                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  className="bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-gray-300 focus:outline-none focus:border-nesma-secondary/50"
                >
                  <option value="">All Categories</option>
                  {categories.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
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

          {/* Loading skeleton */}
          {isLoading && (
            <div className="p-4 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse flex gap-4">
                  <div className="bg-white/10 rounded h-5 w-24" />
                  <div className="bg-white/10 rounded h-5 flex-1" />
                  <div className="bg-white/10 rounded h-5 w-20" />
                  <div className="bg-white/10 rounded h-5 w-16" />
                  <div className="bg-white/10 rounded h-5 w-16" />
                </div>
              ))}
            </div>
          )}

          {/* Table View */}
          {!isLoading && viewMode === 'table' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="nesma-table-head text-nesma-secondary text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-4">#</th>
                    <th className="px-4 py-4">Code</th>
                    <th className="px-4 py-4">Description</th>
                    <th className="px-4 py-4">Category</th>
                    <th className="px-4 py-4">Warehouse</th>
                    <th className="px-4 py-4">Unit</th>
                    <th className="px-4 py-4 text-right">On Hand</th>
                    <th className="px-4 py-4 text-right">Reserved</th>
                    <th className="px-4 py-4 text-right">Available</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm text-gray-300">
                  {filteredData.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-12 text-center text-gray-500">
                        <Package size={32} className="mx-auto mb-3 text-gray-600" />
                        <p>No inventory records found</p>
                        {searchQuery && <p className="text-xs mt-1">Try adjusting your search or filters</p>}
                      </td>
                    </tr>
                  ) : (
                    filteredData.map((row, idx) => {
                      const status = getStockStatus(row.available, row.minLevel);
                      return (
                        <tr key={row.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 text-gray-500">{(page - 1) * pageSize + idx + 1}</td>
                          <td className="px-4 py-3 font-mono text-white text-xs">{row.itemCode}</td>
                          <td className="px-4 py-3 max-w-xs truncate" title={row.description}>
                            {row.description}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-nesma-primary/20 text-nesma-secondary rounded text-xs">
                              {row.category}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <MapPin size={12} />
                              {row.warehouseName}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs">{row.unit}</td>
                          <td className="px-4 py-3 text-right font-mono text-white">
                            {row.qtyOnHand.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-gray-400">
                            {row.qtyReserved.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-lg font-bold text-nesma-secondary">
                            {row.available.toLocaleString()}
                          </td>
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
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Grid View */}
          {!isLoading && viewMode === 'grid' && (
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredData.length === 0 ? (
                <div className="col-span-full text-center py-12 text-gray-500">
                  <Package size={32} className="mx-auto mb-3 text-gray-600" />
                  <p>No inventory records found</p>
                </div>
              ) : (
                filteredData.map(row => {
                  const status = getStockStatus(row.available, row.minLevel);
                  return (
                    <div
                      key={row.id}
                      className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all cursor-pointer"
                      onClick={() => setSelectedItem(row)}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <span className="px-2 py-1 bg-nesma-primary/20 text-nesma-secondary rounded text-xs">
                          {row.category}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs border ${status.color}`}>{status.label}</span>
                      </div>
                      <p className="text-white font-medium text-sm mb-1 line-clamp-2">{row.description}</p>
                      <p className="text-gray-400 text-xs mb-3 font-mono">{row.itemCode}</p>
                      <div className="flex justify-between items-end">
                        <div>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <MapPin size={10} />
                            {row.warehouseName}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5">Reserved: {row.qtyReserved.toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold text-white">{row.available.toLocaleString()}</p>
                          <p className="text-xs text-gray-400">{row.unit}</p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Footer with pagination */}
          <div className="p-4 border-t border-white/10 bg-white/5 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-gray-400">
            <span>
              Showing {filteredData.length} of {meta?.total ?? filteredData.length} items
              {filterWarehouse || filterCategory || searchQuery ? ' (filtered)' : ''}
            </span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={!canPrev}
                  className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  Previous
                </button>
                <span className="text-gray-300">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={!canNext}
                  className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedItem(null)}
        >
          <div
            className="glass-card w-full max-w-lg rounded-2xl overflow-hidden border border-white/10 bg-nesma-dark"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-white/10 bg-white/5 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Item Details</h3>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
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
                  <p className="text-xs text-gray-400 mb-1">Category</p>
                  <p className="text-nesma-secondary">{selectedItem.category}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-1">Description</p>
                <p className="text-white">{selectedItem.description}</p>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">Warehouse</p>
                  <p className="text-white text-sm">{selectedItem.warehouseName}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Unit</p>
                  <p className="text-white">{selectedItem.unit}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 mb-1">Min Level</p>
                  <p className="text-white">{selectedItem.minLevel || '-'}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">On Hand</p>
                  <p className="text-2xl font-bold text-white">{selectedItem.qtyOnHand.toLocaleString()}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 text-center">
                  <p className="text-xs text-gray-400 mb-1">Reserved</p>
                  <p className="text-2xl font-bold text-amber-400">{selectedItem.qtyReserved.toLocaleString()}</p>
                </div>
                <div className="bg-nesma-primary/10 rounded-xl p-3 text-center border border-nesma-primary/20">
                  <p className="text-xs text-gray-400 mb-1">Available</p>
                  <p className="text-2xl font-bold text-nesma-secondary">{selectedItem.available.toLocaleString()}</p>
                </div>
              </div>
              {selectedItem.lastMovementDate && (
                <div className="text-xs text-gray-500 text-center pt-2">
                  Last movement: {new Date(selectedItem.lastMovementDate).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
