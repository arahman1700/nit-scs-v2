import React, { useState, useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { RefreshCw, Search, Filter, BarChart3, Package, TrendingUp } from 'lucide-react';
import { useAbcAnalysis, useAbcSummary, useRecalculateAbc } from '@/api/hooks';

const CLASS_COLORS = {
  A: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30', chart: '#10b981' },
  B: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30', chart: '#f59e0b' },
  C: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30', chart: '#3b82f6' },
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-SA', { style: 'currency', currency: 'SAR', maximumFractionDigits: 0 }).format(value);

export const AbcAnalysisPage: React.FC = () => {
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [filterClass, setFilterClass] = useState<string>('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const params = useMemo(
    () => ({
      page,
      pageSize,
      ...(filterClass && { abcClass: filterClass }),
      ...(search && { search }),
    }),
    [page, pageSize, filterClass, search],
  );

  const { data: listData, isLoading: listLoading } = useAbcAnalysis(params);
  const { data: summaryData, isLoading: summaryLoading } = useAbcSummary();
  const recalculate = useRecalculateAbc();

  const summary = summaryData?.data;
  const items = listData?.data ?? [];
  const meta = (listData as unknown as Record<string, unknown>)?.meta as
    | { page: number; pageSize: number; total: number; totalPages: number }
    | undefined;

  const pieData = summary
    ? [
        { name: 'Class A', value: summary.classA.totalValue, count: summary.classA.count },
        { name: 'Class B', value: summary.classB.totalValue, count: summary.classB.count },
        { name: 'Class C', value: summary.classC.totalValue, count: summary.classC.count },
      ]
    : [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleRecalculate = () => {
    recalculate.mutate(undefined);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">ABC Inventory Analysis</h1>
          <p className="text-sm text-gray-400 mt-1">
            Classify inventory items by annual consumption value (A=80%, B=15%, C=5%)
          </p>
        </div>
        <button
          onClick={handleRecalculate}
          disabled={recalculate.isPending}
          className="btn-primary flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm"
        >
          <RefreshCw className={`w-4 h-4 ${recalculate.isPending ? 'animate-spin' : ''}`} />
          {recalculate.isPending ? 'Recalculating...' : 'Recalculate'}
        </button>
      </div>

      {/* Summary Cards */}
      {summaryLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="glass-card rounded-2xl p-6 animate-pulse">
              <div className="h-4 bg-white/10 rounded w-20 mb-3" />
              <div className="h-8 bg-white/10 rounded w-16" />
            </div>
          ))}
        </div>
      ) : summary ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Class A */}
          <div className="glass-card rounded-2xl p-6 border border-emerald-500/20">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
              </div>
              <span className="text-sm font-medium text-gray-400">Class A Items</span>
            </div>
            <div className="text-2xl font-bold text-emerald-400">{summary.classA.count}</div>
            <div className="text-xs text-gray-500 mt-1">
              {summary.classA.percentOfItems}% of items | {summary.classA.percentOfValue}% of value
            </div>
            <div className="text-sm text-gray-400 mt-2">{formatCurrency(summary.classA.totalValue)}</div>
          </div>

          {/* Class B */}
          <div className="glass-card rounded-2xl p-6 border border-amber-500/20">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                <Package className="w-4 h-4 text-amber-400" />
              </div>
              <span className="text-sm font-medium text-gray-400">Class B Items</span>
            </div>
            <div className="text-2xl font-bold text-amber-400">{summary.classB.count}</div>
            <div className="text-xs text-gray-500 mt-1">
              {summary.classB.percentOfItems}% of items | {summary.classB.percentOfValue}% of value
            </div>
            <div className="text-sm text-gray-400 mt-2">{formatCurrency(summary.classB.totalValue)}</div>
          </div>

          {/* Class C */}
          <div className="glass-card rounded-2xl p-6 border border-blue-500/20">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-blue-400" />
              </div>
              <span className="text-sm font-medium text-gray-400">Class C Items</span>
            </div>
            <div className="text-2xl font-bold text-blue-400">{summary.classC.count}</div>
            <div className="text-xs text-gray-500 mt-1">
              {summary.classC.percentOfItems}% of items | {summary.classC.percentOfValue}% of value
            </div>
            <div className="text-sm text-gray-400 mt-2">{formatCurrency(summary.classC.totalValue)}</div>
          </div>

          {/* Total */}
          <div className="glass-card rounded-2xl p-6 border border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <Package className="w-4 h-4 text-gray-400" />
              </div>
              <span className="text-sm font-medium text-gray-400">Total</span>
            </div>
            <div className="text-2xl font-bold text-white">{summary.totalItems}</div>
            <div className="text-xs text-gray-500 mt-1">Classified items</div>
            <div className="text-sm text-gray-400 mt-2">{formatCurrency(summary.totalValue)}</div>
          </div>
        </div>
      ) : null}

      {/* Chart + Last calculated */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pie Chart */}
        <div className="glass-card rounded-2xl p-6 lg:col-span-1">
          <h2 className="text-lg font-semibold text-white mb-4">Value Distribution</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                >
                  <Cell fill={CLASS_COLORS.A.chart} />
                  <Cell fill={CLASS_COLORS.B.chart} />
                  <Cell fill={CLASS_COLORS.C.chart} />
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: '#1e293b',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    color: '#fff',
                  }}
                  formatter={value => formatCurrency(value as number)}
                />
                <Legend formatter={(value: string) => <span className="text-gray-300 text-sm">{value}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-gray-500">No data available</div>
          )}
          {summary?.lastCalculatedAt && (
            <p className="text-xs text-gray-500 text-center mt-2">
              Last calculated:{' '}
              {new Date(summary.lastCalculatedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </div>

        {/* Item Table */}
        <div className="glass-card rounded-2xl p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">Item Classification</h2>
            <div className="flex items-center gap-3">
              {/* Search */}
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="Search items..."
                  className="input-field w-56 pl-9 pr-3 py-2 text-sm rounded-xl"
                />
              </form>

              {/* Filter by class */}
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <select
                  value={filterClass}
                  onChange={e => {
                    setFilterClass(e.target.value);
                    setPage(1);
                  }}
                  className="input-field pl-9 pr-8 py-2 text-sm rounded-xl appearance-none"
                >
                  <option value="">All Classes</option>
                  <option value="A">Class A</option>
                  <option value="B">Class B</option>
                  <option value="C">Class C</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-3 px-3 text-gray-400 font-medium">Item Code</th>
                  <th className="text-left py-3 px-3 text-gray-400 font-medium">Description</th>
                  <th className="text-right py-3 px-3 text-gray-400 font-medium">Annual Value</th>
                  <th className="text-right py-3 px-3 text-gray-400 font-medium">Cumulative %</th>
                  <th className="text-center py-3 px-3 text-gray-400 font-medium">Class</th>
                </tr>
              </thead>
              <tbody>
                {listLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-white/5">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <td key={j} className="py-3 px-3">
                          <div className="h-4 bg-white/10 rounded animate-pulse" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      No items found. Run a recalculation to classify inventory.
                    </td>
                  </tr>
                ) : (
                  items.map(item => {
                    const colors = CLASS_COLORS[item.abcClass] || CLASS_COLORS.C;
                    return (
                      <tr key={item.itemId} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-3 px-3 text-white font-mono text-xs">{item.itemCode}</td>
                        <td className="py-3 px-3 text-gray-300 max-w-[300px] truncate">{item.itemDescription}</td>
                        <td className="py-3 px-3 text-right text-white">
                          {formatCurrency(item.annualConsumptionValue)}
                        </td>
                        <td className="py-3 px-3 text-right text-gray-300">{item.cumulativePercent}%</td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}
                          >
                            {item.abcClass}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
              <span className="text-xs text-gray-500">
                Showing {(meta.page - 1) * meta.pageSize + 1}
                {' - '}
                {Math.min(meta.page * meta.pageSize, meta.total)} of {meta.total} items
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-3 py-1.5 rounded-lg text-xs text-gray-300 border border-white/10 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-xs text-gray-400">
                  Page {meta.page} of {meta.totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(meta.totalPages, p + 1))}
                  disabled={page >= meta.totalPages}
                  className="px-3 py-1.5 rounded-lg text-xs text-gray-300 border border-white/10 hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
